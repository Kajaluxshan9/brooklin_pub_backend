import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { OpeningHoursService } from './opening-hours.service';
import { CreateOpeningHoursDto } from './dto/create-opening-hours.dto';
import { UpdateOpeningHoursDto } from './dto/update-opening-hours.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('opening-hours')
export class OpeningHoursController {
  constructor(private readonly openingHoursService: OpeningHoursService) {}

  @Get()
  findAll() {
    return this.openingHoursService.findAll();
  }

  @Get('status')
  getCurrentStatus() {
    return this.openingHoursService.getCurrentStatus();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.openingHoursService.findOne(id);
  }

  @Get('day/:day')
  findByDay(@Param('day') day: string) {
    return this.openingHoursService.findByDay(day);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createOpeningHoursDto: CreateOpeningHoursDto) {
    return this.openingHoursService.create(createOpeningHoursDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateOpeningHoursDto: UpdateOpeningHoursDto,
  ) {
    return this.openingHoursService.update(id, updateOpeningHoursDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.openingHoursService.remove(id);
  }
}
