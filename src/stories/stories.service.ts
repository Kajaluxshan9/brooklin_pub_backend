import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Story } from '../entities/story.entity';
import { StoryCategory } from '../entities/story-category.entity';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { CreateStoryCategoryDto } from './dto/create-story-category.dto';
import { UpdateStoryCategoryDto } from './dto/update-story-category.dto';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class StoriesService {
  private readonly logger = new Logger(StoriesService.name);
  constructor(
    @InjectRepository(Story)
    private storyRepository: Repository<Story>,
    @InjectRepository(StoryCategory)
    private storyCategoryRepository: Repository<StoryCategory>,
    private uploadService: UploadService,
  ) {}

  // Story Category Methods
  async findAllCategories(): Promise<StoryCategory[]> {
    return this.storyCategoryRepository.find({
      relations: ['stories'],
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async findCategoryById(id: string): Promise<StoryCategory> {
    const category = await this.storyCategoryRepository.findOne({
      where: { id },
      relations: ['stories'],
    });
    if (!category) {
      throw new NotFoundException(`Story category with ID ${id} not found`);
    }
    return category;
  }

  async createCategory(
    createCategoryDto: CreateStoryCategoryDto,
  ): Promise<StoryCategory> {
    const category = this.storyCategoryRepository.create(createCategoryDto);
    return this.storyCategoryRepository.save(category);
  }

  async updateCategory(
    id: string,
    updateCategoryDto: UpdateStoryCategoryDto,
  ): Promise<StoryCategory> {
    await this.storyCategoryRepository.update(id, updateCategoryDto);
    return this.findCategoryById(id);
  }

  async removeCategory(id: string): Promise<void> {
    const category = await this.findCategoryById(id);

    // Delete all stories and their images in this category
    for (const story of category.stories) {
      if (story.imageUrls && story.imageUrls.length > 0) {
        for (const imageUrl of story.imageUrls) {
          try {
            await this.uploadService.deleteFile(imageUrl);
          } catch (error) {
            this.logger.error(
              `Failed to delete image ${imageUrl}:`,
              error as any,
            );
          }
        }
      }
    }

    await this.storyCategoryRepository.delete(id);
  }

  async toggleCategoryStatus(id: string): Promise<StoryCategory> {
    const category = await this.findCategoryById(id);
    category.isActive = !category.isActive;
    return this.storyCategoryRepository.save(category);
  }

  // Move category order up or down
  async moveCategoryOrder(
    id: string,
    direction: 'up' | 'down',
  ): Promise<StoryCategory> {
    const category = await this.findCategoryById(id);
    const categories = await this.findAllCategories();

    // First, ensure all categories have unique sortOrder values
    let needsReindex = false;
    const sortOrders = categories.map((c) => c.sortOrder);
    if (new Set(sortOrders).size !== sortOrders.length) {
      needsReindex = true;
    }

    if (needsReindex) {
      // Assign sequential sortOrder values
      for (let i = 0; i < categories.length; i++) {
        categories[i].sortOrder = i;
      }
      await this.storyCategoryRepository.save(categories);
    }

    // Re-fetch after potential reindex
    const updatedCategories = await this.findAllCategories();
    const currentIndex = updatedCategories.findIndex((c) => c.id === id);
    if (currentIndex === -1) return category;

    const targetIndex =
      direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= updatedCategories.length)
      return category;

    // Swap sort orders
    const currentCategory = updatedCategories[currentIndex];
    const targetCategory = updatedCategories[targetIndex];
    const tempOrder = currentCategory.sortOrder;
    currentCategory.sortOrder = targetCategory.sortOrder;
    targetCategory.sortOrder = tempOrder;

    await this.storyCategoryRepository.save([currentCategory, targetCategory]);
    return this.findCategoryById(id);
  }

  // Story Methods
  async findAllStories(): Promise<Story[]> {
    return this.storyRepository.find({
      relations: ['category'],
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async findStoriesByCategory(categoryId: string): Promise<Story[]> {
    return this.storyRepository.find({
      where: { categoryId },
      relations: ['category'],
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async findStoryById(id: string): Promise<Story> {
    const story = await this.storyRepository.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!story) {
      throw new NotFoundException(`Story with ID ${id} not found`);
    }
    return story;
  }

  async createStory(createStoryDto: CreateStoryDto): Promise<Story> {
    const story = this.storyRepository.create(createStoryDto);
    return this.storyRepository.save(story);
  }

  async updateStory(
    id: string,
    updateStoryDto: UpdateStoryDto,
  ): Promise<Story> {
    await this.storyRepository.update(id, updateStoryDto);
    return this.findStoryById(id);
  }

  async removeStory(id: string): Promise<void> {
    const story = await this.findStoryById(id);

    // Delete images from S3 if they exist
    if (story.imageUrls && story.imageUrls.length > 0) {
      for (const imageUrl of story.imageUrls) {
        try {
          await this.uploadService.deleteFile(imageUrl);
        } catch (error) {
          this.logger.error(
            `Failed to delete image ${imageUrl}:`,
            error as any,
          );
        }
      }
    }

    await this.storyRepository.delete(id);
  }

  async toggleStoryStatus(id: string): Promise<Story> {
    const story = await this.findStoryById(id);
    story.isActive = !story.isActive;
    return this.storyRepository.save(story);
  }

  // Move story order
  async moveStoryOrder(id: string, direction: 'up' | 'down'): Promise<Story> {
    const story = await this.findStoryById(id);
    const stories = await this.findStoriesByCategory(story.categoryId);

    // First, ensure all stories have unique sortOrder values
    let needsReindex = false;
    const sortOrders = stories.map((s) => s.sortOrder);
    if (new Set(sortOrders).size !== sortOrders.length) {
      needsReindex = true;
    }

    if (needsReindex) {
      // Assign sequential sortOrder values
      for (let i = 0; i < stories.length; i++) {
        stories[i].sortOrder = i;
      }
      await this.storyRepository.save(stories);
    }

    // Re-fetch after potential reindex
    const updatedStories = await this.findStoriesByCategory(story.categoryId);
    const currentIndex = updatedStories.findIndex((s) => s.id === id);
    if (currentIndex === -1) return story;

    const targetIndex =
      direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= updatedStories.length) return story;

    // Swap sort orders
    const currentStory = updatedStories[currentIndex];
    const targetStory = updatedStories[targetIndex];
    const tempOrder = currentStory.sortOrder;
    currentStory.sortOrder = targetStory.sortOrder;
    targetStory.sortOrder = tempOrder;

    await this.storyRepository.save([currentStory, targetStory]);
    return this.findStoryById(id);
  }
}
