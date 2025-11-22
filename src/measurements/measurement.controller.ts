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

@Controller('measurements')
export class MeasurementController {
  constructor(private readonly measurementService: MeasurementService) {}

  @Get()
  async findAll() {
    return this.measurementService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.measurementService.findById(id);
  }

  @Post()
  async create(@Body() createDto: CreateMeasurementTypeDto) {
    return this.measurementService.create(createDto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateMeasurementTypeDto,
  ) {
    return this.measurementService.update(id, updateDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.measurementService.delete(id);
  }
}
