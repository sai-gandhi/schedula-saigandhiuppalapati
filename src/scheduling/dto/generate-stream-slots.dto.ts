import { IsDateString, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateStreamSlotsDto {
  @IsDateString()
  date: string;

  @IsInt()
  @Min(5)
  @Max(120)
  @Type(() => Number)
  duration: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  @Type(() => Number)
  bufferTime?: number = 0;
}