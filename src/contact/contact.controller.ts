import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto';

@Controller('contact')
export class ContactController {
  private readonly logger = new Logger(ContactController.name);

  constructor(private readonly contactService: ContactService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async submitContactForm(@Body() createContactDto: CreateContactDto) {
    this.logger.log(
      `Received contact form submission from: ${createContactDto.name} (${createContactDto.email})`,
    );
    return this.contactService.submitContactForm(createContactDto);
  }
}
