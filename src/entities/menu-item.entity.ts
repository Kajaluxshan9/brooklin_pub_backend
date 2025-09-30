import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MenuCategory } from './menu-category.entity';

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column('decimal', { precision: 8, scale: 2 })
  price: number;

  @Column({ nullable: true })
  preparationTime: number; // in minutes

  @Column('simple-array', { nullable: true })
  allergens: string[]; // ['gluten', 'dairy', 'nuts']

  @Column('simple-array', { nullable: true })
  dietaryInfo: string[]; // ['vegetarian', 'vegan', 'gluten-free']

  @Column({ default: true })
  isAvailable: boolean;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ nullable: true })
  categoryId: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @ManyToOne(() => MenuCategory, (category) => category.menuItems)
  @JoinColumn({ name: 'categoryId' })
  category: MenuCategory;
}
