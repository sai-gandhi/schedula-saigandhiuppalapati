import { IsEnum } from 'class-validator';
import { SchedulingType } from '../../doctor/doctor.entity';

export class SetSchedulingTypeDto {
  @IsEnum(SchedulingType)
  schedulingType: SchedulingType;
}