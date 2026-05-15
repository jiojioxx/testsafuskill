import { IsString } from 'class-validator';

export class CreateClaimDto {
  @IsString()
  skillId: string;
}
