import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, OneToOne,
} from 'typeorm';
import { DoctorProfile } from '../doctor/doctor.entity';
import { PatientProfile } from '../patient/patient.entity';

export enum Role {
  DOCTOR = 'DOCTOR',
  PATIENT = 'PATIENT',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ type: 'enum', enum: Role })
  role: Role;

  @CreateDateColumn()
  created_at: Date;

  @OneToOne(() => DoctorProfile, (d) => d.user)
  doctorProfile: DoctorProfile;

  @OneToOne(() => PatientProfile, (p) => p.user)
  patientProfile: PatientProfile;
}