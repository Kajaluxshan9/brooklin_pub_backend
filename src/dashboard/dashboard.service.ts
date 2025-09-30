import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { MenuItem } from '../entities/menu-item.entity';
import { Special } from '../entities/special.entity';
import { Event } from '../entities/event.entity';
import { Todo, TodoStatus } from '../entities/todo.entity';
import { OpeningHours } from '../entities/opening-hours.entity';
import { User } from '../entities/user.entity';
import { MenuCategory } from '../entities/menu-category.entity';

@Injectable()
export class DashboardService {
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

  async getSummary() {
    const now = new Date();

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
      this.userRepository.count(),
      this.userRepository.count({ where: { isActive: true } }),
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
        where: { startDateTime: MoreThan(now), isActive: true },
        order: { startDateTime: 'ASC' },
        select: [
          'id',
          'title',
          'startDateTime',
          'endDateTime',
          'type',
          'currentBookings',
          'maxCapacity',
        ],
        take: 5,
      }),
      this.todoRepository.find({
        order: { updatedAt: 'DESC' },
        select: [
          'id',
          'title',
          'status',
          'priority',
          'assignedToId',
          'updatedAt',
        ],
        relations: ['assignedTo'],
        take: 5,
      }),
      this.userRepository.find({
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
        todos: recentTodos.map((todo) => ({
          ...todo,
          assignedToName: todo.assignedTo
            ? `${todo.assignedTo.firstName} ${todo.assignedTo.lastName}`
            : null,
        })),
        users: recentUsers,
      },
    };
  }
}
