import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeasurementType } from '../entities/measurement-type.entity';
import { CreateMeasurementTypeDto } from './dto/create-measurement-type.dto';
import { UpdateMeasurementTypeDto } from './dto/update-measurement-type.dto';

@Injectable()
export class MeasurementService {
  constructor(
    @InjectRepository(MeasurementType)
    private measurementRepository: Repository<MeasurementType>,
  ) {}

  async findAll(): Promise<MeasurementType[]> {
    return this.measurementRepository.find({ order: { sortOrder: 'ASC' } });
  }

  async findById(id: string): Promise<MeasurementType> {
    const item = await this.measurementRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Measurement type not found');
    return item;
  }

  async create(createDto: CreateMeasurementTypeDto): Promise<MeasurementType> {
    const entity = this.measurementRepository.create(createDto);
    return this.measurementRepository.save(entity);
  }

  async update(id: string, updateDto: UpdateMeasurementTypeDto) {
    await this.measurementRepository.update(id, updateDto);
    return this.findById(id);
  }

  async delete(id: string) {
    await this.measurementRepository.delete(id);
  }
}
