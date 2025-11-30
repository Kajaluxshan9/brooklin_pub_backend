import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EventType {
  LIVE_MUSIC = 'live_music',
  SPORTS_VIEWING = 'sports_viewing',
  TRIVIA_NIGHT = 'trivia_night',
  KARAOKE = 'karaoke',
  PRIVATE_PARTY = 'private_party',
  SPECIAL_EVENT = 'special_event',
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
    default: EventType.SPECIAL_EVENT,
  })
  type: EventType;

  @Column({ type: 'timestamp' })
  displayStartDate: Date;

  @Column({ type: 'timestamp' })
  displayEndDate: Date;

  @Column({ type: 'timestamp' })
  eventStartDate: Date;

  @Column({ type: 'timestamp' })
  eventEndDate: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column('json', { nullable: true })
  imageUrls: string[];

  @Column({ nullable: true })
  ticketLink: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
