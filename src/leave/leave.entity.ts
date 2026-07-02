import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { DoctorProfile } from '../doctor/doctor.entity';

@Entity('doctor_leaves')
export class DoctorLeave {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DoctorProfile, { onDelete: 'CASCADE' })
  @JoinColumn()
  doctor: DoctorProfile;

  @Column({ type: 'date' })
  leaveDate: string;

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn()
  createdAt: Date;
}