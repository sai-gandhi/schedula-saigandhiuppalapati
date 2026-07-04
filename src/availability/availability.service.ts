import {
  Injectable, BadRequestException,
  NotFoundException, ConflictException,
  Inject, forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecurringAvailability } from './recurring-availability.entity';
import { CustomAvailability } from './custom-availability.entity';
import { CreateRecurringDto } from './dto/create-recurring.dto';
import { UpdateRecurringDto } from './dto/update-recurring.dto';
import { CreateOverrideDto } from './dto/create-override.dto';
import { DoctorProfile } from '../doctor/doctor.entity';
import { SlotsService } from '../slots/slots.service';
import { Appointment, AppointmentStatus } from '../appointments/appointment.entity';
import { Slot, SlotStatus, SlotType } from '../slots/slot.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(RecurringAvailability)
    private recurringRepo: Repository<RecurringAvailability>,
    @InjectRepository(CustomAvailability)
    private customRepo: Repository<CustomAvailability>,
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(Slot)
    private slotRepo: Repository<Slot>,
    @Inject(forwardRef(() => SlotsService))
    private slotsService: SlotsService,
    private notificationsService: NotificationsService,
  ) {}

  private isValidTimeRange(start: string, end: string): boolean {
    return start < end;
  }

  private hasOverlap(
    start1: string, end1: string,
    start2: string, end2: string,
  ): boolean {
    return start1 < end2 && start2 < end1;
  }

  private async autoGenerateSlots(
    doctor: DoctorProfile,
    dayOfWeek: string,
    duration: number = 30,
  ): Promise<void> {
    const today = new Date();
    const next30Days = 30;

    console.log(`Auto generating slots for ${dayOfWeek} for next ${next30Days} days...`);

    for (let i = 0; i < next30Days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      const day = date
        .toLocaleDateString('en-US', { weekday: 'long' })
        .toUpperCase();

      if (day === dayOfWeek) {
        const dateStr = date.toISOString().split('T')[0];
        console.log(`Slots will be generated on demand for ${dateStr}`);
      }
    }

    console.log(`Auto slot generation complete for ${dayOfWeek}`);
  }

  // ── Recurring Availability ───────────────────────────────

  async createRecurring(
    doctor: DoctorProfile,
    dto: CreateRecurringDto,
  ): Promise<RecurringAvailability> {
    if (!this.isValidTimeRange(dto.startTime, dto.endTime)) {
      throw new BadRequestException('End time must be after start time');
    }

    const existing = await this.recurringRepo.find({
      where: { doctor: { id: doctor.id }, dayOfWeek: dto.dayOfWeek },
    });

    for (const slot of existing) {
      if (this.hasOverlap(dto.startTime, dto.endTime, slot.startTime, slot.endTime)) {
        throw new ConflictException(
          `Time slot overlaps with existing slot: ${slot.startTime} - ${slot.endTime}`,
        );
      }
    }

    const availability = this.recurringRepo.create({ ...dto, doctor });
    const saved = await this.recurringRepo.save(availability);

    try {
      console.log('Calling autoGenerateSlots...');
      await this.autoGenerateSlots(doctor, dto.dayOfWeek);
      console.log('autoGenerateSlots completed successfully');
    } catch (error) {
      console.error('Auto generate slots failed:', error.message);
    }

    return saved;
  }

  async getRecurring(doctor: DoctorProfile): Promise<RecurringAvailability[]> {
    return this.recurringRepo.find({
      where: { doctor: { id: doctor.id } },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async updateRecurring(
    doctor: DoctorProfile,
    id: string,
    dto: UpdateRecurringDto,
  ): Promise<RecurringAvailability> {
    const slot = await this.recurringRepo.findOne({
      where: { id, doctor: { id: doctor.id } },
    });
    if (!slot) throw new NotFoundException('Availability slot not found');

    const startTime = dto.startTime || slot.startTime;
    const endTime = dto.endTime || slot.endTime;

    if (!this.isValidTimeRange(startTime, endTime)) {
      throw new BadRequestException('End time must be after start time');
    }

    const existing = await this.recurringRepo.find({
      where: {
        doctor: { id: doctor.id },
        dayOfWeek: dto.dayOfWeek || slot.dayOfWeek,
      },
    });

    for (const s of existing) {
      if (s.id === id) continue;
      if (this.hasOverlap(startTime, endTime, s.startTime, s.endTime)) {
        throw new ConflictException(
          `Time slot overlaps with existing slot: ${s.startTime} - ${s.endTime}`,
        );
      }
    }

    Object.assign(slot, dto);
    const updated = await this.recurringRepo.save(slot);

    try {
      await this.autoGenerateSlots(doctor, updated.dayOfWeek);
    } catch (error) {
      console.error('Auto generate slots failed:', error.message);
    }

    return updated;
  }

  async deleteRecurring(doctor: DoctorProfile, id: string): Promise<void> {
    const slot = await this.recurringRepo.findOne({
      where: { id, doctor: { id: doctor.id } },
    });
    if (!slot) throw new NotFoundException('Availability slot not found');
    await this.recurringRepo.remove(slot);
  }

  // ── Custom Override ──────────────────────────────────────

  async createOverride(
    doctor: DoctorProfile,
    dto: CreateOverrideDto,
  ): Promise<{
    override: CustomAvailability;
    cancelledAppointments: number;
    message: string;
  }> {
    if (!dto.isUnavailable) {
      if (!dto.startTime || !dto.endTime) {
        throw new BadRequestException(
          'startTime and endTime are required when not marking as unavailable',
        );
      }
      if (!this.isValidTimeRange(dto.startTime, dto.endTime)) {
        throw new BadRequestException('End time must be after start time');
      }

      const existing = await this.customRepo.find({
        where: { doctor: { id: doctor.id }, date: dto.date },
      });

      for (const slot of existing) {
        if (this.hasOverlap(
          dto.startTime, dto.endTime,
          slot.startTime, slot.endTime,
        )) {
          throw new ConflictException(
            `Time slot overlaps with existing override: ${slot.startTime} - ${slot.endTime}`,
          );
        }
      }
    }

    // ── Find existing appointments for this date ──────────
    const existingAppointments = await this.appointmentRepo.find({
      where: {
        doctor: { id: doctor.id },
        date: dto.date,
        status: AppointmentStatus.BOOKED,
      },
      relations: { patient: true, slot: true },
    });

    // Determine conflicting appointments
    const conflictingAppointments = dto.isUnavailable
      ? existingAppointments
      : existingAppointments.filter((appt) => {
          if (!dto.startTime || !dto.endTime) return false;
          const apptStart = appt.startTime.substring(0, 5);
          return apptStart < dto.startTime || apptStart >= dto.endTime;
        });

    // ── Auto-cancel conflicting appointments ──────────────
    let cancelledCount = 0;

    for (const appt of conflictingAppointments) {
      appt.status = AppointmentStatus.CANCELLED;
      await this.appointmentRepo.save(appt);

      // Release the slot
      if (appt.slot) {
        const slot = await this.slotRepo.findOneBy({ id: appt.slot.id });
        if (slot) {
          if (slot.slotType === SlotType.WAVE) {
            slot.bookedCount = Math.max(0, slot.bookedCount - 1);
          }
          slot.status = SlotStatus.AVAILABLE;
          await this.slotRepo.save(slot);
        }
      }

      // Notify patient
      await this.notificationsService.createNotification(
        appt.patient,
        'Appointment Cancelled — Availability Changed',
        `Your appointment with ${doctor.fullName} on ${appt.date} at ${appt.startTime.substring(0, 5)} has been cancelled because the doctor updated their availability. Please book another appointment.`,
        NotificationType.APPOINTMENT_CANCELLED,
      );

      cancelledCount++;
    }

    // ── Save the override ─────────────────────────────────
    const override = this.customRepo.create({ ...dto, doctor });
    const saved = await this.customRepo.save(override);

    console.log(`Override saved for ${dto.date} — slots will be generated on demand`);

    const message = cancelledCount > 0
      ? `Override created. ${cancelledCount} conflicting appointment(s) were automatically cancelled and patients have been notified.`
      : 'Override created successfully. No existing appointments were affected.';

    return {
      override: saved,
      cancelledAppointments: cancelledCount,
      message,
    };
  }

  async getByDate(
    doctor: DoctorProfile,
    date: string,
  ): Promise<{
    date: string;
    hasCustomOverride: boolean;
    slots: any[];
  }> {
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    const customSlots = await this.customRepo.find({
      where: { doctor: { id: doctor.id }, date },
    });

    if (customSlots.length > 0) {
      return { date, hasCustomOverride: true, slots: customSlots };
    }

    const dayOfWeek = new Date(date + 'T00:00:00')
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toUpperCase();

    const recurringSlots = await this.recurringRepo.find({
      where: {
        doctor: { id: doctor.id },
        dayOfWeek: dayOfWeek as any,
      },
    });

    return {
      date,
      hasCustomOverride: false,
      slots: recurringSlots,
    };
  }
}