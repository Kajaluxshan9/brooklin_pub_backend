import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class AddMeasurementTypesAndMenuItemMeasurements1763788800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create measurement_types table
    await queryRunner.createTable(
      new Table({
        name: 'measurement_types',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'name', type: 'varchar', length: '100', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          {
            name: 'isActive',
            type: 'boolean',
            isNullable: false,
            default: true,
          },
          { name: 'sortOrder', type: 'int', isNullable: false, default: 0 },
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

    // Create menu_item_measurements table
    await queryRunner.createTable(
      new Table({
        name: 'menu_item_measurements',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'menuItemId', type: 'uuid', isNullable: false },
          { name: 'measurementTypeId', type: 'uuid', isNullable: true },
          {
            name: 'freeformMeasurement',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'price',
            type: 'decimal',
            precision: 8,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'isAvailable',
            type: 'boolean',
            isNullable: false,
            default: true,
          },
          { name: 'sortOrder', type: 'int', isNullable: false, default: 0 },
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

    // Foreign keys
    await queryRunner.createForeignKey(
      'menu_item_measurements',
      new TableForeignKey({
        columnNames: ['menuItemId'],
        referencedTableName: 'menu_items',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'menu_item_measurements',
      new TableForeignKey({
        columnNames: ['measurementTypeId'],
        referencedTableName: 'measurement_types',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // Add index for performance
    await queryRunner.query(
      `CREATE INDEX "IDX_menu_item_measurements_menuItemId" ON "menu_item_measurements" ("menuItemId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_menu_item_measurements_measurementTypeId" ON "menu_item_measurements" ("measurementTypeId")`,
    );

    // Add hasMeasurements column to menu_items
    await queryRunner.addColumn(
      'menu_items',
      new TableColumn({
        name: 'hasMeasurements',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );

    // Create a default measurement type 'Regular' if it doesn't exist
    await queryRunner.query(
      `INSERT INTO measurement_types (id, name, description, "isActive", "sortOrder", "createdAt", "updatedAt") SELECT uuid_generate_v4(), 'Regular', 'Regular / single size', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM measurement_types WHERE name='Regular')`,
    );

    // Migrate existing menu item prices into menu_item_measurements as 'Regular' measurement
    await queryRunner.query(`
      INSERT INTO menu_item_measurements ("id","menuItemId","measurementTypeId","freeformMeasurement","price","isAvailable","sortOrder","createdAt","updatedAt")
      SELECT
        uuid_generate_v4(),
        mi.id,
        (SELECT id FROM measurement_types mt WHERE mt.name = 'Regular' LIMIT 1),
        NULL,
        mi.price,
        mi."isAvailable",
        0,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM menu_items mi
      WHERE mi.price IS NOT NULL
    `);

    // mark hasMeasurements for migrated items
    await queryRunner.query(
      `UPDATE menu_items SET "hasMeasurements" = true WHERE price IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove hasMeasurements column
    await queryRunner.dropColumn('menu_items', 'hasMeasurements');

    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_menu_item_measurements_measurementTypeId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_menu_item_measurements_menuItemId"`,
    );

    // Drop foreign keys and tables
    const mimTable = await queryRunner.getTable('menu_item_measurements');
    const fk1 = mimTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('menuItemId') !== -1,
    );
    if (fk1) await queryRunner.dropForeignKey('menu_item_measurements', fk1);
    const fk2 = mimTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('measurementTypeId') !== -1,
    );
    if (fk2) await queryRunner.dropForeignKey('menu_item_measurements', fk2);
    await queryRunner.dropTable('menu_item_measurements');

    await queryRunner.dropTable('measurement_types');
  }
}
