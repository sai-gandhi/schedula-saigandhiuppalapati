import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecurringAvailability } from './recurring-availability.entity';
import { CustomAvailability } from './custom-availability.entity';
import { Appointment } from '../appointments/appointment.entity';
import { Slot } from '../slots/slot.entity';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';
import { DoctorModule } from '../doctor/doctor.module';
import { SlotsModule } from '../slots/slots.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RecurringAvailability, CustomAvailability, Appointment, Slot]),
    DoctorModule,
    forwardRef(() => SlotsModule),
    NotificationsModule,
  ],
  providers: [AvailabilityService],
  controllers: [AvailabilityController],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}