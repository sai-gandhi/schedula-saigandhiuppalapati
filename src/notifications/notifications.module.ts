import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { Appointment } from '../appointments/appointment.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { ReminderService } from './reminder.service';
import { PatientModule } from '../patient/patient.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, Appointment]),
    PatientModule,
  ],
  providers: [NotificationsService, ReminderService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}