import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
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

  // ─── Admin Query Methods ────────────────────────────────────────

  async findAll(): Promise<ScheduledNotification[]> {
    return this.notificationRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getStats(): Promise<{
    total: number;
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
  }> {
    const total = await this.notificationRepo.count();
    const pending = await this.notificationRepo.count({
      where: { status: NotificationStatus.PENDING },
    });
    const sent = await this.notificationRepo.count({
      where: { status: NotificationStatus.SENT },
    });
    const failed = await this.notificationRepo.count({
      where: { status: NotificationStatus.FAILED },
    });
    return {
      total,
      pending,
      sent,
      failed,
      cancelled: total - pending - sent - failed,
    };
  }

  /**
   * Returns notifications enriched with the referenced special/event title.
   */
  async findAllWithDetails(): Promise<
    (ScheduledNotification & { referenceTitle: string })[]
  > {
    const notifications = await this.findAll();

    const specialIds = notifications
      .filter((n) => n.type === NotificationType.SPECIAL)
      .map((n) => n.referenceId);
    const eventIds = notifications
      .filter((n) => n.type === NotificationType.EVENT)
      .map((n) => n.referenceId);

    const [specials, events] = await Promise.all([
      specialIds.length > 0
        ? this.specialRepo
            .createQueryBuilder('s')
            .select(['s.id', 's.title'])
            .where('s.id IN (:...ids)', { ids: specialIds })
            .getMany()
        : Promise.resolve([]),
      eventIds.length > 0
        ? this.eventRepo
            .createQueryBuilder('e')
            .select(['e.id', 'e.title'])
            .where('e.id IN (:...ids)', { ids: eventIds })
            .getMany()
        : Promise.resolve([]),
    ]);

    const titleMap = new Map<string, string>();
    specials.forEach((s) => titleMap.set(s.id, s.title));
    events.forEach((e) => titleMap.set(e.id, e.title));

    return notifications.map((n) => ({
      ...n,
      referenceTitle: titleMap.get(n.referenceId) || '(Deleted)',
    }));
  }
}
