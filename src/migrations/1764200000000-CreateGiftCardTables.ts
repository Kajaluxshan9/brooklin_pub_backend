import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gift cards (bank-transfer slip + admin approval flow).
 *
 * - gift_cards: one row per card; money in integer cents
 * - gift_card_transactions: append-only history (issue/redeem/adjust/lock/...)
 * - gift_card_settings: singleton row (id = 1) with admin-configurable options
 */
export class CreateGiftCardTables1764200000000 implements MigrationInterface {
  name = 'CreateGiftCardTables1764200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "gift_cards_status_enum" AS ENUM
          ('pending_verification','active','rejected','fully_redeemed','frozen','void');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN
        CREATE TYPE "gift_cards_source_enum" AS ENUM ('online','admin');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN
        CREATE TYPE "gift_cards_paymentmethod_enum" AS ENUM
          ('interac','bank_deposit','in_store','complimentary');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN
        CREATE TYPE "gift_card_transactions_type_enum" AS ENUM
          ('issue','redeem','adjust','void','reject','freeze','unfreeze','lock','unlock','pin_reset','email_resent');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gift_cards" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar(20) NOT NULL,
        "status" "gift_cards_status_enum" NOT NULL DEFAULT 'pending_verification',
        "source" "gift_cards_source_enum" NOT NULL DEFAULT 'online',
        "paymentMethod" "gift_cards_paymentmethod_enum" NOT NULL,
        "requestedAmountCents" integer NOT NULL,
        "approvedAmountCents" integer,
        "balanceCents" integer NOT NULL DEFAULT 0,
        "pinEncrypted" varchar(200),
        "failedPinAttempts" integer NOT NULL DEFAULT 0,
        "firstFailedPinAt" TIMESTAMP,
        "isLocked" boolean NOT NULL DEFAULT false,
        "lockedAt" TIMESTAMP,
        "buyerName" varchar(120) NOT NULL,
        "buyerEmail" varchar(200),
        "buyerPhone" varchar(30),
        "isForSelf" boolean NOT NULL DEFAULT false,
        "recipientName" varchar(120) NOT NULL,
        "recipientEmail" varchar(200),
        "message" varchar(500),
        "slipFileName" varchar(255),
        "slipMimeType" varchar(100),
        "reviewedById" uuid,
        "reviewedByName" varchar(200),
        "reviewedAt" TIMESTAMP,
        "approvalNote" varchar(500),
        "rejectionReason" varchar(500),
        "activatedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gift_cards_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_gift_cards_balance_nonneg" CHECK ("balanceCents" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_cards_code" ON "gift_cards" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_gift_cards_status" ON "gift_cards" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gift_card_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "giftCardId" uuid NOT NULL,
        "type" "gift_card_transactions_type_enum" NOT NULL,
        "amountCents" integer,
        "balanceAfterCents" integer,
        "note" varchar(500),
        "performedById" uuid,
        "performedByName" varchar(200),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gift_card_transactions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_gift_card_transactions_card" FOREIGN KEY ("giftCardId")
          REFERENCES "gift_cards"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_gift_card_transactions_card" ON "gift_card_transactions" ("giftCardId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gift_card_settings" (
        "id" integer NOT NULL DEFAULT 1,
        "isEnabled" boolean NOT NULL DEFAULT true,
        "presetAmounts" jsonb NOT NULL DEFAULT '[25,50,100,200]',
        "customAmountEnabled" boolean NOT NULL DEFAULT true,
        "customAmountMin" integer NOT NULL DEFAULT 10,
        "customAmountMax" integer NOT NULL DEFAULT 500,
        "interacEnabled" boolean NOT NULL DEFAULT true,
        "interacEmail" varchar(200),
        "interacRecipientName" varchar(200),
        "interacInstructions" text,
        "bankDepositEnabled" boolean NOT NULL DEFAULT true,
        "bankName" varchar(200),
        "bankAccountName" varchar(200),
        "bankInstitutionNumber" varchar(10),
        "bankTransitNumber" varchar(10),
        "bankAccountNumber" varchar(30),
        "bankInstructions" text,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gift_card_settings_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `INSERT INTO "gift_card_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "gift_card_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gift_cards"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gift_card_settings"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "gift_card_transactions_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "gift_cards_paymentmethod_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "gift_cards_source_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "gift_cards_status_enum"`);
  }
}
