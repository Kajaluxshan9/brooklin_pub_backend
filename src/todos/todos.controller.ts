import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { TodosService } from './todos.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('todos')
@UseGuards(JwtAuthGuard)
export class TodosController {
  private readonly logger = new Logger(TodosController.name);
  constructor(private readonly todosService: TodosService) {}

  @Get()
  findAll() {
    return this.todosService.findAll();
  }

  @Get('stats')
  getStats() {
    return this.todosService.getStats();
  }

  @Get('my-todos')
  findMyTodos(@Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.todosService.findByUser(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.todosService.findOne(id);
  }

  @Post()
  create(@Body() createTodoDto: CreateTodoDto, @Request() req: any) {
    try {
      // Log incoming payload and user for debugging
      this.logger.debug('Create todo request body:', createTodoDto as any);
      const userId = (req as any)?.user?.id ?? null;
      this.logger.debug('Create todo requested by user:', userId as any);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return this.todosService.create(createTodoDto, userId);
    } catch (err) {
      this.logger.error('Error in TodosController.create:', err as any);
      // Surface inner message for easier debugging in dev
      const msg = err instanceof Error ? err.message : 'Internal server error';
      throw new InternalServerErrorException(msg);
    }
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTodoDto: UpdateTodoDto) {
    return this.todosService.update(id, updateTodoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.todosService.remove(id);
  }

  @Patch(':id/toggle-complete')
  toggleComplete(@Param('id') id: string) {
    return this.todosService.toggleComplete(id);
  }
}
