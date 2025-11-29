import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpeningHours, DayOfWeek } from '../entities/opening-hours.entity';
import { CreateOpeningHoursDto } from './dto/create-opening-hours.dto';
import { UpdateOpeningHoursDto } from './dto/update-opening-hours.dto';
import moment from 'moment-timezone';

// Toronto timezone for accurate open/close status
const TIMEZONE = 'America/Toronto';

@Injectable()
export class OpeningHoursService {
  constructor(
    @InjectRepository(OpeningHours)
    private openingHoursRepository: Repository<OpeningHours>,
  ) {}

  private readonly dayOrder: DayOfWeek[] = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY,
    DayOfWeek.SUNDAY,
  ];

  async create(
    createOpeningHoursDto: CreateOpeningHoursDto,
  ): Promise<OpeningHours> {
    const existing = await this.openingHoursRepository.findOne({
      where: { dayOfWeek: createOpeningHoursDto.dayOfWeek },
    });

    if (existing) {
      return this.update(existing.id, createOpeningHoursDto);
    }

    const data = this.normalizePayload(createOpeningHoursDto);
    const openingHours = this.openingHoursRepository.create({
      ...data,
      dayOfWeek: createOpeningHoursDto.dayOfWeek,
    });
    return await this.openingHoursRepository.save(openingHours);
  }

  async findAll(): Promise<OpeningHours[]> {
    const records = await this.openingHoursRepository.find();
    return records.sort(
      (a, b) =>
        this.dayOrder.indexOf(a.dayOfWeek) - this.dayOrder.indexOf(b.dayOfWeek),
    );
  }

  async findOne(id: string): Promise<OpeningHours> {
    const openingHours = await this.openingHoursRepository.findOne({
      where: { id },
    });

    if (!openingHours) {
      throw new NotFoundException(`Opening hours with ID ${id} not found`);
    }

    return openingHours;
  }

  async findByDay(day: string): Promise<OpeningHours> {
    const openingHours = await this.openingHoursRepository.findOne({
      where: { dayOfWeek: day.toLowerCase() as DayOfWeek },
    });

    if (!openingHours) {
      throw new NotFoundException(`Opening hours for ${day} not found`);
    }

    return openingHours;
  }

  async update(
    id: string,
    updateOpeningHoursDto: UpdateOpeningHoursDto,
  ): Promise<OpeningHours> {
    const openingHours = await this.findOne(id);
    const data = this.normalizePayload(updateOpeningHoursDto, openingHours);

    Object.assign(openingHours, data);

    return await this.openingHoursRepository.save(openingHours);
  }

  async remove(id: string): Promise<void> {
    const openingHours = await this.findOne(id);
    await this.openingHoursRepository.remove(openingHours);
  }

  private normalizePayload(
    payload: Partial<CreateOpeningHoursDto>,
    current?: OpeningHours,
  ) {
    const isOpen = payload.isOpen ?? current?.isOpen ?? true;

    // Determine if closing time is next day
    const isClosedNextDay = this.determineIsClosedNextDay(
      payload.openTime,
      payload.closeTime,
      payload.isClosedNextDay,
      current,
    );

    return {
      ...payload,
      isOpen,
      isActive: payload.isActive ?? current?.isActive ?? true,
      isClosedNextDay,
      openTime:
        isOpen && payload.openTime !== undefined
          ? payload.openTime
          : isOpen
            ? (current?.openTime ?? null)
            : null,
      closeTime:
        isOpen && payload.closeTime !== undefined
          ? payload.closeTime
          : isOpen
            ? (current?.closeTime ?? null)
            : null,
      specialNote:
        payload.specialNote !== undefined
          ? payload.specialNote
          : (current?.specialNote ?? null),
    };
  }

  private determineIsClosedNextDay(
    openTime?: string | null,
    closeTime?: string | null,
    explicitValue?: boolean,
    current?: OpeningHours,
  ): boolean {
    // If explicitly set, use that value
    if (explicitValue !== undefined) {
      return explicitValue;
    }

    // If we have both times, check if close time is before open time
    if (openTime && closeTime) {
      const [openHour, openMinute] = openTime.split(':').map(Number);
      const [closeHour, closeMinute] = closeTime.split(':').map(Number);

      const openTotalMinutes = openHour * 60 + openMinute;
      const closeTotalMinutes = closeHour * 60 + closeMinute;

      return closeTotalMinutes < openTotalMinutes;
    }

    // Fall back to current value
    return current?.isClosedNextDay ?? false;
  }

  async getCurrentStatus(): Promise<{
    isOpen: boolean;
    currentHours?: OpeningHours;
    nextOpenTime?: string;
  }> {
    try {
      // Use Toronto timezone for accurate status
      const now = moment().tz(TIMEZONE);
      const currentDay = now.format('dddd').toLowerCase() as DayOfWeek;
      const currentTime = now.format('HH:mm'); // HH:MM format
      const currentMinutes = this.timeToMinutes(currentTime);

      // Check today's hours first
      const todayHours = await this.openingHoursRepository.findOne({
        where: { dayOfWeek: currentDay },
      });

      // Check if we're within today's opening hours
      if (
        todayHours &&
        todayHours.isOpen &&
        todayHours.isActive &&
        todayHours.openTime &&
        todayHours.closeTime
      ) {
        const openMinutes = this.timeToMinutes(todayHours.openTime);
        const closeMinutes = this.timeToMinutes(todayHours.closeTime);

        if (todayHours.isClosedNextDay) {
          // Opens today, closes tomorrow (e.g., 11 PM - 2 AM)
          // Currently open if we're past opening time
          if (currentMinutes >= openMinutes) {
            return { isOpen: true, currentHours: todayHours };
          }
        } else {
          // Normal same-day hours (e.g., 11 AM - 11 PM)
          if (currentMinutes >= openMinutes && currentMinutes <= closeMinutes) {
            return { isOpen: true, currentHours: todayHours };
          }
        }
      }

      // Check if we're still within yesterday's overnight hours
      const previousDay = now.clone().subtract(1, 'day');
      const previousDayName = previousDay
        .format('dddd')
        .toLowerCase() as DayOfWeek;

      const yesterdayHours = await this.openingHoursRepository.findOne({
        where: { dayOfWeek: previousDayName },
      });

      if (
        yesterdayHours &&
        yesterdayHours.isOpen &&
        yesterdayHours.isActive &&
        yesterdayHours.isClosedNextDay &&
        yesterdayHours.openTime &&
        yesterdayHours.closeTime
      ) {
        const closeMinutes = this.timeToMinutes(yesterdayHours.closeTime);
        // If yesterday's hours go past midnight and we're before close time
        if (currentMinutes <= closeMinutes) {
          return { isOpen: true, currentHours: yesterdayHours };
        }
      }

      // Not currently open
      return { isOpen: false, currentHours: todayHours || undefined };
    } catch {
      // Return closed status if there's any error
      return { isOpen: false };
    }
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
