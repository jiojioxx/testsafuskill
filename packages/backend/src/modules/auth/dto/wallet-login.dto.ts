import { IsString, IsEthereumAddress } from 'class-validator';

export class WalletLoginDto {
  @IsEthereumAddress()
  address: string;

  @IsString()
  message: string;

  @IsString()
  signature: string;
}
