import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { MenuModule } from './menu/menu.module';
import { SpecialsModule } from './specials/specials.module';
import { OpeningHoursModule } from './opening-hours/opening-hours.module';
import { EventsModule } from './events/events.module';
import { UsersModule } from './users/users.module';
import { TodosModule } from './todos/todos.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { UploadModule } from './upload/upload.module';
import { StoriesModule } from './stories/stories.module';
import { User } from './entities/user.entity';
import { MenuItem } from './entities/menu-item.entity';
import { MenuCategory } from './entities/menu-category.entity';
import { PrimaryCategory } from './entities/primary-category.entity';
import { Special } from './entities/special.entity';
import { Event } from './entities/event.entity';
import { OpeningHours } from './entities/opening-hours.entity';
import { Todo } from './entities/todo.entity';
import { Story } from './entities/story.entity';
import { StoryCategory } from './entities/story-category.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Validate database configuration
        const requiredDbVars = [
          'DB_HOST',
          'DB_PORT',
          'DB_USERNAME',
          'DB_PASSWORD',
          'DB_NAME',
        ];
        const missing = requiredDbVars.filter((v) => !configService.get(v));
        if (missing.length > 0) {
          throw new Error(
            `Missing required database config: ${missing.join(', ')}`,
          );
        }

        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST'),
          port: configService.get<number>('DB_PORT'),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_NAME'),
          entities: [
            User,
            MenuItem,
            MenuCategory,
            PrimaryCategory,
            Special,
            Event,
            OpeningHours,
            Todo,
            Story,
            StoryCategory,
          ],
          synchronize: configService.get<string>('NODE_ENV') !== 'production',
          logging: configService.get<string>('NODE_ENV') === 'development',
          timezone: 'UTC',
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    MenuModule,
    SpecialsModule,
    OpeningHoursModule,
    EventsModule,
    UsersModule,
    TodosModule,
    DashboardModule,
    UploadModule,
    StoriesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
