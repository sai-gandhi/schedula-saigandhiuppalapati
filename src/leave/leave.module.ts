import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorLeave } from './leave.entity';
import { Appointment } from '../appointments/appointment.entity';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { DoctorModule } from '../doctor/doctor.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DoctorLeave, Appointment]),
    DoctorModule,
  ],
  providers: [LeaveService],
  controllers: [LeaveController],
  exports: [LeaveService],
})
export class LeaveModule {}