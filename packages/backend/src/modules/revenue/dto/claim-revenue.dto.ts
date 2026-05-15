import { IsString } from 'class-validator';

export class ClaimRevenueDto {
  @IsString()
  authorClaimId: string;
}
