import {
  Controller, Post, Get, Patch,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { PatientService } from '../patient/patient.service';
import { DoctorService } from '../doctor/doctor.service';

@Controller()
export class AppointmentsController {
  constructor(
    private appointmentsService: AppointmentsService,
    private patientService: PatientService,
    private doctorService: DoctorService,
  ) {}

  @Post('appointment')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('PATIENT')
  async create(@Request() req, @Body() dto: CreateAppointmentDto) {
    const patient = await this.patientService.findByUser(req.user);
    return this.appointmentsService.create(patient, dto);
  }

  @Get('appointment/my')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('PATIENT')
  async getMyAppointments(@Request() req) {
    const patient = await this.patientService.findByUser(req.user);
    return this.appointmentsService.getMyAppointments(patient);
  }

  @Patch('appointment/:id/cancel')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('PATIENT')
  async cancel(@Request() req, @Param('id') id: string) {
    const patient = await this.patientService.findByUser(req.user);
    return this.appointmentsService.cancel(patient, id);
  }

  @Patch('appointment/:id/reschedule')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('PATIENT')
  async reschedule(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    const patient = await this.patientService.findByUser(req.user);
    return this.appointmentsService.reschedule(patient, id, dto);
  }

  // Doctor-side appointment management (Day 12)
  // Using 'appointments-list' to avoid colliding with
  // DoctorController's GET /doctor/:id route.
  @Get('doctor/appointments-list')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DOCTOR')
  async getDoctorAppointments(@Request() req, @Query('date') date?: string) {
    const doctor = await this.doctorService.findByUser(req.user);
    return this.appointmentsService.getDoctorAppointments(doctor, date);
  }

  @Patch('doctor/appointments-list/:id/cancel')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DOCTOR')
  async cancelByDoctor(@Request() req, @Param('id') id: string) {
    const doctor = await this.doctorService.findByUser(req.user);
    return this.appointmentsService.cancelByDoctor(doctor, id);
  }
}