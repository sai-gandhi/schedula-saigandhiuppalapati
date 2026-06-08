import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientProfile } from './patient.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { User } from '../users/user.entity';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(PatientProfile)
    private patientRepo: Repository<PatientProfile>,
  ) {}

  async create(user: User, dto: CreatePatientDto): Promise<PatientProfile> {
    const existing = await this.patientRepo.findOne({ where: { user: { id: user.id } } });
    if (existing) throw new ConflictException('Patient profile already exists');

    const profile = this.patientRepo.create({ ...dto, user });
    return this.patientRepo.save(profile);
  }

  async findByUser(user: User): Promise<PatientProfile> {
    const profile = await this.patientRepo.findOne({ where: { user: { id: user.id } } });
    if (!profile) throw new NotFoundException('Patient profile not found');
    return profile;
  }

  async update(user: User, dto: UpdatePatientDto): Promise<PatientProfile> {
    const profile = await this.findByUser(user);
    Object.assign(profile, dto);
    return this.patientRepo.save(profile);
  }
}