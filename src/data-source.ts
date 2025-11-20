import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { User } from './entities/user.entity';
import { MenuItem } from './entities/menu-item.entity';
import { MenuCategory } from './entities/menu-category.entity';
import { PrimaryCategory } from './entities/primary-category.entity';
import { Special } from './entities/special.entity';
import { Event } from './entities/event.entity';
import { OpeningHours } from './entities/opening-hours.entity';
import { Todo } from './entities/todo.entity';

config();

const configService = new ConfigService();

// Validate required environment variables
const requiredEnvVars = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_NAME',
];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(
    `Missing required database environment variables: ${missingVars.join(', ')}. ` +
      'Please ensure your .env file is properly configured.',
  );
}

export const AppDataSource = new DataSource({
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
  ],
  synchronize: false, // We'll use CLI to sync
  logging: true,
});

// If this file is run directly, synchronize the schema
if (require.main === module) {
  AppDataSource.initialize()
    .then(() => {
      console.log('📡 Data source initialized');
      return AppDataSource.synchronize();
    })
    .then(() => {
      console.log('✅ Schema synchronized successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error synchronizing schema:', error);
      process.exit(1);
    });
}
