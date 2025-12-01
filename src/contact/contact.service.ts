import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { getRequiredEnv } from '../config/env.validation';
import { CreateContactDto } from './dto';

// Subject labels for better readability
const subjectLabels: Record<string, string> = {
  general: 'General Inquiry',
  reservation: 'Party Reservation',
  event: 'Event Inquiry',
  catering: 'Catering Request',
  feedback: 'Feedback',
  careers: 'Careers Application',
  other: 'Other Inquiry',
};

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);
  private transporter: nodemailer.Transporter;
  private readonly emailFrom: string;
  private readonly pubEmail: string;
  private readonly backendPublicUrl: string;
  private readonly logoUrl: string;

  constructor() {
    // Read from validated env vars
    const host = getRequiredEnv('EMAIL_HOST');
    const port = Number(getRequiredEnv('EMAIL_PORT'));
    const user = getRequiredEnv('EMAIL_USER');
    const pass = getRequiredEnv('EMAIL_PASS');
    this.emailFrom = getRequiredEnv('EMAIL_FROM');
    this.pubEmail = getRequiredEnv('PUB_CONTACT_EMAIL');
    this.backendPublicUrl = getRequiredEnv('BACKEND_PUBLIC_URL');
    this.logoUrl = `${this.backendPublicUrl}/uploads/assets/brooklinpub-logo.png`;

    // Create transport with validated credentials
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });

    // Verify transporter
    (async () => {
      try {
        await this.transporter.verify();
        this.logger.log('Contact SMTP transporter verified');
      } catch (err) {
        this.logger.warn('Contact SMTP transporter could not be verified', err);
        if (getRequiredEnv('NODE_ENV') !== 'production') {
          this.logger.log(
            'Falling back to Ethereal test account for development',
          );
          const testAccount = await nodemailer.createTestAccount();
          this.transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass,
            },
          });
          this.logger.log(`Ethereal account user: ${testAccount.user}`);
        } else {
          this.logger.error(
            'Contact SMTP transporter verification failed in production',
            err,
          );
        }
      }
    })();
  }

  async submitContactForm(contactDto: CreateContactDto): Promise<{
    success: boolean;
    message: string;
  }> {
    const { name, email, subject } = contactDto;
    const isReservation = subject === 'reservation';
    const subjectLabel = subjectLabels[subject] || 'Contact Form Submission';

    try {
      // Send notification email to pub
      await this.sendPubNotification(contactDto, subjectLabel);

      // Send confirmation email to customer
      await this.sendCustomerConfirmation(contactDto, subjectLabel);

      this.logger.log(
        `Contact form submitted successfully: ${name} (${email}) - ${subjectLabel}`,
      );

      return {
        success: true,
        message: isReservation
          ? 'Reservation request received. We will confirm your booking shortly.'
          : 'Thank you for your message. We will get back to you within 24 hours.',
      };
    } catch (error) {
      this.logger.error('Failed to process contact form:', error);
      throw error;
    }
  }

  /**
   * Generate the common email header with logo
   */
  private getEmailHeader(subtitle: string): string {
    return `
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #3C1F0E 0%, #5A2E18 50%, #6A3A1E 100%); padding: 40px 30px; text-align: center;">
              <img src="${this.logoUrl}" alt="Brooklin Pub" style="max-width: 180px; height: auto; margin-bottom: 15px;" />
              <p style="color: rgba(255,255,255,0.85); margin: 0; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; font-weight: 500;">
                ${subtitle}
              </p>
            </td>
          </tr>
    `;
  }

  /**
   * Generate the common email footer
   */
  private getEmailFooter(): string {
    return `
          <!-- Footer -->
          <tr>
            <td style="background: #3C1F0E; padding: 35px 30px; text-align: center;">
              <img src="${this.logoUrl}" alt="Brooklin Pub" style="max-width: 120px; height: auto; margin-bottom: 20px; opacity: 0.9;" />
              <p style="color: rgba(255,255,255,0.7); margin: 0 0 15px 0; font-size: 13px; line-height: 1.6;">
                15 Baldwin Street, Whitby, ON L1M 1A2<br>
                (905) 655-3513
              </p>
              <p style="margin: 0 0 20px 0;">
                <a href="https://facebook.com/brooklinpub" style="color: #D9A756; text-decoration: none; margin: 0 12px; font-size: 13px;">Facebook</a>
                <span style="color: rgba(255,255,255,0.3);">|</span>
                <a href="https://instagram.com/brooklinpub" style="color: #D9A756; text-decoration: none; margin: 0 12px; font-size: 13px;">Instagram</a>
              </p>
              <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; margin-top: 10px;">
                <p style="color: rgba(255,255,255,0.5); margin: 0; font-size: 11px;">
                  &copy; ${new Date().getFullYear()} Brooklin Pub. All rights reserved.
                </p>
              </div>
            </td>
          </tr>
    `;
  }

  /**
   * Get base email wrapper
   */
  private getEmailWrapper(content: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brooklin Pub</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F5EBE0; font-family: 'Georgia', 'Times New Roman', serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5EBE0; padding: 30px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 4px; overflow: hidden; box-shadow: 0 4px 24px rgba(60,31,14,0.12);">
          ${content}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  private async sendPubNotification(
    contactDto: CreateContactDto,
    subjectLabel: string,
  ): Promise<void> {
    const {
      name,
      email,
      phone,
      subject,
      reservationDate,
      reservationTime,
      guestCount,
      position,
      message,
    } = contactDto;
    const isReservation = subject === 'reservation';
    const isCareers = subject === 'careers';

    // Build reservation details section
    let reservationDetailsHtml = '';
    if (isReservation) {
      reservationDetailsHtml = `
        <div style="background: #FDF8F3; padding: 24px; border-radius: 4px; margin: 24px 0; border-left: 3px solid #D9A756;">
          <h3 style="color: #3C1F0E; margin: 0 0 18px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Party Reservation Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #6A3A1E; font-weight: 600; width: 140px; font-size: 14px; border-bottom: 1px solid rgba(217,167,86,0.2);">Requested Date</td>
              <td style="padding: 10px 0; color: #3C1F0E; font-size: 14px; border-bottom: 1px solid rgba(217,167,86,0.2);">${reservationDate || 'Not specified'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6A3A1E; font-weight: 600; font-size: 14px; border-bottom: 1px solid rgba(217,167,86,0.2);">Requested Time</td>
              <td style="padding: 10px 0; color: #3C1F0E; font-size: 14px; border-bottom: 1px solid rgba(217,167,86,0.2);">${reservationTime || 'Not specified'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6A3A1E; font-weight: 600; font-size: 14px;">Number of Guests</td>
              <td style="padding: 10px 0; color: #3C1F0E; font-size: 14px;">${guestCount || 'Not specified'}</td>
            </tr>
          </table>
        </div>
      `;
    }

    // Build careers details section
    let careersDetailsHtml = '';
    if (isCareers) {
      careersDetailsHtml = `
        <div style="background: #FDF8F3; padding: 24px; border-radius: 4px; margin: 24px 0; border-left: 3px solid #D9A756;">
          <h3 style="color: #3C1F0E; margin: 0 0 18px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Application Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #6A3A1E; font-weight: 600; width: 140px; font-size: 14px;">Position Applied</td>
              <td style="padding: 10px 0; color: #3C1F0E; font-size: 14px; font-weight: 500;">${position || 'Not specified'}</td>
            </tr>
          </table>
        </div>
      `;
    }

    const emailSubject = isReservation
      ? `New Party Reservation Request - ${name}`
      : isCareers
        ? `New Careers Application - ${name} (${position || 'Position not specified'})`
        : `New ${subjectLabel} - ${name}`;

    const textContent = `
NEW ${isReservation ? 'PARTY RESERVATION REQUEST' : isCareers ? 'CAREERS APPLICATION' : 'CONTACT FORM SUBMISSION'}
─────────────────────────────────────────

CONTACT INFORMATION
Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}
Subject: ${subjectLabel}
${
  isReservation
    ? `
RESERVATION DETAILS
Date: ${reservationDate || 'Not specified'}
Time: ${reservationTime || 'Not specified'}
Guests: ${guestCount || 'Not specified'}
`
    : ''
}${
      isCareers
        ? `
APPLICATION DETAILS
Position: ${position || 'Not specified'}
`
        : ''
    }
MESSAGE
${message}

─────────────────────────────────────────
Received: ${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })}
Brooklin Pub Contact Form
    `;

    const htmlContent = this.getEmailWrapper(`
          ${this.getEmailHeader(isReservation ? 'New Party Reservation' : isCareers ? 'New Careers Application' : 'New Contact Message')}

          <!-- Content -->
          <tr>
            <td style="padding: 40px 35px;">
              <!-- Contact Info Card -->
              <div style="background: #F9F6F2; padding: 24px; border-radius: 4px; margin-bottom: 24px;">
                <h3 style="color: #3C1F0E; margin: 0 0 18px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">${isCareers ? 'Applicant' : 'Contact'} Information</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; color: #6A3A1E; font-weight: 600; width: 100px; font-size: 14px; border-bottom: 1px solid rgba(217,167,86,0.2);">Name</td>
                    <td style="padding: 10px 0; color: #3C1F0E; font-weight: 500; font-size: 14px; border-bottom: 1px solid rgba(217,167,86,0.2);">${name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6A3A1E; font-weight: 600; font-size: 14px; border-bottom: 1px solid rgba(217,167,86,0.2);">Email</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid rgba(217,167,86,0.2);"><a href="mailto:${email}" style="color: #B08030; text-decoration: none; font-size: 14px;">${email}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6A3A1E; font-weight: 600; font-size: 14px; border-bottom: 1px solid rgba(217,167,86,0.2);">Phone</td>
                    <td style="padding: 10px 0; color: #3C1F0E; font-size: 14px; border-bottom: 1px solid rgba(217,167,86,0.2);">${phone ? `<a href="tel:${phone}" style="color: #B08030; text-decoration: none;">${phone}</a>` : '<span style="color: #8B7355;">Not provided</span>'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6A3A1E; font-weight: 600; font-size: 14px;">Subject</td>
                    <td style="padding: 10px 0;"><span style="background: #D9A756; color: #3C1F0E; padding: 4px 14px; border-radius: 3px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${subjectLabel}</span></td>
                  </tr>
                </table>
              </div>

              ${reservationDetailsHtml}
              ${careersDetailsHtml}

              <!-- Message Card -->
              <div style="background: #FFFDFB; padding: 24px; border-radius: 4px; border: 1px solid rgba(217,167,86,0.25);">
                <h3 style="color: #3C1F0E; margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Message</h3>
                <p style="color: #4A2C17; line-height: 1.8; margin: 0; white-space: pre-wrap; font-size: 14px;">${message}</p>
              </div>

              <!-- Quick Actions -->
              <div style="margin-top: 30px; text-align: center;">
                <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subjectLabel)}" style="display: inline-block; background: #D9A756; color: #3C1F0E; padding: 14px 32px; border-radius: 3px; text-decoration: none; font-weight: 600; margin: 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Reply via Email</a>
                ${phone ? `<a href="tel:${phone}" style="display: inline-block; background: #3C1F0E; color: #fff; padding: 14px 32px; border-radius: 3px; text-decoration: none; font-weight: 600; margin: 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Call ${name.split(' ')[0]}</a>` : ''}
              </div>

              <!-- Timestamp -->
              <p style="color: #8B7355; margin: 30px 0 0 0; font-size: 12px; text-align: center; border-top: 1px solid rgba(217,167,86,0.2); padding-top: 20px;">
                Received on ${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'full', timeStyle: 'short' })}
              </p>
            </td>
          </tr>

          ${this.getEmailFooter()}
    `);

    const mailOptions = {
      from: this.emailFrom,
      to: this.pubEmail,
      replyTo: email,
      subject: emailSubject,
      text: textContent,
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Pub notification email sent. Info: ${JSON.stringify(info)}`,
      );
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) this.logger.log(`Preview URL: ${preview}`);
    } catch (error) {
      this.logger.error('Failed to send pub notification email:', error);
      throw error;
    }
  }

  private async sendCustomerConfirmation(
    contactDto: CreateContactDto,
    subjectLabel: string,
  ): Promise<void> {
    const {
      name,
      email,
      subject,
      reservationDate,
      reservationTime,
      guestCount,
      position,
      message,
    } = contactDto;
    const isReservation = subject === 'reservation';
    const isCareers = subject === 'careers';

    // Build reservation confirmation section
    let reservationConfirmHtml = '';
    if (isReservation) {
      reservationConfirmHtml = `
        <div style="background: #FDF8F3; padding: 28px; border-radius: 4px; margin: 28px 0; border: 1px dashed #D9A756;">
          <h3 style="color: #3C1F0E; margin: 0 0 22px 0; font-size: 14px; text-align: center; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Your Reservation Request</h3>
          <table style="width: 100%; border-collapse: collapse; max-width: 320px; margin: 0 auto;">
            <tr>
              <td style="padding: 12px 0; color: #6A3A1E; font-weight: 600; text-align: left; font-size: 14px; border-bottom: 1px solid rgba(217,167,86,0.2);">Date</td>
              <td style="padding: 12px 0; color: #3C1F0E; font-weight: 500; text-align: right; font-size: 14px; border-bottom: 1px solid rgba(217,167,86,0.2);">${reservationDate || 'To be confirmed'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #6A3A1E; font-weight: 600; text-align: left; font-size: 14px; border-bottom: 1px solid rgba(217,167,86,0.2);">Time</td>
              <td style="padding: 12px 0; color: #3C1F0E; font-weight: 500; text-align: right; font-size: 14px; border-bottom: 1px solid rgba(217,167,86,0.2);">${reservationTime || 'To be confirmed'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #6A3A1E; font-weight: 600; text-align: left; font-size: 14px;">Party Size</td>
              <td style="padding: 12px 0; color: #3C1F0E; font-weight: 500; text-align: right; font-size: 14px;">${guestCount || 'To be confirmed'} guests</td>
            </tr>
          </table>
          <p style="color: #8B7355; font-size: 13px; text-align: center; margin: 22px 0 0 0; font-style: italic;">
            We will confirm your reservation within a few hours during business hours.
          </p>
        </div>
      `;
    }

    // Build careers confirmation section
    let careersConfirmHtml = '';
    if (isCareers) {
      careersConfirmHtml = `
        <div style="background: #FDF8F3; padding: 28px; border-radius: 4px; margin: 28px 0; border: 1px dashed #D9A756;">
          <h3 style="color: #3C1F0E; margin: 0 0 22px 0; font-size: 14px; text-align: center; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Your Application</h3>
          <table style="width: 100%; border-collapse: collapse; max-width: 320px; margin: 0 auto;">
            <tr>
              <td style="padding: 12px 0; color: #6A3A1E; font-weight: 600; text-align: left; font-size: 14px;">Position</td>
              <td style="padding: 12px 0; color: #3C1F0E; font-weight: 500; text-align: right; font-size: 14px;">${position || 'Not specified'}</td>
            </tr>
          </table>
          <p style="color: #8B7355; font-size: 13px; text-align: center; margin: 22px 0 0 0; font-style: italic;">
            Our team will review your application and contact you soon.
          </p>
        </div>
      `;
    }

    const emailSubject = isReservation
      ? `Reservation Request Received - Brooklin Pub`
      : isCareers
        ? `Application Received - Brooklin Pub`
        : `Message Received - Brooklin Pub`;

    const htmlContent = this.getEmailWrapper(`
          ${this.getEmailHeader(isReservation ? 'Reservation Confirmed' : isCareers ? 'Application Received' : 'Message Received')}

          <!-- Content -->
          <tr>
            <td style="padding: 45px 35px;">
              <p style="color: #3C1F0E; font-size: 18px; margin: 0 0 8px 0;">Dear ${name},</p>

              <p style="color: #4A2C17; line-height: 1.85; font-size: 15px; margin: 20px 0 28px 0;">
                ${
                  isReservation
                    ? 'Thank you for your party reservation request at Brooklin Pub. We have received your booking details and our team will review and confirm your reservation shortly.'
                    : isCareers
                      ? 'Thank you for your interest in joining the Brooklin Pub team. We have received your application and our hiring team will review it carefully.'
                      : 'Thank you for reaching out to Brooklin Pub. We have received your message and our team will respond within 24 hours.'
                }
              </p>

              ${reservationConfirmHtml}
              ${careersConfirmHtml}

              <!-- What they sent -->
              <div style="background: #FFFDFB; padding: 24px; border-radius: 4px; border: 1px solid rgba(217,167,86,0.25); margin: 28px 0;">
                <p style="color: #6A3A1E; font-weight: 600; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your Message</p>
                <p style="color: #4A2C17; line-height: 1.75; margin: 0; font-style: italic; font-size: 14px;">"${message}"</p>
              </div>

              <!-- Contact Info -->
              <div style="background: linear-gradient(135deg, #F9F6F2 0%, #FDF8F3 100%); padding: 28px; border-radius: 4px; text-align: center; margin-top: 32px;">
                <p style="color: #3C1F0E; font-weight: 600; margin: 0 0 18px 0; font-size: 15px;">Need to reach us sooner?</p>
                <table style="width: 100%; max-width: 280px; margin: 0 auto; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6A3A1E; font-size: 14px;">Phone</td>
                    <td style="padding: 8px 0; text-align: right;"><a href="tel:9056553513" style="color: #B08030; text-decoration: none; font-weight: 500; font-size: 14px;">(905) 655-3513</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6A3A1E; font-size: 14px;">Email</td>
                    <td style="padding: 8px 0; text-align: right;"><a href="mailto:brooklinpub@gmail.com" style="color: #B08030; text-decoration: none; font-weight: 500; font-size: 14px;">brooklinpub@gmail.com</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6A3A1E; font-size: 14px;">Address</td>
                    <td style="padding: 8px 0; text-align: right; color: #4A2C17; font-size: 14px;">15 Baldwin Street, Whitby</td>
                  </tr>
                </table>
              </div>

              <p style="color: #4A2C17; line-height: 1.8; font-size: 15px; margin: 35px 0 0 0; text-align: center;">
                We look forward to ${isReservation ? 'welcoming you to Brooklin Pub' : 'connecting with you'}.
              </p>

              <p style="color: #3C1F0E; font-size: 15px; margin: 25px 0 0 0; text-align: center;">
                Warm regards,<br>
                <span style="color: #6A3A1E; font-weight: 500;">The Brooklin Pub Team</span>
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 35px 40px 35px; text-align: center;">
              <a href="https://brooklinpub.com" style="display: inline-block; background: #D9A756; color: #3C1F0E; padding: 16px 42px; border-radius: 3px; text-decoration: none; font-weight: 600; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">
                Visit Our Website
              </a>
            </td>
          </tr>

          ${this.getEmailFooter()}
    `);

    const textContent = `
Dear ${name},

${
  isReservation
    ? 'Thank you for your party reservation request at Brooklin Pub. We have received your booking details and our team will review and confirm your reservation shortly.'
    : isCareers
      ? 'Thank you for your interest in joining the Brooklin Pub team. We have received your application and our hiring team will review it carefully.'
      : 'Thank you for reaching out to Brooklin Pub. We have received your message and our team will respond within 24 hours.'
}

${
  isReservation
    ? `
YOUR RESERVATION REQUEST
─────────────────────────
Date: ${reservationDate || 'To be confirmed'}
Time: ${reservationTime || 'To be confirmed'}
Party Size: ${guestCount || 'To be confirmed'} guests

We will confirm your reservation within a few hours during business hours.
`
    : isCareers
      ? `
YOUR APPLICATION
─────────────────────────
Position: ${position || 'Not specified'}

Our team will review your application and contact you soon.
`
      : ''
}

YOUR MESSAGE
─────────────────────────
"${message}"


NEED TO REACH US SOONER?
─────────────────────────
Phone: (905) 655-3513
Email: brooklinpub@gmail.com
Address: 15 Baldwin Street, Whitby, ON

We look forward to ${isReservation ? 'welcoming you to Brooklin Pub' : 'connecting with you'}.

Warm regards,
The Brooklin Pub Team

─────────────────────────
Brooklin Pub
15 Baldwin Street, Whitby, ON L1M 1A2
brooklinpub.com
    `;

    const mailOptions = {
      from: this.emailFrom,
      to: email,
      subject: emailSubject,
      text: textContent,
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Customer confirmation email sent to ${email}. Info: ${JSON.stringify(info)}`,
      );
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) this.logger.log(`Preview URL: ${preview}`);
    } catch (error) {
      this.logger.error('Failed to send customer confirmation email:', error);
      // Don't throw - pub notification is more important
    }
  }
}
