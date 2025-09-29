# Brooklin Pub Backend

This is the backend API for Brooklin Pub built with NestJS, TypeORM, and PostgreSQL.

## Features

- **NestJS** - Scalable Node.js server-side framework
- **TypeORM** - Object-Relational Mapping for database operations
- **PostgreSQL** - Robust relational database
- **JWT Authentication** - Secure user authentication
- **CORS** - Cross-origin resource sharing enabled
- **Validation** - Global validation pipes
- **Environment Configuration** - ConfigModule for environment variables

## Setup

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- Docker (optional, for database setup)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Setup:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` file with your database credentials.

3. **Database Setup (Option A - Docker):**
   ```bash
   docker-compose up -d
   ```

4. **Database Setup (Option B - Manual PostgreSQL):**
   - Install PostgreSQL
   - Create database named `brooklin_pub`
   - Update `.env` with your database credentials

5. **Start development server:**
   ```bash
   npm run start:dev
   ```

## Available Scripts

- `npm run start` - Start production server
- `npm run start:dev` - Start development server with watch mode
- `npm run start:debug` - Start development server with debug mode
- `npm run build` - Build for production
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run lint` - Run ESLint

## Environment Variables

Create a `.env` file in the root directory:

```env
NODE_ENV=development
PORT=3001

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=brooklin_pub

# JWT
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=1d
```

## API Endpoints

The server will start on http://localhost:3001

### Base Routes
- `GET /` - Health check
- `POST /auth/login` - User login
- `POST /auth/register` - User registration

### Protected Routes (Requires JWT)
- `GET /users` - Get all users
- `GET /menu` - Get menu items
- `POST /orders` - Create new order
- `GET /orders` - Get user orders

## Database Entities

- **User** - Customer and staff user accounts
- **MenuItem** - Menu items with categories and pricing
- **Order** - Customer orders with status tracking

## Tech Stack

- **NestJS** - Server framework
- **TypeORM** - Database ORM
- **PostgreSQL** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **class-validator** - Request validation

## Project Structure

```
src/
├── entities/       # Database entities
├── modules/        # Feature modules
├── guards/         # Authentication guards
├── decorators/     # Custom decorators
├── filters/        # Exception filters
├── pipes/          # Validation pipes
└── main.ts         # Application entry point
```

## Development

1. Make sure PostgreSQL is running
2. Run `npm run start:dev` for development
3. The API will be available at http://localhost:3001
4. Database tables will be auto-created in development mode