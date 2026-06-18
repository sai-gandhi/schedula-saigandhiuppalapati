import {
  Injectable, NotFoundException,
  BadRequestException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Slot, SlotStatus, SlotType } from '../slots/slot.entity';
import { DoctorProfile, SchedulingType } from '../doctor/doctor.entity';
import { SetSchedulingTypeDto } from './dto/set-scheduling-type.dto';
import { GenerateStreamSlotsDto } from './dto/generate-stream-slots.dto';
import { GenerateWaveSlotsDto } from './dto/generate-wave-slots.dto';
import { DoctorService } from '../doctor/doctor.service';
import { AvailabilityService } from '../availability/availability.service';

@Injectable()
export class SchedulingService {
  constructor(
    @InjectRepository(Slot)
    private slotRepo: Repository<Slot>,
    private doctorService: DoctorService,
    private availabilityService: AvailabilityService,
  ) {}

  private trimTime(time: string): string {
    return time.substring(0, 5);
  }

  private isPastDate(date: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date + 'T00:00:00');
    targetDate.setHours(0, 0, 0, 0);
    return targetDate < today;
  }

  async setSchedulingType(
    doctor: DoctorProfile,
    dto: SetSchedulingTypeDto,
  ): Promise<DoctorProfile> {
    // Conflicting schedule check: block switching scheduling type while
    // the doctor has active future bookings under the current type,
    // since that would silently orphan/break those appointments.
    if (dto.schedulingType !== doctor.schedulingType) {
      const today = new Date().toISOString().split('T')[0];

      const activeBookings = await this.slotRepo
        .createQueryBuilder('slot')
        .where('slot.doctorId = :doctorId', { doctorId: doctor.id })
        .andWhere('slot.date >= :today', { today })
        .andWhere(
          '(slot.status = :booked OR slot.bookedCount > 0)',
          { booked: SlotStatus.BOOKED },
        )
        .getCount();

      if (activeBookings > 0) {
        throw new ConflictException(
          'Cannot change scheduling type while there are active future bookings. Resolve existing appointments first.',
        );
      }
    }

    doctor.schedulingType = dto.schedulingType;
    return this.doctorService.save(doctor);
  }

  // ── STREAM Scheduling ────────────────────────────────────

  async generateStreamSlots(
    doctor: DoctorProfile,
    dto: GenerateStreamSlotsDto,
  ): Promise<Slot[]> {
    if (doctor.schedulingType !== SchedulingType.STREAM) {
      throw new BadRequestException(
        'Doctor scheduling type is not set to STREAM',
      );
    }

    if (this.isPastDate(dto.date)) {
      throw new BadRequestException('Cannot generate slots for past dates');
    }

    // Conflicting schedule check: block regenerating slots for a date
    // that already has active bookings, to avoid silently invalidating
    // existing appointments via the delete-and-regenerate step below.
    const existingBookedSlots = await this.slotRepo.count({
      where: {
        doctor: { id: doctor.id },
        date: dto.date,
        status: SlotStatus.BOOKED,
      },
    });

    if (existingBookedSlots > 0) {
      throw new ConflictException(
        'Cannot regenerate slots for this date - existing bookings would be invalidated. Cancel or reschedule them first.',
      );
    }

    const availability = await this.availabilityService.getByDate(
      doctor, dto.date,
    );

    if (!availability.slots || availability.slots.length === 0) {
      throw new NotFoundException('No availability found for this date');
    }

    if (availability.hasCustomOverride) {
      const isUnavailable = availability.slots.some(
        (s: any) => s.isUnavailable,
      );
      if (isUnavailable) {
        throw new NotFoundException('Doctor is unavailable on this date');
      }
    }

    await this.slotRepo.delete({
      doctor: { id: doctor.id },
      date: dto.date,
    });

    const duration = Number(dto.duration);
    const buffer = Number(dto.bufferTime) || 0;
    const generatedSlots: Slot[] = [];

    for (const avail of availability.slots) {
      const start = this.trimTime(avail.startTime);
      const end = this.trimTime(avail.endTime);

      const [startH, startM] = start.split(':').map(Number);
      const [endH, endM] = end.split(':').map(Number);

      let current = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      while (current + duration <= endMinutes) {
        const slotStart = `${String(Math.floor(current / 60)).padStart(2, '0')}:${String(current % 60).padStart(2, '0')}`;
        const slotEndMinutes = current + duration;
        const slotEnd = `${String(Math.floor(slotEndMinutes / 60)).padStart(2, '0')}:${String(slotEndMinutes % 60).padStart(2, '0')}`;

        const slot = this.slotRepo.create({
          doctor,
          date: dto.date,
          startTime: slotStart,
          endTime: slotEnd,
          status: SlotStatus.AVAILABLE,
          duration,
          slotType: SlotType.STREAM,
        });
        generatedSlots.push(slot);

        current = slotEndMinutes + buffer;
      }
    }

    return this.slotRepo.save(generatedSlots);
  }

  // ── WAVE Scheduling ──────────────────────────────────────

  async generateWaveSlots(
    doctor: DoctorProfile,
    dto: GenerateWaveSlotsDto,
  ): Promise<Slot[]> {
    if (doctor.schedulingType !== SchedulingType.WAVE) {
      throw new BadRequestException(
        'Doctor scheduling type is not set to WAVE',
      );
    }

    if (this.isPastDate(dto.date)) {
      throw new BadRequestException('Cannot generate slots for past dates');
    }

    // Conflicting schedule check: block regenerating wave slots for a
    // date that already has active bookings (bookedCount > 0), to avoid
    // silently invalidating existing appointments via delete-and-regenerate.
    const existingBookings = await this.slotRepo
      .createQueryBuilder('slot')
      .where('slot.doctorId = :doctorId', { doctorId: doctor.id })
      .andWhere('slot.date = :date', { date: dto.date })
      .andWhere('slot.bookedCount > 0')
      .getCount();

    if (existingBookings > 0) {
      throw new ConflictException(
        'Cannot regenerate wave slots for this date - existing bookings would be invalidated. Cancel or reschedule them first.',
      );
    }

    const availability = await this.availabilityService.getByDate(
      doctor, dto.date,
    );

    if (!availability.slots || availability.slots.length === 0) {
      throw new NotFoundException('No availability found for this date');
    }

    if (availability.hasCustomOverride) {
      const isUnavailable = availability.slots.some(
        (s: any) => s.isUnavailable,
      );
      if (isUnavailable) {
        throw new NotFoundException('Doctor is unavailable on this date');
      }
    }

    await this.slotRepo.delete({
      doctor: { id: doctor.id },
      date: dto.date,
    });

    const generatedWaves: Slot[] = [];

    for (const avail of availability.slots) {
      const start = this.trimTime(avail.startTime);
      const end = this.trimTime(avail.endTime);

      const wave = this.slotRepo.create({
        doctor,
        date: dto.date,
        startTime: start,
        endTime: end,
        status: SlotStatus.AVAILABLE,
        slotType: SlotType.WAVE,
        maxCapacity: Number(dto.maxCapacity),
        bookedCount: 0,
      });
      generatedWaves.push(wave);
    }

    return this.slotRepo.save(generatedWaves);
  }

  // ── Patient View ─────────────────────────────────────────

  async getScheduledSlots(doctorId: string, date: string) {
    if (!date) throw new BadRequestException('Date is required');

    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    if (this.isPastDate(date)) {
      throw new BadRequestException('Cannot fetch slots for past dates');
    }

    const doctor = await this.doctorService.findById(doctorId);

    const allSlots = await this.slotRepo
      .createQueryBuilder('slot')
      .where('slot.doctorId = :doctorId', { doctorId })
      .andWhere('slot.date = :date', { date })
      .orderBy('slot.startTime', 'ASC')
      .getMany();

    if (doctor.schedulingType === SchedulingType.STREAM) {
      const availableSlots = allSlots.filter(
        (s) => s.status === SlotStatus.AVAILABLE,
      );
      return {
        doctorId,
        date,
        schedulingType: 'STREAM',
        slots: availableSlots.map((s) => ({
          id: s.id,
          startTime: this.trimTime(s.startTime),
          endTime: this.trimTime(s.endTime),
        })),
        total: availableSlots.length,
      };
    }

    return {
      doctorId,
      date,
      schedulingType: 'WAVE',
      waves: allSlots.map((s) => ({
        id: s.id,
        timeWindow: `${this.trimTime(s.startTime)} - ${this.trimTime(s.endTime)}`,
        available: s.maxCapacity - s.bookedCount,
        maxCapacity: s.maxCapacity,
        isFull: s.bookedCount >= s.maxCapacity,
      })),
      total: allSlots.length,
    };
  }
}