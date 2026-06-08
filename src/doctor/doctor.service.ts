import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorProfile } from './doctor.entity';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { User } from '../users/user.entity';

@Injectable()
export class DoctorService {
  constructor(
    @InjectRepository(DoctorProfile)
    private doctorRepo: Repository<DoctorProfile>,
  ) {}

  async create(user: User, dto: CreateDoctorDto): Promise<DoctorProfile> {
    const existing = await this.doctorRepo.findOne({ where: { user: { id: user.id } } });
    if (existing) throw new ConflictException('Doctor profile already exists');

    const profile = this.doctorRepo.create({ ...dto, user });
    return this.doctorRepo.save(profile);
  }

  async findByUser(user: User): Promise<DoctorProfile> {
    const profile = await this.doctorRepo.findOne({ where: { user: { id: user.id } } });
    if (!profile) throw new NotFoundException('Doctor profile not found');
    return profile;
  }

  async update(user: User, dto: UpdateDoctorDto): Promise<DoctorProfile> {
    const profile = await this.findByUser(user);
    Object.assign(profile, dto);
    return this.doctorRepo.save(profile);
  }
}