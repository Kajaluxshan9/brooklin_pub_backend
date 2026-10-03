import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { GiftCard } from './gift-card.entity';

export enum GiftCardTransactionType {
  ISSUE = 'issue',
  REDEEM = 'redeem',
  ADJUST = 'adjust',
  VOID = 'void',
  REJECT = 'reject',
  FREEZE = 'freeze',
  UNFREEZE = 'unfreeze',
  LOCK = 'lock',
  UNLOCK = 'unlock',
  PIN_RESET = 'pin_reset',
  EMAIL_RESENT = 'email_resent',
}

/**
 * Append-only history for a gift card. Monetary entries carry amountCents
 * (signed: negative = money taken off) and balanceAfterCents.
 */
@Entity('gift_card_transactions')
export class GiftCardTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  giftCardId: string;

  @ManyToOne(() => GiftCard, (g) => g.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'giftCardId' })
  giftCard: GiftCard;

  @Column({ type: 'enum', enum: GiftCardTransactionType })
  type: GiftCardTransactionType;

  @Column({ type: 'int', nullable: true })
  amountCents: number | null;

  @Column({ type: 'int', nullable: true })
  balanceAfterCents: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'uuid', nullable: true })
  performedById: string | null;

  /** Staff name, or "Customer" / "System". */
  @Column({ type: 'varchar', length: 200, nullable: true })
  performedByName: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
