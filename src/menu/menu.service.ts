import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuCategory } from '../entities/menu-category.entity';
import { MenuItem } from '../entities/menu-item.entity';
import { PrimaryCategory } from '../entities/primary-category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { CreatePrimaryCategoryDto } from './dto/create-primary-category.dto';
import { UpdatePrimaryCategoryDto } from './dto/update-primary-category.dto';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuCategory)
    private categoryRepository: Repository<MenuCategory>,
    @InjectRepository(MenuItem)
    private menuItemRepository: Repository<MenuItem>,
    @InjectRepository(PrimaryCategory)
    private primaryCategoryRepository: Repository<PrimaryCategory>,
    private uploadService: UploadService,
  ) {}

  // Primary Category methods
  async findAllPrimaryCategories(): Promise<PrimaryCategory[]> {
    return this.primaryCategoryRepository.find({
      order: { sortOrder: 'ASC' },
      relations: ['categories'],
    });
  }

  async findPrimaryCategoryById(id: string): Promise<PrimaryCategory> {
    const primaryCategory = await this.primaryCategoryRepository.findOne({
      where: { id },
      relations: ['categories'],
    });
    if (!primaryCategory) {
      throw new NotFoundException(`Primary category with ID ${id} not found`);
    }
    return primaryCategory;
  }

  async createPrimaryCategory(
    createPrimaryCategoryDto: CreatePrimaryCategoryDto,
  ): Promise<PrimaryCategory> {
    const primaryCategory = this.primaryCategoryRepository.create(
      createPrimaryCategoryDto,
    );
    return this.primaryCategoryRepository.save(primaryCategory);
  }

  async updatePrimaryCategory(
    id: string,
    updatePrimaryCategoryDto: UpdatePrimaryCategoryDto,
  ): Promise<PrimaryCategory> {
    await this.primaryCategoryRepository.update(id, updatePrimaryCategoryDto);
    return this.findPrimaryCategoryById(id);
  }

  async removePrimaryCategory(id: string): Promise<void> {
    await this.primaryCategoryRepository.delete(id);
  }

  async movePrimaryCategoryOrder(
    primaryCategoryId: string,
    direction: 'up' | 'down',
  ): Promise<PrimaryCategory> {
    const primaryCategory =
      await this.findPrimaryCategoryById(primaryCategoryId);
    const currentOrder = primaryCategory.sortOrder;

    if (direction === 'up' && currentOrder > 0) {
      const previousPrimaryCategory =
        await this.primaryCategoryRepository.findOne({
          where: { sortOrder: currentOrder - 1 },
        });

      if (previousPrimaryCategory) {
        previousPrimaryCategory.sortOrder = currentOrder;
        primaryCategory.sortOrder = currentOrder - 1;

        await this.primaryCategoryRepository.save(previousPrimaryCategory);
        return this.primaryCategoryRepository.save(primaryCategory);
      }
    } else if (direction === 'down') {
      const nextPrimaryCategory = await this.primaryCategoryRepository.findOne({
        where: { sortOrder: currentOrder + 1 },
      });

      if (nextPrimaryCategory) {
        nextPrimaryCategory.sortOrder = currentOrder;
        primaryCategory.sortOrder = currentOrder + 1;

        await this.primaryCategoryRepository.save(nextPrimaryCategory);
        return this.primaryCategoryRepository.save(primaryCategory);
      }
    }

    return primaryCategory;
  }

  // Category methods
  async findAllCategories(): Promise<MenuCategory[]> {
    return this.categoryRepository.find({
      order: { sortOrder: 'ASC' },
      relations: ['menuItems', 'primaryCategory'],
    });
  }

  async findCategoryById(id: string): Promise<MenuCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['menuItems', 'primaryCategory'],
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

  async reorderCategory(
    categoryId: string,
    newOrder: number,
  ): Promise<MenuCategory> {
    const category = await this.findCategoryById(categoryId);
    const oldOrder = category.sortOrder;

    // Get all categories
    const categories = await this.categoryRepository.find({
      order: { sortOrder: 'ASC' },
    });

    // Update sort orders
    if (newOrder > oldOrder) {
      // Moving down
      for (const cat of categories) {
        if (cat.sortOrder > oldOrder && cat.sortOrder <= newOrder) {
          cat.sortOrder--;
          await this.categoryRepository.save(cat);
        }
      }
    } else if (newOrder < oldOrder) {
      // Moving up
      for (const cat of categories) {
        if (cat.sortOrder >= newOrder && cat.sortOrder < oldOrder) {
          cat.sortOrder++;
          await this.categoryRepository.save(cat);
        }
      }
    }

    category.sortOrder = newOrder;
    return this.categoryRepository.save(category);
  }

  async moveCategoryOrder(
    categoryId: string,
    direction: 'up' | 'down',
  ): Promise<MenuCategory> {
    const category = await this.findCategoryById(categoryId);
    const currentOrder = category.sortOrder;

    if (direction === 'up' && currentOrder > 0) {
      // Find the category with the previous order
      const previousCategory = await this.categoryRepository.findOne({
        where: { sortOrder: currentOrder - 1 },
      });

      if (previousCategory) {
        // Swap orders
        previousCategory.sortOrder = currentOrder;
        category.sortOrder = currentOrder - 1;

        await this.categoryRepository.save(previousCategory);
        return this.categoryRepository.save(category);
      }
    } else if (direction === 'down') {
      // Find the category with the next order
      const nextCategory = await this.categoryRepository.findOne({
        where: { sortOrder: currentOrder + 1 },
      });

      if (nextCategory) {
        // Swap orders
        nextCategory.sortOrder = currentOrder;
        category.sortOrder = currentOrder + 1;

        await this.categoryRepository.save(nextCategory);
        return this.categoryRepository.save(category);
      }
    }

    return category;
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
    // Get the menu item to access its images before deletion
    const menuItem = await this.findMenuItemById(id);

    // Delete images from S3 if they exist
    if (menuItem.imageUrls && menuItem.imageUrls.length > 0) {
      try {
        await this.uploadService.deleteMultipleFiles(menuItem.imageUrls);
      } catch (error) {
        console.error('Failed to delete images from S3:', error);
        // Continue with menu item deletion even if S3 deletion fails
      }
    }

    await this.menuItemRepository.delete(id);
  }

  async reorderMenuItem(itemId: string, newOrder: number): Promise<MenuItem> {
    const menuItem = await this.findMenuItemById(itemId);
    const oldOrder = menuItem.sortOrder;

    // Get all menu items in the same category
    const menuItems = await this.menuItemRepository.find({
      where: { categoryId: menuItem.categoryId },
      order: { sortOrder: 'ASC' },
    });

    // Update sort orders
    if (newOrder > oldOrder) {
      // Moving down
      for (const item of menuItems) {
        if (item.sortOrder > oldOrder && item.sortOrder <= newOrder) {
          item.sortOrder--;
          await this.menuItemRepository.save(item);
        }
      }
    } else if (newOrder < oldOrder) {
      // Moving up
      for (const item of menuItems) {
        if (item.sortOrder >= newOrder && item.sortOrder < oldOrder) {
          item.sortOrder++;
          await this.menuItemRepository.save(item);
        }
      }
    }

    menuItem.sortOrder = newOrder;
    return this.menuItemRepository.save(menuItem);
  }

  async moveMenuItemOrder(
    itemId: string,
    direction: 'up' | 'down',
  ): Promise<MenuItem> {
    const menuItem = await this.findMenuItemById(itemId);
    const currentOrder = menuItem.sortOrder;

    if (direction === 'up' && currentOrder > 0) {
      // Find the menu item with the previous order in the same category
      const previousItem = await this.menuItemRepository.findOne({
        where: {
          categoryId: menuItem.categoryId,
          sortOrder: currentOrder - 1,
        },
      });

      if (previousItem) {
        // Swap orders
        previousItem.sortOrder = currentOrder;
        menuItem.sortOrder = currentOrder - 1;

        await this.menuItemRepository.save(previousItem);
        return this.menuItemRepository.save(menuItem);
      }
    } else if (direction === 'down') {
      // Find the menu item with the next order in the same category
      const nextItem = await this.menuItemRepository.findOne({
        where: {
          categoryId: menuItem.categoryId,
          sortOrder: currentOrder + 1,
        },
      });

      if (nextItem) {
        // Swap orders
        nextItem.sortOrder = currentOrder;
        menuItem.sortOrder = currentOrder + 1;

        await this.menuItemRepository.save(nextItem);
        return this.menuItemRepository.save(menuItem);
      }
    }

    return menuItem;
  }
}
