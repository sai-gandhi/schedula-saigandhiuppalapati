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

@Module({
  imports: [
   TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    url: config.get('DATABASE_URL'),
    entities: [User, DoctorProfile, PatientProfile],
    synchronize: false,
    migrations: ['dist/database/migrations/*.js'],
    ssl: { rejectUnauthorized: false },
  }),
}),
    AuthModule,
    UsersModule,
    DoctorModule,
    PatientModule,
  ],
})
export class AppModule {}