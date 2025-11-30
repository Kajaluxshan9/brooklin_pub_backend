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
      displayStartDate: createEventDto.displayStartDate,
      displayEndDate: createEventDto.displayEndDate,
      eventStartDate: createEventDto.eventStartDate,
      eventEndDate: createEventDto.eventEndDate,
      imageUrls: createEventDto.imageUrls || [],
      isActive: createEventDto.isActive !== false,
      ticketLink: createEventDto.ticketLink || null,
    });
    return this.eventRepository.save(event);
  }

  async findAll(): Promise<Event[]> {
    return await this.eventRepository.find({
      order: {
        eventStartDate: 'ASC',
      },
    });
  }

  async findActive(): Promise<Event[]> {
    return await this.eventRepository.find({
      where: { isActive: true },
      order: {
        eventStartDate: 'ASC',
      },
    });
  }

  async findUpcoming(): Promise<Event[]> {
    const now = new Date();
    return await this.eventRepository
      .createQueryBuilder('event')
      .where('event.eventStartDate >= :now', { now })
      .andWhere('event.isActive = :isActive', { isActive: true })
      .orderBy('event.eventStartDate', 'ASC')
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
}
