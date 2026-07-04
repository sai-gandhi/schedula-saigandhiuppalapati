import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateLeaveDto {
  @IsDateString()
  leaveDate: string;

  @IsOptional()
  @IsString()
  reason?: string;
}