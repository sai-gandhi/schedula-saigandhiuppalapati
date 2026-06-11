import { IsString, IsDateString, Matches, IsBoolean, IsOptional } from 'class-validator';

export class CreateOverrideDto {
  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:MM format',
  })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in HH:MM format',
  })
  endTime?: string;

  @IsOptional()
  @IsBoolean()
  isUnavailable?: boolean;
}