import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  Body,
  BadRequestException,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('images')
  @UseInterceptors(FilesInterceptor('images', 5)) // Max 5 files
  async uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    // Validate file size (1MB limit)
    const maxSize = 1024 * 1024; // 1MB
    for (const file of files) {
      if (file.size > maxSize) {
        throw new BadRequestException(
          `File ${file.originalname} exceeds 1MB size limit`,
        );
      }
    }

    // Validate file type
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/webp',
    ];
    for (const file of files) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `File ${file.originalname} is not a supported image format`,
        );
      }
    }

    try {
      const uploadedUrls = await this.uploadService.uploadMultipleFiles(files);
      return {
        success: true,
        message: 'Images uploaded successfully',
        urls: uploadedUrls,
      };
    } catch (error) {
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }
  }

  @Delete('images')
  async deleteImages(@Body() body: { urls: string[] }) {
    if (!body.urls || body.urls.length === 0) {
      throw new BadRequestException('No URLs provided for deletion');
    }

    try {
      await this.uploadService.deleteMultipleFiles(body.urls);
      return {
        success: true,
        message: 'Images deleted successfully',
      };
    } catch (error) {
      throw new BadRequestException(`Delete failed: ${error.message}`);
    }
  }
}
