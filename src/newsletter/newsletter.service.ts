import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';
import { Subscriber } from '../entities/subscriber.entity';
import { SubscribeDto, GetSubscribersQueryDto } from './dto';
import { getRequiredEnv, getOptionalEnv } from '../config/env.validation';
import { ILike, IsNull, Not } from 'typeorm';

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);
  private transporter: nodemailer.Transporter;
  private readonly emailFrom: string;
  private readonly frontendUrl: string;
  private readonly backendPublicUrl: string;
  private readonly logoUrl: string;

  constructor(
    @InjectRepository(Subscriber)
    private subscriberRepository: Repository<Subscriber>,
  ) {
    // Use events email config (falls back to primary)
    const host =
      getOptionalEnv('EMAIL_EVENTS_HOST') || getRequiredEnv('EMAIL_HOST');
    const port = Number(
      getOptionalEnv('EMAIL_EVENTS_PORT') || getRequiredEnv('EMAIL_PORT'),
    );
    const user =
      getOptionalEnv('EMAIL_EVENTS_USER') || getRequiredEnv('EMAIL_USER');
    const pass =
      getOptionalEnv('EMAIL_EVENTS_PASS') || getRequiredEnv('EMAIL_PASS');
    this.emailFrom =
      getOptionalEnv('EMAIL_EVENTS_FROM') ||
      'Brooklin Pub <' + getRequiredEnv('EMAIL_FROM') + '>';

    this.frontendUrl =
      getOptionalEnv('FRONTEND_URL') || 'http://localhost:3000';
    this.backendPublicUrl = getRequiredEnv('BACKEND_PUBLIC_URL');
    this.logoUrl = `${this.backendPublicUrl}/uploads/assets/brooklinpub-logo.png`;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    // Verify transporter
    (async () => {
      try {
        await this.transporter.verify();
        this.logger.log('Newsletter SMTP transporter verified');
      } catch (err) {
        this.logger.warn(
          'Newsletter SMTP transporter could not be verified',
          err,
        );
        if (getRequiredEnv('NODE_ENV') !== 'production') {
          const testAccount = await nodemailer.createTestAccount();
          this.transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: { user: testAccount.user, pass: testAccount.pass },
          });
          this.logger.log(`Newsletter using Ethereal: ${testAccount.user}`);
        }
      }
    })();
  }

  /**
   * Subscribe a new email to the newsletter
   */
  async subscribe(subscribeDto: SubscribeDto): Promise<{ message: string }> {
    const email = subscribeDto.email.toLowerCase().trim();

    // Check if already subscribed
    const existing = await this.subscriberRepository.findOne({
      where: { email },
    });

    if (existing) {
      if (existing.isActive) {
        throw new ConflictException('This email is already subscribed');
      }
      // Re-activate previously unsubscribed user
      existing.isActive = true;
      existing.unsubscribedAt = null;
      await this.subscriberRepository.save(existing);
      return {
        message: 'Welcome back! Your subscription has been reactivated.',
      };
    }

    const subscriber = this.subscriberRepository.create({
      email,
      unsubscribeToken: crypto.randomUUID(),
    });

    await this.subscriberRepository.save(subscriber);

    // Send welcome email (non-blocking)
    this.sendWelcomeEmail(subscriber).catch((err) =>
      this.logger.error('Failed to send welcome email', err),
    );

    return { message: 'Successfully subscribed to our newsletter!' };
  }

  /**
   * Unsubscribe via token
   */
  async unsubscribe(token: string): Promise<{ message: string }> {
    const subscriber = await this.subscriberRepository.findOne({
      where: { unsubscribeToken: token },
    });

    if (!subscriber) {
      throw new NotFoundException('Invalid unsubscribe link');
    }

    if (!subscriber.isActive) {
      return { message: 'You have already been unsubscribed.' };
    }

    subscriber.isActive = false;
    subscriber.unsubscribedAt = new Date();
    await this.subscriberRepository.save(subscriber);

    return { message: 'You have been successfully unsubscribed.' };
  }

  /**
   * Get paginated + filtered subscribers (admin only)
   */
  async findAll(query: GetSubscribersQueryDto): Promise<{
    data: Subscriber[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const status = query.status ?? 'all';
    const search = query.search?.trim();

    // Build where clause
    const where: Record<string, unknown>[] = [];

    const buildStatusCondition = (): Record<string, unknown> => {
      switch (status) {
        case 'active':
          return { isActive: true };
        case 'unsubscribed':
          return { isActive: false };
        case 'promo_pending':
          return { isActive: true, promoCodeSent: false };
        case 'promo_sent':
          return { promoCodeSent: true, promoClaimed: false };
        case 'promo_claimed':
          return { promoClaimed: true };
        default:
          return {};
      }
    };

    const statusCondition = buildStatusCondition();

    if (search) {
      // When searching with a filter, combine both conditions in the same object
      where.push({ ...statusCondition, email: ILike(`%${search}%`) });
    } else {
      where.push(statusCondition);
    }

    const [data, total] = await this.subscriberRepository.findAndCount({
      where,
      order: { subscribedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get active subscribers (admin only)
   */
  async findActive(): Promise<Subscriber[]> {
    return this.subscriberRepository.find({
      where: { isActive: true },
      order: { subscribedAt: 'DESC' },
    });
  }

  /**
   * Get subscriber stats
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    unsubscribed: number;
    promoSent: number;
    promoPending: number;
  }> {
    const total = await this.subscriberRepository.count();
    const active = await this.subscriberRepository.count({
      where: { isActive: true },
    });
    const promoSent = await this.subscriberRepository.count({
      where: { promoCodeSent: true },
    });
    return {
      total,
      active,
      unsubscribed: total - active,
      promoSent,
      promoPending: active - promoSent > 0 ? active - promoSent : 0,
    };
  }

  /**
   * Send a one-time promo code to a specific subscriber (admin only).
   *
   * Guards:
   *  - Subscriber must exist
   *  - Subscriber must be active (inactive users cannot receive promo)
   *  - Promo must not have been sent before (persists across unsubscribe/re-subscribe cycles)
   *
   * Concurrency: uses a pessimistic write-lock inside a transaction so that
   * two simultaneous admin requests cannot both pass the promoCodeSent guard
   * and generate two codes for the same subscriber.
   */
  async sendPromoCode(id: string): Promise<{ message: string; promoCode: string }> {
    let savedEmail = '';
    let savedCode = '';

    await this.subscriberRepository.manager.transaction(async (manager) => {
      const subscriber = await manager.findOne(Subscriber, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!subscriber) {
        throw new NotFoundException(`Subscriber with ID ${id} not found`);
      }

      if (!subscriber.isActive) {
        throw new BadRequestException(
          'Promo codes can only be sent to active subscribers',
        );
      }

      if (subscriber.promoCodeSent) {
        throw new BadRequestException(
          'Promo code has already been sent to this subscriber',
        );
      }

      const promoCode = this.generatePromoCode();
      subscriber.promoCode = promoCode;
      subscriber.promoCodeSent = true;
      subscriber.promoSentAt = new Date();

      await manager.save(Subscriber, subscriber);

      savedEmail = subscriber.email;
      savedCode = promoCode;
    });

    // Send email outside transaction (non-blocking)
    const subscriberForEmail = await this.subscriberRepository.findOne({
      where: { id },
    });
    if (subscriberForEmail) {
      this.sendPromoEmail(subscriberForEmail).catch((err) =>
        this.logger.error(`Failed to send promo email to ${savedEmail}`, err),
      );
    }

    this.logger.log(`Promo code ${savedCode} queued for ${savedEmail}`);

    return { message: 'Promo code sent successfully', promoCode: savedCode };
  }

  /**
   * Mark a subscriber's promo code as claimed at the pub (admin only).
   * Can only be called after the promo has been sent.
   */
  async markPromoClaimed(id: string): Promise<{ message: string }> {
    const subscriber = await this.subscriberRepository.findOne({ where: { id } });

    if (!subscriber) {
      throw new NotFoundException(`Subscriber with ID ${id} not found`);
    }

    if (!subscriber.promoCodeSent) {
      throw new BadRequestException(
        'No promo code has been sent to this subscriber yet',
      );
    }

    if (subscriber.promoClaimed) {
      throw new BadRequestException('Promo has already been marked as claimed');
    }

    subscriber.promoClaimed = true;
    subscriber.promoClaimedAt = new Date();

    await this.subscriberRepository.save(subscriber);

    this.logger.log(`Promo claimed for ${subscriber.email}`);

    return { message: 'Promo code marked as claimed' };
  }

  /**
   * Delete a subscriber (admin only)
   */
  async remove(id: string): Promise<void> {
    const subscriber = await this.subscriberRepository.findOne({
      where: { id },
    });
    if (!subscriber) {
      throw new NotFoundException(`Subscriber with ID ${id} not found`);
    }
    await this.subscriberRepository.remove(subscriber);
  }

  /**
   * Send newsletter email to all active subscribers about a new event.
   * Message is specific to the event type (Live Music, Trivia Night, etc.).
   */
  async notifyNewEvent(event: {
    id: string;
    title: string;
    description: string;
    type: string;
    eventStartDate: Date;
    imageUrls?: string[];
  }): Promise<void> {
    const subscribers = await this.findActive();
    if (subscribers.length === 0) {
      this.logger.log('No active subscribers for event notification');
      return;
    }

    const eventDate = new Date(event.eventStartDate).toLocaleDateString(
      'en-US',
      {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Toronto',
      },
    );

    const eventTime = new Date(event.eventStartDate).toLocaleTimeString(
      'en-US',
      {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Toronto',
      },
    );

    // Type-specific labels and emoji
    const eventMeta = this.getEventTypeMeta(event.type);

    const eventUrl = `${this.frontendUrl}/events`;
    const imageUrl =
      event.imageUrls && event.imageUrls.length > 0
        ? this.getFullImageUrl(event.imageUrls[0])
        : null;

    for (const subscriber of subscribers) {
      const unsubscribeUrl = `${this.frontendUrl}/unsubscribe?token=${subscriber.unsubscribeToken}`;

      const html = this.buildEmailTemplate({
        preheader: `${eventMeta.label}: ${event.title} — ${eventDate} at ${eventTime}`,
        heading: eventMeta.heading,
        title: event.title,
        description: event.description,
        date: `${eventDate} at ${eventTime}`,
        imageUrl,
        ctaText: eventMeta.ctaText,
        ctaUrl: eventUrl,
        unsubscribeUrl,
      });

      this.sendMail(
        subscriber.email,
        `${eventMeta.emoji} ${eventMeta.label}: ${event.title} — ${eventDate}`,
        html,
      ).catch((err) =>
        this.logger.error(
          `Failed to send event notification to ${subscriber.email}`,
          err,
        ),
      );
    }

    this.logger.log(
      `${eventMeta.label} notification queued for ${subscribers.length} subscribers`,
    );
  }

  /**
   * Send newsletter email to all active subscribers about a new special.
   * Message is specific to the special type and day-of-week for daily specials.
   */
  async notifyNewSpecial(special: {
    id: string;
    title: string;
    description: string;
    type: string;
    dayOfWeek?: string | null;
    specialCategory?: string | null;
    displayStartDate?: Date | null;
    specialStartDate?: Date | null;
    specialEndDate?: Date | null;
    imageUrls?: string[];
  }): Promise<void> {
    const subscribers = await this.findActive();
    if (subscribers.length === 0) {
      this.logger.log('No active subscribers for special notification');
      return;
    }

    // Build type-specific messaging
    const specialMeta = this.getSpecialTypeMeta(
      special.type,
      special.dayOfWeek ?? null,
      special.specialCategory ?? null,
    );

    // For seasonal specials, include validity dates
    let dateInfo: string | undefined;
    if (special.type === 'seasonal' && special.specialStartDate) {
      const fmt = (d: Date) =>
        new Date(d).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          timeZone: 'America/Toronto',
        });
      dateInfo = special.specialEndDate
        ? `${fmt(special.specialStartDate)} — ${fmt(special.specialEndDate)}`
        : `Starting ${fmt(special.specialStartDate)}`;
    }

    const specialUrl = `${this.frontendUrl}/specials`;
    const imageUrl =
      special.imageUrls && special.imageUrls.length > 0
        ? this.getFullImageUrl(special.imageUrls[0])
        : null;

    for (const subscriber of subscribers) {
      const unsubscribeUrl = `${this.frontendUrl}/unsubscribe?token=${subscriber.unsubscribeToken}`;

      const html = this.buildEmailTemplate({
        preheader: `${specialMeta.label}: ${special.title}`,
        heading: specialMeta.heading,
        title: special.title,
        description: special.description,
        date: dateInfo,
        imageUrl,
        ctaText: specialMeta.ctaText,
        ctaUrl: specialUrl,
        unsubscribeUrl,
      });

      this.sendMail(
        subscriber.email,
        `${specialMeta.emoji} ${specialMeta.label}: ${special.title}`,
        html,
      ).catch((err) =>
        this.logger.error(
          `Failed to send special notification to ${subscriber.email}`,
          err,
        ),
      );
    }

    this.logger.log(
      `${specialMeta.label} notification queued for ${subscribers.length} subscribers`,
    );
  }

  // ─── Type-Specific Messaging ───────────────────────────────────

  private getEventTypeMeta(eventType: string): {
    label: string;
    heading: string;
    emoji: string;
    ctaText: string;
  } {
    const meta: Record<
      string,
      { label: string; heading: string; emoji: string; ctaText: string }
    > = {
      live_music: {
        label: 'Live Music',
        heading: 'Live Music Night at Brooklin Pub!',
        emoji: '🎵',
        ctaText: 'See the Lineup',
      },
      sports_viewing: {
        label: 'Sports Viewing',
        heading: 'Game Day at Brooklin Pub!',
        emoji: '🏆',
        ctaText: 'Join the Watch Party',
      },
      trivia_night: {
        label: 'Trivia Night',
        heading: 'Trivia Night at Brooklin Pub!',
        emoji: '🧠',
        ctaText: 'Gather Your Team',
      },
      karaoke: {
        label: 'Karaoke Night',
        heading: 'Karaoke Night at Brooklin Pub!',
        emoji: '🎤',
        ctaText: 'Warm Up Your Vocals',
      },
      private_party: {
        label: 'Special Party',
        heading: 'Special Party at Brooklin Pub!',
        emoji: '🥂',
        ctaText: 'View Event Details',
      },
      special_event: {
        label: 'Special Event',
        heading: 'Something Special at Brooklin Pub!',
        emoji: '🎉',
        ctaText: 'View Event Details',
      },
    };

    return (
      meta[eventType] || {
        label: 'New Event',
        heading: 'New Event at Brooklin Pub!',
        emoji: '🎉',
        ctaText: 'View Event Details',
      }
    );
  }

  private getSpecialTypeMeta(
    specialType: string,
    dayOfWeek: string | null,
    specialCategory: string | null,
  ): {
    label: string;
    heading: string;
    emoji: string;
    ctaText: string;
  } {
    // Capitalize day name
    const dayName = dayOfWeek
      ? dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)
      : null;
    const isLateNight = specialCategory === 'late_night';

    const meta: Record<
      string,
      { label: string; heading: string; emoji: string; ctaText: string }
    > = {
      daily: {
        label: dayName
          ? isLateNight
            ? `${dayName} Late Night Special`
            : `${dayName} Special`
          : isLateNight
            ? 'Late Night Special'
            : 'Daily Special',
        heading: dayName
          ? isLateNight
            ? `${dayName} Late Night Special at Brooklin Pub!`
            : `${dayName} Special at Brooklin Pub!`
          : isLateNight
            ? 'Late Night Special at Brooklin Pub!'
            : 'New Daily Special at Brooklin Pub!',
        emoji: isLateNight ? '🌙' : '📅',
        ctaText: "View Today's Special",
      },
      game_time: {
        label: 'Game Time Special',
        heading: 'Game Time Special at Brooklin Pub!',
        emoji: '🏈',
        ctaText: 'View Game Time Deal',
      },
      day_time: {
        label: 'Day Time Special',
        heading: 'Day Time Special at Brooklin Pub!',
        emoji: '☀️',
        ctaText: 'View Day Time Deal',
      },
      chef: {
        label: "Chef's Special",
        heading: "New Chef's Special at Brooklin Pub!",
        emoji: '👨‍🍳',
        ctaText: "See the Chef's Pick",
      },
      seasonal: {
        label: 'Seasonal Special',
        heading: 'New Seasonal Special at Brooklin Pub!',
        emoji: '🍂',
        ctaText: 'View Seasonal Offer',
      },
    };

    return (
      meta[specialType] || {
        label: 'New Special',
        heading: 'New Special at Brooklin Pub!',
        emoji: '⭐',
        ctaText: 'View Special',
      }
    );
  }

  // ─── Private Helpers ────────────────────────────────────────────

  /**
   * Generate a cryptographically secure 8-character promo code (A-Z, 0-9).
   */
  private generatePromoCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = crypto.randomBytes(8);
    return Array.from(bytes)
      .map((b) => chars[b % chars.length])
      .join('');
  }

  private async sendPromoEmail(subscriber: Subscriber): Promise<void> {
    const unsubscribeUrl = `${this.frontendUrl}/unsubscribe?token=${subscriber.unsubscribeToken}`;

    const html = this.buildPromoEmailTemplate({
      promoCode: subscriber.promoCode!,
      unsubscribeUrl,
    });

    await this.sendMail(
      subscriber.email,
      'Your Complimentary Appetizer Promo Code — Brooklin Pub 🍺',
      html,
    );
  }

  private buildPromoEmailTemplate(opts: {
    promoCode: string;
    unsubscribeUrl: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Your Complimentary Appetizer Promo Code</title>
  <style>
    body, table, td { margin: 0; padding: 0; }
    body { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-spacing: 0; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; max-width: 100%; }
    a { color: #C87941; text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .content-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .hero-text { font-size: 24px !important; }
      .promo-code { font-size: 28px !important; letter-spacing: 8px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #EDE0D0; font-family: 'Segoe UI', -apple-system, Helvetica, Arial, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #EDE0D0;">Your complimentary appetizer promo code from Brooklin Pub&#847; &#847; &#847;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #EDE0D0;">
    <tr>
      <td align="center" style="padding: 40px 16px 48px;">
        <table role="presentation" class="email-container" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 24px rgba(42,21,9,0.08);">

          <!-- Header -->
          <tr>
            <td align="center" style="background-color: #FFFCF8; padding: 36px 32px 28px; border-bottom: 1px solid rgba(42,21,9,0.06);">
              <img src="${this.logoUrl}" alt="Brooklin Pub" width="48" style="width: 48px; height: auto; margin-bottom: 12px;" />
              <p style="margin: 0; font-size: 14px; font-weight: 700; color: #2A1509; letter-spacing: 3px; text-transform: uppercase; font-family: Georgia, 'Times New Roman', serif;">BROOKLIN PUB</p>
              <p style="margin: 6px 0 0; font-size: 11px; color: #C87941; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 500;">&#9733;&ensp;Est. 2014&ensp;&#9733;</p>
            </td>
          </tr>

          <!-- Gold accent line -->
          <tr>
            <td style="height: 3px; background: linear-gradient(90deg, #EDE0D0, #D9A756, #C87941, #D9A756, #EDE0D0);"></td>
          </tr>

          <!-- Hero heading -->
          <tr>
            <td class="content-pad" style="background-color: #FFFCF8; padding: 36px 40px 0;">
              <h1 class="hero-text" style="margin: 0; font-size: 26px; font-weight: 700; color: #2A1509; font-family: Georgia, 'Times New Roman', serif; line-height: 1.3;">A Complimentary Appetizer, Just for You!</h1>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 14px;">
                <tr>
                  <td style="width: 44px; height: 2px; background-color: #D9A756; border-radius: 2px;"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body content -->
          <tr>
            <td class="content-pad" style="background-color: #FFFCF8; padding: 24px 40px 0;">
              <p style="margin: 0; font-size: 15px; line-height: 1.75; color: #5C4033;">
                You are eligible for a complimentary appetizer at Brooklin Pub.<br />
                Visit us and show your promo code to enjoy your one-time offer.<br />
                Thank you for subscribing to our newsletter.<br />
                You may also randomly receive special gifts from us in the future.
              </p>
            </td>
          </tr>

          <!-- Promo Code Box -->
          <tr>
            <td class="content-pad" align="center" style="background-color: #FFFCF8; padding: 32px 40px 12px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td align="center" style="background-color: #FDF3E7; border: 2px dashed #D9A756; border-radius: 14px; padding: 28px 20px;">
                    <p style="margin: 0 0 10px; font-size: 12px; font-weight: 700; color: #8B6914; letter-spacing: 2px; text-transform: uppercase;">Your Promo Code</p>
                    <p class="promo-code" style="margin: 0; font-size: 36px; font-weight: 700; color: #2A1509; letter-spacing: 12px; font-family: 'Courier New', Courier, monospace;">${opts.promoCode}</p>
                    <p style="margin: 12px 0 0; font-size: 12px; color: rgba(42,21,9,0.45);">One-time use &mdash; Show this code at the pub</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td class="content-pad" align="center" style="background-color: #FFFCF8; padding: 24px 40px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius: 10px; background-color: #2A1509;" align="center">
                    <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${this.frontendUrl}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="21%" fillcolor="#2A1509" stroke="f"><v:textbox inset="0,0,0,0"><center style="font-size:15px;font-weight:700;color:#F5EFE6;font-family:Arial,sans-serif;">Visit Brooklin Pub</center></v:textbox></v:roundrect><![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${this.frontendUrl}" style="display: inline-block; padding: 14px 40px; background-color: #2A1509; color: #F5EFE6; font-size: 15px; font-weight: 700; border-radius: 10px; text-decoration: none; letter-spacing: 0.3px; font-family: 'Segoe UI', Arial, sans-serif; text-align: center;">Visit Brooklin Pub&nbsp;&rarr;</a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F5EDE1; padding: 28px 36px; border-top: 1px solid rgba(42,21,9,0.06);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 18px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 0 6px;">
                          <a href="https://www.facebook.com/brooklinpub" style="display: inline-block; text-decoration: none;" title="Facebook">
                            <img src="${this.backendPublicUrl}/uploads/assets/icon-facebook.svg" width="30" height="30" alt="Facebook" style="display: block; border: 0;" />
                          </a>
                        </td>
                        <td style="padding: 0 6px;">
                          <a href="https://www.instagram.com/brooklinpubngrill/" style="display: inline-block; text-decoration: none;" title="Instagram">
                            <img src="${this.backendPublicUrl}/uploads/assets/icon-instagram.svg" width="30" height="30" alt="Instagram" style="display: block; border: 0;" />
                          </a>
                        </td>
                        <td style="padding: 0 6px;">
                          <a href="https://www.tiktok.com/@brooklinpubngrill" style="display: inline-block; text-decoration: none;" title="TikTok">
                            <img src="${this.backendPublicUrl}/uploads/assets/icon-tiktok.svg" width="30" height="30" alt="TikTok" style="display: block; border: 0;" />
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="height: 1px; background-color: rgba(42,21,9,0.08);"></td>
                </tr>
                <tr>
                  <td align="center" style="padding: 18px 0 14px;">
                    <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #6A3A1E; letter-spacing: 0.3px;">Brooklin Pub &amp; Grill</p>
                    <p style="margin: 0 0 2px; font-size: 12px; color: rgba(42,21,9,0.45);">15 Baldwin St, Whitby, ON L1M 1A2</p>
                    <p style="margin: 0; font-size: 12px; color: rgba(42,21,9,0.45);">
                      <a href="tel:+19054253055" style="color: rgba(42,21,9,0.45); text-decoration: none;">(905) 425-3055</a>&ensp;&#183;&ensp;
                      <a href="mailto:brooklinpub@gmail.com" style="color: rgba(42,21,9,0.45); text-decoration: none;">brooklinpub@gmail.com</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 2px;">
                    <p style="margin: 0; font-size: 11px; line-height: 1.6; color: rgba(42,21,9,0.3);">
                      You received this because you subscribed at brooklinpub.com<br />
                      <a href="${opts.unsubscribeUrl}" style="color: #C87941; text-decoration: underline; font-weight: 500;">Unsubscribe</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private getFullImageUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${this.backendPublicUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  private async sendMail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: this.emailFrom,
        to,
        subject,
        html,
      } as any);
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) this.logger.log(`Preview URL: ${preview}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}`, err);
      throw err;
    }
  }

  private async sendWelcomeEmail(subscriber: Subscriber): Promise<void> {
    const unsubscribeUrl = `${this.frontendUrl}/unsubscribe?token=${subscriber.unsubscribeToken}`;

    const html = this.buildEmailTemplate({
      preheader: 'Welcome to the Brooklin Pub Newsletter!',
      heading: 'Welcome to Brooklin Pub!',
      title: "You're on the list!",
      description:
        "Thanks for subscribing to the Brooklin Pub newsletter! You'll be the first to hear about our latest events, specials, and everything happening at Brooklin's favourite neighbourhood pub.",
      ctaText: 'Explore Our Menu',
      ctaUrl: `${this.frontendUrl}/menu`,
      unsubscribeUrl,
    });

    await this.sendMail(
      subscriber.email,
      'Welcome to the Brooklin Pub Newsletter! 🍺',
      html,
    );
  }

  private buildEmailTemplate(opts: {
    preheader: string;
    heading: string;
    title: string;
    description: string;
    date?: string;
    imageUrl?: string | null;
    ctaText: string;
    ctaUrl: string;
    unsubscribeUrl: string;
  }): string {
    const imageBlock = opts.imageUrl
      ? `
          <tr>
            <td class="content-pad" style="background-color: #FFFCF8; padding: 24px 40px 0;">
              <img src="${opts.imageUrl}" alt="${opts.title}" style="width: 100%; max-height: 340px; object-fit: cover; border-radius: 14px; border: 1px solid rgba(42,21,9,0.06);" />
            </td>
          </tr>`
      : '';

    const dateBlock = opts.date
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 16px;">
                <tr>
                  <td style="background-color: #FDF3E7; border-radius: 8px; padding: 10px 18px; border: 1px solid rgba(217,167,86,0.15);">
                    <span style="font-size: 13px; color: #8B6914; font-weight: 600; letter-spacing: 0.3px;">&#128197;&nbsp; ${opts.date}</span>
                  </td>
                </tr>
              </table>`
      : '';

    return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${opts.preheader}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body, table, td { margin: 0; padding: 0; }
    body { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-spacing: 0; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; max-width: 100%; }
    a { color: #C87941; text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .content-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .hero-text { font-size: 24px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #EDE0D0; font-family: 'Segoe UI', -apple-system, Helvetica, Arial, sans-serif; word-spacing: normal;">
  <!-- Preheader -->
  <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #EDE0D0;">${opts.preheader}&#847; &#847; &#847;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #EDE0D0;">
    <tr>
      <td align="center" style="padding: 40px 16px 48px;">
        <table role="presentation" class="email-container" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 24px rgba(42,21,9,0.08);">

          <!-- Header — warm cream with subtle branding -->
          <tr>
            <td align="center" style="background-color: #FFFCF8; padding: 36px 32px 28px; border-bottom: 1px solid rgba(42,21,9,0.06);">
              <img src="${this.logoUrl}" alt="Brooklin Pub" width="48" style="width: 48px; height: auto; margin-bottom: 12px;" />
              <p style="margin: 0; font-size: 14px; font-weight: 700; color: #2A1509; letter-spacing: 3px; text-transform: uppercase; font-family: Georgia, 'Times New Roman', serif;">BROOKLIN PUB</p>
              <p style="margin: 6px 0 0; font-size: 11px; color: #C87941; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 500;">&#9733;&ensp;Est. 2014&ensp;&#9733;</p>
            </td>
          </tr>

          <!-- Gold accent line -->
          <tr>
            <td style="height: 3px; background: linear-gradient(90deg, #EDE0D0, #D9A756, #C87941, #D9A756, #EDE0D0);"></td>
          </tr>

          <!-- Hero heading -->
          <tr>
            <td class="content-pad" style="background-color: #FFFCF8; padding: 36px 40px 0;">
              <h1 class="hero-text" style="margin: 0; font-size: 26px; font-weight: 700; color: #2A1509; font-family: Georgia, 'Times New Roman', serif; line-height: 1.3;">${opts.heading}</h1>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 14px;">
                <tr>
                  <td style="width: 44px; height: 2px; background-color: #D9A756; border-radius: 2px;"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Image -->
          ${imageBlock}

          <!-- Body content -->
          <tr>
            <td class="content-pad" style="background-color: #FFFCF8; padding: 24px 40px 0;">
              <h2 style="margin: 0 0 4px; font-size: 18px; font-weight: 700; color: #6A3A1E; font-family: Georgia, 'Times New Roman', serif;">${opts.title}</h2>
              ${dateBlock}
              <p style="margin: 16px 0 0; font-size: 15px; line-height: 1.75; color: #5C4033;">${opts.description}</p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td class="content-pad" align="center" style="background-color: #FFFCF8; padding: 32px 40px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius: 10px; background-color: #2A1509;" align="center">
                    <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${opts.ctaUrl}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="21%" fillcolor="#2A1509" stroke="f"><v:textbox inset="0,0,0,0"><center style="font-size:15px;font-weight:700;color:#F5EFE6;font-family:Arial,sans-serif;">${opts.ctaText}</center></v:textbox></v:roundrect><![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${opts.ctaUrl}" style="display: inline-block; padding: 14px 40px; background-color: #2A1509; color: #F5EFE6; font-size: 15px; font-weight: 700; border-radius: 10px; text-decoration: none; letter-spacing: 0.3px; font-family: 'Segoe UI', Arial, sans-serif; mso-padding-alt: 0; text-align: center;">${opts.ctaText}&nbsp;&rarr;</a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer — light warm tone -->
          <tr>
            <td style="background-color: #F5EDE1; padding: 28px 36px; border-top: 1px solid rgba(42,21,9,0.06);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

                <!-- Social links -->
                <tr>
                  <td align="center" style="padding-bottom: 18px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 0 6px;">
                          <a href="https://www.facebook.com/brooklinpub" style="display: inline-block; text-decoration: none;" title="Facebook">
                            <img src="${this.backendPublicUrl}/uploads/assets/icon-facebook.svg" width="30" height="30" alt="Facebook" style="display: block; border: 0;" />
                          </a>
                        </td>
                        <td style="padding: 0 6px;">
                          <a href="https://www.instagram.com/brooklinpubngrill/" style="display: inline-block; text-decoration: none;" title="Instagram">
                            <img src="${this.backendPublicUrl}/uploads/assets/icon-instagram.svg" width="30" height="30" alt="Instagram" style="display: block; border: 0;" />
                          </a>
                        </td>
                        <td style="padding: 0 6px;">
                          <a href="https://www.tiktok.com/@brooklinpubngrill" style="display: inline-block; text-decoration: none;" title="TikTok">
                            <img src="${this.backendPublicUrl}/uploads/assets/icon-tiktok.svg" width="30" height="30" alt="TikTok" style="display: block; border: 0;" />
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="height: 1px; background-color: rgba(42,21,9,0.08);"></td>
                </tr>

                <!-- Address & contact -->
                <tr>
                  <td align="center" style="padding: 18px 0 14px;">
                    <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #6A3A1E; letter-spacing: 0.3px;">Brooklin Pub &amp; Grill</p>
                    <p style="margin: 0 0 2px; font-size: 12px; color: rgba(42,21,9,0.45);">15 Baldwin St, Whitby, ON L1M 1A2</p>
                    <p style="margin: 0; font-size: 12px; color: rgba(42,21,9,0.45);">
                      <a href="tel:+19054253055" style="color: rgba(42,21,9,0.45); text-decoration: none;">(905) 425-3055</a>&ensp;&#183;&ensp;
                      <a href="mailto:brooklinpub@gmail.com" style="color: rgba(42,21,9,0.45); text-decoration: none;">brooklinpub@gmail.com</a>
                    </p>
                  </td>
                </tr>

                <!-- Unsubscribe -->
                <tr>
                  <td align="center" style="padding-top: 2px;">
                    <p style="margin: 0; font-size: 11px; line-height: 1.6; color: rgba(42,21,9,0.3);">
                      You received this because you subscribed at brooklinpub.com<br />
                      <a href="${opts.unsubscribeUrl}" style="color: #C87941; text-decoration: underline; font-weight: 500;">Unsubscribe</a>
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
