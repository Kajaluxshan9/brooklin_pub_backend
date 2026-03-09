import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpecialsService } from './specials.service';
import { SpecialsController } from './specials.controller';
import { Special } from '../entities/special.entity';
import { UploadModule } from '../upload/upload.module';
import { NewsletterModule } from '../newsletter/newsletter.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Special]),
    UploadModule,
    NewsletterModule,
    NotificationsModule,
  ],
  controllers: [SpecialsController],
  providers: [SpecialsService],
  exports: [SpecialsService],
})
export class SpecialsModule {}
