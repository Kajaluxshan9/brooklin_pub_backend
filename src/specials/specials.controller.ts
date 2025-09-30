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
import { SpecialsService } from './specials.service';
import { CreateSpecialDto } from './dto/create-special.dto';
import { UpdateSpecialDto } from './dto/update-special.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('specials')
export class SpecialsController {
  constructor(private readonly specialsService: SpecialsService) {}

  @Get()
  findAll() {
    return this.specialsService.findAll();
  }

  @Get('active')
  findActive() {
    return this.specialsService.findActive();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.specialsService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createSpecialDto: CreateSpecialDto) {
    return this.specialsService.create(createSpecialDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateSpecialDto: UpdateSpecialDto) {
    return this.specialsService.update(id, updateSpecialDto);
  }

  @Patch(':id/toggle')
  @UseGuards(JwtAuthGuard)
  toggleStatus(@Param('id') id: string) {
    return this.specialsService.toggleStatus(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.specialsService.remove(id);
  }
}
