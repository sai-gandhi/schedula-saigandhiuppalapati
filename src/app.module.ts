import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { User } from './users/user.entity';
import { DoctorProfile } from './doctor/doctor.entity';
import { PatientProfile } from './patient/patient.entity';
import { AvailabilityModule } from './availability/availability.module';
import { RecurringAvailability } from './availability/recurring-availability.entity';
import { CustomAvailability } from './availability/custom-availability.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        entities: [User, DoctorProfile, PatientProfile, RecurringAvailability, CustomAvailability],
        synchronize: false,
        migrations: ['dist/database/migrations/*.js'],
      }),
    }),
    AuthModule,
    UsersModule,
    DoctorModule,
    PatientModule,
    AvailabilityModule, 
  ],
})
export class AppModule {}