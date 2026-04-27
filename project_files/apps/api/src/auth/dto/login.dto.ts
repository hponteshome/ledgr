import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Email/CPF é obrigatório' })
  login: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  password: string;
}
