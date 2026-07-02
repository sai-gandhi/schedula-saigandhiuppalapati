import {
  Injectable, BadRequestException,
  ConflictException, NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorLeave } from './leave.entity';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { DoctorProfile } from '../doctor/doctor.entity';
import { Appointment, AppointmentStatus } from '../appointments/appointment.entity';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(DoctorLeave)
    private leaveRepo: Repository<DoctorLeave>,
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
  ) {}

  async createLeave(
    doctor: DoctorProfile,
    dto: CreateLeaveDto,
  ): Promise<DoctorLeave> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const leaveDate = new Date(dto.leaveDate + 'T00:00:00');

    // Past date rejected
    if (leaveDate < today) {
      throw new BadRequestException(
        'Cannot apply leave for past dates.',
      );
    }

    // Duplicate check
   const existing = await this.leaveRepo
  .createQueryBuilder('leave')
  .where('leave.doctorId = :doctorId', { doctorId: doctor.id })
  .andWhere('leave."leaveDate" = :leaveDate', { leaveDate: dto.leaveDate })
  .getOne();

    if (existing) {
      throw new ConflictException(
        `Leave already exists for ${dto.leaveDate}.`,
      );
    }

    // Check for existing appointments on this date
    const existingAppointments = await this.appointmentRepo.count({
      where: {
        doctor: { id: doctor.id },
        date: dto.leaveDate,
        status: AppointmentStatus.BOOKED,
      },
    });

    if (existingAppointments > 0) {
      throw new ConflictException(
        `Cannot apply leave. ${existingAppointments} appointment(s) already scheduled on ${dto.leaveDate}. Please cancel or reschedule existing appointments first.`,
      );
    }

    const leave = this.leaveRepo.create({
      doctor,
      leaveDate: dto.leaveDate,
      reason: dto.reason,
    });

    return this.leaveRepo.save(leave);
  }

  async getMyLeaves(doctor: DoctorProfile): Promise<DoctorLeave[]> {
    return this.leaveRepo.find({
      where: { doctor: { id: doctor.id } },
      order: { leaveDate: 'ASC' },
    });
  }

  async deleteLeave(doctor: DoctorProfile, id: string): Promise<void> {
    const leave = await this.leaveRepo.findOne({
      where: { id },
      relations: { doctor: true },
    });

    if (!leave) {
      throw new NotFoundException('Leave not found');
    }

    if (leave.doctor.id !== doctor.id) {
      throw new ForbiddenException('You can only delete your own leave');
    }

    await this.leaveRepo.remove(leave);
  }

  async isOnLeave(doctorId: string, date: string): Promise<boolean> {
  const leave = await this.leaveRepo
    .createQueryBuilder('leave')
    .where('leave.doctorId = :doctorId', { doctorId })
    .andWhere('leave."leaveDate" = :date', { date })
    .getOne();
  return !!leave;
}
}