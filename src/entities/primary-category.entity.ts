import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { MenuCategory } from './menu-category.entity';

@Entity('primary_categories')
export class PrimaryCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @OneToMany(() => MenuCategory, (category) => category.primaryCategory)
  categories: MenuCategory[];
}
