import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Todo, TodoStatus, TodoPriority } from '../entities/todo.entity';
import { User } from '../entities/user.entity';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';

@Injectable()
export class TodosService {
  private readonly logger = new Logger(TodosService.name);
  constructor(
    @InjectRepository(Todo)
    private todoRepository: Repository<Todo>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(createTodoDto: CreateTodoDto, userId: string): Promise<Todo> {
    const todo = new Todo();

    // Basic payload validation to avoid unexpected DB errors
    if (!createTodoDto || !createTodoDto.title || !createTodoDto.description) {
      throw new BadRequestException('title and description are required');
    }

    // Coerce/validate enums to the entity enums
    const priority =
      (createTodoDto.priority as unknown as TodoPriority) ||
      TodoPriority.MEDIUM;
    const status =
      (createTodoDto.status as unknown as TodoStatus) || TodoStatus.PENDING;

    todo.title = createTodoDto.title;
    todo.description = createTodoDto.description;
    todo.priority = priority;
    todo.status = status;
    // Accept either Date or ISO string for dueDate
    const incomingDue = (createTodoDto.dueDate as any) || null;
    if (incomingDue === null) {
      todo.dueDate = null;
    } else if (typeof incomingDue === 'string') {
      const parsed = new Date(incomingDue);
      todo.dueDate = isNaN(parsed.getTime()) ? null : parsed;
    } else if (incomingDue instanceof Date) {
      todo.dueDate = incomingDue;
    } else {
      todo.dueDate = null;
    }

    // Try to resolve the creating user entity for proper relation setting
    try {
      if (userId) {
        const user = await this.userRepository.findOne({
          where: { id: userId },
        });
        if (user) {
          todo.createdBy = user;
        } else {
          // fallback to setting the id only
          todo.createdById = userId;
        }
      }
    } catch (err) {
      // Non-fatal: proceed without relation if user lookup fails
      this.logger.warn('User lookup failed when creating todo:', err);
      todo.createdById = userId;
    }

    try {
      // Log the todo object we are about to save for debugging
      this.logger.debug('Saving todo to DB:', todo as any);
      return await this.todoRepository.save(todo);
    } catch (err) {
      // Log the underlying error and throw a clearer exception
      this.logger.error('Error saving todo:', err as any);
      throw new InternalServerErrorException('Failed to save todo');
    }
  }

  async findAll(): Promise<Todo[]> {
    return await this.todoRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findByUser(userId: string): Promise<Todo[]> {
    return await this.todoRepository.find({
      where: { createdById: userId },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: string): Promise<Todo> {
    const todo = await this.todoRepository.findOne({
      where: { id },
    });

    if (!todo) {
      throw new NotFoundException(`Todo with ID ${id} not found`);
    }

    return todo;
  }

  async update(id: string, updateTodoDto: UpdateTodoDto): Promise<Todo> {
    const todo = await this.findOne(id);

    Object.assign(todo, {
      title: updateTodoDto.title,
      description: updateTodoDto.description,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      priority: updateTodoDto.priority as any,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      status: updateTodoDto.status as any,
      dueDate: updateTodoDto.dueDate,
    });

    return await this.todoRepository.save(todo);
  }

  async remove(id: string): Promise<void> {
    const todo = await this.findOne(id);
    await this.todoRepository.remove(todo);
  }

  async toggleComplete(id: string): Promise<Todo> {
    const todo = await this.todoRepository.findOne({ where: { id } });
    if (!todo) {
      throw new NotFoundException('Todo not found');
    }

    todo.status =
      todo.status === TodoStatus.COMPLETED
        ? TodoStatus.PENDING
        : TodoStatus.COMPLETED;
    todo.completedAt = todo.status === TodoStatus.COMPLETED ? new Date() : null;

    return this.todoRepository.save(todo);
  }

  async getStats() {
    const total = await this.todoRepository.count();
    const completed = await this.todoRepository.count({
      where: { status: TodoStatus.COMPLETED },
    });
    const pending = await this.todoRepository.count({
      where: { status: TodoStatus.PENDING },
    });
    const inProgress = await this.todoRepository.count({
      where: { status: TodoStatus.IN_PROGRESS },
    });

    return {
      total,
      completed,
      pending,
      inProgress,
    };
  }
}
