import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { SubscribeDto, GetSubscribersQueryDto } from './dto';
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
  findAll(@Query() query: GetSubscribersQueryDto) {
    return this.newsletterService.findAll(query);
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

  @Post('subscribers/:id/send-promo')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  sendPromoCode(@Param('id') id: string) {
    return this.newsletterService.sendPromoCode(id);
  }

  @Patch('subscribers/:id/claim-promo')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  markPromoClaimed(@Param('id') id: string) {
    return this.newsletterService.markPromoClaimed(id);
  }

  @Delete('subscribers/:id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.newsletterService.remove(id);
  }
}
