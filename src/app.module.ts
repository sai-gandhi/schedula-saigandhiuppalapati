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
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get('DATABASE_URL'),
        entities: [User, DoctorProfile, PatientProfile],
        synchronize: false,
        ssl: { rejectUnauthorized: false },
      }),
    }),
    AuthModule,
    UsersModule,
    DoctorModule,
    PatientModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
