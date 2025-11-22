import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MenuItem } from './menu-item.entity';
import { MeasurementType } from './measurement-type.entity';

@Entity('menu_item_measurements')
export class MenuItemMeasurement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  menuItemId: string;

  @Column({ nullable: true })
  measurementTypeId: string; // FK to measurement_types table (nullable to support freeform legacy values)

  @Column('decimal', {
    precision: 8,
    scale: 2,
    transformer: {
      to: (value: number) =>
        value === null || value === undefined ? null : value,
      from: (value: string) =>
        value === null || value === undefined ? null : parseFloat(value),
    },
  })
  price: number;

  @Column({ default: true })
  isAvailable: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @ManyToOne(() => MenuItem, (menuItem) => menuItem.measurements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'menuItemId' })
  menuItem: MenuItem;

  @ManyToOne(() => MeasurementType, (mt) => mt.menuItemMeasurements, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'measurementTypeId' })
  measurementTypeEntity: MeasurementType;
}
