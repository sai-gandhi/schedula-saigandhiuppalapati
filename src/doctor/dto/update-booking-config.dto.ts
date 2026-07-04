import { IsBoolean, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateBookingConfigDto {
  @IsBoolean()
  allowFutureBooking: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  @Type(() => Number)
  maxFutureBookingDays?: number | null;
}