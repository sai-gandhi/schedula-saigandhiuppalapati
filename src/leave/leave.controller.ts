import {
  Controller, Post, Get, Delete,
  Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { LeaveService } from './leave.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { DoctorService } from '../doctor/doctor.service';

@Controller('doctor/leave')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('DOCTOR')
export class LeaveController {
  constructor(
    private leaveService: LeaveService,
    private doctorService: DoctorService,
  ) {}

  @Post()
  async createLeave(@Request() req, @Body() dto: CreateLeaveDto) {
    const doctor = await this.doctorService.findByUser(req.user);
    return this.leaveService.createLeave(doctor, dto);
  }

  @Get()
  async getMyLeaves(@Request() req) {
    const doctor = await this.doctorService.findByUser(req.user);
    return this.leaveService.getMyLeaves(doctor);
  }

  @Delete(':id')
  async deleteLeave(@Request() req, @Param('id') id: string) {
    const doctor = await this.doctorService.findByUser(req.user);
    return this.leaveService.deleteLeave(doctor, id);
  }
}