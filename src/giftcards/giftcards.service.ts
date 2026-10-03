import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { DataSource, EntityManager, Repository } from 'typeorm';
import * as crypto from 'crypto';
import moment from 'moment-timezone';
import * as fs from 'fs';
import * as path from 'path';
import {
  GiftCard,
  GiftCardPaymentMethod,
  GiftCardSource,
  GiftCardStatus,
} from '../entities/gift-card.entity';
import {
  GiftCardTransaction,
  GiftCardTransactionType,
} from '../entities/gift-card-transaction.entity';
import { GiftCardSettings } from '../entities/gift-card-settings.entity';
import { User } from '../entities/user.entity';
import { getOptionalEnv, getRequiredEnv } from '../config/env.validation';
import { GiftCardMailService, formatCents } from './giftcard-mail.service';
import {
  AdjustGiftCardDto,
  ApproveGiftCardDto,
  IssueGiftCardDto,
  ListGiftCardsQueryDto,
  PurchaseGiftCardDto,
  RedeemGiftCardDto,
  RejectGiftCardDto,
  UpdateGiftCardSettingsDto,
} from './dto';

export interface Actor {
  userId: string;
  email: string;
  role: string;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PIN_ATTEMPTS = 5;
const PIN_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_SLIP_BYTES = 5 * 1024 * 1024;
const SUBMIT_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };
/** Per-IP cap on balance lookups, so PINs can't be sprayed across many cards. */
const CHECK_LIMIT = { max: 30, windowMs: 10 * 60 * 1000 };
const LOCKED_MESSAGE =
  'This gift card has been locked after too many incorrect PIN attempts. Please contact Brooklin Pub by phone at (905) 425-3055 or through the Contact Us form.';

const toCents = (dollars: number) => Math.round(dollars * 100);

@Injectable()
export class GiftCardsService implements OnModuleInit {
  private readonly logger = new Logger(GiftCardsService.name);
  private readonly slipDir: string;
  private readonly pinKey: Buffer;
  private readonly rateHits = new Map<string, number[]>();

  constructor(
    @InjectRepository(GiftCard)
    private readonly cardRepo: Repository<GiftCard>,
    @InjectRepository(GiftCardTransaction)
    private readonly txRepo: Repository<GiftCardTransaction>,
    @InjectRepository(GiftCardSettings)
    private readonly settingsRepo: Repository<GiftCardSettings>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly mail: GiftCardMailService,
  ) {
    const dir =
      getOptionalEnv('GIFTCARD_SLIP_DIR') ||
      path.join('private_uploads', 'giftcard-slips');
    this.slipDir = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
    const secret =
      getOptionalEnv('GIFTCARD_PIN_SECRET') || getRequiredEnv('JWT_SECRET');
    this.pinKey = crypto.createHash('sha256').update(secret).digest();
    if (!getOptionalEnv('GIFTCARD_PIN_SECRET')) {
      this.logger.warn(
        'GIFTCARD_PIN_SECRET is not set; falling back to JWT_SECRET. Rotating JWT_SECRET would make existing gift card PINs unreadable.',
      );
    }
    const publicUploads = path.resolve(
      getOptionalEnv('UPLOAD_DIR', 'uploads') || 'uploads',
    );
    if (path.resolve(this.slipDir).startsWith(publicUploads + path.sep)) {
      throw new Error(
        'GIFTCARD_SLIP_DIR must not be inside the public UPLOAD_DIR',
      );
    }
  }

  onModuleInit() {
    if (!fs.existsSync(this.slipDir)) {
      fs.mkdirSync(this.slipDir, { recursive: true });
    }
  }

  // ═══ Settings ═══════════════════════════════════════════════

  async getSettings(): Promise<GiftCardSettings> {
    let settings = await this.settingsRepo.findOne({ where: { id: 1 } });
    if (!settings) {
      settings = await this.settingsRepo.save(
        this.settingsRepo.create({ id: 1 }),
      );
    }
    return settings;
  }

