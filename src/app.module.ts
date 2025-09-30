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
import { User } from './entities/user.entity';
import { MenuItem } from './entities/menu-item.entity';
import { MenuCategory } from './entities/menu-category.entity';
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
      useFactory: () => ({
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'Kajan2000#',
        database: 'brooklinpubfinaldb',
        entities: [
          User,
          MenuItem,
          MenuCategory,
          Special,
          Event,
          OpeningHours,
          Todo,
        ],
        synchronize: true,
        logging: true,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
