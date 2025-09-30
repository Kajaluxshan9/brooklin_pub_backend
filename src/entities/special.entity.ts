import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SpecialType {
  DAILY = 'daily',
  SEASONAL = 'seasonal',
  HOLIDAY = 'holiday',
  LIMITED_TIME = 'limited_time',
}

@Entity('specials')
export class Special {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column('decimal', { precision: 8, scale: 2, nullable: true })
  originalPrice: number;

  @Column('decimal', { precision: 8, scale: 2 })
  specialPrice: number;

  @Column({
    type: 'enum',
    enum: SpecialType,
    default: SpecialType.DAILY,
  })
  type: SpecialType;

  @Column({ type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column('simple-array', { nullable: true })
  availableDays: string[]; // ['monday', 'tuesday', 'wednesday']

  @Column({ type: 'time', nullable: true })
  startTime: string;

  @Column({ type: 'time', nullable: true })
  endTime: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
