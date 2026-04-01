import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository, Not } from 'typeorm';
import moment from 'moment-timezone';
import { MenuItem } from '../entities/menu-item.entity';
import { Special } from '../entities/special.entity';
import { Event } from '../entities/event.entity';
import { Todo, TodoStatus } from '../entities/todo.entity';
import { OpeningHours } from '../entities/opening-hours.entity';
import { User } from '../entities/user.entity';
import { MenuCategory } from '../entities/menu-category.entity';

@Injectable()
export class DashboardService {
  private readonly TIMEZONE = 'America/Toronto';
  constructor(
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
    @InjectRepository(MenuCategory)
    private readonly menuCategoryRepository: Repository<MenuCategory>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Special)
    private readonly specialRepository: Repository<Special>,
    @InjectRepository(Todo)
    private readonly todoRepository: Repository<Todo>,
    @InjectRepository(OpeningHours)
    private readonly openingHoursRepository: Repository<OpeningHours>,
  ) {}

  async getSummary(user: any) {
    const userFilter =
      user.role !== 'super_admin' ? { role: Not('super_admin') } : {};
    const userActiveFilter =
      user.role !== 'super_admin'
        ? { role: Not('super_admin'), isActive: true }
        : { isActive: true };

    // Batch related counts into single queries to reduce from 18 → 10 queries
    const [
      menuStats,
      menuCategories,
      userStats,
      eventsTotal,
      specialsTotal,
      todoStats,
      openingHoursStats,
      recentMenuItems,
      recentSpecials,
      upcomingEvents,
      recentTodos,
      recentUsers,
    ] = await Promise.all([
      // Single query for menu item total + active count
      this.menuItemRepository
        .createQueryBuilder('mi')
        .select('COUNT(*)', 'total')
        .addSelect('COUNT(*) FILTER (WHERE mi.isAvailable = true)', 'active')
        .getRawOne() as Promise<{ total: string; active: string }>,
      this.menuCategoryRepository.find({
        order: { sortOrder: 'ASC' },
        relations: ['menuItems'],
      }),
      // Single query for user total + active count
      user.role !== 'super_admin'
        ? (this.userRepository
            .createQueryBuilder('u')
            .select('COUNT(*) FILTER (WHERE u.role != :role)', 'total')
            .addSelect(
              'COUNT(*) FILTER (WHERE u.role != :role AND u.isActive = true)',
              'active',
            )
            .setParameter('role', 'super_admin')
            .getRawOne() as Promise<{ total: string; active: string }>)
        : (this.userRepository
            .createQueryBuilder('u')
            .select('COUNT(*)', 'total')
            .addSelect('COUNT(*) FILTER (WHERE u.isActive = true)', 'active')
            .getRawOne() as Promise<{ total: string; active: string }>),
      this.eventRepository.count(),
      this.specialRepository.count(),
      // Single query for all todo status counts
      this.todoRepository
        .createQueryBuilder('t')
        .select('COUNT(*)', 'total')
        .addSelect(
          `COUNT(*) FILTER (WHERE t.status = :completed)`,
          'completed',
        )
        .addSelect(`COUNT(*) FILTER (WHERE t.status = :pending)`, 'pending')
        .addSelect(
          `COUNT(*) FILTER (WHERE t.status = :inProgress)`,
          'inProgress',
        )
        .setParameter('completed', TodoStatus.COMPLETED)
        .setParameter('pending', TodoStatus.PENDING)
        .setParameter('inProgress', TodoStatus.IN_PROGRESS)
        .getRawOne() as Promise<{
        total: string;
        completed: string;
        pending: string;
        inProgress: string;
      }>,
      // Single query for opening hours total + active count
      this.openingHoursRepository
        .createQueryBuilder('oh')
        .select('COUNT(*)', 'total')
        .addSelect('COUNT(*) FILTER (WHERE oh.isActive = true)', 'active')
        .getRawOne() as Promise<{ total: string; active: string }>,
      this.menuItemRepository.find({
        order: { createdAt: 'DESC' },
        select: ['id', 'name', 'createdAt', 'isAvailable'],
        take: 5,
      }),
      this.specialRepository.find({
        order: { createdAt: 'DESC' },
        select: ['id', 'title', 'createdAt', 'isActive'],
        take: 5,
      }),
      this.eventRepository.find({
        where: {
          eventStartDate: MoreThan(moment().tz(this.TIMEZONE).toDate()),
          isActive: true,
        },
        order: { eventStartDate: 'ASC' },
        select: ['id', 'title', 'eventStartDate', 'eventEndDate', 'type'],
        take: 5,
      }),
      this.todoRepository.find({
        order: { updatedAt: 'DESC' },
        select: ['id', 'title', 'status', 'priority', 'updatedAt'],
        take: 5,
      }),
      this.userRepository.find({
        where: userFilter,
        select: [
          'id',
          'email',
          'firstName',
          'lastName',
          'role',
          'isActive',
          'createdAt',
          'lastLoginAt',
        ],
        order: { createdAt: 'DESC' },
        take: 5,
      }),
    ]);

    return {
      menu: {
        total: parseInt(menuStats.total, 10),
        active: parseInt(menuStats.active, 10),
        categories: menuCategories.map((category) => ({
          id: category.id,
          name: category.name,
          itemCount: category.menuItems?.length ?? 0,
          isActive: category.isActive,
        })),
      },
      users: {
        total: parseInt(userStats.total, 10),
        active: parseInt(userStats.active, 10),
      },
      events: {
        total: eventsTotal,
        upcoming: upcomingEvents.length,
      },
      specials: {
        total: specialsTotal,
        active: recentSpecials.filter((special) => special.isActive).length,
      },
      todos: {
        total: parseInt(todoStats.total, 10),
        completed: parseInt(todoStats.completed, 10),
        pending: parseInt(todoStats.pending, 10),
        inProgress: parseInt(todoStats.inProgress, 10),
      },
      openingHours: {
        total: parseInt(openingHoursStats.total, 10),
        active: parseInt(openingHoursStats.active, 10),
      },
      recent: {
        menuItems: recentMenuItems,
        specials: recentSpecials,
        events: upcomingEvents,
        todos: recentTodos,
        users: recentUsers,
      },
    };
  }
}
