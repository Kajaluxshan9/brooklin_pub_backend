import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OpeningHoursService } from './opening-hours.service';
import { OpeningHoursController } from './opening-hours.controller';
import { OpeningHours } from '../entities/opening-hours.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OpeningHours])],
  controllers: [OpeningHoursController],
  providers: [OpeningHoursService],
  exports: [OpeningHoursService],
})
export class OpeningHoursModule {}
