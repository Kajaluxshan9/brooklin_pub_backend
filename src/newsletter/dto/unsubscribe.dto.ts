import { IsNotEmpty, IsString } from 'class-validator';

export class UnsubscribeDto {
  @IsString()
  @IsNotEmpty({ message: 'Unsubscribe token is required' })
  token: string;
}
