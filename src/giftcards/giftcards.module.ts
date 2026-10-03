import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GiftCard } from '../entities/gift-card.entity';
import { GiftCardTransaction } from '../entities/gift-card-transaction.entity';
import { GiftCardSettings } from '../entities/gift-card-settings.entity';
import { User } from '../entities/user.entity';
import { GiftCardsService } from './giftcards.service';
import { GiftCardsController } from './giftcards.controller';
import { GiftCardMailService } from './giftcard-mail.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GiftCard,
      GiftCardTransaction,
      GiftCardSettings,
      User,
    ]),
  ],
  controllers: [GiftCardsController],
  providers: [GiftCardsService, GiftCardMailService],
  exports: [GiftCardsService],
})
export class GiftCardsModule {}
