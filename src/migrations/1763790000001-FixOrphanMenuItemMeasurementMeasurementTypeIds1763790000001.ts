import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixOrphanMenuItemMeasurementMeasurementTypeIds1763790000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Any menu_item_measurements that reference a non-existent measurement_types id
    // should be updated to NULL to avoid FK issues and allow fetching.
    // Also move the measurement to freeformMeasurement set to 'Regular' as fallback
    await queryRunner.query(`
      UPDATE menu_item_measurements mim
      SET "freeformMeasurement" = COALESCE(mim."freeformMeasurement", 'Regular'),
          "measurementTypeId" = NULL
      WHERE mim."measurementTypeId" IS NOT NULL
        AND mim."measurementTypeId" NOT IN (SELECT id FROM measurement_types);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // no-op down migration; it's unsafe to reassign measurementTypeIds automatically
  }
}
