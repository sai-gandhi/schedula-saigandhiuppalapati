import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { DoctorProfile } from '../doctor/doctor.entity';

export enum SlotStatus {
  AVAILABLE = 'AVAILABLE',
  BOOKED = 'BOOKED',
  CANCELLED = 'CANCELLED',
}

export enum SlotType {
  STREAM = 'STREAM',
  WAVE = 'WAVE',
}

@Entity('slots')
export class Slot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DoctorProfile, { onDelete: 'CASCADE' })
  @JoinColumn()
  doctor: DoctorProfile;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column({ type: 'enum', enum: SlotStatus, default: SlotStatus.AVAILABLE })
  status: SlotStatus;

  @Column({ default: 30 })
  duration: number;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'enum', enum: SlotType, default: SlotType.STREAM })
slotType: SlotType;

@Column({ type: 'int', nullable: true })
maxCapacity: number;

@Column({ type: 'int', default: 0 })
bookedCount: number;

}