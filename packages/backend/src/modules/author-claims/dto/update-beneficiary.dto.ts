import { IsString, Matches } from 'class-validator';

export class UpdateBeneficiaryDto {
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid wallet address' })
  beneficiaryAddress: string;
}
