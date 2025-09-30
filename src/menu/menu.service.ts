import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuCategory } from '../entities/menu-category.entity';
import { MenuItem } from '../entities/menu-item.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuCategory)
    private categoryRepository: Repository<MenuCategory>,
    @InjectRepository(MenuItem)
    private menuItemRepository: Repository<MenuItem>,
  ) {}

  // Category methods
  async findAllCategories(): Promise<MenuCategory[]> {
    return this.categoryRepository.find({
      order: { sortOrder: 'ASC' },
      relations: ['menuItems'],
    });
  }

  async findCategoryById(id: string): Promise<MenuCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['menuItems'],
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async createCategory(
    createCategoryDto: CreateCategoryDto,
  ): Promise<MenuCategory> {
    const category = this.categoryRepository.create(createCategoryDto);
    return this.categoryRepository.save(category);
  }

  async updateCategory(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<MenuCategory> {
    await this.categoryRepository.update(id, updateCategoryDto);
    return this.findCategoryById(id);
  }

  async removeCategory(id: string): Promise<void> {
    await this.categoryRepository.delete(id);
  }

  // Menu Item methods
  async findAllMenuItems(): Promise<MenuItem[]> {
    return this.menuItemRepository.find({
      order: { sortOrder: 'ASC' },
      relations: ['category'],
    });
  }

  async findMenuItemById(id: string): Promise<MenuItem> {
    const menuItem = await this.menuItemRepository.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!menuItem) {
      throw new NotFoundException(`Menu item with ID ${id} not found`);
    }
    return menuItem;
  }

  async findMenuItemsByCategory(categoryId: string): Promise<MenuItem[]> {
    return this.menuItemRepository.find({
      where: { categoryId },
      order: { sortOrder: 'ASC' },
      relations: ['category'],
    });
  }

  async createMenuItem(
    createMenuItemDto: CreateMenuItemDto,
  ): Promise<MenuItem> {
    const menuItem = this.menuItemRepository.create(createMenuItemDto);
    return this.menuItemRepository.save(menuItem);
  }

  async updateMenuItem(
    id: string,
    updateMenuItemDto: UpdateMenuItemDto,
  ): Promise<MenuItem> {
    await this.menuItemRepository.update(id, updateMenuItemDto);
    return this.findMenuItemById(id);
  }

  async removeMenuItem(id: string): Promise<void> {
    await this.menuItemRepository.delete(id);
  }
}
