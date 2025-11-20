import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoriesService } from './stories.service';
import { StoriesController } from './stories.controller';
import { Story } from '../entities/story.entity';
import { StoryCategory } from '../entities/story-category.entity';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [TypeOrmModule.forFeature([Story, StoryCategory]), UploadModule],
  controllers: [StoriesController],
  providers: [StoriesService],
  exports: [StoriesService],
})
export class StoriesModule {}
