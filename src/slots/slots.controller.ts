import {
  Controller, Get, Post,
  Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SlotsService } from './slots.service';
import { GenerateSlotsDto } from './dto/generate-slots.dto';

@Controller('doctor')
export class SlotsController {
  constructor(private slotsService: SlotsService) {}

  // Doctor generates slots
  @Post(':doctorId/slots/generate')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DOCTOR')
  generateSlots(
    @Param('doctorId') doctorId: string,
    @Query() dto: GenerateSlotsDto,
  ) {
    return this.slotsService.generateSlots(doctorId, dto);
  }

  // Patient views available slots (public)
  @Get(':doctorId/slots')
  getAvailableSlots(
    @Param('doctorId') doctorId: string,
    @Query('date') date: string,
  ) {
    return this.slotsService.getAvailableSlots(doctorId, date);
  }
}