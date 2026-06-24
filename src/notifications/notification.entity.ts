import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { PatientProfile } from '../patient/patient.entity';

export enum NotificationType {
  APPOINTMENT_BOOKED = 'APPOINTMENT_BOOKED',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
  APPOINTMENT_RESCHEDULED = 'APPOINTMENT_RESCHEDULED',
  APPOINTMENT_REMINDER = 'APPOINTMENT_REMINDER',
  FOLLOW_UP_REMINDER = 'FOLLOW_UP_REMINDER',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PatientProfile, { onDelete: 'CASCADE' })
  @JoinColumn()
  patient: PatientProfile;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;
}