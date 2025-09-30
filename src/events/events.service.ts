import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
  ) {}

  async create(createEventDto: CreateEventDto): Promise<Event> {
    const event = new Event();
    Object.assign(event, {
      title: createEventDto.title,
      description: createEventDto.description,
      type: createEventDto.type,
      startDateTime: createEventDto.startDateTime,
      endDateTime: createEventDto.endDateTime,
      maxCapacity: createEventDto.capacity,
      currentBookings: createEventDto.currentBookings || 0,
      isRecurring: createEventDto.isRecurring || false,
      ticketPrice: createEventDto.price || 0,
      imageUrl: createEventDto.imageUrl || null,
      isActive: createEventDto.isActive !== false,
    });
    return this.eventRepository.save(event);
  }

  async findAll(): Promise<Event[]> {
    return await this.eventRepository.find({
      order: {
        startDateTime: 'ASC',
      },
    });
  }

  async findActive(): Promise<Event[]> {
    return await this.eventRepository.find({
      where: { isActive: true },
      order: {
        startDateTime: 'ASC',
      },
    });
  }

  async findUpcoming(): Promise<Event[]> {
    const now = new Date();
    return await this.eventRepository
      .createQueryBuilder('event')
      .where('event.startDateTime >= :now', { now })
      .andWhere('event.isActive = :isActive', { isActive: true })
      .orderBy('event.startDateTime', 'ASC')
      .getMany();
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.eventRepository.findOne({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    return event;
  }

  async update(id: string, updateEventDto: UpdateEventDto): Promise<Event> {
    const event = await this.findOne(id);

    Object.assign(event, updateEventDto);

    return await this.eventRepository.save(event);
  }

  async remove(id: string): Promise<void> {
    const event = await this.findOne(id);
    await this.eventRepository.remove(event);
  }

  async updateBookings(id: string, bookings: number): Promise<Event> {
    const event = await this.findOne(id);
    event.currentBookings = bookings;
    return await this.eventRepository.save(event);
  }
}
