import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * Reviews are public and unauthenticated, so the input is constrained hard.
 * Text is stored as-is and must only ever be rendered as plain text.
 */
export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  authorName!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString()
  @MaxLength(120)
  title?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body!: string;
}
