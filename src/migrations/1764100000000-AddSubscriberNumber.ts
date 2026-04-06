import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a subscriberNumber column to the subscribers table.
 *
 * - subscriberNumber is a sequential integer (1 = first subscriber ever)
 * - Backfills existing rows ordered by subscribedAt ASC so the earliest
 *   subscriber gets number 1
 * - Adds a UNIQUE constraint to prevent duplicates
 */
export class AddSubscriberNumber1764100000000 implements MigrationInterface {
  name = 'AddSubscriberNumber1764100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add column as nullable first so we can backfill
    await queryRunner.query(`
      ALTER TABLE "subscribers"
        ADD COLUMN IF NOT EXISTS "subscriberNumber" integer DEFAULT NULL
    `);

    // Backfill existing subscribers ordered by subscribedAt (earliest = 1)
    await queryRunner.query(`
      WITH numbered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY "subscribedAt" ASC) AS rn
        FROM "subscribers"
      )
      UPDATE "subscribers" s
      SET "subscriberNumber" = numbered.rn
      FROM numbered
      WHERE s.id = numbered.id
    `);

    // Now make the column NOT NULL
    await queryRunner.query(`
      ALTER TABLE "subscribers"
        ALTER COLUMN "subscriberNumber" SET NOT NULL
    `);

    // Add unique constraint
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "subscribers"
          ADD CONSTRAINT "UQ_subscribers_subscriberNumber" UNIQUE ("subscriberNumber");
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscribers"
        DROP CONSTRAINT IF EXISTS "UQ_subscribers_subscriberNumber"
    `);

    await queryRunner.query(`
      ALTER TABLE "subscribers"
        DROP COLUMN IF EXISTS "subscriberNumber"
    `);
  }
}
