import { Controller, Get, UseGuards } from '@nestjs/common';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationSchedulerService: NotificationSchedulerService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.notificationSchedulerService.findAllWithDetails();
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  getStats() {
    return this.notificationSchedulerService.getStats();
  }
}
