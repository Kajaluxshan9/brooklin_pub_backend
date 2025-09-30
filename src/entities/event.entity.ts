import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EventType {
  LIVE_MUSIC = 'live_music',
  SPORTS = 'sports',
  TRIVIA = 'trivia',
  KARAOKE = 'karaoke',
  PRIVATE_PARTY = 'private_party',
  HOLIDAY = 'holiday',
  OTHER = 'other',
}

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: EventType,
    default: EventType.OTHER,
  })
  type: EventType;

  @Column({ type: 'timestamp' })
  startDateTime: Date;

  @Column({ type: 'timestamp' })
  endDateTime: Date;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  ticketPrice: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ default: false })
  isRecurring: boolean;

  @Column({ nullable: true })
  recurringPattern: string; // 'weekly', 'monthly', etc.

  @Column({ default: 0 })
  maxCapacity: number;

  @Column({ default: 0 })
  currentBookings: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
