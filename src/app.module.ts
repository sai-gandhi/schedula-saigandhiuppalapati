import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { AvailabilityModule } from './availability/availability.module';
import { User } from './users/user.entity';
import { DoctorProfile } from './doctor/doctor.entity';
import { PatientProfile } from './patient/patient.entity';
import { RecurringAvailability } from './availability/recurring-availability.entity';
import { CustomAvailability } from './availability/custom-availability.entity';
import { AppController } from './app.controller';
import { SlotsModule } from './slots/slots.module';
import { Slot } from './slots/slot.entity';
import { AppointmentsModule } from './appointments/appointments.module';
import { Appointment } from './appointments/appointment.entity';
import { SchedulingModule } from './scheduling/scheduling.module';
import { NotificationsModule } from './notifications/notifications.module';
import { Notification } from './notifications/notification.entity';
import { ScheduleModule } from '@nestjs/schedule';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get('DATABASE_URL'),
        entities: [User, DoctorProfile, PatientProfile, RecurringAvailability, CustomAvailability, Slot, Appointment, Notification],
        synchronize: false,
        ssl: false,
      }),
    }),
    AuthModule,
    UsersModule,
    AppointmentsModule,
    DoctorModule,
    PatientModule,
    AvailabilityModule,
    SlotsModule,
    SchedulingModule,
    NotificationsModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
})
export class AppModule {}