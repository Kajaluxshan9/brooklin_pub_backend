import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class ReorderMenuItemDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsNumber()
  @IsNotEmpty()
  newOrder: number;
}
