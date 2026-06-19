import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Slot } from '../slots/slot.entity';
import { SchedulingService } from './scheduling.service';
import { SchedulingController } from './scheduling.controller';
import { DoctorModule } from '../doctor/doctor.module';
import { AvailabilityModule } from '../availability/availability.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Slot]),
    DoctorModule,
    AvailabilityModule,
  ],
  providers: [SchedulingService],
  controllers: [SchedulingController],
})
export class SchedulingModule {}