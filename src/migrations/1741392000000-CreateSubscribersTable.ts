import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubscribersTable1741392000000 implements MigrationInterface {
  name = 'CreateSubscribersTable1741392000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "subscribers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "unsubscribeToken" character varying NOT NULL,
        "subscribedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "unsubscribedAt" TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_subscribers_email" UNIQUE ("email"),
        CONSTRAINT "UQ_subscribers_unsubscribeToken" UNIQUE ("unsubscribeToken"),
        CONSTRAINT "PK_subscribers" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "subscribers"`);
  }
}
