import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('subscribers')
export class Subscriber {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Sequential subscriber number, assigned on subscription (1 = first subscriber ever). */
  @Column({ type: 'int', unique: true, nullable: false })
  subscriberNumber: number;

  @Column({ unique: true })
  email: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'varchar', unique: true })
  unsubscribeToken: string;

  @CreateDateColumn()
  subscribedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  unsubscribedAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;

  // ─── Promo Code ──────────────────────────────────────────────────────────────

  /** The 8-char promo code. Null until a promo is sent. Unique across all rows. */
  @Column({ type: 'varchar', length: 8, nullable: true, unique: true })
  promoCode: string | null;

  /** True once a promo code has been emailed. Never resets, even on re-subscribe. */
  @Column({ default: false })
  promoCodeSent: boolean;

  /** Timestamp the promo email was dispatched. */
  @Column({ type: 'timestamp', nullable: true })
  promoSentAt: Date | null;

  /** True once the admin marks the promo as physically claimed at the pub. */
  @Column({ default: false })
  promoClaimed: boolean;

  /** Timestamp the admin marked the promo as claimed. */
  @Column({ type: 'timestamp', nullable: true })
  promoClaimedAt: Date | null;
}
