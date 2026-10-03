import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { getOptionalEnv, getRequiredEnv } from '../config/env.validation';
import { GiftCard, GiftCardPaymentMethod } from '../entities/gift-card.entity';

const PUB_PHONE_DISPLAY = '(905) 425-3055';
const PUB_PHONE_TEL = '+19054253055';
const PUB_EMAIL = 'brooklinpub@gmail.com';
const PUB_ADDRESS = '15 Baldwin St, Whitby, ON L1M 1A2';

export function formatCents(cents: number | null | undefined): string {
  return `$${((cents ?? 0) / 100).toFixed(2)}`;
}

function esc(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class GiftCardMailService {
  private readonly logger = new Logger(GiftCardMailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly emailFrom: string;
  private readonly frontendUrl: string;
  private readonly adminUrl: string;
  private readonly logoUrl: string;

  constructor() {
    const port = Number(getRequiredEnv('EMAIL_PORT'));
    this.transporter = nodemailer.createTransport({
      host: getRequiredEnv('EMAIL_HOST'),
      port,
      secure: port === 465,
      auth: {
        user: getRequiredEnv('EMAIL_USER'),
        pass: getRequiredEnv('EMAIL_PASS'),
      },
    });
    this.emailFrom = 'Brooklin Pub <' + getRequiredEnv('EMAIL_FROM') + '>';
    this.frontendUrl =
      getOptionalEnv('FRONTEND_URL') || 'http://localhost:3000';
    this.adminUrl = getRequiredEnv('ADMIN_FRONTEND_URL');
    this.logoUrl = `${getRequiredEnv('BACKEND_PUBLIC_URL')}/uploads/assets/brooklinpub-logo.png`;
  }

  private get checkUrl(): string {
    return `${this.frontendUrl}/gift-cards/check`;
  }

  // ─── Customer emails ────────────────────────────────────────

  async sendOrderReceived(card: GiftCard): Promise<void> {
    if (!card.buyerEmail) return;
    const html = this.layout({
      preheader: `Gift card order ${card.code} received`,
      heading: 'We received your gift card order',
      body: `
        <p>Hi ${esc(card.buyerName)},</p>
        <p>Thank you for purchasing a Brooklin Pub gift card of <strong>${formatCents(card.requestedAmountCents)}</strong>${card.isForSelf ? '' : ` for <strong>${esc(card.recipientName)}</strong>`}.</p>
        <p>Our team will verify your payment and activate the card. Once approved, ${card.isForSelf ? 'you' : 'the recipient'} will receive the gift card details along with a 4-digit PIN by email.</p>
        ${this.codeBox('Your Gift Card ID', card.code, 'Please keep this ID safe — you need it to check your order status.')}
        <p>You can check the status anytime at <a href="${this.checkUrl}">${this.checkUrl}</a>.</p>`,
    });
    await this.send(
      card.buyerEmail,
      `Gift card order received — ${card.code}`,
      html,
    );
  }

  async sendGiftCardToRecipient(
    card: GiftCard,
    pin: string,
    isReissue = false,
  ): Promise<void> {
    if (!card.recipientEmail) return;
    const fromLine = card.isForSelf
      ? ''
      : `<p><strong>${esc(card.buyerName)}</strong> has sent you a Brooklin Pub gift card!</p>`;
    const messageBlock = card.message
      ? `<p style="margin:20px 0;padding:16px 20px;background:#FDF3E7;border-left:3px solid #D9A756;border-radius:6px;font-style:italic;color:#5C4033;">“${esc(card.message)}”</p>`
      : '';
    const html = this.layout({
      preheader: `Your Brooklin Pub gift card of ${formatCents(card.balanceCents)}`,
      heading: isReissue
        ? 'Your gift card details'
        : 'You’ve received a gift card!',
      body: `
        <p>Hi ${esc(card.recipientName)},</p>
        ${fromLine}
        ${messageBlock}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#2A1509;border-radius:14px;">
          <tr><td style="padding:28px 24px;color:#F5EFE6;text-align:center;">
            <p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#D9A756;">Brooklin Pub Gift Card</p>
            <p style="margin:12px 0 4px;font-size:34px;font-weight:700;font-family:Georgia,serif;">${formatCents(card.balanceCents)}</p>
            <p style="margin:18px 0 4px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#D9A756;">Gift Card ID</p>
            <p style="margin:0;font-size:22px;letter-spacing:3px;font-family:'Courier New',monospace;">${card.code}</p>
            <p style="margin:18px 0 4px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#D9A756;">PIN</p>
            <p style="margin:0;font-size:26px;letter-spacing:10px;font-family:'Courier New',monospace;">${pin}</p>
          </td></tr>
        </table>
        <p><strong>How to use:</strong> Visit Brooklin Pub and give your Gift Card ID and PIN to our staff when paying. You can use it over multiple visits until the balance runs out.</p>
        <p>Check your balance anytime at <a href="${this.checkUrl}">${this.checkUrl}</a>.</p>
        <p style="font-size:13px;color:#8a7362;">Keep your PIN private — anyone with your ID and PIN can use the balance. This gift card never expires and has no fees.</p>`,
    });
    await this.send(
      card.recipientEmail,
      isReissue
        ? `Your Brooklin Pub gift card — ${card.code}`
        : `🎁 You’ve received a Brooklin Pub gift card!`,
      html,
    );
  }

  async sendBuyerApproved(card: GiftCard): Promise<void> {
    if (!card.buyerEmail) return;
    const differs = card.approvedAmountCents !== card.requestedAmountCents;
    const amountLine = differs
      ? `<p>We received <strong>${formatCents(card.approvedAmountCents)}</strong> (you requested ${formatCents(card.requestedAmountCents)}). Your gift card has been issued for <strong>${formatCents(card.approvedAmountCents)}</strong>.</p>
         ${card.approvalNote ? `<p style="color:#8a7362;">Note from our team: ${esc(card.approvalNote)}</p>` : ''}
         <p>If you have any questions about this, please contact us.</p>`
      : `<p>Your payment of <strong>${formatCents(card.approvedAmountCents)}</strong> has been verified.</p>`;
    const html = this.layout({
      preheader: `Gift card ${card.code} approved`,
      heading: 'Your gift card is active',
      body: `
        <p>Hi ${esc(card.buyerName)},</p>
        ${amountLine}
        <p>${card.isForSelf ? 'Your gift card details and PIN have been sent in a separate email.' : `The gift card and its PIN have been emailed to <strong>${esc(card.recipientName)}</strong>.`}</p>
        ${this.codeBox('Gift Card ID', card.code)}`,
    });
    await this.send(card.buyerEmail, `Gift card approved — ${card.code}`, html);
  }

  async sendBuyerRejected(card: GiftCard): Promise<void> {
    if (!card.buyerEmail) return;
    const html = this.layout({
      preheader: `Update on gift card order ${card.code}`,
      heading: 'We couldn’t verify your payment',
      body: `
        <p>Hi ${esc(card.buyerName)},</p>
        <p>Unfortunately we were unable to approve your gift card order <strong>${card.code}</strong>.</p>
        <p><strong>Reason:</strong> ${esc(card.rejectionReason)}</p>
        <p>Please contact us by phone at <a href="tel:${PUB_PHONE_TEL}">${PUB_PHONE_DISPLAY}</a> or through our <a href="${this.frontendUrl}/contactus">Contact Us</a> form and quote your Gift Card ID.</p>`,
    });
    await this.send(
      card.buyerEmail,
      `Gift card order update — ${card.code}`,
      html,
    );
  }

  async sendPinReset(card: GiftCard, pin: string): Promise<void> {
    if (!card.recipientEmail) return;
    const html = this.layout({
      preheader: `New PIN for gift card ${card.code}`,
      heading: 'Your gift card PIN has been reset',
      body: `
        <p>Hi ${esc(card.recipientName)},</p>
        <p>As requested, a new PIN has been issued for your Brooklin Pub gift card. Your previous PIN no longer works.</p>
        ${this.codeBox('Gift Card ID', card.code)}
        ${this.codeBox('New PIN', pin)}
        <p>Current balance: <strong>${formatCents(card.balanceCents)}</strong></p>`,
    });
    await this.send(
      card.recipientEmail,
      `New PIN for your Brooklin Pub gift card`,
      html,
    );
  }

  // ─── Staff emails ───────────────────────────────────────────

  async sendNewOrderToStaff(card: GiftCard): Promise<void> {
    const to = getRequiredEnv('PUB_CONTACT_EMAIL');
    const html = this.layout({
      preheader: `New gift card order ${card.code}`,
      heading: 'New gift card order awaiting approval',
      body: `
        <p><strong>${card.code}</strong> — ${formatCents(card.requestedAmountCents)} via ${card.paymentMethod === GiftCardPaymentMethod.INTERAC ? 'Interac e-Transfer' : 'bank deposit'}.</p>
        <p>Buyer: ${esc(card.buyerName)} (${esc(card.buyerEmail)}, ${esc(card.buyerPhone)})<br/>
        Recipient: ${esc(card.recipientName)} (${esc(card.recipientEmail)})</p>
        <p>Please verify the payment slip and approve or reject the order:</p>
        <p><a href="${this.adminUrl}/gift-cards">${this.adminUrl}/gift-cards</a></p>`,
    });
    await this.send(
      to,
      `New gift card order — ${card.code} (${formatCents(card.requestedAmountCents)})`,
      html,
    );
  }

  async sendWeeklyPendingDigest(
    to: string[],
    pending: GiftCard[],
  ): Promise<void> {
    const rows = pending
      .map((c) => {
        const days = Math.floor(
          (Date.now() - new Date(c.createdAt).getTime()) / 86400000,
        );
        return `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee;font-family:'Courier New',monospace;">${c.code}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${esc(c.buyerName)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatCents(c.requestedAmountCents)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${days} day${days === 1 ? '' : 's'}</td>
        </tr>`;
      })
      .join('');
    const html = this.layout({
      preheader: `${pending.length} gift card order(s) awaiting approval`,
      heading: `${pending.length} gift card order${pending.length === 1 ? '' : 's'} awaiting approval`,
      body: `
        <p>The following gift card orders are still pending payment verification:</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse;">
          <tr style="background:#FDF3E7;"><th align="left" style="padding:8px;">ID</th><th align="left" style="padding:8px;">Buyer</th><th align="right" style="padding:8px;">Amount</th><th align="right" style="padding:8px;">Waiting</th></tr>
          ${rows}
        </table>
        <p style="margin-top:20px;"><a href="${this.adminUrl}/gift-cards">Review pending orders →</a></p>`,
    });
    await this.send(
      to.join(','),
      `Weekly reminder: ${pending.length} pending gift card order(s)`,
      html,
    );
  }

  // ─── Helpers ────────────────────────────────────────────────

  private codeBox(label: string, value: string, hint?: string): string {
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <tr><td align="center" style="background:#FDF3E7;border:2px dashed #D9A756;border-radius:12px;padding:20px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#8B6914;letter-spacing:2px;text-transform:uppercase;">${label}</p>
          <p style="margin:0;font-size:24px;font-weight:700;color:#2A1509;letter-spacing:4px;font-family:'Courier New',monospace;">${value}</p>
          ${hint ? `<p style="margin:10px 0 0;font-size:12px;color:rgba(42,21,9,0.5);">${hint}</p>` : ''}
        </td></tr>
      </table>`;
  }

  private layout(opts: {
    preheader: string;
    heading: string;
    body: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${esc(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:#EDE0D0;font-family:'Segoe UI',-apple-system,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${esc(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDE0D0;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;border-radius:16px;overflow:hidden;background:#FFFCF8;">
        <tr><td align="center" style="padding:32px 32px 24px;border-bottom:1px solid rgba(42,21,9,0.06);">
          <img src="${this.logoUrl}" alt="Brooklin Pub" width="48" style="width:48px;height:auto;margin-bottom:10px;" />
          <p style="margin:0;font-size:14px;font-weight:700;color:#2A1509;letter-spacing:3px;text-transform:uppercase;font-family:Georgia,serif;">BROOKLIN PUB</p>
        </td></tr>
        <tr><td style="height:3px;background:linear-gradient(90deg,#EDE0D0,#D9A756,#C87941,#D9A756,#EDE0D0);"></td></tr>
        <tr><td style="padding:32px 40px 36px;font-size:15px;line-height:1.7;color:#5C4033;">
          <h1 style="margin:0 0 18px;font-size:24px;color:#2A1509;font-family:Georgia,serif;">${esc(opts.heading)}</h1>
          ${opts.body}
        </td></tr>
        <tr><td align="center" style="background:#F5EDE1;padding:22px 32px;font-size:12px;color:rgba(42,21,9,0.5);">
          <p style="margin:0 0 4px;font-weight:600;color:#6A3A1E;">Brooklin Pub &amp; Grill</p>
          <p style="margin:0 0 2px;">${PUB_ADDRESS}</p>
          <p style="margin:0;"><a href="tel:${PUB_PHONE_TEL}" style="color:inherit;">${PUB_PHONE_DISPLAY}</a> · <a href="mailto:${PUB_EMAIL}" style="color:inherit;">${PUB_EMAIL}</a></p>
          <p style="margin:10px 0 0;">Questions about a gift card? Call us or use our <a href="${this.frontendUrl}/contactus" style="color:#C87941;">Contact Us</a> form.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  /** Emails are best-effort: a mail failure never rolls back a gift card action. */
  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: this.emailFrom,
        to,
        subject,
        html,
      });
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) this.logger.log(`Preview URL: ${preview}`);
    } catch (err) {
      this.logger.error(`Failed to send gift card email to ${to}`, err);
    }
  }
}
