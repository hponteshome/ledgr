// src/auth/dto/login.dto.ts
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {  // <-- TEM QUE TER "export"
    @IsEmail()
    email: string;

    @IsString()
    password: string;
}