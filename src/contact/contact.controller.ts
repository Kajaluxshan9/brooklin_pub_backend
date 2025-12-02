import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto';

// Configure multer for CV file uploads
const cvFileFilter = (
  req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  // Accept only PDF, DOC, DOCX files
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(
      new BadRequestException(
        'Invalid file type. Only PDF, DOC, and DOCX files are allowed.',
      ),
      false,
    );
  }
};

@Controller('contact')
export class ContactController {
  private readonly logger = new Logger(ContactController.name);

  constructor(private readonly contactService: ContactService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('cvFile', {
      fileFilter: cvFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
      },
    }),
  )
  async submitContactForm(
    @Body() createContactDto: CreateContactDto,
    @UploadedFile() cvFile?: Express.Multer.File,
  ) {
    this.logger.log(
      `Received contact form submission from: ${createContactDto.name} (${createContactDto.email})${cvFile ? ` with CV file: ${cvFile.originalname}` : ''}`,
    );
    return this.contactService.submitContactForm(createContactDto, cvFile);
  }
}
