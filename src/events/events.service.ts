import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { NewsletterService } from '../newsletter/newsletter.service';
import { NotificationSchedulerService } from '../notifications/notification-scheduler.service';
import { NotificationType } from '../entities/scheduled-notification.entity';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private newsletterService: NewsletterService,
    private notificationScheduler: NotificationSchedulerService,
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
    const savedEvent = await this.eventRepository.save(event);

    // Notify subscribers — schedule for displayStartDate or send immediately
    if (savedEvent.isActive) {
      const sendNow =
        await this.notificationScheduler.scheduleOrSendImmediately(
          NotificationType.EVENT,
          savedEvent.id,
          savedEvent.displayStartDate,
        );

      if (sendNow) {
        this.newsletterService
          .notifyNewEvent(savedEvent)
          .catch((err) =>
            this.logger.error('Failed to send event newsletter', err),
          );
      }
    }

    return savedEvent;
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

    // Cancel any pending scheduled notifications
    await this.notificationScheduler.cancelPendingNotifications(
      NotificationType.EVENT,
      id,
    );

    await this.eventRepository.remove(event);
  }
}
