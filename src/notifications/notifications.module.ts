import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduledNotification } from '../entities/scheduled-notification.entity';
import { Special } from '../entities/special.entity';
import { Event } from '../entities/event.entity';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { NewsletterModule } from '../newsletter/newsletter.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScheduledNotification, Special, Event]),
    NewsletterModule,
  ],
  providers: [NotificationSchedulerService],
  exports: [NotificationSchedulerService],
})
export class NotificationsModule {}
