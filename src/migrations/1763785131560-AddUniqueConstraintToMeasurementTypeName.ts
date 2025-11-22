import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueConstraintToMeasurementTypeName1763785131560 implements MigrationInterface {
    name = 'AddUniqueConstraintToMeasurementTypeName1763785131560'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "menu_items" ALTER COLUMN "imageUrls" SET DEFAULT ARRAY[]::text[]`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "menu_items" ALTER COLUMN "imageUrls" SET DEFAULT ARRAY[]`);
    }

}
