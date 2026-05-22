// apps/api/src/modules/hr/services/employee-pdf-parser.service.ts
import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');
export interface ParsedDependent {
  code:         string;
  name:         string;
  relationship: string;
  birthDate:    string | null;
  salaryFamily: boolean;
  irDeduction:  boolean;
}

export interface ParsedEmployee {
  // Pessoais
  registrationNumber: string;
  fullName:      string;
  motherName:    string | null;
  fatherName:    string | null;
  nickname:      string | null;
  phone:         string | null;
  cellPhone:     string | null;
  street:        string | null;
  neighborhood:  string | null;
  city:          string | null;
  addressState:  string | null;
  zipCode:       string | null;
  maritalStatus: string | null;
  raceColor:     string | null;
  nationality:   string | null;
  hasDisability: boolean;
  educationLevel: string | null;
  birthDate:     string | null;
  birthCity:     string | null;
  birthState:    string | null;
  // Documentos
  taxId:       string | null;
  rgNumber:    string | null;
  rgIssuer:    string | null;
  rgState:     string | null;
  rgDate:      string | null;
  pisNumber:   string | null;
  pisDate:     string | null;
  ctpsNumber:  string | null;
  ctpsSeries:  string | null;
  ctpsState:   string | null;
  voterTitle:  string | null;
  voterZone:   string | null;
  voterSection: string | null;
  voterDate:   string | null;
  cnhNumber:   string | null;
  militaryCert: string | null;
  // Funcionais
  hireDate:           string | null;
  experienceDays:     number | null;
  role:               string | null;
  salary:             number | null;
  weeklyHours:        number | null;
  lotacao:            string | null;
  paymentBank:        string | null;
  gfipCategory:       string | null;
  gfipOccurrence:     string | null;
  inssOption:         string | null;
  employmentBond:     string | null;
  cagedCode:          string | null;
  isUnionized:        boolean;
  unionCode:          string | null;
  unionName:          string | null;
  bankAgency:         string | null;
  bankAccount:        string | null;
  status:             string;
  dependents:         ParsedDependent[];
  rawText:            string;
}

