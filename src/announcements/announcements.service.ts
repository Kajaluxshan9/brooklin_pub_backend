import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import {
  Announcement,
  AnnouncementType,
  AnnouncementPriority,
  AnnouncementStatus,
} from '../entities/announcement.entity';
import { Subscriber } from '../entities/subscriber.entity';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto';
import { getRequiredEnv, getOptionalEnv } from '../config/env.validation';

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);
  private transporter: nodemailer.Transporter;
  private readonly emailFrom: string;
  private readonly frontendUrl: string;
  private readonly backendPublicUrl: string;
  private readonly logoUrl: string;

  constructor(
    @InjectRepository(Announcement)
    private announcementRepository: Repository<Announcement>,
    @InjectRepository(Subscriber)
    private subscriberRepository: Repository<Subscriber>,
  ) {
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

    void (async () => {
      try {
        await this.transporter.verify();
        this.logger.log('Announcements SMTP transporter verified');
      } catch (err) {
        this.logger.warn(
          'Announcements SMTP transporter could not be verified',
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
          this.logger.log(`Announcements using Ethereal: ${testAccount.user}`);
        }
      }
    })();
  }

  // ─── CRUD ─────────────────────────────────────────────────────

  async create(dto: CreateAnnouncementDto): Promise<Announcement> {
    const announcement = this.announcementRepository.create({
      ...dto,
      status: AnnouncementStatus.DRAFT,
    });
    return this.announcementRepository.save(announcement);
  }

  async findAll(): Promise<Announcement[]> {
    return this.announcementRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Announcement> {
    const announcement = await this.announcementRepository.findOne({
      where: { id },
    });
    if (!announcement) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }
    return announcement;
  }

  async update(id: string, dto: UpdateAnnouncementDto): Promise<Announcement> {
    const announcement = await this.findOne(id);
    if (announcement.status === AnnouncementStatus.SENT) {
      throw new BadRequestException('Cannot edit an already sent announcement');
    }
    Object.assign(announcement, dto);
    return this.announcementRepository.save(announcement);
  }

  async remove(id: string): Promise<void> {
    const announcement = await this.findOne(id);
    await this.announcementRepository.remove(announcement);
  }

  async getStats(): Promise<{
    total: number;
    sent: number;
    drafts: number;
    totalRecipients: number;
  }> {
    const total = await this.announcementRepository.count();
    const sent = await this.announcementRepository.count({
      where: { status: AnnouncementStatus.SENT },
    });
    const drafts = await this.announcementRepository.count({
      where: { status: AnnouncementStatus.DRAFT },
    });
    const result: { totalRecipients: string } | undefined =
      await this.announcementRepository
        .createQueryBuilder('a')
        .select('COALESCE(SUM(a.recipientCount), 0)', 'totalRecipients')
        .getRawOne();
    return {
      total,
      sent,
      drafts,
      totalRecipients: Number(result?.totalRecipients ?? 0),
    };
  }

  // ─── Send Announcement ────────────────────────────────────────

  async send(id: string): Promise<Announcement> {
    const announcement = await this.findOne(id);

    if (announcement.status === AnnouncementStatus.SENT) {
      throw new BadRequestException('This announcement has already been sent');
    }
    if (announcement.status === AnnouncementStatus.SENDING) {
      throw new BadRequestException(
        'This announcement is currently being sent',
      );
    }

    const subscribers = await this.subscriberRepository.find({
      where: { isActive: true },
    });

    if (subscribers.length === 0) {
      throw new BadRequestException('No active subscribers to send to');
    }

    // Mark as sending
    announcement.status = AnnouncementStatus.SENDING;
    await this.announcementRepository.save(announcement);

    const meta = this.getAnnouncementTypeMeta(
      announcement.type,
      announcement.priority,
    );

    let successCount = 0;

    for (const subscriber of subscribers) {
      const unsubscribeUrl = `${this.frontendUrl}/unsubscribe?token=${subscriber.unsubscribeToken}`;

      const html = this.buildAnnouncementEmailTemplate({
        preheader: `${meta.label}: ${announcement.title}`,
        heading: meta.heading,
        title: announcement.title,
        content: announcement.content,
        accentColor: meta.accentColor,
        iconEmoji: meta.emoji,
        priorityBadge:
          announcement.priority === AnnouncementPriority.HIGH ||
          announcement.priority === AnnouncementPriority.URGENT
            ? this.getPriorityBadge(announcement.priority)
            : null,
        ctaText: announcement.ctaText || meta.ctaText,
        ctaUrl: announcement.ctaUrl || this.frontendUrl,
        unsubscribeUrl,
      });

      try {
        await this.sendMail(
          subscriber.email,
          `${meta.emoji} ${meta.label}: ${announcement.title}`,
          html,
        );
        successCount++;
      } catch (err) {
        this.logger.error(
          `Failed to send announcement to ${subscriber.email}`,
          err,
        );
      }
    }

    // Update announcement record
    announcement.status =
      successCount > 0 ? AnnouncementStatus.SENT : AnnouncementStatus.FAILED;
    announcement.recipientCount = successCount;
    announcement.sentAt = new Date();
    await this.announcementRepository.save(announcement);

    this.logger.log(
      `Announcement "${announcement.title}" sent to ${successCount}/${subscribers.length} subscribers`,
    );

    return announcement;
  }

  // ─── Type-Specific Messaging ──────────────────────────────────

  private getAnnouncementTypeMeta(
    type: AnnouncementType,
    priority: AnnouncementPriority,
  ): {
    label: string;
    heading: string;
    emoji: string;
    ctaText: string;
    accentColor: string;
  } {
    const meta: Record<
      AnnouncementType,
      {
        label: string;
        heading: string;
        emoji: string;
        ctaText: string;
        accentColor: string;
      }
    > = {
      [AnnouncementType.GENERAL]: {
        label: 'Announcement',
        heading: 'A Message from Brooklin Pub',
        emoji: '📢',
        ctaText: 'Visit Brooklin Pub',
        accentColor: '#C87941',
      },
      [AnnouncementType.PROMOTION]: {
        label: 'Special Offer',
        heading: 'Exclusive Deal at Brooklin Pub!',
        emoji: '🎁',
        ctaText: 'Grab the Deal',
        accentColor: '#E67E22',
      },
      [AnnouncementType.CLOSURE]: {
        label: 'Important Notice',
        heading: 'Important Update from Brooklin Pub',
        emoji: '⚠️',
        ctaText: 'View Details',
        accentColor: '#E74C3C',
      },
      [AnnouncementType.MENU_UPDATE]: {
        label: 'Menu Update',
        heading: "What's New on Our Menu!",
        emoji: '🍽️',
        ctaText: 'Explore the Menu',
        accentColor: '#27AE60',
      },
      [AnnouncementType.COMMUNITY]: {
        label: 'Community Update',
        heading: 'From Our Community at Brooklin Pub',
        emoji: '🤝',
        ctaText: 'Learn More',
        accentColor: '#3498DB',
      },
      [AnnouncementType.HOLIDAY]: {
        label: 'Holiday Greetings',
        heading: 'Happy Holidays from Brooklin Pub!',
        emoji: '🎄',
        ctaText: 'Celebrate With Us',
        accentColor: '#8E44AD',
      },
    };

    const m = meta[type] || meta[AnnouncementType.GENERAL];

    // Override heading for urgent
    if (priority === AnnouncementPriority.URGENT) {
      m.heading = `🚨 ${m.heading}`;
    }

    return m;
  }

  private getPriorityBadge(
    priority: AnnouncementPriority,
  ): { text: string; color: string } | null {
    if (priority === AnnouncementPriority.HIGH) {
      return { text: 'HIGH PRIORITY', color: '#E67E22' };
    }
    if (priority === AnnouncementPriority.URGENT) {
      return { text: 'URGENT', color: '#E74C3C' };
    }
    return null;
  }

  // ─── Private Helpers ──────────────────────────────────────────

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

  private buildAnnouncementEmailTemplate(opts: {
    preheader: string;
    heading: string;
    title: string;
    content: string;
    accentColor: string;
    iconEmoji: string;
    priorityBadge: { text: string; color: string } | null;
    ctaText: string;
    ctaUrl: string;
    unsubscribeUrl: string;
  }): string {
    const priorityBlock = opts.priorityBadge
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                <tr>
                  <td style="background-color: ${opts.priorityBadge.color}; border-radius: 6px; padding: 6px 16px;">
                    <span style="font-size: 11px; color: #FFFFFF; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">${opts.priorityBadge.text}</span>
                  </td>
                </tr>
              </table>`
      : '';

    // Convert newlines in content to <br> for proper email rendering
    const formattedContent = opts.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(
        /\n\n/g,
        '</p><p style="margin: 16px 0 0; font-size: 15px; line-height: 1.75; color: #5C4033;">',
      )
      .replace(/\n/g, '<br/>');

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
    a { color: ${opts.accentColor}; text-decoration: none; }
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

          <!-- Header -->
          <tr>
            <td align="center" style="background-color: #FFFCF8; padding: 36px 32px 28px; border-bottom: 1px solid rgba(42,21,9,0.06);">
              <img src="${this.logoUrl}" alt="Brooklin Pub" width="48" style="width: 48px; height: auto; margin-bottom: 12px;" />
              <p style="margin: 0; font-size: 14px; font-weight: 700; color: #2A1509; letter-spacing: 3px; text-transform: uppercase; font-family: Georgia, 'Times New Roman', serif;">BROOKLIN PUB</p>
              <p style="margin: 6px 0 0; font-size: 11px; color: ${opts.accentColor}; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 500;">&#9733;&ensp;Est. 2014&ensp;&#9733;</p>
            </td>
          </tr>

          <!-- Accent line (uses announcement type color) -->
          <tr>
            <td style="height: 3px; background: linear-gradient(90deg, #EDE0D0, ${opts.accentColor}, ${opts.accentColor}, #EDE0D0);"></td>
          </tr>

          <!-- Type badge & Heading -->
          <tr>
            <td class="content-pad" style="background-color: #FFFCF8; padding: 36px 40px 0;">
              ${priorityBlock}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                <tr>
                  <td style="background-color: rgba(42,21,9,0.04); border-radius: 8px; padding: 6px 14px; border: 1px solid rgba(42,21,9,0.06);">
                    <span style="font-size: 12px; color: ${opts.accentColor}; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">${opts.iconEmoji}&ensp;${opts.heading}</span>
                  </td>
                </tr>
              </table>
              <h1 class="hero-text" style="margin: 0; font-size: 26px; font-weight: 700; color: #2A1509; font-family: Georgia, 'Times New Roman', serif; line-height: 1.3;">${opts.title}</h1>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 14px;">
                <tr>
                  <td style="width: 44px; height: 2px; background-color: ${opts.accentColor}; border-radius: 2px;"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body content -->
          <tr>
            <td class="content-pad" style="background-color: #FFFCF8; padding: 24px 40px 0;">
              <p style="margin: 0; font-size: 15px; line-height: 1.75; color: #5C4033;">${formattedContent}</p>
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

          <!-- Footer -->
          <tr>
            <td style="background-color: #F5EDE1; padding: 28px 36px; border-top: 1px solid rgba(42,21,9,0.06);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

                <!-- Social links -->
                <tr>
                  <td align="center" style="padding-bottom: 18px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 0 6px;">
                          <a href="https://www.facebook.com/brooklinpub" style="display: inline-block; width: 30px; height: 30px; border-radius: 8px; background-color: rgba(42,21,9,0.06); text-align: center; line-height: 30px; font-size: 13px; color: #8B6914; text-decoration: none;" title="Facebook">f</a>
                        </td>
                        <td style="padding: 0 6px;">
                          <a href="https://www.instagram.com/brooklinpubngrill/" style="display: inline-block; width: 30px; height: 30px; border-radius: 8px; background-color: rgba(42,21,9,0.06); text-align: center; line-height: 30px; font-size: 13px; color: #8B6914; text-decoration: none;" title="Instagram">&#9679;</a>
                        </td>
                        <td style="padding: 0 6px;">
                          <a href="https://www.tiktok.com/@brooklinpubngrill" style="display: inline-block; width: 30px; height: 30px; border-radius: 8px; background-color: rgba(42,21,9,0.06); text-align: center; line-height: 30px; font-size: 13px; color: #8B6914; text-decoration: none;" title="TikTok">&#9835;</a>
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
                      <a href="${opts.unsubscribeUrl}" style="color: ${opts.accentColor}; text-decoration: underline; font-weight: 500;">Unsubscribe</a>
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
