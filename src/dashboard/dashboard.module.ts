import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { MenuItem } from '../entities/menu-item.entity';
import { User } from '../entities/user.entity';
import { Event } from '../entities/event.entity';
import { Special } from '../entities/special.entity';
import { Todo } from '../entities/todo.entity';
import { OpeningHours } from '../entities/opening-hours.entity';
import { MenuCategory } from '../entities/menu-category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MenuItem,
      MenuCategory,
      User,
      Event,
      Special,
      Todo,
      OpeningHours,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
