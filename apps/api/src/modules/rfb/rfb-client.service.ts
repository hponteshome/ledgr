import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RfbClientService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async consultarCNPJ(cnpj: string): Promise<any> {
    try {
      cnpj = cnpj.replace(/\D/g, '');
      
      // Consulta direto na BrasilAPI (sem mock)
      const response = await firstValueFrom(
        this.httpService.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
      );
      
      return this.formatarDados(response.data);
      
    } catch (error) {
      throw new HttpException(
        'Erro ao consultar CNPJ na Receita Federal',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  async consultarCNPJComFallback(cnpj: string): Promise<any> {
    return this.consultarCNPJ(cnpj);
  }

  private formatarDados(data: any): any {
    return {
      razaoSocial: data.razao_social,
      nomeFantasia: data.nome_fantasia,
      dataAbertura: data.data_inicio_atividade,
      endereco: {
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        cep: data.cep,
        uf: data.uf,
        municipio: data.municipio
      },
      contato: {
        email: data.email,
        telefone1: data.ddd_telefone_1 ? `${data.ddd_telefone_1}` : '',
        telefone2: data.ddd_telefone_2 ? `${data.ddd_telefone_2}` : ''
      },
      capitalSocial: data.capital_social,
      naturezaJuridica: data.natureza_juridica,
      socios: (data.qsa || []).map((socio: any) => ({
        nome: socio.nome_socio,
        qualificacao: socio.qualificacao_socio,
        dataEntrada: socio.data_entrada_sociedade,
        cpfCnpj: socio.cnpj_cpf_do_socio
      })),
      simples: {
        optante: data.opcao_pelo_simples === 'SIM' || data.opcao_pelo_simples === true,
        dataOpcao: data.data_opcao_pelo_simples
      },
      mei: {
        optante: data.opcao_pelo_mei === 'SIM' || data.opcao_pelo_mei === true,
        dataOpcao: data.data_opcao_pelo_mei
      }
    };
  }
}