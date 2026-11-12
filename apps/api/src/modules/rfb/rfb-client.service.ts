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
      const dados = this.formatarDados(response.data);
      // IMPL-RFB-03 (12/11/2026): a BrasilAPI nao devolve o e-mail do estabelecimento - complementa pelo CNPJ.ws.
      if (!dados.contato?.email) {
        const email = await this.emailCnpjWs(cnpj);
        if (email) { dados.contato.email = email; dados.fonteEmail = 'CNPJ.ws'; }
      }
      return dados;
    } catch (error) {
      throw new HttpException(
        'Erro ao consultar CNPJ na Receita Federal',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  // IMPL-RFB-03/04: API publica do CNPJ.ws (estabelecimento.email). Limite de 3 consultas/minuto por IP.
  // IMPL-RFB-04 (12/11/2026): fila unica (uma consulta por vez, mesmo com sincronizacoes simultaneas),
  // intervalo de 25s e, no 429, espera a liberacao informada pelo CNPJ.ws (ou 60s) e tenta de novo (ate 3x).
  // Falha aqui nao derruba a consulta principal (o e-mail fica vazio).
  private static filaCnpjWs: Promise<any> = Promise.resolve();
  private static ultimaCnpjWs = 0;
  private emailCnpjWs(cnpj: string): Promise<string> {
    const tarefa = () => this.consultarEmailCnpjWs(cnpj);
    const p: Promise<string> = RfbClientService.filaCnpjWs.then(tarefa, tarefa);
    RfbClientService.filaCnpjWs = p.catch(() => undefined);
    return p;
  }
  private async consultarEmailCnpjWs(cnpj: string): Promise<string> {
    const dormir = (ms: number) => new Promise(r => setTimeout(r, ms));
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      const espera = RfbClientService.ultimaCnpjWs + 25000 - Date.now();
      if (espera > 0) await dormir(espera);
      RfbClientService.ultimaCnpjWs = Date.now();
      try {
        const r = await firstValueFrom(this.httpService.get(`https://publica.cnpj.ws/cnpj/${cnpj}`, { timeout: 15000 }));
        return String(r.data?.estabelecimento?.email || '').trim();
      } catch (e: any) {
        const st = e?.response?.status;
        if (st === 429 && tentativa < 3) {
          const det = String(e?.response?.data?.detalhes || '');
          const m = det.match(/em (.+)$/);
          const lib = m ? Date.parse(m[1]) : NaN;
          const ra = Number(e?.response?.headers?.['retry-after']);
          let ms = !isNaN(lib) ? lib - Date.now() + 2000 : ra > 0 ? ra * 1000 : 60000;
          ms = Math.min(Math.max(ms, 30000), 120000);
          console.warn('[IMPL-RFB-04] CNPJ.ws 429 para ' + cnpj + ' - aguardando ' + Math.round(ms / 1000) + 's (tentativa ' + tentativa + '/3)');
          await dormir(ms);
          RfbClientService.ultimaCnpjWs = 0;
          continue;
        }
        console.warn('[IMPL-RFB-04] CNPJ.ws sem e-mail para ' + cnpj + ': ' + (st || e?.message || e));
        return '';
      }
    }
    return '';
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