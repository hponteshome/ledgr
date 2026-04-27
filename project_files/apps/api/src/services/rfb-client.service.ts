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
      
      // Tenta consultar o service-rfb (se existir)
      const rfbUrl = this.configService.get('RFB_SERVICE_URL', 'http://localhost:3002');
      
      const response = await firstValueFrom(
        this.httpService.get(`${rfbUrl}/consulta/cnpj/${cnpj}`).pipe()
      ).catch(() => null);

      if (response?.data?.success) {
        return response.data.data;
      }
      
      // Se falhar, retorna dados MOCK para testes
      return this.getMockData(cnpj);
      
    } catch (error) {
      return this.getMockData(cnpj);
    }
  }

  async consultarCNPJComFallback(cnpj: string): Promise<any> {
    return this.consultarCNPJ(cnpj);
  }

  private getMockData(cnpj: string): any {
    // MOCK de dados da RFB para testes
    return {
      razaoSocial: 'EMPRESA TESTE LTDA',
      nomeFantasia: 'Teste Empresa',
      dataAbertura: '2020-01-01',
      endereco: {
        logradouro: 'Rua Teste',
        numero: '123',
        complemento: '',
        bairro: 'Centro',
        cep: '01234567',
        uf: 'SP',
        municipio: 'São Paulo'
      },
      contato: {
        email: 'teste@empresa.com',
        telefone1: '1133334444',
        telefone2: ''
      },
      capitalSocial: 100000,
      naturezaJuridica: 'Sociedade Empresária Ltda',
      socios: [
        {
          nome: 'Sócio Teste',
          qualificacao: 'Sócio-Administrador',
          dataEntrada: '2020-01-01',
          cpfCnpj: '12345678909'
        }
      ],
      simples: {
        optante: true,
        dataOpcao: '2020-01-01'
      },
      mei: {
        optante: false
      }
    };
  }
}
