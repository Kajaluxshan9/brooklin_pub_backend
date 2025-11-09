import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Special } from '../entities/special.entity';
import { CreateSpecialDto } from './dto/create-special.dto';
import { UpdateSpecialDto } from './dto/update-special.dto';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class SpecialsService {
  constructor(
    @InjectRepository(Special)
    private specialRepository: Repository<Special>,
    private uploadService: UploadService,
  ) {}

  async findAll(): Promise<Special[]> {
    return this.specialRepository.find({
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Special> {
    const special = await this.specialRepository.findOne({
      where: { id },
    });
    if (!special) {
      throw new NotFoundException(`Special with ID ${id} not found`);
    }
    return special;
  }

  async findActive(): Promise<Special[]> {
    return this.specialRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async create(createSpecialDto: CreateSpecialDto): Promise<Special> {
    const special = this.specialRepository.create(createSpecialDto);
    return this.specialRepository.save(special);
  }

  async update(
    id: string,
    updateSpecialDto: UpdateSpecialDto,
  ): Promise<Special> {
    await this.specialRepository.update(id, updateSpecialDto);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    const special = await this.findById(id);

    // Delete images from S3 if they exist
    if (special.imageUrls && special.imageUrls.length > 0) {
      for (const imageUrl of special.imageUrls) {
        try {
          await this.uploadService.deleteFile(imageUrl);
        } catch (error) {
          console.error(`Failed to delete image ${imageUrl}:`, error);
        }
      }
    }

    await this.specialRepository.delete(id);
  }

  async toggleStatus(id: string): Promise<Special> {
    const special = await this.findById(id);
    special.isActive = !special.isActive;
    return this.specialRepository.save(special);
  }
}
