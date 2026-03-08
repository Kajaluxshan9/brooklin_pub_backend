import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { SubscribeDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  // ─── Public Endpoints ─────────────────────────────────────────

  @Post('subscribe')
  subscribe(@Body() subscribeDto: SubscribeDto) {
    return this.newsletterService.subscribe(subscribeDto);
  }

  @Get('unsubscribe')
  unsubscribe(@Query('token') token: string) {
    return this.newsletterService.unsubscribe(token);
  }

  // ─── Admin Endpoints (Protected) ─────────────────────────────

  @Get('subscribers')
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.newsletterService.findAll();
  }

  @Get('subscribers/active')
  @UseGuards(JwtAuthGuard)
  findActive() {
    return this.newsletterService.findActive();
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  getStats() {
    return this.newsletterService.getStats();
  }

  @Delete('subscribers/:id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.newsletterService.remove(id);
  }
}
