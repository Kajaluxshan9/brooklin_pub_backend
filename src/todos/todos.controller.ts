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
} from '@nestjs/common';
import { TodosService } from './todos.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('todos')
@UseGuards(JwtAuthGuard)
export class TodosController {
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
      console.debug('Create todo request body:', createTodoDto);
      const userId = (req as any)?.user?.id ?? null;
      console.debug('Create todo requested by user:', userId);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return this.todosService.create(createTodoDto, userId);
    } catch (err) {
      console.error('Error in TodosController.create:', err);
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
