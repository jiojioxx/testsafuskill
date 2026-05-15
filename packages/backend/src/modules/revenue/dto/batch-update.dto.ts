import { IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class BatchUpdateItem {
  @IsString()
  id: string;

  @IsString()
  @IsIn(['PENDING', 'PAID'])
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(66)
  txHash?: string;
}

export class BatchUpdateRevenueClaimsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchUpdateItem)
  items: BatchUpdateItem[];
}
