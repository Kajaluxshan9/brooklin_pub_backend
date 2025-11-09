import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private s3: AWS.S3;

  constructor() {
    // Configure AWS S3
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    bucketName: string = process.env.AWS_S3_BUCKET_NAME ||
      'brooklin-pub-images',
  ): Promise<string> {
    const fileName = `menu-items/${uuidv4()}-${file.originalname}`;

    const uploadParams = {
      Bucket: bucketName,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    try {
      const result = await this.s3.upload(uploadParams).promise();
      return result.Location;
    } catch (error) {
      // Surface the original error message if available
      const msg =
        (error && (error.message || error.toString())) || 'Unknown error';
      throw new Error(`Failed to upload file to S3: ${msg}`);
    }
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    bucketName: string = process.env.AWS_S3_BUCKET_NAME ||
      'brooklin-pub-images',
  ): Promise<string[]> {
    const uploadPromises = files.map((file) =>
      this.uploadFile(file, bucketName),
    );
    return Promise.all(uploadPromises);
  }

  async deleteFile(
    fileUrl: string,
    bucketName: string = process.env.AWS_S3_BUCKET_NAME ||
      'brooklin-pub-images',
  ): Promise<void> {
    // Extract the key from the full URL in a robust way
    let key: string;
    try {
      const parsed = new URL(fileUrl);
      // pathname starts with '/': remove leading slash
      key = parsed.pathname.startsWith('/')
        ? parsed.pathname.slice(1)
        : parsed.pathname;
      // If the pathname contains the bucket name as the first segment (s3 path-style), remove it
      if (key.startsWith(`${bucketName}/`)) {
        key = key.slice(bucketName.length + 1);
      }
    } catch (e) {
      // Fallback: take last two segments (folder/filename) which matches our upload pattern
      const urlParts = fileUrl.split('/');
      key = urlParts.slice(-2).join('/');
    }

    const deleteParams = {
      Bucket: bucketName,
      Key: key,
    };

    try {
      await this.s3.deleteObject(deleteParams).promise();
    } catch (error) {
      console.error(`Failed to delete file from S3: ${error.message}`);
      // Don't throw error for delete operations to avoid blocking the main operation
    }
  }

  async deleteMultipleFiles(
    fileUrls: string[],
    bucketName: string = process.env.AWS_S3_BUCKET_NAME ||
      'brooklin-pub-images',
  ): Promise<void> {
    const deletePromises = fileUrls.map((url) =>
      this.deleteFile(url, bucketName),
    );
    await Promise.all(deletePromises);
  }
}
