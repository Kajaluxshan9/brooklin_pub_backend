import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Todo, TodoStatus } from '../entities/todo.entity';
import { User } from '../entities/user.entity';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';

@Injectable()
export class TodosService {
  constructor(
    @InjectRepository(Todo)
    private todoRepository: Repository<Todo>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(createTodoDto: CreateTodoDto, userId: string): Promise<Todo> {
    const todo = new Todo();
    Object.assign(todo, {
      title: createTodoDto.title,
      description: createTodoDto.description,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      priority: createTodoDto.priority as any,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      status: (createTodoDto.status as any) || 'pending',
      // Automatically assign to current user if no assignedUserId is provided
      assignedToId: createTodoDto.assignedUserId || userId,
      createdById: userId,
      dueDate: createTodoDto.dueDate || null,
    });

    return this.todoRepository.save(todo);
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
      where: [{ assignedToId: userId }, { createdById: userId }],
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

    if (updateTodoDto.assignedUserId) {
      todo.assignedToId = updateTodoDto.assignedUserId;
    }

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
