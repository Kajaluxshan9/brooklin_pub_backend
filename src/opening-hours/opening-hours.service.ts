import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpeningHours, DayOfWeek } from '../entities/opening-hours.entity';
import { CreateOpeningHoursDto } from './dto/create-opening-hours.dto';
import { UpdateOpeningHoursDto } from './dto/update-opening-hours.dto';

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
      const now = new Date();
      const currentDay = now
        .toLocaleDateString('en-US', { weekday: 'long' })
        .toLowerCase() as DayOfWeek;
      const currentTime = now.toTimeString().substring(0, 5); // HH:MM format

      const todayHours = await this.openingHoursRepository.findOne({
        where: { dayOfWeek: currentDay },
      });

      if (!todayHours || !todayHours.isOpen || !todayHours.isActive) {
        return { isOpen: false };
      }

      const { openTime, closeTime, isClosedNextDay } = todayHours;

      if (!openTime || !closeTime) {
        return { isOpen: false };
      }

      const currentMinutes = this.timeToMinutes(currentTime);
      const openMinutes = this.timeToMinutes(openTime);
      const closeMinutes = this.timeToMinutes(closeTime);

      let isCurrentlyOpen = false;

      if (isClosedNextDay) {
        // Open past midnight (e.g., 11 PM to 2 AM)
        isCurrentlyOpen =
          currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
      } else {
        // Normal hours (e.g., 9 AM to 10 PM)
        isCurrentlyOpen =
          currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
      }

      return {
        isOpen: isCurrentlyOpen,
        currentHours: todayHours,
      };
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
