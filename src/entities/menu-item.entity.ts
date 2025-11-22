import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { MenuCategory } from './menu-category.entity';
import { MenuItemMeasurement } from './menu-item-measurement.entity';

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  // Store price as decimal(8,2) in Postgres but expose as number in TS
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

  @Column({ nullable: true })
  preparationTime: number; // in minutes

  @Column('simple-array', { nullable: true })
  allergens: string[]; // ['gluten', 'dairy', 'nuts']

  @Column('simple-array', { nullable: true })
  dietaryInfo: string[]; // ['vegetarian', 'vegan', 'gluten-free']

  @Column({ default: true })
  isAvailable: boolean;

  // Use Postgres text[] with a proper default empty array
  @Column('text', { array: true, default: () => 'ARRAY[]::text[]' })
  imageUrls: string[]; // Support multiple images (up to 5)

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ nullable: true })
  categoryId: string;

  @Column({ default: false })
  hasMeasurements: boolean; // If true, use measurements table; if false, use price field

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @ManyToOne(() => MenuCategory, (category) => category.menuItems)
  @JoinColumn({ name: 'categoryId' })
  category: MenuCategory;

  @OneToMany(() => MenuItemMeasurement, (measurement) => measurement.menuItem, {
    cascade: true,
    eager: false,
  })
  measurements: MenuItemMeasurement[];
}
