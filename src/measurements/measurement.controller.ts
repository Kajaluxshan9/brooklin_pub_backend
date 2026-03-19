import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { MeasurementService } from './measurement.service';
import { CreateMeasurementTypeDto } from './dto/create-measurement-type.dto';
import { UpdateMeasurementTypeDto } from './dto/update-measurement-type.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('measurements')
export class MeasurementController {
  constructor(private readonly measurementService: MeasurementService) {}

  // Public — used by the frontend menu page to render size options
  @Get()
  async findAll() {
    return this.measurementService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.measurementService.findById(id);
  }

  // Admin-only — mutating operations require authentication
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createDto: CreateMeasurementTypeDto) {
    return this.measurementService.create(createDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateMeasurementTypeDto,
  ) {
    return this.measurementService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string) {
    return this.measurementService.delete(id);
  }
}
