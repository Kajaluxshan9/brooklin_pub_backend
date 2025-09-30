import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpecialsService } from './specials.service';
import { SpecialsController } from './specials.controller';
import { Special } from '../entities/special.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Special])],
  controllers: [SpecialsController],
  providers: [SpecialsService],
  exports: [SpecialsService],
})
export class SpecialsModule {}