  /** Public view: only what a customer needs to buy a card. */
  async getPublicSettings() {
    const s = await this.getSettings();
    return {
      isEnabled: s.isEnabled && (s.interacEnabled || s.bankDepositEnabled),
      presetAmounts: [...s.presetAmounts].sort((a, b) => a - b),
      customAmountEnabled: s.customAmountEnabled,
      customAmountMin: s.customAmountMin,
      customAmountMax: s.customAmountMax,
      interac: s.interacEnabled
        ? {
            email: s.interacEmail,
            recipientName: s.interacRecipientName,
            instructions: s.interacInstructions,
          }
        : null,
      bankDeposit: s.bankDepositEnabled
        ? {
            bankName: s.bankName,
            accountName: s.bankAccountName,
            institutionNumber: s.bankInstitutionNumber,
            transitNumber: s.bankTransitNumber,
            accountNumber: s.bankAccountNumber,
            instructions: s.bankInstructions,
          }
        : null,
    };
  }

  async updateSettings(dto: UpdateGiftCardSettingsDto) {
    const s = await this.getSettings();
    // Only apply fields actually sent; the DTO instance carries undefined keys.
    Object.assign(
      s,
      Object.fromEntries(
        Object.entries(dto).filter(([, v]) => v !== undefined),
      ),
    );
    if (s.customAmountMin > s.customAmountMax) {
      throw new BadRequestException(
        'Custom amount minimum cannot be greater than the maximum',
      );
    }
    if (dto.presetAmounts) {
      s.presetAmounts = [...new Set(dto.presetAmounts)].sort((a, b) => a - b);
    }
    return this.settingsRepo.save(s);
  }

  // ═══ Public: purchase ═══════════════════════════════════════

