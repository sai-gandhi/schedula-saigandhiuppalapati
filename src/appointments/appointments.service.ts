import {
  Injectable, NotFoundException,
  BadRequestException, ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from './appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { Slot, SlotStatus } from '../slots/slot.entity';
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
    // 1. Doctor should exist
    const doctor = await this.doctorService.findById(dto.doctorId);

    // 2. Appointment should be for future date/time
    if (!this.isFutureDateTime(dto.date, dto.startTime)) {
      throw new BadRequestException(
        'Cannot book appointment for past date/time',
      );
    }

    // 3. Slot should exist and be available
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

    if (slot.status !== SlotStatus.AVAILABLE) {
      throw new ConflictException('Slot is already booked');
    }

    // 4. Same slot should not be booked twice
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

    // Create appointment
    const appointment = this.appointmentRepo.create({
      doctor,
      patient,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      status: AppointmentStatus.BOOKED,
    });

    const saved = await this.appointmentRepo.save(appointment);

    // Mark slot as booked
    slot.status = SlotStatus.BOOKED;
    await this.slotRepo.save(slot);

    return saved;
  }

  async getMyAppointments(patient: PatientProfile): Promise<Appointment[]> {
    const appointments = await this.appointmentRepo.find({
      where: { patient: { id: patient.id } },
      relations: { doctor: true },
      order: { date: 'DESC', startTime: 'DESC' },
    });

    // Explicit empty-state: returns [] with 200 OK when patient
    // has no appointments, rather than throwing an error.
    // An empty list is a valid, expected state — not a "not found" case.
    return appointments;
  }

  async getDoctorAppointments(doctor: DoctorProfile): Promise<Appointment[]> {
    const appointments = await this.appointmentRepo.find({
      where: { doctor: { id: doctor.id } },
      relations: { patient: true },
      order: { date: 'DESC', startTime: 'DESC' },
    });

    // Explicit empty-state: returns [] with 200 OK when doctor
    // has no appointments booked yet.
    return appointments;
  }

  async cancel(patient: PatientProfile, id: string): Promise<Appointment> {
    //for reference
    // Validate appointment ID format before querying DB
    // to avoid raw UUID syntax errors from PostgreSQL
    if (!this.isValidUUID(id)) {
      throw new NotFoundException('Appointment not found');
    }

    const appointment = await this.appointmentRepo.findOne({
      where: { id },
      relations: { patient: true, doctor: true },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Only owner can cancel
    if (appointment.patient.id !== patient.id) {
      throw new ForbiddenException('You can only cancel your own appointments');
    }

    // Cannot cancel already cancelled appointment
    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Appointment is already cancelled');
    }

    // Past appointment should not be cancellable
    if (!this.isFutureDateTime(appointment.date, this.trimTime(appointment.startTime))) {
      throw new BadRequestException('Cannot cancel past appointments');
    }

    appointment.status = AppointmentStatus.CANCELLED;
    const updated = await this.appointmentRepo.save(appointment);

    // Free up the slot
    const slot = await this.slotRepo.findOne({
      where: {
        doctor: { id: appointment.doctor.id },
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
      },
    });

    if (slot) {
      slot.status = SlotStatus.AVAILABLE;
      await this.slotRepo.save(slot);
    }

    return updated;
  }
}