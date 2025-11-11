import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SpecialType {
  DAILY = 'daily',
  GAME_TIME = 'game_time',
  DAY_TIME = 'day_time',
  CHEF = 'chef',
  SEASONAL = 'seasonal',
}

export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
}

export enum SpecialCategory {
  REGULAR = 'regular',
  LATE_NIGHT = 'late_night',
}

@Entity('specials')
export class Special {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: SpecialType,
    default: SpecialType.DAILY,
  })
  type: SpecialType;

  // For DAILY specials - which day this special is for
  @Column({
    type: 'enum',
    enum: DayOfWeek,
    nullable: true,
  })
  dayOfWeek: DayOfWeek;

  // For DAILY specials - category (regular or late night)
  @Column({
    type: 'enum',
    enum: SpecialCategory,
    default: SpecialCategory.REGULAR,
    nullable: true,
  })
  specialCategory: SpecialCategory;

  // For SEASONAL specials - display period (when to show the special)
  @Column({ type: 'timestamptz', nullable: true })
  displayStartDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  displayEndDate: Date;

  // For SEASONAL specials - actual special period (when discount is valid)
  @Column({ type: 'timestamptz', nullable: true })
  specialStartDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  specialEndDate: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column('text', { array: true, default: '{}' })
  imageUrls: string[];

  @Column({ default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
