import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MenuItem } from './menu-item.entity';
import { PrimaryCategory } from './primary-category.entity';

@Entity('menu_categories')
@Index(['primaryCategoryId'])
@Index(['sortOrder'])
@Index(['isActive'])
export class MenuCategory {
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

  @Column({ nullable: true })
  primaryCategoryId: string;

  @ManyToOne(
    () => PrimaryCategory,
    (primaryCategory) => primaryCategory.categories,
    {
      nullable: true,
    },
  )
  @JoinColumn({ name: 'primaryCategoryId' })
  primaryCategory: PrimaryCategory;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @OneToMany(() => MenuItem, (menuItem) => menuItem.category)
  menuItems: MenuItem[];
}
