import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreatePatientDto {
  @IsString()
  fullName: string;

  @IsNumber()
  age: number;

  @IsString()
  gender: string;

  @IsString()
  contactDetails: string;

  @IsOptional()
  @IsString()
  healthInfo?: string;
}