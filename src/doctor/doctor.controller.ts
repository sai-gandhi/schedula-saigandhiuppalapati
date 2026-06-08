import { Controller, Get, Post, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DoctorService } from './doctor.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Controller('doctor')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('DOCTOR')
export class DoctorController {
  constructor(private doctorService: DoctorService) {}

  @Post('profile')
  create(@Request() req, @Body() dto: CreateDoctorDto) {
    return this.doctorService.create(req.user, dto);
  }

  @Get('profile')
  get(@Request() req) {
    return this.doctorService.findByUser(req.user);
  }

  @Patch('profile')
  update(@Request() req, @Body() dto: UpdateDoctorDto) {
    return this.doctorService.update(req.user, dto);
  }
}