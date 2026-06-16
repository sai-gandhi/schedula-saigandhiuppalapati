import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { DoctorProfile } from '../doctor/doctor.entity';
import { PatientProfile } from '../patient/patient.entity';
import { Slot } from '../slots/slot.entity';

export enum AppointmentStatus {
  BOOKED = 'BOOKED',
  CANCELLED = 'CANCELLED',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DoctorProfile, { onDelete: 'CASCADE' })
  @JoinColumn()
  doctor: DoctorProfile;

  @ManyToOne(() => PatientProfile, { onDelete: 'CASCADE' })
  @JoinColumn()
  patient: PatientProfile;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column({ type: 'enum', enum: AppointmentStatus, default: AppointmentStatus.BOOKED })
  status: AppointmentStatus;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Slot, { nullable: true, onDelete: 'SET NULL' })
@JoinColumn()
slot: Slot;

@Column({ nullable: true })
schedulingType: string;

@Column({ type: 'int', nullable: true })
tokenNumber: number;


}