  async purchase(
    dto: PurchaseGiftCardDto,
    slip: Express.Multer.File | undefined,
    ip: string,
  ) {
    this.enforceRateLimit(
      `submit:${ip}`,
      SUBMIT_LIMIT,
      'Too many gift card orders from this device. Please try again later or contact us.',
    );
    const settings = await this.getSettings();
    if (!settings.isEnabled) {
      throw new BadRequestException(
        'Gift card sales are currently unavailable',
      );
    }
    if (
      (dto.paymentMethod === GiftCardPaymentMethod.INTERAC &&
        !settings.interacEnabled) ||
      (dto.paymentMethod === GiftCardPaymentMethod.BANK_DEPOSIT &&
        !settings.bankDepositEnabled)
    ) {
      throw new BadRequestException('Selected payment method is not available');
    }

    const isPreset = settings.presetAmounts.includes(dto.amount);
    const isValidCustom =
      settings.customAmountEnabled &&
      dto.amount >= settings.customAmountMin &&
      dto.amount <= settings.customAmountMax;
    if (!isPreset && !isValidCustom) {
      throw new BadRequestException(
        settings.customAmountEnabled
          ? `Amount must be one of the listed amounts or between $${settings.customAmountMin} and $${settings.customAmountMax}`
          : 'Please choose one of the listed amounts',
      );
    }

    const slipMime = this.validateSlip(slip);
    const code = await this.generateUniqueCode();
    const ext = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'application/pdf': 'pdf',
    }[slipMime];
    const slipFileName = `${code}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    await fs.promises.writeFile(
      path.join(this.slipDir, slipFileName),
      slip!.buffer,
    );

    const card = this.cardRepo.create({
      code,
      status: GiftCardStatus.PENDING_VERIFICATION,
      source: GiftCardSource.ONLINE,
      paymentMethod: dto.paymentMethod,
      requestedAmountCents: toCents(dto.amount),
      balanceCents: 0,
      buyerName: dto.buyerName,
      buyerEmail: dto.buyerEmail.toLowerCase(),
      buyerPhone: dto.buyerPhone,
      isForSelf: dto.isForSelf,
      recipientName: dto.isForSelf ? dto.buyerName : dto.recipientName!,
      recipientEmail: (dto.isForSelf
        ? dto.buyerEmail
        : dto.recipientEmail!
      ).toLowerCase(),
      message: dto.message || null,
      slipFileName,
      slipMimeType: slipMime,
    });

    try {
      await this.cardRepo.save(card);
    } catch (err) {
      await fs.promises
        .unlink(path.join(this.slipDir, slipFileName))
        .catch(() => undefined);
      throw err;
    }

    void this.mail.sendOrderReceived(card);
    void this.mail.sendNewOrderToStaff(card);

    return {
      code: card.code,
      status: card.status,
      amount: card.requestedAmountCents / 100,
      message:
        'Your gift card order has been received. Please save your Gift Card ID — you will need it to check the status.',
    };
  }

  // ═══ Public: status / balance ═══════════════════════════════

  async check(code: string, pin: string | undefined, ip: string) {
    this.enforceRateLimit(
      `check:${ip}`,
      CHECK_LIMIT,
      'Too many lookups from this device. Please wait a few minutes and try again.',
    );
    if (!pin) {
      const card = await this.cardRepo.findOne({ where: { code } });
      if (!card)
        throw new NotFoundException(
          'Gift card not found. Please check the ID.',
        );
      return { ...this.publicStatusView(card), pinVerified: false };
    }

    // Count failed attempts atomically; throw only after the counter is committed.
    const outcome = await this.dataSource.transaction(async (em) => {
      const card = await this.lockCard(em, { code });
      if (!card) return { kind: 'not_found' as const };
      if (!card.pinEncrypted) return { kind: 'status' as const, card };
      if (card.isLocked) return { kind: 'locked' as const };

      if (this.pinMatches(card, pin)) {
        if (card.failedPinAttempts > 0) {
          card.failedPinAttempts = 0;
          card.firstFailedPinAt = null;
          await em.save(card);
        }
        return { kind: 'ok' as const, card };
      }

      const now = new Date();
      const windowExpired =
        !card.firstFailedPinAt ||
        now.getTime() - card.firstFailedPinAt.getTime() > PIN_ATTEMPT_WINDOW_MS;
      card.failedPinAttempts = windowExpired ? 1 : card.failedPinAttempts + 1;
      if (windowExpired) card.firstFailedPinAt = now;

      if (card.failedPinAttempts >= MAX_PIN_ATTEMPTS) {
        card.isLocked = true;
        card.lockedAt = now;
        await em.save(card);
        await this.log(em, card, GiftCardTransactionType.LOCK, {
          note: `Locked after ${MAX_PIN_ATTEMPTS} incorrect PIN attempts`,
          byName: 'System',
        });
        return { kind: 'locked' as const };
      }
      await em.save(card);
      return {
        kind: 'wrong_pin' as const,
        remaining: MAX_PIN_ATTEMPTS - card.failedPinAttempts,
      };
    });

    switch (outcome.kind) {
      case 'not_found':
        throw new NotFoundException(
          'Gift card not found. Please check the ID.',
        );
      case 'locked':
        throw new HttpException(
          { message: LOCKED_MESSAGE, locked: true },
          HttpStatus.LOCKED,
        );
      case 'wrong_pin':
        throw new BadRequestException({
          message: `Incorrect PIN. ${outcome.remaining} attempt${outcome.remaining === 1 ? '' : 's'} remaining before this card is locked.`,
          attemptsRemaining: outcome.remaining,
        });
      case 'status':
        return { ...this.publicStatusView(outcome.card), pinVerified: false };
      case 'ok': {
        const history = await this.txRepo.find({
          where: { giftCardId: outcome.card.id },
          order: { createdAt: 'DESC' },
        });
        return {
          ...this.publicStatusView(outcome.card),
          pinVerified: true,
          balance: outcome.card.balanceCents / 100,
          history: history
            .filter((t) => t.amountCents !== null)
            .map((t) => ({
              type: t.type,
              amount: t.amountCents! / 100,
              balanceAfter: (t.balanceAfterCents ?? 0) / 100,
              date: t.createdAt,
            })),
        };
      }
    }
  }

  private publicStatusView(card: GiftCard) {
    const approved = card.approvedAmountCents;
    return {
      code: card.code,
      status: card.status,
      isLocked: card.isLocked,
      requestedAmount: card.requestedAmountCents / 100,
      approvedAmount: approved !== null ? approved / 100 : null,
      amountAdjusted:
        approved !== null && approved !== card.requestedAmountCents,
      rejectionReason:
        card.status === GiftCardStatus.REJECTED ? card.rejectionReason : null,
      purchasedAt: card.createdAt,
      activatedAt: card.activatedAt,
    };
  }

  // ═══ Admin: queries ═════════════════════════════════════════

  async list(query: ListGiftCardsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const qb = this.cardRepo.createQueryBuilder('g');
    if (query.status)
      qb.andWhere('g.status = :status', { status: query.status });
    if (query.locked !== undefined)
      qb.andWhere('g.isLocked = :locked', { locked: query.locked });
    if (query.search) {
      qb.andWhere(
        `(g.code ILIKE :s OR g.buyerName ILIKE :s OR g.buyerEmail ILIKE :s OR g.buyerPhone ILIKE :s OR g.recipientName ILIKE :s OR g.recipientEmail ILIKE :s)`,
        { s: `%${query.search.trim()}%` },
      );
    }
    qb.orderBy(
      query.status === GiftCardStatus.PENDING_VERIFICATION
        ? 'g.createdAt'
        : 'g.updatedAt',
      query.status === GiftCardStatus.PENDING_VERIFICATION ? 'ASC' : 'DESC',
    )
      .skip((page - 1) * limit)
      .take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items: items.map((c) => this.adminView(c)), total, page, limit };
  }

  async findOne(id: string) {
    const card = await this.getCardOrFail(id);
    const transactions = await this.txRepo.find({
      where: { giftCardId: id },
      order: { createdAt: 'DESC' },
    });
    return { ...this.adminView(card), transactions };
  }

  async findByCode(code: string) {
    const card = await this.cardRepo.findOne({
      where: { code: code.trim().toUpperCase() },
    });
    if (!card) throw new NotFoundException('Gift card not found');
    return this.findOne(card.id);
  }

  async getSlip(id: string) {
    const card = await this.getCardOrFail(id);
    if (!card.slipFileName)
      throw new NotFoundException('No payment slip for this gift card');
    const filePath = path.join(this.slipDir, path.basename(card.slipFileName));
    if (!fs.existsSync(filePath))
      throw new NotFoundException('Payment slip file is missing');
    return {
      filePath,
      mimeType: card.slipMimeType || 'application/octet-stream',
      fileName: card.slipFileName,
    };
  }

  async getStats() {
    // "This month" is the pub's local month, regardless of server timezone.
    const monthStart = moment.tz('America/Toronto').startOf('month').toDate();

    const [
      pendingCount,
      activeCount,
      lockedCount,
      oldestPending,
      outstanding,
      soldMonth,
      redeemedMonth,
    ] = await Promise.all([
      this.cardRepo.count({
        where: { status: GiftCardStatus.PENDING_VERIFICATION },
      }),
      this.cardRepo.count({ where: { status: GiftCardStatus.ACTIVE } }),
      this.cardRepo.count({ where: { isLocked: true } }),
      this.cardRepo.findOne({
        where: { status: GiftCardStatus.PENDING_VERIFICATION },
        order: { createdAt: 'ASC' },
      }),
      this.cardRepo
        .createQueryBuilder('g')
        .select('COALESCE(SUM(g.balanceCents), 0)', 'sum')
        .where('g.status IN (:...s)', {
          s: [GiftCardStatus.ACTIVE, GiftCardStatus.FROZEN],
        })
        .getRawOne<{ sum: string }>(),
      this.cardRepo
        .createQueryBuilder('g')
        .select('COALESCE(SUM(g.approvedAmountCents), 0)', 'sum')
        .addSelect('COUNT(*)', 'count')
        .where('g.activatedAt >= :m', { m: monthStart })
        .getRawOne<{ sum: string; count: string }>(),
      this.txRepo
        .createQueryBuilder('t')
        .select('COALESCE(SUM(-"t"."amountCents"), 0)', 'sum')
        .where('t.type = :type', { type: GiftCardTransactionType.REDEEM })
        .andWhere('t.createdAt >= :m', { m: monthStart })
        .getRawOne<{ sum: string }>(),
    ]);

    return {
      pendingCount,
      oldestPendingAt: oldestPending?.createdAt ?? null,
      activeCount,
      lockedCount,
      outstandingBalance: Number(outstanding?.sum ?? 0) / 100,
      soldThisMonth: Number(soldMonth?.sum ?? 0) / 100,
      soldCountThisMonth: Number(soldMonth?.count ?? 0),
      redeemedThisMonth: Number(redeemedMonth?.sum ?? 0) / 100,
    };
  }

  // ═══ Admin: actions ═════════════════════════════════════════

  async approve(id: string, dto: ApproveGiftCardDto, actor: Actor) {
    const receivedCents = toCents(dto.receivedAmount);
    const { card, pin } = await this.dataSource.transaction(async (em) => {
      const card = await this.lockCardOrFail(em, id);
      if (
        ![
          GiftCardStatus.PENDING_VERIFICATION,
          GiftCardStatus.REJECTED,
        ].includes(card.status)
      ) {
        throw new BadRequestException(
          'Only pending or rejected orders can be approved',
        );
      }
      const differs = receivedCents !== card.requestedAmountCents;
      if (differs && !dto.note) {
        throw new BadRequestException(
          'A note is required when the received amount differs from the requested amount',
        );
      }
      const name = await this.actorName(actor);
      const pin = this.generatePin();
      Object.assign(card, {
        status: GiftCardStatus.ACTIVE,
        approvedAmountCents: receivedCents,
        balanceCents: receivedCents,
        pinEncrypted: this.encryptPin(pin),
        approvalNote: dto.note || null,
        rejectionReason: null,
        reviewedById: actor.userId,
        reviewedByName: name,
        reviewedAt: new Date(),
        activatedAt: new Date(),
      });
      await em.save(card);
      await this.log(em, card, GiftCardTransactionType.ISSUE, {
        amountCents: receivedCents,
        note: differs
          ? `Approved for ${formatCents(receivedCents)} (requested ${formatCents(card.requestedAmountCents)}). ${dto.note}`
          : dto.note || 'Payment verified',
        actor,
        byName: name,
      });
      return { card, pin };
    });

    void this.mail.sendGiftCardToRecipient(card, pin);
    void this.mail.sendBuyerApproved(card);
    return this.adminView(card);
  }

  async reject(id: string, dto: RejectGiftCardDto, actor: Actor) {
    const card = await this.dataSource.transaction(async (em) => {
      const card = await this.lockCardOrFail(em, id);
      if (card.status !== GiftCardStatus.PENDING_VERIFICATION) {
        throw new BadRequestException('Only pending orders can be rejected');
      }
      const name = await this.actorName(actor);
      Object.assign(card, {
        status: GiftCardStatus.REJECTED,
        rejectionReason: dto.reason,
        reviewedById: actor.userId,
        reviewedByName: name,
        reviewedAt: new Date(),
      });
      await em.save(card);
      await this.log(em, card, GiftCardTransactionType.REJECT, {
        note: dto.reason,
        actor,
        byName: name,
      });
      return card;
    });
    void this.mail.sendBuyerRejected(card);
    return this.adminView(card);
  }

  async redeem(id: string, dto: RedeemGiftCardDto, actor: Actor) {
    const amountCents = toCents(dto.amount);
    const card = await this.dataSource.transaction(async (em) => {
      const card = await this.lockCardOrFail(em, id);
      if (card.isLocked) {
        throw new ForbiddenException(
          'This gift card is locked. Unlock it or reset the PIN first.',
        );
      }
      if (card.status !== GiftCardStatus.ACTIVE) {
        throw new BadRequestException(
          `Gift card cannot be used (status: ${card.status})`,
        );
      }
      if (!this.pinMatches(card, dto.pin)) {
        throw new BadRequestException('Incorrect PIN');
      }
      if (amountCents > card.balanceCents) {
        throw new BadRequestException(
          `Amount exceeds the available balance of ${formatCents(card.balanceCents)}`,
        );
      }
      card.balanceCents -= amountCents;
      if (card.balanceCents === 0) card.status = GiftCardStatus.FULLY_REDEEMED;
      await em.save(card);
      await this.log(em, card, GiftCardTransactionType.REDEEM, {
        amountCents: -amountCents,
        note: dto.note,
        actor,
        byName: await this.actorName(actor),
      });
      return card;
    });
    return this.adminView(card);
  }

  async adjust(id: string, dto: AdjustGiftCardDto, actor: Actor) {
    const delta = toCents(dto.amount);
    if (delta === 0)
      throw new BadRequestException('Adjustment amount cannot be zero');
    const card = await this.dataSource.transaction(async (em) => {
      const card = await this.lockCardOrFail(em, id);
      if (
        ![
          GiftCardStatus.ACTIVE,
          GiftCardStatus.FULLY_REDEEMED,
          GiftCardStatus.FROZEN,
        ].includes(card.status)
      ) {
        throw new BadRequestException(
          `Cannot adjust a card with status ${card.status}`,
        );
      }
      if (card.balanceCents + delta < 0) {
        throw new BadRequestException(
          'Adjustment would make the balance negative',
        );
      }
      card.balanceCents += delta;
      if (card.status !== GiftCardStatus.FROZEN) {
        card.status =
          card.balanceCents === 0
            ? GiftCardStatus.FULLY_REDEEMED
            : GiftCardStatus.ACTIVE;
      }
      await em.save(card);
      await this.log(em, card, GiftCardTransactionType.ADJUST, {
        amountCents: delta,
        note: dto.note,
        actor,
        byName: await this.actorName(actor),
      });
      return card;
    });
    return this.adminView(card);
  }

  async issue(dto: IssueGiftCardDto, actor: Actor) {
    const cents = toCents(dto.amount);
    const pin = this.generatePin();
    const code = await this.generateUniqueCode();
    const name = await this.actorName(actor);
    const card = await this.dataSource.transaction(async (em) => {
      const card = em.create(GiftCard, {
        code,
        status: GiftCardStatus.ACTIVE,
        source: GiftCardSource.ADMIN,
        paymentMethod: dto.paymentMethod,
        requestedAmountCents: cents,
        approvedAmountCents: cents,
        balanceCents: cents,
        pinEncrypted: this.encryptPin(pin),
        buyerName: dto.buyerName,
        buyerEmail: dto.buyerEmail?.toLowerCase() || null,
        buyerPhone: dto.buyerPhone || null,
        isForSelf: false,
        recipientName: dto.recipientName,
        recipientEmail: dto.recipientEmail?.toLowerCase() || null,
        message: dto.message || null,
        approvalNote: dto.note || null,
        reviewedById: actor.userId,
        reviewedByName: name,
        reviewedAt: new Date(),
        activatedAt: new Date(),
      });
      await em.save(card);
      await this.log(em, card, GiftCardTransactionType.ISSUE, {
        amountCents: cents,
        note:
          dto.note ||
          `Issued by staff (${dto.paymentMethod === GiftCardPaymentMethod.IN_STORE ? 'in-store payment' : 'complimentary'})`,
        actor,
        byName: name,
      });
      return card;
    });
    if (card.recipientEmail) void this.mail.sendGiftCardToRecipient(card, pin);
    // PIN is returned once so staff can hand it over when there is no email.
    return { ...this.adminView(card), pin, emailed: !!card.recipientEmail };
  }

  async resendEmail(id: string, actor: Actor) {
    const card = await this.getCardOrFail(id);
    if (!card.pinEncrypted)
      throw new BadRequestException('This gift card has not been issued yet');
    if (!card.recipientEmail)
      throw new BadRequestException('This gift card has no recipient email');
    await this.mail.sendGiftCardToRecipient(
      card,
      this.decryptPin(card.pinEncrypted),
      true,
    );
    await this.log(
      this.dataSource.manager,
      card,
      GiftCardTransactionType.EMAIL_RESENT,
      {
        note: `Sent to ${card.recipientEmail}`,
        actor,
        byName: await this.actorName(actor),
      },
    );
    return { success: true };
  }

  async unlock(id: string, actor: Actor) {
    const card = await this.dataSource.transaction(async (em) => {
      const card = await this.lockCardOrFail(em, id);
      if (!card.isLocked)
        throw new BadRequestException('This gift card is not locked');
      Object.assign(card, {
        isLocked: false,
        lockedAt: null,
        failedPinAttempts: 0,
        firstFailedPinAt: null,
      });
      await em.save(card);
      await this.log(em, card, GiftCardTransactionType.UNLOCK, {
        actor,
        byName: await this.actorName(actor),
      });
      return card;
    });
    return this.adminView(card);
  }

  async resetPin(id: string, actor: Actor) {
    const { card, pin } = await this.dataSource.transaction(async (em) => {
      const card = await this.lockCardOrFail(em, id);
      if (!card.pinEncrypted)
        throw new BadRequestException('This gift card has not been issued yet');
      const pin = this.generatePin();
      Object.assign(card, {
        pinEncrypted: this.encryptPin(pin),
        isLocked: false,
        lockedAt: null,
        failedPinAttempts: 0,
        firstFailedPinAt: null,
      });
      await em.save(card);
      await this.log(em, card, GiftCardTransactionType.PIN_RESET, {
        note: card.recipientEmail
          ? `New PIN emailed to ${card.recipientEmail}`
          : 'New PIN shown to staff',
        actor,
        byName: await this.actorName(actor),
      });
      return { card, pin };
    });
    if (card.recipientEmail) void this.mail.sendPinReset(card, pin);
    return {
      ...this.adminView(card),
      pin: card.recipientEmail ? undefined : pin,
      emailed: !!card.recipientEmail,
    };
  }

  async setFrozen(
    id: string,
    frozen: boolean,
    dto: { note?: string },
    actor: Actor,
  ) {
    const card = await this.dataSource.transaction(async (em) => {
      const card = await this.lockCardOrFail(em, id);
      if (frozen && card.status !== GiftCardStatus.ACTIVE) {
        throw new BadRequestException('Only active gift cards can be frozen');
      }
      if (!frozen && card.status !== GiftCardStatus.FROZEN) {
        throw new BadRequestException('This gift card is not frozen');
      }
      card.status = frozen
        ? GiftCardStatus.FROZEN
        : card.balanceCents === 0
          ? GiftCardStatus.FULLY_REDEEMED
          : GiftCardStatus.ACTIVE;
      await em.save(card);
      await this.log(
        em,
        card,
        frozen
          ? GiftCardTransactionType.FREEZE
          : GiftCardTransactionType.UNFREEZE,
        {
          note: dto.note,
          actor,
          byName: await this.actorName(actor),
        },
      );
      return card;
    });
    return this.adminView(card);
  }

  async void(id: string, dto: { note?: string }, actor: Actor) {
    const card = await this.dataSource.transaction(async (em) => {
      const card = await this.lockCardOrFail(em, id);
      if (card.status === GiftCardStatus.VOID)
        throw new BadRequestException('Gift card is already void');
      const removed = card.balanceCents;
      card.balanceCents = 0;
      card.status = GiftCardStatus.VOID;
      await em.save(card);
      await this.log(em, card, GiftCardTransactionType.VOID, {
        amountCents: removed ? -removed : null,
        note: dto.note,
        actor,
        byName: await this.actorName(actor),
      });
      return card;
    });
    return this.adminView(card);
  }

  // ═══ Weekly reminder (super admins) ═════════════════════════

  @Cron('0 9 * * 1', {
    name: 'giftcard-weekly-pending',
    timeZone: 'America/Toronto',
  })
  async sendWeeklyPendingReminder() {
    const pending = await this.cardRepo.find({
      where: { status: GiftCardStatus.PENDING_VERIFICATION },
      order: { createdAt: 'ASC' },
    });
    if (pending.length === 0) return;
    const superAdmins = await this.userRepo.find({
      where: { role: 'super_admin', isActive: true },
    });
    const emails = superAdmins.map((u) => u.email).filter(Boolean);
    if (emails.length === 0) return;
    await this.mail.sendWeeklyPendingDigest(emails, pending);
    this.logger.log(
      `Weekly gift card reminder sent to ${emails.length} super admin(s): ${pending.length} pending`,
    );
  }

  // ═══ Helpers ════════════════════════════════════════════════

  private adminView(card: GiftCard) {
    const { pinEncrypted, slipFileName, ...rest } = card;
    return {
      ...rest,
      hasPin: !!pinEncrypted,
      hasSlip: !!slipFileName,
      requestedAmount: card.requestedAmountCents / 100,
      approvedAmount:
        card.approvedAmountCents !== null
          ? card.approvedAmountCents / 100
          : null,
      balance: card.balanceCents / 100,
    };
  }

  private async getCardOrFail(id: string): Promise<GiftCard> {
    const card = await this.cardRepo.findOne({ where: { id } });
    if (!card) throw new NotFoundException('Gift card not found');
    return card;
  }

  private lockCard(em: EntityManager, where: { id?: string; code?: string }) {
    return em.findOne(GiftCard, { where, lock: { mode: 'pessimistic_write' } });
  }

  private async lockCardOrFail(
    em: EntityManager,
    id: string,
  ): Promise<GiftCard> {
    const card = await this.lockCard(em, { id });
    if (!card) throw new NotFoundException('Gift card not found');
    return card;
  }

  private async log(
    em: EntityManager,
    card: GiftCard,
    type: GiftCardTransactionType,
    opts: {
      amountCents?: number | null;
      note?: string | null;
      actor?: Actor;
      byName?: string;
    },
  ) {
    const monetary =
      opts.amountCents !== undefined && opts.amountCents !== null;
    await em.save(
      em.create(GiftCardTransaction, {
        giftCardId: card.id,
        type,
        amountCents: monetary ? opts.amountCents : null,
        balanceAfterCents: monetary ? card.balanceCents : null,
        note: opts.note || null,
        performedById: opts.actor?.userId ?? null,
        performedByName: opts.byName ?? null,
      }),
    );
  }

  private async actorName(actor: Actor): Promise<string> {
    const user = await this.userRepo.findOne({ where: { id: actor.userId } });
    return user ? `${user.firstName} ${user.lastName}`.trim() : actor.email;
  }

  private async generateUniqueCode(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const pick = () =>
        Array.from(
          { length: 4 },
          () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)],
        ).join('');
      const code = `BPGC-${pick()}-${pick()}`;
      if (!(await this.cardRepo.exist({ where: { code } }))) return code;
    }
    throw new Error('Could not generate a unique gift card code');
  }

  private generatePin(): string {
    return crypto.randomInt(0, 10000).toString().padStart(4, '0');
  }

  private encryptPin(pin: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.pinKey, iv);
    const enc = Buffer.concat([cipher.update(pin, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), enc]
      .map((b) => b.toString('base64'))
      .join('.');
  }

  private decryptPin(payload: string): string {
    const [iv, tag, enc] = payload
      .split('.')
      .map((p) => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.pinKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
      'utf8',
    );
  }

  private pinMatches(card: GiftCard, pin: string): boolean {
    if (!card.pinEncrypted) return false;
    const actual = Buffer.from(this.decryptPin(card.pinEncrypted));
    const given = Buffer.from(pin);
    return (
      actual.length === given.length && crypto.timingSafeEqual(actual, given)
    );
  }

  /** Checks size and real file signature (not just the client-supplied mimetype). */
  private validateSlip(file: Express.Multer.File | undefined): string {
    if (!file?.buffer?.length)
      throw new BadRequestException('Please upload your payment slip');
    if (file.size > MAX_SLIP_BYTES)
      throw new BadRequestException('Payment slip must be 5 MB or smaller');
    const b = file.buffer;
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])))
      return 'image/png';
    if (b.subarray(0, 4).toString('latin1') === '%PDF')
      return 'application/pdf';
    throw new BadRequestException(
      'Payment slip must be a JPG, PNG or PDF file',
    );
  }

  private enforceRateLimit(
    key: string,
    limit: { max: number; windowMs: number },
    message: string,
  ) {
    const now = Date.now();
    const hits = (this.rateHits.get(key) || []).filter(
      (t) => now - t < limit.windowMs,
    );
    if (hits.length >= limit.max) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
    hits.push(now);
    this.rateHits.set(key, hits);
  }

  /** Drop stale rate-limit buckets so the map can't grow without bound. */
  @Cron('*/15 * * * *', { name: 'giftcard-rate-limit-prune' })
  pruneRateLimits() {
    const cutoff = Date.now() - SUBMIT_LIMIT.windowMs;
    for (const [key, hits] of this.rateHits) {
      if (hits.every((t) => t < cutoff)) this.rateHits.delete(key);
    }
  }
}
