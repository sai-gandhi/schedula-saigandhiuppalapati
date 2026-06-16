import { IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateWaveSlotsDto {
  @IsDateString()
  date: string;

  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  maxCapacity: number;
}