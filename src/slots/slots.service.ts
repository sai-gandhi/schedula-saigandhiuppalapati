import {
  Injectable, NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Slot, SlotStatus } from './slot.entity';
import { GenerateSlotsDto } from './dto/generate-slots.dto';
import { DoctorService } from '../doctor/doctor.service';
import { AvailabilityService } from '../availability/availability.service';

@Injectable()
export class SlotsService {
  constructor(
    @InjectRepository(Slot)
    private slotRepo: Repository<Slot>,
    private doctorService: DoctorService,
    private availabilityService: AvailabilityService,
  ) {}

  private trimTime(time: string): string {
    return time.substring(0, 5);
  }

  private generateTimeSlots(
    startTime: string,
    endTime: string,
    duration: number,
  ): { startTime: string; endTime: string }[] {
    const slots: { startTime: string; endTime: string }[] = [];
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    let current = startH * 60 + startM;
    const end = endH * 60 + endM;

    console.log('current:', current, 'end:', end, 'duration:', duration);

    while (current + Number(duration) <= end) {
      const slotStart = `${String(Math.floor(current / 60)).padStart(2, '0')}:${String(current % 60).padStart(2, '0')}`;
      current += duration;
      const slotEnd = `${String(Math.floor(current / 60)).padStart(2, '0')}:${String(current % 60).padStart(2, '0')}`;
      slots.push({ startTime: slotStart, endTime: slotEnd });
      console.log('Generated slot:', slotStart, '-', slotEnd);
    }

    return slots;
  }

  private isFutureSlot(date: string, startTime: string): boolean {
  const now = new Date();
  const trimmed = this.trimTime(startTime); // "10:00:00" → "10:00"
  const slotDateTime = new Date(`${date}T${trimmed}:00`);
  return slotDateTime > now;
}

  async generateSlots(doctorId: string, dto: GenerateSlotsDto): Promise<Slot[]> {
    const doctor = await this.doctorService.findById(doctorId);

    console.log('Doctor ID:', doctor.id);
    console.log('Date:', dto.date);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const slotDate = new Date(dto.date + 'T00:00:00');
    slotDate.setHours(0, 0, 0, 0);

    if (slotDate < today) {
      throw new BadRequestException('Cannot generate slots for past dates');
    }

    const dayOfWeek = new Date(dto.date + 'T00:00:00')
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toUpperCase();
    console.log('Day of week:', dayOfWeek);

    const availability = await this.availabilityService.getByDate(
      doctor, dto.date,
    );

    console.log('Availability:', JSON.stringify(availability));

    if (!availability.slots || availability.slots.length === 0) {
      throw new NotFoundException('No availability found for this date');
    }

    if (availability.hasCustomOverride) {
      const isUnavailable = availability.slots.some(
        (s: any) => s.isUnavailable,
      );
      if (isUnavailable) {
        throw new NotFoundException('Doctor is unavailable on this date');
      }
    }

    await this.slotRepo.delete({
      doctor: { id: doctor.id },
      date: dto.date,
    });

    const generatedSlots: Slot[] = [];
    const duration = Number(dto.duration) || 30;

    for (const avail of availability.slots) {
      const start = this.trimTime(avail.startTime);
      const end = this.trimTime(avail.endTime);
      console.log('Start:', start, 'End:', end, 'Duration:', duration);

      const timeSlots = this.generateTimeSlots(start, end, Number(duration));
      console.log('Time slots generated:', timeSlots);

      for (const ts of timeSlots) {
        const slot = this.slotRepo.create({
          doctor,
          date: dto.date,
          startTime: ts.startTime,
          endTime: ts.endTime,
          status: SlotStatus.AVAILABLE,
          duration,
        });
        generatedSlots.push(slot);
      }
    }

    console.log('Total slots to save:', generatedSlots.length);
    const saved = await this.slotRepo.save(generatedSlots);
    console.log('Saved slots:', saved.length);
    return saved;
  }

  async getAvailableSlots(doctorId: string, date: string): Promise<{
  doctorId: string;
  date: string;
  slots: Slot[];
  total: number;
}> {
  if (!date) throw new BadRequestException('Date is required');

  if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const slotDate = new Date(date + 'T00:00:00');
  slotDate.setHours(0, 0, 0, 0);

  if (slotDate < today) {
    throw new BadRequestException('Cannot fetch slots for past dates');
  }

  await this.doctorService.findById(doctorId);

  const allSlots = await this.slotRepo
    .createQueryBuilder('slot')
    .where('slot.doctorId = :doctorId', { doctorId })
    .andWhere('slot.date = :date', { date })
    .andWhere('slot.status = :status', { status: SlotStatus.AVAILABLE })
    .orderBy('slot.startTime', 'ASC')
    .getMany();

  console.log('All slots found:', allSlots.length);

  const futureSlots = allSlots.filter((slot) => {
  const isFuture = this.isFutureSlot(date, slot.startTime);
  console.log(`Slot ${slot.startTime} - isFuture: ${isFuture}`);
  return isFuture;
});

  console.log('Future slots:', futureSlots.length);

  return {
    doctorId,
    date,
    slots: futureSlots,
    total: futureSlots.length,
  };
}
}
