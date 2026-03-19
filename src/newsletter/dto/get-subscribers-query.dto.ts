import { IsOptional, IsInt, Min, Max, IsIn, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export type SubscriberFilterStatus =
  | 'all'
  | 'active'
  | 'unsubscribed'
  | 'promo_pending'
  | 'promo_sent'
  | 'promo_claimed';

export class GetSubscribersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsIn(['all', 'active', 'unsubscribed', 'promo_pending', 'promo_sent', 'promo_claimed'])
  status?: SubscriberFilterStatus = 'all';

  @IsOptional()
  @IsString()
  search?: string;
}
