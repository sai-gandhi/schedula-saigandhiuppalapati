import {
  Controller, Get, Post, Patch,
  Body, UseGuards, Request,
  Param, Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DoctorService } from './doctor.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { QueryDoctorDto } from './dto/query-doctor.dto';

@Controller('doctor')
export class DoctorController {
  constructor(private doctorService: DoctorService) {}

  // ── Public routes ────────────────────────────────────────

  @Get()
  findAll(@Query() query: QueryDoctorDto) {
    return this.doctorService.findAll(query);
  }

  // IMPORTANT: 'profile' must come before ':id'
  @Get('profile')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DOCTOR')
  getProfile(@Request() req) {
    return this.doctorService.findByUser(req.user);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.doctorService.findById(id);
  }

  // ── Protected routes ─────────────────────────────────────

  @Post('profile')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DOCTOR')
  create(@Request() req, @Body() dto: CreateDoctorDto) {
    return this.doctorService.create(req.user, dto);
  }

  @Patch('profile')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DOCTOR')
  update(@Request() req, @Body() dto: UpdateDoctorDto) {
    return this.doctorService.update(req.user, dto);
  }
}