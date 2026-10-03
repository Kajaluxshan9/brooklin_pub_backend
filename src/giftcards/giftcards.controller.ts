import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { Actor, GiftCardsService } from './giftcards.service';
import {
  AdjustGiftCardDto,
  ApproveGiftCardDto,
  CheckGiftCardDto,
  IssueGiftCardDto,
  ListGiftCardsQueryDto,
  NoteDto,
  PurchaseGiftCardDto,
  RedeemGiftCardDto,
  RejectGiftCardDto,
  UpdateGiftCardSettingsDto,
} from './dto';

type AuthedRequest = Request & { user: Actor };

@Controller('giftcards')
export class GiftCardsController {
  constructor(private readonly giftCards: GiftCardsService) {}

  // ─── Public Endpoints ─────────────────────────────────────────

  @Get('settings')
  getPublicSettings() {
    return this.giftCards.getPublicSettings();
  }

  @Post('purchase')
  @UseInterceptors(
    FileInterceptor('slip', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
        fields: 20,
        fieldSize: 4096,
      },
    }),
  )
  purchase(
    @Body() dto: PurchaseGiftCardDto,
    @UploadedFile() slip: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    return this.giftCards.purchase(dto, slip, req.ip ?? 'unknown');
  }

  /** ID only → order status. ID + PIN → balance and history. POST keeps the PIN out of URLs/logs. */
  @Post('check')
  @HttpCode(HttpStatus.OK)
  check(@Body() dto: CheckGiftCardDto, @Req() req: Request) {
    return this.giftCards.check(dto.code, dto.pin, req.ip ?? 'unknown');
  }

  // ─── Admin Endpoints (any admin) ──────────────────────────────

  @Get('admin/stats')
  @UseGuards(JwtAuthGuard)
  getStats() {
    return this.giftCards.getStats();
  }

  @Get('admin/settings')
  @UseGuards(JwtAuthGuard)
  getSettings() {
    return this.giftCards.getSettings();
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard)
  list(@Query() query: ListGiftCardsQueryDto) {
    return this.giftCards.list(query);
  }

  @Get('admin/code/:code')
  @UseGuards(JwtAuthGuard)
  findByCode(@Param('code') code: string) {
    return this.giftCards.findByCode(code);
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.giftCards.findOne(id);
  }

  @Get('admin/:id/slip')
  @UseGuards(JwtAuthGuard)
  async getSlip(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const slip = await this.giftCards.getSlip(id);
    res.setHeader('Content-Type', slip.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${slip.fileName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    );
    res.sendFile(slip.filePath);
  }

  @Post('admin/:id/approve')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveGiftCardDto,
    @Req() req: AuthedRequest,
  ) {
    return this.giftCards.approve(id, dto, req.user);
  }

  @Post('admin/:id/reject')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectGiftCardDto,
    @Req() req: AuthedRequest,
  ) {
    return this.giftCards.reject(id, dto, req.user);
  }

  @Post('admin/:id/redeem')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  redeem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RedeemGiftCardDto,
    @Req() req: AuthedRequest,
  ) {
    return this.giftCards.redeem(id, dto, req.user);
  }

  @Post('admin/issue')
  @UseGuards(JwtAuthGuard)
  issue(@Body() dto: IssueGiftCardDto, @Req() req: AuthedRequest) {
    return this.giftCards.issue(dto, req.user);
  }

  @Post('admin/:id/resend')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  resend(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    return this.giftCards.resendEmail(id, req.user);
  }

  @Post('admin/:id/unlock')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  unlock(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    return this.giftCards.unlock(id, req.user);
  }

  // ─── Super Admin Only ─────────────────────────────────────────

  @Put('admin/settings')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  updateSettings(@Body() dto: UpdateGiftCardSettingsDto) {
    return this.giftCards.updateSettings(dto);
  }

  @Post('admin/:id/adjust')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @HttpCode(HttpStatus.OK)
  adjust(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustGiftCardDto,
    @Req() req: AuthedRequest,
  ) {
    return this.giftCards.adjust(id, dto, req.user);
  }

  @Post('admin/:id/reset-pin')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @HttpCode(HttpStatus.OK)
  resetPin(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    return this.giftCards.resetPin(id, req.user);
  }

  @Patch('admin/:id/freeze')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  freeze(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NoteDto,
    @Req() req: AuthedRequest,
  ) {
    return this.giftCards.setFrozen(id, true, dto, req.user);
  }

  @Patch('admin/:id/unfreeze')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  unfreeze(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NoteDto,
    @Req() req: AuthedRequest,
  ) {
    return this.giftCards.setFrozen(id, false, dto, req.user);
  }

  @Patch('admin/:id/void')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  void(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NoteDto,
    @Req() req: AuthedRequest,
  ) {
    return this.giftCards.void(id, dto, req.user);
  }
}
