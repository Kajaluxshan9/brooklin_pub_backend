import { IsString, IsIn, IsNotEmpty } from 'class-validator';

export class MoveOrderDto {
  @IsString()
  @IsIn(['up', 'down'])
  @IsNotEmpty()
  direction: 'up' | 'down';
}
