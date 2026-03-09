import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Special } from '../entities/special.entity';
import { CreateSpecialDto } from './dto/create-special.dto';
import { UpdateSpecialDto } from './dto/update-special.dto';
import { UploadService } from '../upload/upload.service';
import { NewsletterService } from '../newsletter/newsletter.service';
import { NotificationSchedulerService } from '../notifications/notification-scheduler.service';
import { NotificationType } from '../entities/scheduled-notification.entity';

@Injectable()
export class SpecialsService {
  private readonly logger = new Logger(SpecialsService.name);
  constructor(
    @InjectRepository(Special)
    private specialRepository: Repository<Special>,
    private uploadService: UploadService,
    private newsletterService: NewsletterService,
    private notificationScheduler: NotificationSchedulerService,
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
    const savedSpecial = await this.specialRepository.save(special);

    // Notify subscribers — schedule for displayStartDate or send immediately
    if (savedSpecial.isActive) {
      const sendNow =
        await this.notificationScheduler.scheduleOrSendImmediately(
          NotificationType.SPECIAL,
          savedSpecial.id,
          savedSpecial.displayStartDate,
        );

      if (sendNow) {
        this.newsletterService
          .notifyNewSpecial(savedSpecial)
          .catch((err) =>
            this.logger.error('Failed to send special newsletter', err),
          );
      }
    }

    return savedSpecial;
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

    // Cancel any pending scheduled notifications
    await this.notificationScheduler.cancelPendingNotifications(
      NotificationType.SPECIAL,
      id,
    );

    // Delete images from S3 if they exist
    if (special.imageUrls && special.imageUrls.length > 0) {
      for (const imageUrl of special.imageUrls) {
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

    await this.specialRepository.delete(id);
  }

  async toggleStatus(id: string): Promise<Special> {
    const special = await this.findById(id);
    special.isActive = !special.isActive;
    return this.specialRepository.save(special);
  }
}
