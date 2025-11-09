import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class ReorderCategoryDto {
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsNumber()
  @IsNotEmpty()
  newOrder: number;
}