function clean(s: string | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

function parseDate(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.trim().match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseCpf(s: string | undefined): string | null {
  if (!s) return null;
  return s.replace(/\D/g, '') || null;
}

function parseMaritalStatus(s: string | undefined): string | null {
  if (!s) return null;
  const map: Record<string, string> = {
    '1': 'SOLTEIRO', '2': 'CASADO', '3': 'UNIAO_ESTAVEL',
    '4': 'SEPARADO', '5': 'DIVORCIADO', '6': 'VIUVO',
  };
  const code = s.trim().split(' ')[0];
  return map[code] ?? clean(s);
}

function parseRaceColor(s: string | undefined): string | null {
  if (!s) return null;
  const map: Record<string, string> = {
    'branca': 'BRANCA', 'preta': 'PRETA', 'parda': 'PARDA',
    'amarela': 'AMARELA', 'indigena': 'INDIGENA',
  };
  return map[s.trim().toLowerCase()] ?? 'NAO_INFORMADO';
}

function parseEducation(s: string | undefined): string | null {
  if (!s) return null;
  const map: Record<string, string> = {
    '1': 'ANALFABETO', '2': 'FUNDAMENTAL_INCOMPLETO', '3': 'FUNDAMENTAL_COMPLETO',
    '4': 'MEDIO_INCOMPLETO', '5': 'MEDIO_INCOMPLETO', '6': 'MEDIO_INCOMPLETO',
    '7': 'MEDIO_COMPLETO', '8': 'SUPERIOR_INCOMPLETO', '9': 'SUPERIOR_COMPLETO',
  };
  const code = s.trim().split(' ')[0];
  return map[code] ?? null;
}

function parseRelationship(s: string): string {
  const map: Record<string, string> = {
    'filho': 'FILHO', 'filha': 'FILHA', 'cônjuge': 'CONJUGE', 'conjuge': 'CONJUGE',
    'esposa': 'CONJUGE', 'esposo': 'CONJUGE', 'enteado': 'ENTEADO', 'enteada': 'ENTEADA',
    'pai': 'PAI', 'mãe': 'MAE', 'mae': 'MAE', 'irmão': 'IRMAO', 'irmã': 'IRMA',
  };
  return map[s.trim().toLowerCase()] ?? 'OUTROS';
}

function extract(text: string, pattern: RegExp, group = 1): string | null {
  const m = text.match(pattern);
  return m ? clean(m[group]) : null;
}

@Injectable()
export class EmployeePdfParserService {

  async parse(buffer: Buffer): Promise<ParsedEmployee[]> {
    const data = await pdfParse(buffer);
    const fullText = data.text;

    // Dividir por funcionário (cada página começa com "Funcionário: NNNNN")
    const pages = fullText.split(/(?=Funcionário:\s+\d{5})/);
    const employees: ParsedEmployee[] = [];

    for (const page of pages) {
      if (!page.match(/Funcionário:\s+\d{5}/)) continue;
      employees.push(this.parsePage(page));
    }

    return employees;
  }

  private parsePage(text: string): ParsedEmployee {
    const g = (pattern: RegExp, group = 1) => extract(text, pattern, group);

    // ── Identificação ─────────────────────────────────────────
    const regNum = g(/Funcionário:\s+(\d{5})/);
    const fullName = g(/Funcionário:\s+\d{5}\s+(.+?)(?:\n|Dados Pessoais)/);

    // ── Dados Pessoais ────────────────────────────────────────
    const motherName  = g(/Mãe:\s*(.+?)(?:\n|Apelido)/i);
    const fatherName  = g(/Pai:\s*(.+?)(?:\n|Mãe)/i);
    const nickname    = g(/Apelido:\s*(.+?)(?:\s{2,}|DDD)/i);
    const phone       = g(/DDD\/Telefone:\s*\((\d{3})\)\s*([\d\s]+)/);
    const phoneArea   = g(/DDD\/Telefone:\s*\((\d{3})\)/);
    const phoneNum    = g(/DDD\/Telefone:\s*\(\d{3}\)\s*([\d\s]+?)(?:\s{2,}|\n)/);
    const fullPhone   = phoneArea && phoneNum ? `(${phoneArea}) ${phoneNum.trim()}` : null;

    const street      = g(/Endereço:\s*(.+?)(?:\s{2,}|DDD\/Celular)/i);
    const neighborhood = g(/Bairro:\s*(.+?)(?:\s{2,}|Cidade)/i);
    const city        = g(/Cidade:\s*(.+?)(?:\s{2,}|CEP)/i);
    const zipCode     = g(/CEP:\s*([\d\.\-]+)/i);
    const addrState   = g(/Estado:\s*([A-Z]{2})(?:\s|$)/i);
    const marital     = g(/Estado Civil:\s*(.+?)(?:\s{2,}|Raça)/i);
    const race        = g(/Raça\/Cor:\s*(.+?)(?:\s{2,}|\n)/i);
    const nationality = g(/Nacionalidade:\s*(.+?)(?:\s{2,}|Deficiente)/i);
    const disability  = /Deficiente:.*\[X\]\s*Sim/i.test(text);
    const education   = g(/Grau de Instrução:\s*(.+?)(?:\n)/i);
    const birthDate   = g(/Data de Nascimento:\s*(\d{2}\/\d{2}\/\d{4})/i);
    const birthCity   = g(/Data de Nascimento:.*?Cidade:\s*(.+?)(?:\s{2,}|Estado)/i);
    const birthState  = g(/Data de Nascimento:.*?Estado:\s*([A-Z]{2})/i);

    // ── Documentação ──────────────────────────────────────────
    const taxId      = g(/CPF\s*:\s*([\d\.\-]+)/i);
    const rgNumber   = g(/Identidade\s*:\s*([\d\.\-\/]+)/i);
    const rgIssuer   = g(/Orgão Emissor\s*:\s*(\w+)/i);
    const rgState    = g(/Orgão Emissor.*?Estado\s*:\s*([A-Z]{2})/i);
    const rgDate     = g(/Emissão\s*:\s*(\d{2}\/\d{2}\/\d{4})/i);
    const pisNumber  = g(/PIS\/PASEP\s*:\s*([\d\.\-\/]+)/i);
    const pisDate    = g(/Emissão PIS\/PASEP\s*:\s*(\d{2}\/\d{2}\/\d{4})/i);
    const ctpsNumber = g(/CTPS\s*:\s*(\d+)/i);
    const ctpsSeries = g(/Série\s*:\s*([\w\-]+)/i);
    const voterTitle = g(/Título\s*:\s*(\d+)/i);
    const voterZone  = g(/Zona\s*:\s*(\d+)/i);
    const voterSection = g(/Seção\s*:\s*(\d+)/i);

    // ── Dados Funcionais ──────────────────────────────────────
    const hireDate    = g(/Data de Admissão:\s*(\d{2}\/\d{2}\/\d{4})/i);
    const expDaysStr  = g(/Dias de Experiência:\s*(\d+)/i);
    const role        = g(/Função:\s*\d+\s*-\s*(.+?)(?:\s{2,}|Data)/i);
    const salaryStr   = g(/Salário:\s*([\d\.,]+)/i);
    const hoursStr    = g(/Horas Semanais:\s*([\d\.,]+)/i);
    const lotacao     = g(/Lotação:\s*\d+\s*-\s*(.+?)(?:\s{2,}|\d{3}\.)/i);
    const paymentBank = g(/Banco Pagamento:\s*(\d+)/i);
    const gfipCat     = g(/Categoria GFIP:\s*(.+?)(?:\n)/i);
    const gfipOcc     = g(/Ocorrência GFIP:\s*(.+?)(?:\n)/i);
    const inssOpt     = g(/Opção Desconto INSS:\s*(\d)/i);
    const empBond     = g(/Vínculo Empregatício:\s*(.+?)(?:\n)/i);
    const cagedCode   = g(/Código Admissão CAGED:\s*(\d+)/i);
    const isUnionized = /Sindicalizado:.*\[X\]\s*Sim/i.test(text);
    const unionMatch  = g(/Sindicato:\s*(\d+)\s*-\s*(.+?)(?:\n)/i);
    const unionCode   = g(/Sindicato:\s*(\d+)/i);
    const unionName   = g(/Sindicato:\s*\d+\s*-\s*(.+?)(?:\n)/i);
    const status      = /Situação:\s*Ativo/i.test(text) ? 'active' : 'inactive';

    // ── Dependentes ───────────────────────────────────────────
    const dependents: ParsedDependent[] = [];
    const depSection = text.match(/Dependentes:([\s\S]*?)(?:Eventos Fixos:|$)/i);
    if (depSection) {
      const depLines = depSection[1].trim().split('\n').filter(l => l.trim());
      for (const line of depLines) {
        const dm = line.match(/(\d+)\s+(.+?)\s{2,}(\w+)\s+(\d{2}\/\d{2}\/\d{4})?\s*([SN])\s+([SN])/);
        if (dm) {
          dependents.push({
            code:         dm[1],
            name:         dm[2].trim(),
            relationship: parseRelationship(dm[3]),
            birthDate:    parseDate(dm[4]),
            salaryFamily: dm[5] === 'S',
            irDeduction:  dm[6] === 'S',
          });
        }
      }
    }

    // ── Normalizar salário ────────────────────────────────────
    const salary = salaryStr
      ? parseFloat(salaryStr.replace(/\./g, '').replace(',', '.'))
      : null;
    const weeklyHours = hoursStr
      ? parseFloat(hoursStr.replace(',', '.'))
      : null;

    return {
      registrationNumber: regNum ?? '',
      fullName:     clean(fullName) ?? '',
      motherName:   clean(motherName),
      fatherName:   clean(fatherName),
      nickname:     clean(nickname),
      phone:        fullPhone,
      cellPhone:    null,
      street:       clean(street),
      neighborhood: clean(neighborhood),
      city:         clean(city),
      addressState: addrState ? addrState.toUpperCase() : null,
      zipCode:      zipCode ? zipCode.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2') : null,
      maritalStatus: parseMaritalStatus(marital),
      raceColor:    parseRaceColor(race),
      nationality:  nationality ? nationality.trim().split(' ')[0] : '10',
      hasDisability: disability,
      educationLevel: parseEducation(education),
      birthDate:    parseDate(birthDate),
      birthCity:    clean(birthCity),
      birthState:   birthState ? birthState.toUpperCase() : null,
      taxId:        parseCpf(taxId),
      rgNumber:     clean(rgNumber),
      rgIssuer:     clean(rgIssuer),
      rgState:      rgState ? rgState.toUpperCase() : null,
      rgDate:       parseDate(rgDate),
      pisNumber:    clean(pisNumber),
      pisDate:      parseDate(pisDate),
      ctpsNumber:   clean(ctpsNumber),
      ctpsSeries:   clean(ctpsSeries),
      ctpsState:    null,
      voterTitle:   clean(voterTitle),
      voterZone:    clean(voterZone),
      voterSection: clean(voterSection),
      voterDate:    null,
      cnhNumber:    null,
      militaryCert: null,
      hireDate:     parseDate(hireDate),
      experienceDays: expDaysStr ? parseInt(expDaysStr) : null,
      role:         clean(role),
      salary,
      weeklyHours,
      lotacao:      clean(lotacao),
      paymentBank:  clean(paymentBank),
      gfipCategory: gfipCat ? gfipCat.trim().split(' ')[0] : null,
      gfipOccurrence: gfipOcc ? gfipOcc.trim().split(' ')[0] : null,
      inssOption:   clean(inssOpt),
      employmentBond: empBond ? empBond.trim().split(' ')[0] : null,
      cagedCode:    clean(cagedCode),
      isUnionized,
      unionCode:    clean(unionCode),
      unionName:    clean(unionName),
      bankAgency:   null,
      bankAccount:  null,
      status,
      dependents,
      rawText:      text,
    };
  }
}
