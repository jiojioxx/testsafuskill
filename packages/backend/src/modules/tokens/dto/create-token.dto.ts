import { IsString, IsOptional, IsInt, IsIn, Min, Max } from 'class-validator';

export class CreateTokenDto {
  @IsString()
  name: string;

  @IsString()
  symbol: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  skillId: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @IsIn([56, 97], { message: 'chainId must be 56 (BSC) or 97 (BSC Testnet)' })
  chainId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  taxRate?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  mktBps?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  deflationBps?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  dividendBps?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  lpBps?: number;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  twitter?: string;

  @IsOptional()
  @IsIn(['FLAP', 'FOURMEME'])
  launchPlatform?: string;
}
