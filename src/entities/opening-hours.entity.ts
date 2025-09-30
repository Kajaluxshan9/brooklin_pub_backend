import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
}

@Entity('opening_hours')
export class OpeningHours {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: DayOfWeek,
  })
  dayOfWeek: DayOfWeek;

  @Column({ type: 'time', nullable: true })
  openTime: string | null;

  @Column({ type: 'time', nullable: true })
  closeTime: string | null;

  @Column({ default: false })
  isClosedNextDay: boolean; // True if closing time is next day

  @Column({ default: true })
  isOpen: boolean;

  @Column({ default: true })
  isActive: boolean; // Admin can toggle this to temporarily close

  @Column({ type: 'text', nullable: true })
  specialNote: string | null; // For holiday hours, etc.

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
