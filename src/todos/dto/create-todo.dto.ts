import { IsString, IsEnum, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TodoStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export class CreateTodoDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsEnum(Priority)
  priority: Priority;

  @IsEnum(TodoStatus)
  @IsOptional()
  status?: TodoStatus;

  @IsString()
  @IsOptional()
  assignedUserId?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  dueDate?: Date;
}
