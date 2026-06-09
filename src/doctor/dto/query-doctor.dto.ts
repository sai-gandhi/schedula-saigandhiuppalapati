import { IsOptional, IsString, IsInt, IsBoolean, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QueryDoctorDto {
  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  availability?: boolean;
}