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

    const [
      menuItemsTotal,
      menuItemsActive,
      menuCategories,
      usersTotal,
      usersActive,
      eventsTotal,
      specialsTotal,
      todosTotal,
      todosCompleted,
      todosPending,
      todosInProgress,
      openingHoursTotal,
      openingHoursActive,
      recentMenuItems,
      recentSpecials,
      upcomingEvents,
      recentTodos,
      recentUsers,
    ] = await Promise.all([
      this.menuItemRepository.count(),
      this.menuItemRepository.count({ where: { isAvailable: true } }),
      this.menuCategoryRepository.find({
        order: { sortOrder: 'ASC' },
        relations: ['menuItems'],
      }),
      this.userRepository.count({ where: userFilter }),
      this.userRepository.count({ where: userActiveFilter }),
      this.eventRepository.count(),
      this.specialRepository.count(),
      this.todoRepository.count(),
      this.todoRepository.count({ where: { status: TodoStatus.COMPLETED } }),
      this.todoRepository.count({ where: { status: TodoStatus.PENDING } }),
      this.todoRepository.count({ where: { status: TodoStatus.IN_PROGRESS } }),
      this.openingHoursRepository.count(),
      this.openingHoursRepository.count({ where: { isActive: true } }),
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
        total: menuItemsTotal,
        active: menuItemsActive,
        categories: menuCategories.map((category) => ({
          id: category.id,
          name: category.name,
          itemCount: category.menuItems?.length ?? 0,
          isActive: category.isActive,
        })),
      },
      users: {
        total: usersTotal,
        active: usersActive,
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
        total: todosTotal,
        completed: todosCompleted,
        pending: todosPending,
        inProgress: todosInProgress,
      },
      openingHours: {
        total: openingHoursTotal,
        active: openingHoursActive,
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
