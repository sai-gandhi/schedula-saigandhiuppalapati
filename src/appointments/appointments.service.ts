import {
  Injectable, NotFoundException,
  BadRequestException, ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from './appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { Slot, SlotStatus, SlotType } from '../slots/slot.entity';
import { DoctorProfile } from '../doctor/doctor.entity';
import { PatientProfile } from '../patient/patient.entity';
import { DoctorService } from '../doctor/doctor.service';

const CUTOFF_MINUTES = 30;

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(Slot)
    private slotRepo: Repository<Slot>,
    private doctorService: DoctorService,
  ) {}

  private trimTime(time: string): string {
    return time.substring(0, 5);
  }

  private isFutureDateTime(date: string, time: string): boolean {
    const now = new Date();
    const target = new Date(`${date}T${time}:00`);
    return target > now;
  }

  private minutesUntil(date: string, time: string): number {
    const now = new Date();
    const target = new Date(`${date}T${time}:00`);
    return (target.getTime() - now.getTime()) / 60000;
  }

  private isValidUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  private addDays(date: string, days: number): string {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  // ── Booking (Day 8/9, unchanged) ──────────────────────────

  async create(
    patient: PatientProfile,
    dto: CreateAppointmentDto,
  ): Promise<Appointment> {
    const doctor = await this.doctorService.findById(dto.doctorId);

    if (!this.isFutureDateTime(dto.date, dto.startTime)) {
      throw new BadRequestException(
        'Cannot book appointment for past date/time',
      );
    }

    const slot = await this.slotRepo.findOne({
      where: {
        doctor: { id: doctor.id },
        date: dto.date,
        startTime: dto.startTime + ':00',
        endTime: dto.endTime + ':00',
      },
    });

    if (!slot) {
      throw new NotFoundException('Slot not found');
    }

    if (slot.slotType === SlotType.WAVE) {
      return this.bookWaveAppointment(patient, doctor, slot, dto);
    }

    return this.bookStreamAppointment(patient, doctor, slot, dto);
  }

  private async bookStreamAppointment(
    patient: PatientProfile,
    doctor: DoctorProfile,
    slot: Slot,
    dto: { date: string; startTime: string; endTime: string },
  ): Promise<Appointment> {
    if (slot.status !== SlotStatus.AVAILABLE) {
      throw new ConflictException('Slot is already booked');
    }

    const existingAppointment = await this.appointmentRepo.findOne({
      where: {
        doctor: { id: doctor.id },
        date: dto.date,
        startTime: dto.startTime + ':00',
        status: AppointmentStatus.BOOKED,
      },
    });

    if (existingAppointment) {
      throw new ConflictException('This slot is already booked');
    }

    slot.status = SlotStatus.BOOKED;
    await this.slotRepo.save(slot);

    const appointment = this.appointmentRepo.create({
      doctor,
      patient,
      slot,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      status: AppointmentStatus.BOOKED,
      schedulingType: 'STREAM',
    });

    return this.appointmentRepo.save(appointment);
  }

  private async bookWaveAppointment(
    patient: PatientProfile,
    doctor: DoctorProfile,
    slot: Slot,
    dto: { date: string; startTime: string; endTime: string },
  ): Promise<Appointment> {
    if (slot.bookedCount >= slot.maxCapacity) {
      throw new ConflictException(
        `Wave is full! Maximum capacity of ${slot.maxCapacity} patients reached`,
      );
    }

    const existingWaveBooking = await this.appointmentRepo.findOne({
      where: {
        patient: { id: patient.id },
        slot: { id: slot.id },
        status: AppointmentStatus.BOOKED,
      },
    });

    if (existingWaveBooking) {
      throw new ConflictException('You have already booked this wave window');
    }

    const tokenNumber = slot.bookedCount + 1;
    slot.bookedCount = tokenNumber;

    if (slot.bookedCount >= slot.maxCapacity) {
      slot.status = SlotStatus.BOOKED;
    }
    await this.slotRepo.save(slot);

    const appointment = this.appointmentRepo.create({
      doctor,
      patient,
      slot,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      status: AppointmentStatus.BOOKED,
      schedulingType: 'WAVE',
      tokenNumber,
    });

    return this.appointmentRepo.save(appointment);
  }

  // ── Shared views ──────────────────────────────────────────

  async getMyAppointments(patient: PatientProfile): Promise<Appointment[]> {
    return this.appointmentRepo.find({
      where: { patient: { id: patient.id } },
      relations: { doctor: true },
      order: { date: 'DESC', startTime: 'DESC' },
    });
  }

  async getDoctorAppointments(doctor: DoctorProfile): Promise<Appointment[]> {
    return this.appointmentRepo.find({
      where: { doctor: { id: doctor.id } },
      relations: { patient: true },
      order: { date: 'DESC', startTime: 'DESC' },
    });
  }

  // ── Cancel (updated with 30-min cutoff) ──────────────────

  async cancel(patient: PatientProfile, id: string): Promise<Appointment> {
    if (!this.isValidUUID(id)) {
      throw new NotFoundException('Appointment not found');
    }

    const appointment = await this.appointmentRepo.findOne({
      where: { id },
      relations: { patient: true, doctor: true, slot: true },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.patient.id !== patient.id) {
      throw new ForbiddenException('You can only cancel your own appointments');
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Appointment is already cancelled');
    }

    const trimmedStart = this.trimTime(appointment.startTime);

    if (!this.isFutureDateTime(appointment.date, trimmedStart)) {
      throw new BadRequestException('Cannot cancel past appointments');
    }

    if (this.minutesUntil(appointment.date, trimmedStart) < CUTOFF_MINUTES) {
      throw new BadRequestException(
        `Cannot cancel - less than ${CUTOFF_MINUTES} minutes remaining before appointment`,
      );
    }

    appointment.status = AppointmentStatus.CANCELLED;
    const updated = await this.appointmentRepo.save(appointment);

    if (appointment.slot) {
      const slot = appointment.slot;

      if (slot.slotType === SlotType.WAVE) {
        slot.bookedCount = Math.max(0, slot.bookedCount - 1);
        slot.status = SlotStatus.AVAILABLE;
      } else {
        slot.status = SlotStatus.AVAILABLE;
      }

      await this.slotRepo.save(slot);
    }

    return updated;
  }

  // ── Reschedule ────────────────────────────────────────────

  async reschedule(
    patient: PatientProfile,
    id: string,
    dto: RescheduleAppointmentDto,
  ): Promise<{ appointment: Appointment; suggestion?: any }> {
    if (!this.isValidUUID(id)) {
      throw new NotFoundException('Appointment not found');
    }

    const appointment = await this.appointmentRepo.findOne({
      where: { id },
      relations: { patient: true, doctor: true, slot: true },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.patient.id !== patient.id) {
      throw new ForbiddenException('You can only reschedule your own appointments');
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Cannot reschedule a cancelled appointment');
    }

    const trimmedOldStart = this.trimTime(appointment.startTime);

    if (this.minutesUntil(appointment.date, trimmedOldStart) < CUTOFF_MINUTES) {
      throw new BadRequestException(
        `Cannot reschedule - less than ${CUTOFF_MINUTES} minutes remaining before appointment`,
      );
    }

    if (!this.isFutureDateTime(dto.date, dto.startTime)) {
      throw new BadRequestException('Cannot reschedule to a past date/time');
    }

    const isSameSlot =
      appointment.date === dto.date &&
      trimmedOldStart === dto.startTime;

    if (isSameSlot) {
      throw new BadRequestException(
        'New slot is the same as the current appointment slot',
      );
    }

    const doctor = appointment.doctor;
    const oldSlot = appointment.slot;

    const newSlot = await this.slotRepo.findOne({
      where: {
        doctor: { id: doctor.id },
        date: dto.date,
        startTime: dto.startTime + ':00',
        endTime: dto.endTime + ':00',
      },
    });

    if (!newSlot) {
      const suggestion = await this.findNextAvailable(doctor.id, dto.date);
      throw new ConflictException({
        message: 'Requested slot unavailable',
        suggestion,
      });
    }

    if (newSlot.slotType === SlotType.WAVE) {
      return this.rescheduleToWave(appointment, oldSlot, newSlot, dto);
    }

    return this.rescheduleToStream(appointment, oldSlot, newSlot, dto);
  }

  private async rescheduleToStream(
    appointment: Appointment,
    oldSlot: Slot,
    newSlot: Slot,
    dto: RescheduleAppointmentDto,
  ): Promise<{ appointment: Appointment }> {
    if (newSlot.status !== SlotStatus.AVAILABLE) {
      const suggestion = await this.findNextAvailable(
        appointment.doctor.id, dto.date,
      );
      throw new ConflictException({
        message: 'Requested slot already booked',
        suggestion,
      });
    }

    const duplicateBooking = await this.appointmentRepo.findOne({
      where: {
        doctor: { id: appointment.doctor.id },
        date: dto.date,
        startTime: dto.startTime + ':00',
        status: AppointmentStatus.BOOKED,
      },
    });

    if (duplicateBooking) {
      const suggestion = await this.findNextAvailable(
        appointment.doctor.id, dto.date,
      );
      throw new ConflictException({
        message: 'Requested slot already booked',
        suggestion,
      });
    }

    // Release old slot
    if (oldSlot) {
      if (oldSlot.slotType === SlotType.WAVE) {
        oldSlot.bookedCount = Math.max(0, oldSlot.bookedCount - 1);
        oldSlot.status = SlotStatus.AVAILABLE;
      } else {
        oldSlot.status = SlotStatus.AVAILABLE;
      }
      await this.slotRepo.save(oldSlot);
    }

    // Reserve new slot
    newSlot.status = SlotStatus.BOOKED;
    await this.slotRepo.save(newSlot);

    appointment.slot = newSlot;
    appointment.date = dto.date;
    appointment.startTime = dto.startTime;
    appointment.endTime = dto.endTime;
    appointment.schedulingType = 'STREAM';
    appointment.tokenNumber = null;

    const updated = await this.appointmentRepo.save(appointment);
    return { appointment: updated };
  }

  private async rescheduleToWave(
    appointment: Appointment,
    oldSlot: Slot,
    newSlot: Slot,
    dto: RescheduleAppointmentDto,
  ): Promise<{ appointment: Appointment }> {
    if (newSlot.bookedCount >= newSlot.maxCapacity) {
      const suggestion = await this.findNextAvailable(
        appointment.doctor.id, dto.date,
      );
      throw new ConflictException({
        message: 'Requested wave is full',
        suggestion,
      });
    }

    const duplicateWaveBooking = await this.appointmentRepo.findOne({
      where: {
        patient: { id: appointment.patient.id },
        slot: { id: newSlot.id },
        status: AppointmentStatus.BOOKED,
      },
    });

    if (duplicateWaveBooking) {
      throw new ConflictException(
        'You have already booked this wave window',
      );
    }

    // Release old slot
    if (oldSlot) {
      if (oldSlot.slotType === SlotType.WAVE) {
        oldSlot.bookedCount = Math.max(0, oldSlot.bookedCount - 1);
        oldSlot.status = SlotStatus.AVAILABLE;
      } else {
        oldSlot.status = SlotStatus.AVAILABLE;
      }
      await this.slotRepo.save(oldSlot);
    }

    // Reserve new wave slot - assign new token
    const tokenNumber = newSlot.bookedCount + 1;
    newSlot.bookedCount = tokenNumber;
    if (newSlot.bookedCount >= newSlot.maxCapacity) {
      newSlot.status = SlotStatus.BOOKED;
    }
    await this.slotRepo.save(newSlot);

    appointment.slot = newSlot;
    appointment.date = dto.date;
    appointment.startTime = dto.startTime;
    appointment.endTime = dto.endTime;
    appointment.schedulingType = 'WAVE';
    appointment.tokenNumber = tokenNumber;

    const updated = await this.appointmentRepo.save(appointment);
    return { appointment: updated };
  }

  // ── Suggest next available slot/wave ────────────────────

  private async findNextAvailable(
    doctorId: string,
    fromDate: string,
    maxDaysToSearch: number = 30,
  ): Promise<any> {
    for (let i = 0; i <= maxDaysToSearch; i++) {
      const checkDate = i === 0 ? fromDate : this.addDays(fromDate, i);

      const slots = await this.slotRepo
        .createQueryBuilder('slot')
        .where('slot.doctorId = :doctorId', { doctorId })
        .andWhere('slot.date = :date', { date: checkDate })
        .orderBy('slot.startTime', 'ASC')
        .getMany();

      if (slots.length === 0) continue;

      // STREAM: first AVAILABLE + future slot
      const availableStream = slots.find(
        (s) =>
          s.slotType === SlotType.STREAM &&
          s.status === SlotStatus.AVAILABLE &&
          this.isFutureDateTime(checkDate, this.trimTime(s.startTime)),
      );

      if (availableStream) {
        return {
          date: checkDate,
          startTime: this.trimTime(availableStream.startTime),
          endTime: this.trimTime(availableStream.endTime),
          schedulingType: 'STREAM',
        };
      }

      // WAVE: first window with available capacity
      const availableWave = slots.find(
        (s) =>
          s.slotType === SlotType.WAVE &&
          s.bookedCount < s.maxCapacity &&
          this.isFutureDateTime(checkDate, this.trimTime(s.startTime)),
      );

      if (availableWave) {
        return {
          date: checkDate,
          timeWindow: `${this.trimTime(availableWave.startTime)} - ${this.trimTime(availableWave.endTime)}`,
          availableCapacity: availableWave.maxCapacity - availableWave.bookedCount,
          schedulingType: 'WAVE',
        };
      }
    }

    return null;
  }
}