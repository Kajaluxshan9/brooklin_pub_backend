import { PartialType } from '@nestjs/mapped-types';
import { CreateMeasurementTypeDto } from './create-measurement-type.dto';

export class UpdateMeasurementTypeDto extends PartialType(
  CreateMeasurementTypeDto,
) {}
