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
import { DoctorProfile, SchedulingType } from '../doctor/doctor.entity';
import { PatientProfile } from '../patient/patient.entity';
import { DoctorService } from '../doctor/doctor.service';
import { NextAvailableDto } from './dto/next-available.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';

const CUTOFF_MINUTES = 30;

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(Slot)
    private slotRepo: Repository<Slot>,
    private doctorService: DoctorService,
    private notificationsService: NotificationsService,
  ) {}

  private trimTime(time: string): string {
    return time.substring(0, 5);
  }

  private isFutureDateTime(date: string, time: string): boolean {
    const now = new Date();
    const target = new Date(`${date}T${time}:00`);
    return target > now;
  }

  private isToday(date: string): boolean {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    return date === todayStr;
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

  // ── Booking ────────────────────────────────────────────────

  async create(
    patient: PatientProfile,
    dto: CreateAppointmentDto,
  ): Promise<Appointment> {
    const doctor = await this.doctorService.findById(dto.doctorId);

    // Day 18: Booking Window - only today's date allowed
    if (!this.isToday(dto.date)) {
      throw new BadRequestException(
        'Appointments can only be booked for today. Past and future dates are not allowed.',
      );
    }

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

    const saved = await this.appointmentRepo.save(appointment);

    await this.notificationsService.createNotification(
      patient,
      'Appointment Booked',
      `Your appointment with ${doctor.fullName} on ${dto.date} at ${dto.startTime} has been confirmed.`,
      NotificationType.APPOINTMENT_BOOKED,
    );

    return saved;
  }

  private async bookWaveAppointment(
    patient: PatientProfile,
    doctor: DoctorProfile,
    slot: Slot,
    dto: { date: string; startTime: string; endTime: string },
  ): Promise<Appointment> {
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

    const result = await this.slotRepo
      .createQueryBuilder()
      .update(Slot)
      .set({ bookedCount: () => '"bookedCount" + 1' })
      .where('id = :id', { id: slot.id })
      .andWhere('"bookedCount" < "maxCapacity"')
      .execute();

    if (result.affected === 0) {
      throw new ConflictException(
        `Wave is full! Maximum capacity of ${slot.maxCapacity} patients reached`,
      );
    }

    const updatedSlot = await this.slotRepo.findOneBy({ id: slot.id });
    if (!updatedSlot) {
      throw new NotFoundException('Slot not found after update');
    }

    const tokenNumber = updatedSlot.bookedCount;

    if (updatedSlot.bookedCount >= updatedSlot.maxCapacity) {
      updatedSlot.status = SlotStatus.BOOKED;
      await this.slotRepo.save(updatedSlot);
    }

    const appointment = this.appointmentRepo.create({
      doctor,
      patient,
      slot: updatedSlot,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      status: AppointmentStatus.BOOKED,
      schedulingType: 'WAVE',
      tokenNumber,
    });

    const saved = await this.appointmentRepo.save(appointment);

    await this.notificationsService.createNotification(
      patient,
      'Appointment Booked',
      `Your wave appointment with ${doctor.fullName} on ${dto.date} (Token ${tokenNumber}) has been confirmed.`,
      NotificationType.APPOINTMENT_BOOKED,
    );

    return saved;
  }

  // ── Shared views ──────────────────────────────────────────

  async getMyAppointments(patient: PatientProfile): Promise<Appointment[]> {
    return this.appointmentRepo.find({
      where: { patient: { id: patient.id } },
      relations: { doctor: true },
      order: { date: 'DESC', startTime: 'DESC' },
    });
  }

  // ── Cancel (30-min cutoff) ────────────────────────────────

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

    await this.notificationsService.createNotification(
      patient,
      'Appointment Cancelled',
      `Your appointment with ${appointment.doctor.fullName} on ${appointment.date} at ${trimmedStart} has been cancelled.`,
      NotificationType.APPOINTMENT_CANCELLED,
    );

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
      return this.rescheduleToWave(appointment, oldSlot, newSlot, dto, patient);
    }

    return this.rescheduleToStream(appointment, oldSlot, newSlot, dto, patient);
  }

  private async rescheduleToStream(
    appointment: Appointment,
    oldSlot: Slot,
    newSlot: Slot,
    dto: RescheduleAppointmentDto,
    patient: PatientProfile,
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

    if (oldSlot) {
      if (oldSlot.slotType === SlotType.WAVE) {
        oldSlot.bookedCount = Math.max(0, oldSlot.bookedCount - 1);
        oldSlot.status = SlotStatus.AVAILABLE;
      } else {
        oldSlot.status = SlotStatus.AVAILABLE;
      }
      await this.slotRepo.save(oldSlot);
    }

    newSlot.status = SlotStatus.BOOKED;
    await this.slotRepo.save(newSlot);

    appointment.slot = newSlot;
    appointment.date = dto.date;
    appointment.startTime = dto.startTime;
    appointment.endTime = dto.endTime;
    appointment.schedulingType = 'STREAM';
    appointment.tokenNumber = null;

    const updated = await this.appointmentRepo.save(appointment);

    await this.notificationsService.createNotification(
      patient,
      'Appointment Rescheduled',
      `Your appointment with ${appointment.doctor.fullName} has been rescheduled to ${dto.date} at ${dto.startTime}.`,
      NotificationType.APPOINTMENT_RESCHEDULED,
    );

    return { appointment: updated };
  }

  private async rescheduleToWave(
    appointment: Appointment,
    oldSlot: Slot,
    newSlot: Slot,
    dto: RescheduleAppointmentDto,
    patient: PatientProfile,
  ): Promise<{ appointment: Appointment }> {
    const duplicateWaveBooking = await this.appointmentRepo.findOne({
      where: {
        patient: { id: appointment.patient.id },
        slot: { id: newSlot.id },
        status: AppointmentStatus.BOOKED,
      },
    });

    if (duplicateWaveBooking) {
      throw new ConflictException('You have already booked this wave window');
    }

    if (oldSlot) {
      if (oldSlot.slotType === SlotType.WAVE) {
        await this.slotRepo
          .createQueryBuilder()
          .update(Slot)
          .set({
            bookedCount: () => 'GREATEST("bookedCount" - 1, 0)',
            status: SlotStatus.AVAILABLE,
          })
          .where('id = :id', { id: oldSlot.id })
          .execute();
      } else {
        oldSlot.status = SlotStatus.AVAILABLE;
        await this.slotRepo.save(oldSlot);
      }
    }

    const result = await this.slotRepo
      .createQueryBuilder()
      .update(Slot)
      .set({ bookedCount: () => '"bookedCount" + 1' })
      .where('id = :id', { id: newSlot.id })
      .andWhere('"bookedCount" < "maxCapacity"')
      .execute();

    if (result.affected === 0) {
      const suggestion = await this.findNextAvailable(
        appointment.doctor.id, dto.date,
      );
      throw new ConflictException({
        message: 'Requested wave is full',
        suggestion,
      });
    }

    const updatedNewSlot = await this.slotRepo.findOneBy({ id: newSlot.id });
    if (!updatedNewSlot) {
      throw new NotFoundException('Slot not found after update');
    }

    const tokenNumber = updatedNewSlot.bookedCount;

    if (updatedNewSlot.bookedCount >= updatedNewSlot.maxCapacity) {
      updatedNewSlot.status = SlotStatus.BOOKED;
      await this.slotRepo.save(updatedNewSlot);
    }

    appointment.slot = updatedNewSlot;
    appointment.date = dto.date;
    appointment.startTime = dto.startTime;
    appointment.endTime = dto.endTime;
    appointment.schedulingType = 'WAVE';
    appointment.tokenNumber = tokenNumber;

    const updated = await this.appointmentRepo.save(appointment);

    await this.notificationsService.createNotification(
      patient,
      'Appointment Rescheduled',
      `Your wave appointment with ${appointment.doctor.fullName} has been rescheduled to ${dto.date} (Token ${tokenNumber}).`,
      NotificationType.APPOINTMENT_RESCHEDULED,
    );

    return { appointment: updated };
  }

  // ── Doctor-side appointment management ──────────────────

  async getDoctorAppointments(
    doctor: DoctorProfile,
    date?: string,
  ): Promise<Appointment[]> {
    if (date && !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    const where: any = {
      doctor: { id: doctor.id },
      status: AppointmentStatus.BOOKED,
    };

    if (date) {
      where.date = date;
    }

    return this.appointmentRepo.find({
      where,
      relations: { patient: true },
      order: { date: 'ASC', startTime: 'ASC' },
    });
  }

  async cancelByDoctor(doctor: DoctorProfile, id: string): Promise<Appointment> {
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

    if (appointment.doctor.id !== doctor.id) {
      throw new ForbiddenException('You can only cancel your own appointments');
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Appointment is already cancelled');
    }

    appointment.status = AppointmentStatus.CANCELLED;
    const updated = await this.appointmentRepo.save(appointment);

    await this.notificationsService.createNotification(
      appointment.patient,
      'Appointment Cancelled by Doctor',
      `Your appointment with ${doctor.fullName} on ${appointment.date} at ${this.trimTime(appointment.startTime)} has been cancelled by the doctor.`,
      NotificationType.APPOINTMENT_CANCELLED,
    );

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

  // ── Suggest next available slot/wave (used in reschedule) ─

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

  // ── Next Available Booking (Day 13) ───────────────────────

  async getNextAvailable(dto: NextAvailableDto): Promise<{
    doctorId: string;
    found: boolean;
    message: string;
    date?: string;
    schedulingType?: string;
    slots?: any[];
    waves?: any[];
  }> {
    const doctor = await this.doctorService.findById(dto.doctorId);
    const searchDays = dto.searchDays || 30;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < searchDays; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + i);
      const dateStr = checkDate.toISOString().split('T')[0];

      const slots = await this.slotRepo
        .createQueryBuilder('slot')
        .where('slot.doctorId = :doctorId', { doctorId: doctor.id })
        .andWhere('slot.date = :date', { date: dateStr })
        .orderBy('slot.startTime', 'ASC')
        .getMany();

      if (slots.length === 0) continue;

      if (doctor.schedulingType === SchedulingType.STREAM) {
        const availableSlots = slots.filter(
          (s) =>
            s.slotType === SlotType.STREAM &&
            s.status === SlotStatus.AVAILABLE &&
            (i > 0 || this.isFutureDateTime(dateStr, this.trimTime(s.startTime))),
        );

        if (availableSlots.length > 0) {
          return {
            doctorId: doctor.id,
            found: true,
            message: i === 0
              ? 'Slots available today'
              : `Next available date found: ${dateStr}`,
            date: dateStr,
            schedulingType: 'STREAM',
            slots: availableSlots.map((s) => ({
              id: s.id,
              startTime: this.trimTime(s.startTime),
              endTime: this.trimTime(s.endTime),
            })),
          };
        }
      }

      if (doctor.schedulingType === SchedulingType.WAVE) {
        const availableWaves = slots.filter(
          (s) =>
            s.slotType === SlotType.WAVE &&
            s.bookedCount < s.maxCapacity &&
            (i > 0 || this.isFutureDateTime(dateStr, this.trimTime(s.startTime))),
        );

        if (availableWaves.length > 0) {
          return {
            doctorId: doctor.id,
            found: true,
            message: i === 0
              ? 'Wave slots available today'
              : `Next available date found: ${dateStr}`,
            date: dateStr,
            schedulingType: 'WAVE',
            waves: availableWaves.map((s) => ({
              id: s.id,
              timeWindow: `${this.trimTime(s.startTime)} - ${this.trimTime(s.endTime)}`,
              available: s.maxCapacity - s.bookedCount,
              maxCapacity: s.maxCapacity,
            })),
          };
        }
      }
    }

    return {
      doctorId: doctor.id,
      found: false,
      message: `No appointments available in the next ${searchDays} working days. Please try again later.`,
    };
  }
}