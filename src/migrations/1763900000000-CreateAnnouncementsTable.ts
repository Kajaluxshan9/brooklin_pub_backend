import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateAnnouncementsTable1763900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "announcement_type_enum" AS ENUM ('general', 'promotion', 'closure', 'menu_update', 'community', 'holiday'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "announcement_priority_enum" AS ENUM ('low', 'normal', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "announcement_status_enum" AS ENUM ('draft', 'sending', 'sent', 'failed'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'announcements',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '200',
          },
          {
            name: 'content',
            type: 'text',
          },
          {
            name: 'type',
            type: 'announcement_type_enum',
            default: `'general'`,
          },
          {
            name: 'priority',
            type: 'announcement_priority_enum',
            default: `'normal'`,
          },
          {
            name: 'status',
            type: 'announcement_status_enum',
            default: `'draft'`,
          },
          {
            name: 'recipientCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'sentAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'ctaText',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'ctaUrl',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('announcements');
    await queryRunner.query(`DROP TYPE "announcement_status_enum"`);
    await queryRunner.query(`DROP TYPE "announcement_priority_enum"`);
    await queryRunner.query(`DROP TYPE "announcement_type_enum"`);
  }
}
