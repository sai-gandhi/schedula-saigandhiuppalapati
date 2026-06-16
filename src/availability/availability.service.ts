import {
  Injectable, BadRequestException,
  NotFoundException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecurringAvailability } from './recurring-availability.entity';
import { CustomAvailability } from './custom-availability.entity';
import { CreateRecurringDto } from './dto/create-recurring.dto';
import { UpdateRecurringDto } from './dto/update-recurring.dto';
import { CreateOverrideDto } from './dto/create-override.dto';
import { DoctorProfile } from '../doctor/doctor.entity';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(RecurringAvailability)
    private recurringRepo: Repository<RecurringAvailability>,
    @InjectRepository(CustomAvailability)
    private customRepo: Repository<CustomAvailability>,
  ) {}

  private isValidTimeRange(start: string, end: string): boolean {
    return start < end;
  }

  private hasOverlap(
    start1: string, end1: string,
    start2: string, end2: string,
  ): boolean {
    return start1 < end2 && start2 < end1;
  }

  // ── Recurring Availability ───────────────────────────────

  async createRecurring(
    doctor: DoctorProfile,
    dto: CreateRecurringDto,
  ): Promise<RecurringAvailability> {
    if (!this.isValidTimeRange(dto.startTime, dto.endTime)) {
      throw new BadRequestException(
        'End time must be after start time',
      );
    }

    const existing = await this.recurringRepo.find({
      where: { doctor: { id: doctor.id }, dayOfWeek: dto.dayOfWeek },
    });

    for (const slot of existing) {
      if (this.hasOverlap(dto.startTime, dto.endTime, slot.startTime, slot.endTime)) {
        throw new ConflictException(
          `Time slot overlaps with existing slot: ${slot.startTime} - ${slot.endTime}`,
        );
      }
    }

    const availability = this.recurringRepo.create({ ...dto, doctor });
    return this.recurringRepo.save(availability);
  }

  async getRecurring(doctor: DoctorProfile): Promise<RecurringAvailability[]> {
    return this.recurringRepo.find({
      where: { doctor: { id: doctor.id } },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async updateRecurring(
    doctor: DoctorProfile,
    id: string,
    dto: UpdateRecurringDto,
  ): Promise<RecurringAvailability> {
    const slot = await this.recurringRepo.findOne({
      where: { id, doctor: { id: doctor.id } },
    });
    if (!slot) throw new NotFoundException('Availability slot not found');

    const startTime = dto.startTime || slot.startTime;
    const endTime = dto.endTime || slot.endTime;

    if (!this.isValidTimeRange(startTime, endTime)) {
      throw new BadRequestException('End time must be after start time');
    }

    const existing = await this.recurringRepo.find({
      where: {
        doctor: { id: doctor.id },
        dayOfWeek: dto.dayOfWeek || slot.dayOfWeek,
      },
    });

    for (const s of existing) {
      if (s.id === id) continue;
      if (this.hasOverlap(startTime, endTime, s.startTime, s.endTime)) {
        throw new ConflictException(
          `Time slot overlaps with existing slot: ${s.startTime} - ${s.endTime}`,
        );
      }
    }

    Object.assign(slot, dto);
    return this.recurringRepo.save(slot);
  }

  async deleteRecurring(doctor: DoctorProfile, id: string): Promise<void> {
    const slot = await this.recurringRepo.findOne({
      where: { id, doctor: { id: doctor.id } },
    });
    if (!slot) throw new NotFoundException('Availability slot not found');
    await this.recurringRepo.remove(slot);
  }

  // ── Custom Override ──────────────────────────────────────

  async createOverride(
    doctor: DoctorProfile,
    dto: CreateOverrideDto,
  ): Promise<CustomAvailability> {
    if (!dto.isUnavailable) {
      if (!dto.startTime || !dto.endTime) {
        throw new BadRequestException(
          'startTime and endTime are required when not marking as unavailable',
        );
      }
      if (!this.isValidTimeRange(dto.startTime, dto.endTime)) {
        throw new BadRequestException('End time must be after start time');
      }

      const existing = await this.customRepo.find({
        where: { doctor: { id: doctor.id }, date: dto.date },
      });

      for (const slot of existing) {
        if (this.hasOverlap(
          dto.startTime, dto.endTime,
          slot.startTime, slot.endTime,
        )) {
          throw new ConflictException(
            `Time slot overlaps with existing override: ${slot.startTime} - ${slot.endTime}`,
          );
        }
      }
    }

    const override = this.customRepo.create({ ...dto, doctor });
    return this.customRepo.save(override);
  }

  async getByDate(
    doctor: DoctorProfile,
    date: string,
  ): Promise<{
    date: string;
    hasCustomOverride: boolean;
    slots: any[];
  }> {
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    const customSlots = await this.customRepo.find({
      where: { doctor: { id: doctor.id }, date },
    });

    if (customSlots.length > 0) {
      return {
        date,
        hasCustomOverride: true,
        slots: customSlots,
      };
    }

    const dayOfWeek = new Date(date + 'T00:00:00')
  .toLocaleDateString('en-US', { weekday: 'long' })
  .toUpperCase();

    const recurringSlots = await this.recurringRepo.find({
      where: {
        doctor: { id: doctor.id },
        dayOfWeek: dayOfWeek as any,
      },
    });

    return {
      date,
      hasCustomOverride: false,
      slots: recurringSlots,
    };
  }
}