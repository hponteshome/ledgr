import { Injectable } from '@nestjs/common';

@Injectable()
export class RfbMockService {
  async consultarCNPJ(cnpj: string): Promise<any> {
    return {
      success: true,
      data: {
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
      }
    };
  }

  async consultarCNPJComFallback(cnpj: string): Promise<any> {
    return this.consultarCNPJ(cnpj);
  }
}
