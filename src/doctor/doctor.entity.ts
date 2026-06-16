import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';

export enum SchedulingType {
  STREAM = 'STREAM',
  WAVE = 'WAVE',
}
import { User } from '../users/user.entity';

@Entity('doctor_profiles')
export class DoctorProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (u) => u.doctorProfile, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  fullName: string;

  @Column()
  specialization: string;

  @Column()
  experience: string;

  @Column()
  qualification: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  consultationFee: number;

  @Column()
  availabilityHours: string;

  @Column({ nullable: true })
  profileDetails: string;

  @Column({ default: true })
  isAvailable: boolean;

  @CreateDateColumn()
  created_at: Date;

  @Column({
  type: 'enum',
  enum: SchedulingType,
  default: SchedulingType.STREAM,
})
schedulingType!: SchedulingType;
}