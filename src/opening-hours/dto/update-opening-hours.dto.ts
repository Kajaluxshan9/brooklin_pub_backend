import { PartialType } from '@nestjs/mapped-types';
import { CreateOpeningHoursDto } from './create-opening-hours.dto';

export class UpdateOpeningHoursDto extends PartialType(CreateOpeningHoursDto) {}
