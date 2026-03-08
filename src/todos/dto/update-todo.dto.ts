import { IsString, IsEnum, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { Priority, TodoStatus } from './create-todo.dto';

export class UpdateTodoDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @IsEnum(TodoStatus)
  @IsOptional()
  status?: TodoStatus;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  dueDate?: Date;
}
