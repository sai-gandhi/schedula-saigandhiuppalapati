import { Controller, Get, Post, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PatientService } from './patient.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Controller('patient')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('PATIENT')
export class PatientController {
  constructor(private patientService: PatientService) {}

  @Post('profile')
  create(@Request() req, @Body() dto: CreatePatientDto) {
    return this.patientService.create(req.user, dto);
  }

  @Get('profile')
  get(@Request() req) {
    return this.patientService.findByUser(req.user);
  }

  @Patch('profile')
  update(@Request() req, @Body() dto: UpdatePatientDto) {
    return this.patientService.update(req.user, dto);
  }
}