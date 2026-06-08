import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller()
export class UsersController {
  @Get('doctor/profile')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DOCTOR')
  getDoctorProfile(@Request() req) {
    return { message: 'Doctor profile', user: req.user };
  }

  @Get('patient/profile')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('PATIENT')
  getPatientProfile(@Request() req) {
    return { message: 'Patient profile', user: req.user };
  }
}