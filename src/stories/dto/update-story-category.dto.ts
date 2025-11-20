import { PartialType } from '@nestjs/mapped-types';
import { CreateStoryCategoryDto } from './create-story-category.dto';

export class UpdateStoryCategoryDto extends PartialType(
  CreateStoryCategoryDto,
) {}
