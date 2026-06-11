import {
  Controller, Post, Get, Patch, Delete,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AvailabilityService } from './availability.service';
import { CreateRecurringDto } from './dto/create-recurring.dto';
import { UpdateRecurringDto } from './dto/update-recurring.dto';
import { CreateOverrideDto } from './dto/create-override.dto';
import { DoctorService } from '../doctor/doctor.service';

@Controller('availability')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('DOCTOR')
export class AvailabilityController {
  constructor(
    private availabilityService: AvailabilityService,
    private doctorService: DoctorService,
  ) {}

  @Post()
  async createRecurring(@Request() req, @Body() dto: CreateRecurringDto) {
    const doctor = await this.doctorService.findByUser(req.user);
    return this.availabilityService.createRecurring(doctor, dto);
  }

  @Get()
  async getRecurring(@Request() req) {
    const doctor = await this.doctorService.findByUser(req.user);
    return this.availabilityService.getRecurring(doctor);
  }

  @Patch(':id')
  async updateRecurring(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringDto,
  ) {
    const doctor = await this.doctorService.findByUser(req.user);
    return this.availabilityService.updateRecurring(doctor, id, dto);
  }

  @Delete(':id')
  async deleteRecurring(@Request() req, @Param('id') id: string) {
    const doctor = await this.doctorService.findByUser(req.user);
    await this.availabilityService.deleteRecurring(doctor, id);
    return { message: 'Availability slot deleted successfully' };
  }

  @Post('override')
  async createOverride(@Request() req, @Body() dto: CreateOverrideDto) {
    const doctor = await this.doctorService.findByUser(req.user);
    return this.availabilityService.createOverride(doctor, dto);
  }

  @Get('date')
  async getByDate(@Request() req, @Query('date') date: string) {
    const doctor = await this.doctorService.findByUser(req.user);
    return this.availabilityService.getByDate(doctor, date);
  }
}