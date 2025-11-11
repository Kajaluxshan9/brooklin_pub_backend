import { PartialType } from '@nestjs/mapped-types';
import { CreatePrimaryCategoryDto } from './create-primary-category.dto';

export class UpdatePrimaryCategoryDto extends PartialType(
  CreatePrimaryCategoryDto,
) {}
