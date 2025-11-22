import { PartialType } from '@nestjs/mapped-types';
import { CreateMenuItemMeasurementDto } from './create-menu-item-measurement.dto';

export class UpdateMenuItemMeasurementDto extends PartialType(
  CreateMenuItemMeasurementDto,
) {}
