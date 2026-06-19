import {
  Controller, Post, Get,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SchedulingService } from './scheduling.service';
import { SetSchedulingTypeDto } from './dto/set-scheduling-type.dto';
import { GenerateStreamSlotsDto } from './dto/generate-stream-slots.dto';
import { GenerateWaveSlotsDto } from './dto/generate-wave-slots.dto';
import { DoctorService } from '../doctor/doctor.service';

@Controller()
export class SchedulingController {
  constructor(
    private schedulingService: SchedulingService,
    private doctorService: DoctorService,
  ) {}

  @Post('doctor/scheduling-type')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DOCTOR')
  async setSchedulingType(@Request() req, @Body() dto: SetSchedulingTypeDto) {
    const doctor = await this.doctorService.findByUser(req.user);
    return this.schedulingService.setSchedulingType(doctor, dto);
  }

  @Post('doctor/slots/stream')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DOCTOR')
  async generateStreamSlots(@Request() req, @Body() dto: GenerateStreamSlotsDto) {
    const doctor = await this.doctorService.findByUser(req.user);
    return this.schedulingService.generateStreamSlots(doctor, dto);
  }

  @Post('doctor/slots/wave')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DOCTOR')
  async generateWaveSlots(@Request() req, @Body() dto: GenerateWaveSlotsDto) {
    const doctor = await this.doctorService.findByUser(req.user);
    return this.schedulingService.generateWaveSlots(doctor, dto);
  }

  @Get('doctor/:doctorId/slots/scheduled')
  getScheduledSlots(
    @Param('doctorId') doctorId: string,
    @Query('date') date: string,
  ) {
    return this.schedulingService.getScheduledSlots(doctorId, date);
  }
}