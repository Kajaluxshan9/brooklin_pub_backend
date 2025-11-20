import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { StoriesService } from './stories.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { CreateStoryCategoryDto } from './dto/create-story-category.dto';
import { UpdateStoryCategoryDto } from './dto/update-story-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  // Category endpoints
  @Get('categories')
  findAllCategories() {
    return this.storiesService.findAllCategories();
  }

  @Get('categories/:id')
  findCategoryById(@Param('id') id: string) {
    return this.storiesService.findCategoryById(id);
  }

  @Post('categories')
  @UseGuards(JwtAuthGuard)
  createCategory(@Body() createCategoryDto: CreateStoryCategoryDto) {
    return this.storiesService.createCategory(createCategoryDto);
  }

  @Patch('categories/:id')
  @UseGuards(JwtAuthGuard)
  updateCategory(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateStoryCategoryDto,
  ) {
    return this.storiesService.updateCategory(id, updateCategoryDto);
  }

  @Patch('categories/:id/toggle')
  @UseGuards(JwtAuthGuard)
  toggleCategoryStatus(@Param('id') id: string) {
    return this.storiesService.toggleCategoryStatus(id);
  }

  @Delete('categories/:id')
  @UseGuards(JwtAuthGuard)
  removeCategory(@Param('id') id: string) {
    return this.storiesService.removeCategory(id);
  }

  // Story endpoints
  @Get()
  findAllStories() {
    return this.storiesService.findAllStories();
  }

  @Get('category/:categoryId')
  findStoriesByCategory(@Param('categoryId') categoryId: string) {
    return this.storiesService.findStoriesByCategory(categoryId);
  }

  @Get(':id')
  findStoryById(@Param('id') id: string) {
    return this.storiesService.findStoryById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  createStory(@Body() createStoryDto: CreateStoryDto) {
    return this.storiesService.createStory(createStoryDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  updateStory(@Param('id') id: string, @Body() updateStoryDto: UpdateStoryDto) {
    return this.storiesService.updateStory(id, updateStoryDto);
  }

  @Patch(':id/toggle')
  @UseGuards(JwtAuthGuard)
  toggleStoryStatus(@Param('id') id: string) {
    return this.storiesService.toggleStoryStatus(id);
  }

  @Patch(':id/move')
  @UseGuards(JwtAuthGuard)
  moveStoryOrder(
    @Param('id') id: string,
    @Body() body: { direction: 'up' | 'down' },
  ) {
    return this.storiesService.moveStoryOrder(id, body.direction);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  removeStory(@Param('id') id: string) {
    return this.storiesService.removeStory(id);
  }
}
