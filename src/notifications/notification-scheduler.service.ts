import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import {
  ScheduledNotification,
  NotificationType,
  NotificationStatus,
} from '../entities/scheduled-notification.entity';
import { Special } from '../entities/special.entity';
import { Event } from '../entities/event.entity';
import { NewsletterService } from '../newsletter/newsletter.service';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    @InjectRepository(ScheduledNotification)
    private notificationRepo: Repository<ScheduledNotification>,
    @InjectRepository(Special)
    private specialRepo: Repository<Special>,
    @InjectRepository(Event)
    private eventRepo: Repository<Event>,
    private newsletterService: NewsletterService,
  ) {}

  /**
   * Runs every minute — picks up all PENDING notifications whose
   * scheduledFor time has passed and dispatches them.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledNotifications(): Promise<void> {
    const now = new Date();

    const dueNotifications = await this.notificationRepo.find({
      where: {
        status: NotificationStatus.PENDING,
        scheduledFor: LessThanOrEqual(now),
      },
    });

    if (dueNotifications.length === 0) return;

    this.logger.log(
      `Processing ${dueNotifications.length} due notification(s)`,
    );

    for (const notification of dueNotifications) {
      try {
        await this.dispatchNotification(notification);
        notification.status = NotificationStatus.SENT;
        notification.sentAt = new Date();
      } catch (err) {
        this.logger.error(
          `Failed to dispatch notification ${notification.id}`,
          err,
        );
        notification.status = NotificationStatus.FAILED;
      }
      await this.notificationRepo.save(notification);
    }
  }

  /**
   * Schedule a notification for a specific display start time.
   * If the time is in the past → send immediately.
   * Returns true if notification was sent immediately, false if scheduled.
   */
  async scheduleOrSendImmediately(
    type: NotificationType,
    referenceId: string,
    displayStartDate: Date | null | undefined,
  ): Promise<boolean> {
    const now = new Date();

    // No display start date or in the past → send immediately
    if (!displayStartDate || new Date(displayStartDate) <= now) {
      return true; // Signal caller to send immediately
    }

    // Future date → schedule
    await this.createScheduledNotification(
      type,
      referenceId,
      new Date(displayStartDate),
    );
    this.logger.log(
      `Scheduled ${type} notification for ${referenceId} at ${displayStartDate}`,
    );
    return false;
  }

  /**
   * Cancel any pending notifications for a given reference (e.g. on delete).
   */
  async cancelPendingNotifications(
    type: NotificationType,
    referenceId: string,
  ): Promise<void> {
    await this.notificationRepo.update(
      {
        type,
        referenceId,
        status: NotificationStatus.PENDING,
      },
      { status: NotificationStatus.CANCELLED },
    );
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private async createScheduledNotification(
    type: NotificationType,
    referenceId: string,
    scheduledFor: Date,
  ): Promise<ScheduledNotification> {
    // Cancel any existing pending notification for the same reference
    await this.cancelPendingNotifications(type, referenceId);

    const notification = this.notificationRepo.create({
      type,
      referenceId,
      scheduledFor,
      status: NotificationStatus.PENDING,
    });
    return this.notificationRepo.save(notification);
  }

  private async dispatchNotification(
    notification: ScheduledNotification,
  ): Promise<void> {
    switch (notification.type) {
      case NotificationType.SPECIAL:
        await this.dispatchSpecialNotification(notification.referenceId);
        break;
      case NotificationType.EVENT:
        await this.dispatchEventNotification(notification.referenceId);
        break;
    }
  }

  private async dispatchSpecialNotification(specialId: string): Promise<void> {
    const special = await this.specialRepo.findOne({
      where: { id: specialId },
    });

    if (!special) {
      this.logger.warn(
        `Special ${specialId} not found — skipping notification`,
      );
      return;
    }

    if (!special.isActive) {
      this.logger.log(
        `Special ${specialId} is inactive — skipping notification`,
      );
      return;
    }

    await this.newsletterService.notifyNewSpecial(special);
  }

  private async dispatchEventNotification(eventId: string): Promise<void> {
    const event = await this.eventRepo.findOne({
      where: { id: eventId },
    });

    if (!event) {
      this.logger.warn(`Event ${eventId} not found — skipping notification`);
      return;
    }

    if (!event.isActive) {
      this.logger.log(`Event ${eventId} is inactive — skipping notification`);
      return;
    }

    await this.newsletterService.notifyNewEvent(event);
  }
}
