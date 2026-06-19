import {
  Injectable, ConflictException,
  NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { DoctorProfile } from './doctor.entity';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { QueryDoctorDto } from './dto/query-doctor.dto';
import { User } from '../users/user.entity';

@Injectable()
export class DoctorService {
  constructor(
    @InjectRepository(DoctorProfile)
    private doctorRepo: Repository<DoctorProfile>,
  ) {}

  async create(user: User, dto: CreateDoctorDto): Promise<DoctorProfile> {
    const existing = await this.doctorRepo.findOne({
      where: { user: { id: user.id } },
    });
    if (existing) throw new ConflictException('Doctor profile already exists');
    const profile = this.doctorRepo.create({ ...dto, user });
    return this.doctorRepo.save(profile);
  }

  async findByUser(user: User): Promise<DoctorProfile> {
    const profile = await this.doctorRepo.findOne({
      where: { user: { id: user.id } },
    });
    if (!profile) throw new NotFoundException('Doctor profile not found');
    return profile;
  }

  async update(user: User, dto: UpdateDoctorDto): Promise<DoctorProfile> {
    const profile = await this.findByUser(user);
    Object.assign(profile, dto);
    return this.doctorRepo.save(profile);
  }

  async findAll(query: QueryDoctorDto) {
    const {
      specialization, search,
      page = 1, limit = 10, availability,
    } = query;

    if (page < 1 || limit < 1) {
      throw new BadRequestException('Page and limit must be positive numbers');
    }

    const where: any = {};

    if (specialization) {
      where.specialization = ILike(`%${specialization}%`);
    }

    if (search) {
      where.fullName = ILike(`%${search}%`);
    }

    if (availability !== undefined) {
      where.isAvailable = availability;
    }

    const [doctors, total] = await this.doctorRepo.findAndCount({
  where,
  select: {
    id: true,
    fullName: true,
    specialization: true,
    experience: true,
    consultationFee: true,
    isAvailable: true,
  },
  skip: (page - 1) * limit,
  take: limit,
  order: { created_at: 'DESC' },
});

    if (doctors.length === 0) {
      return {
        message: 'No doctors found',
        data: [],
        total: 0,
        page,
        limit,
      };
    }

    return {
      data: doctors,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async save(doctor: DoctorProfile): Promise<DoctorProfile> {
    return this.doctorRepo.save(doctor);
  }

  async findById(id: string): Promise<DoctorProfile> {
    if (!id.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )) {
      throw new BadRequestException('Invalid doctor ID format');
    }

    const doctor = await this.doctorRepo.findOne({ where: { id } });
    if (!doctor) throw new NotFoundException('Doctor not found');
    return doctor;
  }
}