import { IsString, IsNotEmpty, IsOptional, IsUUID, Matches, IsBoolean } from 'class-validator';

/**
 * Data Transfer Object for Company entities.
 * Replaces 'EmpresaDto' and uses international naming standards.
 */
export class CompanyDto {
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsString()
  @IsNotEmpty({ message: 'Legal name is required' })
  legalName: string;

  @IsString()
  @IsNotEmpty({ message: 'CNPJ is required' })
  @Matches(/^\d{14}$/, { message: 'CNPJ must contain exactly 14 numeric digits' })
  cnpj: string;

  @IsOptional()
  @IsString()
  tradeName?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  isHeadquarters?: boolean;

  constructor(partial?: any) {
    if (partial) {
      // Manual mapping from Database (snake_case) or Legacy (Portuguese) to DTO properties
      this.id = partial.id;
      this.legalName = partial.legalName || partial.razao_social || partial.razaoSocial;
      this.cnpj = partial.cnpj;
      this.tradeName = partial.tradeName || partial.nome_fantasia || partial.nomeFantasia;
      this.status = partial.status;
      this.isHeadquarters = partial.isHeadquarters ?? partial.is_sede ?? partial.isSede ?? false;
    }
  }
}