import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateDisputeDto {
  @IsString()
  @MaxLength(255)
  skillName: string;

  @IsString()
  @MaxLength(255)
  tokenAddress: string;

  @IsString()
  @MaxLength(2000)
  reason: string;

  @IsOptional()
  @IsString()
  resubmitFromId?: string;
}
