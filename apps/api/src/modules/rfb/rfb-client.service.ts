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
      cnpj: data.cnpj,
      razaoSocial: data.razao_social,
      nomeFantasia: data.nome_fantasia,
      dataAbertura: data.data_inicio_atividade,
      endereco: {
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        cep: (data.cep || '').replace(/\D/g, ''),
        uf: data.uf,
        municipio: data.municipio,
      },
      contato: {
        email: data.email,
        telefone1: data.ddd_telefone_1 || '',
        telefone2: data.ddd_telefone_2 || '',
      },
      capitalSocial: data.capital_social,
      naturezaJuridica: data.natureza_juridica,
      porte: data.porte,
      situacaoCadastral: data.descricao_situacao_cadastral,
      dataSituacao: data.data_situacao_cadastral,
      codMun: data.codigo_municipio_ibge?.toString(),
      cnaePrincipal: {
        codigo: data.cnae_fiscal,
        descricao: data.cnae_fiscal_descricao,
      },
      cnaesSecundarios: (data.cnaes_secundarios || []).map((c: any) => ({
        codigo: c.codigo,
        descricao: c.descricao,
      })),
      regimeTributario: (data.regime_tributario || []),
      qsa: (data.qsa || []).map((s: any) => ({
        nome: s.nome_socio,
        cpfCnpj: s.cnpj_cpf_do_socio,
        qualificacao: s.qualificacao_socio,
        codigoQualificacao: s.codigo_qualificacao_socio,
        dataEntrada: s.data_entrada_sociedade,
        identificador: s.identificador_de_socio,
        representanteLegal: s.nome_representante_legal || null,
        cpfRepresentante: s.cpf_representante_legal || null,
      })),
      simples: {
        optante: !!data.opcao_pelo_simples,
        dataOpcao: data.data_opcao_pelo_simples,
      },
      mei: {
        optante: !!data.opcao_pelo_mei,
        dataOpcao: data.data_opcao_pelo_mei,
      },
    };
  }
}