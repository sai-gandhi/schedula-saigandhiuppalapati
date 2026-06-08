import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateDoctorDto {
  @IsString()
  fullName: string;

  @IsString()
  specialization: string;

  @IsString()
  experience: string;

  @IsString()
  qualification: string;

  @IsNumber()
  consultationFee: number;

  @IsString()
  availabilityHours: string;

  @IsOptional()
  @IsString()
  profileDetails?: string;
}