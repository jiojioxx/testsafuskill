import { IsIn, IsOptional, IsString } from 'class-validator';

export class QueryRevenueClaimsDto {
  @IsOptional()
  @IsString()
  @IsIn(['PENDING', 'PAID'])
  status?: string;
}
