import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds promo code columns to the subscribers table.
 *
 * New columns:
 *  - promoCode        varchar(8)  UNIQUE  NULLABLE  — the 8-char promo code
 *  - promoCodeSent    boolean     NOT NULL DEFAULT false
 *  - promoSentAt      timestamp   NULLABLE
 *  - promoClaimed     boolean     NOT NULL DEFAULT false
 *  - promoClaimedAt   timestamp   NULLABLE
 *
 * Design notes:
 *  - promoCodeSent is never reset, even when a subscriber unsubscribes and
 *    re-subscribes. This enforces the one-time-per-email-address rule.
 *  - promoCode is UNIQUE so two subscribers can never hold the same code.
 */
export class AddPromoCodeToSubscribers1764000000000 implements MigrationInterface {
  name = 'AddPromoCodeToSubscribers1764000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscribers"
        ADD COLUMN IF NOT EXISTS "promoCode"      character varying(8)  DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "promoCodeSent"  boolean               NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "promoSentAt"    TIMESTAMP             DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "promoClaimed"   boolean               NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "promoClaimedAt" TIMESTAMP             DEFAULT NULL
    `);

    // Unique constraint — enforced at DB level in addition to application logic
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "subscribers"
          ADD CONSTRAINT "UQ_subscribers_promoCode" UNIQUE ("promoCode");
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscribers"
        DROP CONSTRAINT IF EXISTS "UQ_subscribers_promoCode"
    `);

    await queryRunner.query(`
      ALTER TABLE "subscribers"
        DROP COLUMN IF EXISTS "promoClaimedAt",
        DROP COLUMN IF EXISTS "promoClaimed",
        DROP COLUMN IF EXISTS "promoSentAt",
        DROP COLUMN IF EXISTS "promoCodeSent",
        DROP COLUMN IF EXISTS "promoCode"
    `);
  }
}
