import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateScheduledNotificationsTable1741500000000 implements MigrationInterface {
  name = 'CreateScheduledNotificationsTable1741500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      DO $$ BEGIN CREATE TYPE "scheduled_notifications_type_enum" AS ENUM ('special', 'event'); EXCEPTION WHEN duplicate_object THEN null; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN CREATE TYPE "scheduled_notifications_status_enum" AS ENUM ('pending', 'sent', 'failed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "scheduled_notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "scheduled_notifications_type_enum" NOT NULL,
        "referenceId" uuid NOT NULL,
        "scheduledFor" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" "scheduled_notifications_status_enum" NOT NULL DEFAULT 'pending',
        "sentAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_scheduled_notifications" PRIMARY KEY ("id")
      )
    `);

    // Index for the cron job: find pending notifications that are due
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_scheduled_notifications_pending_due"
      ON "scheduled_notifications" ("scheduledFor")
      WHERE "status" = 'pending'
    `);

    // Index for cancellation lookups by type + referenceId
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_scheduled_notifications_type_ref"
      ON "scheduled_notifications" ("type", "referenceId")
      WHERE "status" = 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "scheduled_notifications"`);
    await queryRunner.query(`DROP TYPE "scheduled_notifications_status_enum"`);
    await queryRunner.query(`DROP TYPE "scheduled_notifications_type_enum"`);
  }
}
