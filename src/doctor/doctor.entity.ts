import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('doctor_profiles')
export class DoctorProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.doctorProfile)
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

  @Column({ type: 'decimal' })
  consultationFee: number;

  @Column()
  availabilityHours: string;

  @Column({ nullable: true })
  profileDetails: string;

  @CreateDateColumn()
  created_at: Date;
}