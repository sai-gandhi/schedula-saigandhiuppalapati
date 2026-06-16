import {
  Injectable, NotFoundException,
  BadRequestException, ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from './appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { Slot, SlotStatus, SlotType } from '../slots/slot.entity';
import { DoctorProfile } from '../doctor/doctor.entity';
import { PatientProfile } from '../patient/patient.entity';
import { DoctorService } from '../doctor/doctor.service';

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

  private isValidUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

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

    // Branch by scheduling strategy
    if (slot.slotType === SlotType.WAVE) {
      return this.bookWaveAppointment(patient, doctor, slot, dto);
    }

    return this.bookStreamAppointment(patient, doctor, slot, dto);
  }

  // ── STREAM booking ───────────────────────────────────────

  private async bookStreamAppointment(
    patient: PatientProfile,
    doctor: DoctorProfile,
    slot: Slot,
    dto: CreateAppointmentDto,
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

    // Mark slot booked FIRST so the returned appointment reflects it
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

  // ── WAVE booking ─────────────────────────────────────────

  private async bookWaveAppointment(
    patient: PatientProfile,
    doctor: DoctorProfile,
    slot: Slot,
    dto: CreateAppointmentDto,
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

  // ── Shared methods ────────────────────────────────────────

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

    if (!this.isFutureDateTime(appointment.date, this.trimTime(appointment.startTime))) {
      throw new BadRequestException('Cannot cancel past appointments');
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
}