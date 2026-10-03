import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/** Singleton row (id = 1) holding admin-configurable gift card settings. */
@Entity('gift_card_settings')
export class GiftCardSettings {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number;

  /** Master switch for online gift card sales. */
  @Column({ default: true })
  isEnabled: boolean;

  /** Preset amounts in whole dollars. */
  @Column({ type: 'jsonb', default: () => "'[25,50,100,200]'" })
  presetAmounts: number[];

  @Column({ default: true })
  customAmountEnabled: boolean;

  @Column({ type: 'int', default: 10 })
  customAmountMin: number;

  @Column({ type: 'int', default: 500 })
  customAmountMax: number;

  // ─── Interac e-Transfer ─────────────────────────────────────

  @Column({ default: true })
  interacEnabled: boolean;

  @Column({ type: 'varchar', length: 200, nullable: true })
  interacEmail: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  interacRecipientName: string | null;

  @Column({ type: 'text', nullable: true })
  interacInstructions: string | null;

  // ─── Bank deposit ───────────────────────────────────────────

  @Column({ default: true })
  bankDepositEnabled: boolean;

  @Column({ type: 'varchar', length: 200, nullable: true })
  bankName: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  bankAccountName: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  bankInstitutionNumber: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  bankTransitNumber: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  bankAccountNumber: string | null;

  @Column({ type: 'text', nullable: true })
  bankInstructions: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
