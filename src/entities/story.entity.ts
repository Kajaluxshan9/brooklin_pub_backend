import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StoryCategory } from './story-category.entity';

@Entity('stories')
export class Story {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  categoryId: string;

  @Column('simple-array', { default: '' })
  imageUrls: string[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @ManyToOne(() => StoryCategory, (category) => category.stories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'categoryId' })
  category: StoryCategory;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
