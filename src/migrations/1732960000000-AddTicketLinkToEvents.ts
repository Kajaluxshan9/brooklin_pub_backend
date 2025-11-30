import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTicketLinkToEvents1732960000000 implements MigrationInterface {
  name = 'AddTicketLinkToEvents1732960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "ticketLink" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "ticketLink"`);
  }
}
