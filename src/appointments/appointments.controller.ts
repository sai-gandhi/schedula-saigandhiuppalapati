import {
  Controller, Post, Get, Patch,
  Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { PatientService } from '../patient/patient.service';
import { DoctorService } from '../doctor/doctor.service';

@Controller()
export class AppointmentsController {
  constructor(
    private appointmentsService: AppointmentsService,
    private patientService: PatientService,
    private doctorService: DoctorService,
  ) {}

  // Patient books appointment
  @Post('appointment')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('PATIENT')
  async create(@Request() req, @Body() dto: CreateAppointmentDto) {
    const patient = await this.patientService.findByUser(req.user);
    return this.appointmentsService.create(patient, dto);
  }

  // Patient views their appointments
  @Get('appointment/my')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('PATIENT')
  async getMyAppointments(@Request() req) {
    const patient = await this.patientService.findByUser(req.user);
    return this.appointmentsService.getMyAppointments(patient);
  }

  // Patient cancels appointment
  @Patch('appointment/:id/cancel')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('PATIENT')
  async cancel(@Request() req, @Param('id') id: string) {
    const patient = await this.patientService.findByUser(req.user);
    return this.appointmentsService.cancel(patient, id);
  }

  // Doctor views their appointments
  @Get('doctor/appointments')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DOCTOR')
  async getDoctorAppointments(@Request() req) {
    const doctor = await this.doctorService.findByUser(req.user);
    return this.appointmentsService.getDoctorAppointments(doctor);
  }
}