import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  GiftCardPaymentMethod,
  GiftCardStatus,
} from '../../entities/gift-card.entity';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Multipart sends booleans as strings; implicit conversion would turn "false" into true. */
const toBool = ({ obj, key }: { obj: Record<string, unknown>; key: string }) =>
  obj[key] === true || obj[key] === 'true' || obj[key] === '1';

export const GIFT_CARD_CODE_REGEX = /^BPGC-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const normalizeCode = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

// ─── Public ───────────────────────────────────────────────────

export class PurchaseGiftCardDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount: number;

  @IsIn([GiftCardPaymentMethod.INTERAC, GiftCardPaymentMethod.BANK_DEPOSIT])
  paymentMethod: GiftCardPaymentMethod;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  buyerName: string;

  @Transform(trim)
  @IsEmail()
  @MaxLength(200)
  buyerEmail: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9+()\-\s.]{7,30}$/, { message: 'Invalid phone number' })
  buyerPhone: string;

  @Transform(toBool)
  @IsBoolean()
  isForSelf: boolean;

  @ValidateIf((o: PurchaseGiftCardDto) => !o.isForSelf)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  recipientName?: string;

  @ValidateIf((o: PurchaseGiftCardDto) => !o.isForSelf)
  @Transform(trim)
  @IsEmail()
  @MaxLength(200)
  recipientEmail?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class CheckGiftCardDto {
  @Transform(normalizeCode)
  @Matches(GIFT_CARD_CODE_REGEX, { message: 'Invalid gift card ID' })
  code: string;

  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'PIN must be 4 digits' })
  pin?: string;
}

// ─── Admin ────────────────────────────────────────────────────

export class ListGiftCardsQueryDto {
  @IsOptional()
  @IsEnum(GiftCardStatus)
  status?: GiftCardStatus;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  locked?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}

export class ApproveGiftCardDto {
  /** Amount actually received, in dollars. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(10000)
  receivedAmount: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectGiftCardDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export class RedeemGiftCardDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @Matches(/^\d{4}$/, { message: 'PIN must be 4 digits' })
  pin: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AdjustGiftCardDto {
  /** Signed dollars: positive adds, negative removes. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-10000)
  @Max(10000)
  amount: number;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note: string;
}

export class NoteDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class IssueGiftCardDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(10000)
  amount: number;

  @IsIn([GiftCardPaymentMethod.IN_STORE, GiftCardPaymentMethod.COMPLIMENTARY])
  paymentMethod: GiftCardPaymentMethod;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  buyerName: string;

  @IsOptional()
  @Transform(trim)
  @IsEmail()
  buyerEmail?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  buyerPhone?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  recipientName: string;

  /** Optional: without it the PIN is shown once to the admin to hand over. */
  @IsOptional()
  @Transform(trim)
  @IsEmail()
  recipientEmail?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  message?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateGiftCardSettingsDto {
  @IsOptional() @IsBoolean() isEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(12)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(10000, { each: true })
  presetAmounts?: number[];

  @IsOptional() @IsBoolean() customAmountEnabled?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(10000) customAmountMin?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10000) customAmountMax?: number;

  @IsOptional() @IsBoolean() interacEnabled?: boolean;
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsEmail()
  interacEmail?: string | null;
  @IsOptional() @IsString() @MaxLength(200) interacRecipientName?:
    | string
    | null;
  @IsOptional() @IsString() @MaxLength(2000) interacInstructions?:
    | string
    | null;

  @IsOptional() @IsBoolean() bankDepositEnabled?: boolean;
  @IsOptional() @IsString() @MaxLength(200) bankName?: string | null;
  @IsOptional() @IsString() @MaxLength(200) bankAccountName?: string | null;
  @IsOptional() @IsString() @MaxLength(10) bankInstitutionNumber?:
    | string
    | null;
  @IsOptional() @IsString() @MaxLength(10) bankTransitNumber?: string | null;
  @IsOptional() @IsString() @MaxLength(30) bankAccountNumber?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) bankInstructions?: string | null;
}
