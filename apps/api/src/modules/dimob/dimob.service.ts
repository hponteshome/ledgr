// apps/api/src/modules/dimob/dimob.service.ts
// LEDGR - DIMOB (18/11/2026): conferencia e arquivo de importacao do PGD a partir dos titulos de aluguel recebidos.
// Regras: fonte = ar_entries de aluguel (RECEIVED) ligados a contrato, por competence_month (mes do recebimento; contrato com
// imobiliaria = mes do comprovante da imobiliaria); aluguel = amount, comissao = commission_amount, imposto = withheld_tax_amount.
// Imovel no exterior fica fora (R02 so comporta imovel no Brasil). Generico: serve para qualquer empresa locadora.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DimobDeclarante, DimobLocacao, arquivo, ascii, digits, docValido, cpfValido } from './dimob-layout';

type Aviso = { nivel: 'ERRO' | 'ALERTA'; contrato?: string; texto: string };

@Injectable()
export class DimobService {
  constructor(private readonly prisma: PrismaService) {}

  private async municipios() {
    const rows: any[] = await this.prisma.$queryRawUnsafe(`SELECT uf, codigo, nome, cep_faixas FROM dimob_municipios`);
    return rows.map(r => ({
      uf: String(r.uf), codigo: String(r.codigo), nome: ascii(r.nome),
      faixas: [...String(r.cep_faixas ?? '').matchAll(/(\d{8})\s*-\s*(\d{8})/g)].map(m => [m[1], m[2]] as [string, string]),
    }));
  }

  private codMunicipio(tab: { uf: string; codigo: string; nome: string; faixas: [string, string][] }[], uf: string, cep: string, cidade: string) {
    const c = digits(cep).padStart(8, '0');
    const porCep = tab.find(t => t.uf === uf && t.faixas.some(([a, b]) => c >= a && c <= b));
    if (porCep) return porCep.codigo;
    const n = ascii(cidade);
    const porNome = tab.filter(t => t.uf === uf && t.nome === n);
    return porNome.length === 1 ? porNome[0].codigo : null;
  }

  async montar(companyId: string, ano: number, cpfResponsavel: string) {
    if (!companyId) throw new BadRequestException('Empresa nao informada.');
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new BadRequestException('Ano-calendario invalido.');
    const avisos: Aviso[] = [];
    const [emp]: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT tax_id, legal_name, street, number, complement, neighborhood, zip_code, state, city FROM companies WHERE id = $1::uuid`, companyId);
    if (!emp) throw new NotFoundException('Empresa nao encontrada.');
    const tab = await this.municipios();

    const munEmp = this.codMunicipio(tab, String(emp.state ?? ''), emp.zip_code, emp.city);
    if (!munEmp) avisos.push({ nivel: 'ERRO', texto: `Municipio da empresa sem codigo RFB (CEP ${emp.zip_code}, ${emp.city}/${emp.state}).` });
    const cpfResp = digits(cpfResponsavel);
    if (!cpfValido(cpfResp)) avisos.push({ nivel: 'ERRO', texto: 'CPF do responsavel perante a RFB invalido ou nao informado.' });

    const declarante: DimobDeclarante = {
      cnpj: digits(emp.tax_id), ano, nome: emp.legal_name, cpfResponsavel: cpfResp,
      endereco: [emp.street, emp.number, emp.complement, emp.neighborhood].filter(Boolean).join(', '),
      uf: String(emp.state ?? ''), municipio: munEmp ?? '',
    };

    const linhas: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT rc.id AS contrato_id, rc.contract_number, rc.tenant_name, rc.tenant_tax_id, rc.start_date, rc.instrument_date,
             fa.internal_code, fa.street, fa.number, fa.complement, fa.neighborhood, fa.zip_code, fa.state, fa.city, fa.country,
             a.competence_month, sum(a.amount)::float8 AS aluguel, sum(a.commission_amount)::float8 AS comissao,
             sum(a.withheld_tax_amount)::float8 AS imposto, count(*)::int AS titulos
      FROM ar_entries a
      JOIN rental_contracts rc ON rc.id = a.rental_contract_id AND rc.deleted_at IS NULL
      JOIN fixed_assets fa ON fa.id = rc.fixed_asset_id
      WHERE a.company_id = $1::uuid AND a.deleted_at IS NULL AND a.status::text = 'RECEIVED' AND a.origin::text = 'ALUGUEL'
        AND left(a.competence_month, 4) = $2
      GROUP BY rc.id, rc.contract_number, rc.tenant_name, rc.tenant_tax_id, rc.start_date, rc.instrument_date,
               fa.internal_code, fa.street, fa.number, fa.complement, fa.neighborhood, fa.zip_code, fa.state, fa.city, fa.country, a.competence_month
      ORDER BY coalesce(rc.instrument_date, rc.start_date), rc.contract_number, a.competence_month`, companyId, String(ano));

    const porContrato = new Map<string, any>();
    for (const l of linhas) {
      if (!porContrato.has(l.contrato_id)) porContrato.set(l.contrato_id, { ...l, meses: Array.from({ length: 12 }, () => ({ aluguel: 0, comissao: 0, imposto: 0 })), titulos: 0 });
      const c = porContrato.get(l.contrato_id);
      const m = Number(String(l.competence_month).slice(5, 7)) - 1;
      c.meses[m].aluguel += l.aluguel; c.meses[m].comissao += l.comissao; c.meses[m].imposto += l.imposto; c.titulos += l.titulos;
    }

