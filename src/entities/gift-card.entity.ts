import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  Check,
} from 'typeorm';
import { GiftCardTransaction } from './gift-card-transaction.entity';

export enum GiftCardStatus {
  PENDING_VERIFICATION = 'pending_verification',
  ACTIVE = 'active',
  REJECTED = 'rejected',
  FULLY_REDEEMED = 'fully_redeemed',
  FROZEN = 'frozen',
  VOID = 'void',
}

export enum GiftCardPaymentMethod {
  INTERAC = 'interac',
  BANK_DEPOSIT = 'bank_deposit',
  IN_STORE = 'in_store',
  COMPLIMENTARY = 'complimentary',
}

export enum GiftCardSource {
  ONLINE = 'online',
  ADMIN = 'admin',
}

/**
 * A gift card. All money values are stored in integer cents (CAD).
 * Ontario rules: gift cards never expire and carry no fees.
 */
@Entity('gift_cards')
@Check('CHK_gift_cards_balance_nonneg', '"balanceCents" >= 0')
export class GiftCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Public unique ID shared with the buyer, e.g. BPGC-7K3M-Q9XA */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({
    type: 'enum',
    enum: GiftCardStatus,
    default: GiftCardStatus.PENDING_VERIFICATION,
  })
  status: GiftCardStatus;

  @Column({
    type: 'enum',
    enum: GiftCardSource,
    default: GiftCardSource.ONLINE,
  })
  source: GiftCardSource;

  @Column({ type: 'enum', enum: GiftCardPaymentMethod })
  paymentMethod: GiftCardPaymentMethod;

  // ─── Amounts (cents) ─────────────────────────────────────────

  /** Amount the buyer asked for. */
  @Column({ type: 'int' })
  requestedAmountCents: number;

  /** Amount the admin confirmed as received (card value). Null until approved. */
  @Column({ type: 'int', nullable: true })
  approvedAmountCents: number | null;

  @Column({ type: 'int', default: 0 })
  balanceCents: number;

  // ─── PIN (AES-256-GCM encrypted so it can be re-sent) ───────

  @Column({ type: 'varchar', length: 200, nullable: true })
  pinEncrypted: string | null;

  @Column({ type: 'int', default: 0 })
  failedPinAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  firstFailedPinAt: Date | null;

  @Column({ default: false })
  isLocked: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lockedAt: Date | null;

  // ─── Buyer / recipient ──────────────────────────────────────

  @Column({ type: 'varchar', length: 120 })
  buyerName: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  buyerEmail: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  buyerPhone: string | null;

  @Column({ default: false })
  isForSelf: boolean;

  @Column({ type: 'varchar', length: 120 })
  recipientName: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  recipientEmail: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  message: string | null;

  // ─── Payment slip ───────────────────────────────────────────

  /** File name inside the private slip directory (never publicly served). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  slipFileName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  slipMimeType: string | null;

  // ─── Review ─────────────────────────────────────────────────

  @Column({ type: 'uuid', nullable: true })
  reviewedById: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  reviewedByName: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  /** Required when approved amount differs from requested. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  approvalNote: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  activatedAt: Date | null;

  @OneToMany(() => GiftCardTransaction, (t) => t.giftCard)
  transactions: GiftCardTransaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
