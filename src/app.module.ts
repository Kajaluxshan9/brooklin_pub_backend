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
import { User } from './entities/user.entity';
import { MenuItem } from './entities/menu-item.entity';
import { MenuCategory } from './entities/menu-category.entity';
import { PrimaryCategory } from './entities/primary-category.entity';
import { Special } from './entities/special.entity';
import { Event } from './entities/event.entity';
import { OpeningHours } from './entities/opening-hours.entity';
import { Todo } from './entities/todo.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME', 'brooklinpubfinaldb'),
        entities: [
          User,
          MenuItem,
          MenuCategory,
          PrimaryCategory,
          Special,
          Event,
          OpeningHours,
          Todo,
        ],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        logging: configService.get<string>('NODE_ENV') === 'development',
        timezone: 'UTC',
      }),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
