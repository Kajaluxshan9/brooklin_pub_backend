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
import { MenuService } from './menu.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // Category endpoints
  @Get('categories')
  findAllCategories() {
    return this.menuService.findAllCategories();
  }

  @Get('categories/:id')
  findCategoryById(@Param('id') id: string) {
    return this.menuService.findCategoryById(id);
  }

  @Post('categories')
  @UseGuards(JwtAuthGuard)
  createCategory(@Body() createCategoryDto: CreateCategoryDto) {
    return this.menuService.createCategory(createCategoryDto);
  }

  @Patch('categories/:id')
  @UseGuards(JwtAuthGuard)
  updateCategory(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.menuService.updateCategory(id, updateCategoryDto);
  }

  @Delete('categories/:id')
  @UseGuards(JwtAuthGuard)
  removeCategory(@Param('id') id: string) {
    return this.menuService.removeCategory(id);
  }

  // Menu Item endpoints
  @Get('items')
  findAllMenuItems() {
    return this.menuService.findAllMenuItems();
  }

  @Get('items/:id')
  findMenuItemById(@Param('id') id: string) {
    return this.menuService.findMenuItemById(id);
  }

  @Get('categories/:categoryId/items')
  findMenuItemsByCategory(@Param('categoryId') categoryId: string) {
    return this.menuService.findMenuItemsByCategory(categoryId);
  }

  @Post('items')
  @UseGuards(JwtAuthGuard)
  createMenuItem(@Body() createMenuItemDto: CreateMenuItemDto) {
    return this.menuService.createMenuItem(createMenuItemDto);
  }

  @Patch('items/:id')
  @UseGuards(JwtAuthGuard)
  updateMenuItem(
    @Param('id') id: string,
    @Body() updateMenuItemDto: UpdateMenuItemDto,
  ) {
    return this.menuService.updateMenuItem(id, updateMenuItemDto);
  }

  @Delete('items/:id')
  @UseGuards(JwtAuthGuard)
  removeMenuItem(@Param('id') id: string) {
    return this.menuService.removeMenuItem(id);
  }
}
