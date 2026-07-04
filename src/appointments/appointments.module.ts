import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './appointment.entity';
import { Slot } from '../slots/slot.entity';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { DoctorModule } from '../doctor/doctor.module';
import { PatientModule } from '../patient/patient.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LeaveModule } from '../leave/leave.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, Slot]),
    DoctorModule,
    PatientModule,
    NotificationsModule,
    LeaveModule,
  ],
  providers: [AppointmentsService],
  controllers: [AppointmentsController],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}