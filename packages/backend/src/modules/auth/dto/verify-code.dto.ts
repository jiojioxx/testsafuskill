import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class VerifyCodeDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  code: string;

  @IsString()
  @MinLength(2)
  @MaxLength(30)
  username: string;
}