    const locacoes: (DimobLocacao & { imovel: string; contratoLedgr: string; total: { aluguel: number; comissao: number; imposto: number } })[] = [];
    const exterior: { contrato: string; imovel: string; aluguel: number }[] = [];
    let seqInterno = 0;
    for (const c of porContrato.values()) {
      const contratoLedgr = c.contract_number ?? 's/n';
      const total = c.meses.reduce((s: any, m: any) => ({ aluguel: s.aluguel + m.aluguel, comissao: s.comissao + m.comissao, imposto: s.imposto + m.imposto }), { aluguel: 0, comissao: 0, imposto: 0 });
      const pais = ascii(c.country ?? '');
      const noBrasil = (!pais || pais.startsWith('BRASIL') || pais === 'BR') && digits(c.zip_code).length === 8 && /^[A-Z]{2}$/.test(String(c.state ?? ''));
      if (!noBrasil) { exterior.push({ contrato: contratoLedgr, imovel: c.internal_code, aluguel: total.aluguel }); continue; }
      const numero = /^\d{1,6}$/.test(String(c.contract_number ?? '')) ? String(c.contract_number) : String(900000 + ++seqInterno);
      if (numero !== c.contract_number) avisos.push({ nivel: 'ALERTA', contrato: contratoLedgr, texto: `Numero do contrato com mais de 6 posicoes: informado como ${numero} na DIMOB.` });
      const dataIso = c.instrument_date ?? c.start_date;
      const data = dataIso ? new Date(dataIso).toISOString().slice(0, 10) : null;
      if (!data) avisos.push({ nivel: 'ERRO', contrato: contratoLedgr, texto: 'Contrato sem data.' });
      else if (+data.slice(0, 4) < 1950 || +data.slice(0, 4) > ano) avisos.push({ nivel: 'ERRO', contrato: contratoLedgr, texto: `Data do contrato ${data} fora do intervalo 1950-${ano}.` });
      if (!c.instrument_date) avisos.push({ nivel: 'ALERTA', contrato: contratoLedgr, texto: 'Sem data do instrumento: usada a data de inicio da vigencia.' });
      if (!docValido(c.tenant_tax_id)) avisos.push({ nivel: 'ERRO', contrato: contratoLedgr, texto: `CPF/CNPJ do locatario invalido ou ausente (${c.tenant_tax_id ?? '-'}).` });
      const mun = this.codMunicipio(tab, String(c.state), c.zip_code, c.city);
      if (!mun) avisos.push({ nivel: 'ERRO', contrato: contratoLedgr, texto: `Imovel sem codigo de municipio RFB (CEP ${c.zip_code}, ${c.city}/${c.state}).` });
      if (total.aluguel <= 0) avisos.push({ nivel: 'ALERTA', contrato: contratoLedgr, texto: 'Contrato sem aluguel no ano.' });
      locacoes.push({
        contratoId: c.contrato_id, numero, dataContrato: data, contratoLedgr, imovel: c.internal_code,
        locadorDoc: declarante.cnpj, locadorNome: declarante.nome, locatarioDoc: digits(c.tenant_tax_id), locatarioNome: c.tenant_name,
        tipo: 'U', endereco: [[c.street, c.number].filter(Boolean).join(', '), c.complement, c.neighborhood].filter(Boolean).join(' - '),
        cep: digits(c.zip_code), municipio: mun, uf: String(c.state), meses: c.meses.map((m: any) => ({
          aluguel: Math.round(m.aluguel * 100) / 100, comissao: Math.round(m.comissao * 100) / 100, imposto: Math.round(m.imposto * 100) / 100 })),
        total: { aluguel: Math.round(total.aluguel * 100) / 100, comissao: Math.round(total.comissao * 100) / 100, imposto: Math.round(total.imposto * 100) / 100 },
      });
    }
    const totais = locacoes.reduce((s, l) => ({ aluguel: s.aluguel + l.total.aluguel, comissao: s.comissao + l.total.comissao, imposto: s.imposto + l.total.imposto }), { aluguel: 0, comissao: 0, imposto: 0 });
    return { declarante, locacoes, exterior, avisos, totais: { aluguel: Math.round(totais.aluguel * 100) / 100, comissao: Math.round(totais.comissao * 100) / 100, imposto: Math.round(totais.imposto * 100) / 100 } };
  }

  async conferencia(companyId: string, ano: number, cpfResponsavel: string) {
    return this.montar(companyId, ano, cpfResponsavel);
  }

  async gerarArquivo(companyId: string, ano: number, cpfResponsavel: string) {
    const m = await this.montar(companyId, ano, cpfResponsavel);
    const erros = m.avisos.filter(a => a.nivel === 'ERRO');
    if (erros.length) throw new BadRequestException('Corrija antes de gerar: ' + erros.map(e => (e.contrato ? e.contrato + ': ' : '') + e.texto).join(' | '));
    if (!m.locacoes.length) throw new BadRequestException(`Nenhum aluguel recebido em ${ano} para declarar.`);
    return { nome: `${m.declarante.cnpj}-DIMOB-${ano}.txt`, conteudo: arquivo(m.declarante, m.locacoes) };
  }
}
