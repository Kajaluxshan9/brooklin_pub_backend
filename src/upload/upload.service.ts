import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { getOptionalEnv } from '../config/env.validation';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor() {
    // Use environment variable or default to 'uploads' directory
    this.uploadDir = getOptionalEnv('UPLOAD_DIR', 'uploads') || 'uploads';
    // Base URL for accessing uploaded files (e.g., https://api.example.com)
    this.baseUrl = getOptionalEnv('UPLOAD_BASE_URL', '') || '';

    // Ensure upload directory exists
    this.ensureUploadDir();
  }

  private ensureUploadDir(): void {
    const absoluteDir = path.isAbsolute(this.uploadDir)
      ? this.uploadDir
      : path.join(process.cwd(), this.uploadDir);

    if (!fs.existsSync(absoluteDir)) {
      fs.mkdirSync(absoluteDir, { recursive: true });
      this.logger.log(`Created upload directory: ${absoluteDir}`);
    }
  }

  private ensureFolderExists(folder: string): string {
    const absoluteDir = path.isAbsolute(this.uploadDir)
      ? this.uploadDir
      : path.join(process.cwd(), this.uploadDir);

    const folderPath = path.join(absoluteDir, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    return folderPath;
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'general',
  ): Promise<string> {
    // Ensure folder exists
    const folderPath = this.ensureFolderExists(folder);

    // Generate unique filename
    const ext = path.extname(file.originalname);
    const sanitizedName = file.originalname
      .replace(ext, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 50);
    const uniqueFileName = `${uuidv4()}-${sanitizedName}${ext}`;
    const filePath = path.join(folderPath, uniqueFileName);

    try {
      // Write file to disk
      await fs.promises.writeFile(filePath, file.buffer);

      // Return the URL path for accessing the file
      const relativePath = `/uploads/${folder}/${uniqueFileName}`;
      const fullUrl = this.baseUrl ? `${this.baseUrl}${relativePath}` : relativePath;

      this.logger.log(`File uploaded successfully: ${relativePath}`);
      return fullUrl;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to upload file: ${msg}`);
      throw new Error(`Failed to upload file: ${msg}`);
    }
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: string = 'general',
  ): Promise<string[]> {
    const uploadPromises = files.map((file) => this.uploadFile(file, folder));
    return Promise.all(uploadPromises);
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract path from URL
      let relativePath: string;

      if (fileUrl.startsWith('http')) {
        // Full URL - extract path
        const url = new URL(fileUrl);
        relativePath = url.pathname;
      } else {
        // Already a relative path
        relativePath = fileUrl;
      }

      // Remove leading /uploads/ to get folder/filename
      const cleanPath = relativePath.replace(/^\/uploads\//, '');

      const absoluteDir = path.isAbsolute(this.uploadDir)
        ? this.uploadDir
        : path.join(process.cwd(), this.uploadDir);

      const filePath = path.join(absoluteDir, cleanPath);

      // Check if file exists before attempting deletion
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        this.logger.log(`File deleted successfully: ${cleanPath}`);
      } else {
        this.logger.warn(`File not found for deletion: ${cleanPath}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete file: ${msg}`);
      // Don't throw error for delete operations to avoid blocking the main operation
    }
  }

  async deleteMultipleFiles(fileUrls: string[]): Promise<void> {
    const deletePromises = fileUrls.map((url) => this.deleteFile(url));
    await Promise.all(deletePromises);
  }
}
