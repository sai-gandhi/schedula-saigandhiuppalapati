import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from './users/user.entity';
import { DoctorProfile } from './doctor/doctor.entity';
import { PatientProfile } from './patient/patient.entity';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, DoctorProfile, PatientProfile],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  ssl: { rejectUnauthorized: false },
});