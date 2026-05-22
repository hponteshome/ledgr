// apps/api/src/modules/hr/services/employee-pdf-parser.service.ts
import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

export interface ParsedDependent {
  code: string; name: string; relationship: string;
  birthDate: string | null; salaryFamily: boolean; irDeduction: boolean;
}

export interface ParsedEmployee {
  registrationNumber: string; fullName: string;
  motherName: string | null; fatherName: string | null; nickname: string | null;
  phone: string | null; cellPhone: string | null;
  street: string | null; neighborhood: string | null; city: string | null;
  addressState: string | null; zipCode: string | null;
  maritalStatus: string | null; raceColor: string | null;
  nationality: string | null; hasDisability: boolean;
  educationLevel: string | null;
  birthDate: string | null; birthCity: string | null; birthState: string | null;
  taxId: string | null; rgNumber: string | null; rgIssuer: string | null;
  rgState: string | null; rgDate: string | null;
  pisNumber: string | null; pisDate: string | null;
  ctpsNumber: string | null; ctpsSeries: string | null; ctpsState: string | null;
  voterTitle: string | null; voterZone: string | null; voterSection: string | null;
  voterDate: string | null; militaryCert: string | null; cnhNumber: string | null;
  hireDate: string | null; experienceDays: number | null;
  role: string | null; salary: number | null; weeklyHours: number | null;
  department: string | null; lotacao: string | null;
  paymentBank: string | null; gfipCategory: string | null;
  gfipOccurrence: string | null; inssOption: string | null;
  employmentBond: string | null; cagedCode: string | null;
  isUnionized: boolean; unionCode: string | null; unionName: string | null;
  bankAgency: string | null; bankAccount: string | null;
  status: string; dependents: ParsedDependent[]; rawText: string;
}

function clean(s: string | undefined | null): string | null {
  if (!s) return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

function parseDate(s: string | undefined | null): string | null {
  if (!s) return null;
  const m = s.trim().match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function parseCpf(s: string | undefined | null): string | null {
  if (!s) return null;
  const d = s.replace(/\D/g, '');
  return d.length >= 11 ? d.substring(0, 11) : null;
}

function parseMarital(s: string | undefined | null): string | null {
  if (!s) return null;
  const map: Record<string, string> = { '1': 'SOLTEIRO', '2': 'CASADO', '3': 'UNIAO_ESTAVEL', '4': 'SEPARADO', '5': 'DIVORCIADO', '6': 'VIUVO' };
  return map[s.trim().split(/[\s-]/)[0]] ?? null;
}

function parseRace(s: string | undefined | null): string | null {
  if (!s) return null;
  const map: Record<string, string> = { 'branca': 'BRANCA', 'preta': 'PRETA', 'parda': 'PARDA', 'amarela': 'AMARELA', 'indigena': 'INDIGENA' };
  return map[s.trim().toLowerCase()] ?? 'NAO_INFORMADO';
}

function parseEdu(s: string | undefined | null): string | null {
  if (!s) return null;
  const map: Record<string, string> = { '1': 'ANALFABETO', '2': 'FUNDAMENTAL_INCOMPLETO', '3': 'FUNDAMENTAL_COMPLETO', '4': 'MEDIO_INCOMPLETO', '5': 'MEDIO_INCOMPLETO', '6': 'MEDIO_INCOMPLETO', '7': 'MEDIO_COMPLETO', '8': 'SUPERIOR_INCOMPLETO', '9': 'SUPERIOR_COMPLETO' };
  return map[s.trim().split(/[\s-]/)[0]] ?? null;
}

function parseRel(s: string): string {
  const map: Record<string, string> = { 'filho': 'FILHO', 'filha': 'FILHA', 'conjuge': 'CONJUGE', 'esposa': 'CONJUGE', 'esposo': 'CONJUGE', 'enteado': 'ENTEADO', 'enteada': 'ENTEADA', 'pai': 'PAI', 'mae': 'MAE' };
  return map[s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')] ?? 'OUTROS';
}

function g(text: string, pattern: RegExp, group = 1): string | null {
  const m = text.match(pattern);
  return m ? clean(m[group]) : null;
}

@Injectable()
export class EmployeePdfParserService {

  async parse(buffer: Buffer): Promise<ParsedEmployee[]> {
    const data = await pdfParse(buffer);
    const fullText = data.text;
    console.log('PDF_SAMPLE:', JSON.stringify(fullText.substring(0, 500)));
    const pages = fullText.split(/(?=Funcion[aá]rio:\s+\d{5})/i);
    const employees: ParsedEmployee[] = [];
    for (const page of pages) {
      if (!page.match(/Funcion[aá]rio:\s+\d{5}/i)) continue;
      employees.push(this.parsePage(page));
    }
    return employees;
  }

  private parsePage(text: string): ParsedEmployee {
    const f = (pattern: RegExp, group = 1) => g(text, pattern, group);

    // Identificação
    const regNum   = f(/Funcion[aá]rio:\s+(\d{5})/i);
    const fullName = f(/Funcion[aá]rio:\s+\d{5}\s*([^\n\r]+)/i);

    // Dados Pessoais
    const fatherName   = f(/Pai:\s*([^\n\r]+)/i);
    const motherName   = f(/M[aã]e:\s*([^\n\r]+)/i);
    const nickname     = f(/Apelido:\s*(.+?)(?:\s{2,}|DDD)/i);
    const phoneRaw     = f(/DDD\/Telefone:\s*\((\d+)\)\s*([\d\s]+)/i);
    const phoneArea    = f(/DDD\/Telefone:\s*\((\d+)\)/i);
    const phoneNum     = f(/DDD\/Telefone:\s*\(\d+\)\s*([\d\s]+?)(?:\s{2,}|\n)/i);
    const fullPhone    = phoneArea && phoneNum && phoneArea !== '000' ? `(${phoneArea}) ${phoneNum.trim()}` : null;
    const street       = f(/Endere[cç]o:\s*(.+?)(?:\s{2,}|DDD\/Celular)/i);
    const neighborhood = f(/Bairro:\s*(.+?)(?:\s{2,}|Cidade)/i);
    const city         = f(/Cidade:\s*(.+?)(?:\s{2,}|CEP)/i);
    const zipCode      = f(/CEP:\s*([\d\.\-]+)/i);
    const addrState    = f(/Estado:\s*([A-Z]{2})(?:\s|$)/i);
    const marital      = f(/Estado Civil:\s*(\d)/i);
    const race         = f(/Ra[cç]a\/Cor:\s*([^\n\r\s].+?)(?:\s{2,}|\n)/i);
    const nationality  = f(/Nacionalidade:\s*(\d+)/i);
    const disability   = /Deficiente:.*\[X\]\s*Sim/i.test(text);
    const education    = f(/Grau de Instru[cç][aã]o:\s*(\d)/i);
    const birthDate    = f(/Data de Nascimento:\s*(\d{2}\/\d{2}\/\d{4})/i);
    const birthCity    = f(/Data de Nascimento:[^\n]*?Cidade:\s*(.+?)(?:\s{2,}|Estado)/i);
    const birthState   = f(/Data de Nascimento:[^\n]*?Estado:\s*([A-Z]{2})/i);

    // Documentação
    const taxId     = f(/CPF\s*:\s*([\d\.\-]+)/i);
    const rgNumber  = f(/Identidade\s*:\s*([\d\.\-\/]+)/i);
    const rgIssuer  = f(/Org[aã]o Emissor\s*:\s*(\w{2,10})(?:\s|$)/i);
    const rgState   = f(/Org[aã]o Emissor[^\n]*?Estado\s*:\s*([A-Z]{2})/i);
    const rgDate    = f(/Emiss[aã]o\s*:\s*(\d{2}\/\d{2}\/\d{4})/i);
    const pisNumber = f(/PIS\/PASEP\s*:\s*([\d\.\-\/]+)/i);
    const pisDate   = f(/Emiss[aã]o PIS\/PASEP\s*:\s*(\d{2}\/\d{2}\/\d{4})/i);
    const ctpsNum   = f(/CTPS\s*:\s*(\d+)/i);
    const ctpsSer   = f(/S[eé]rie\s*:\s*([\w\-]+)/i);
    const vTitle    = f(/T[ií]tulo\s*:\s*(\d+)/i);
    const vZone     = f(/Zona\s*:\s*(\d+)/i);
    const vSection  = f(/Se[cç][aã]o\s*:\s*(\d+)/i);

    // Dados Funcionais
    const hireDate  = f(/Data de Admiss[aã]o:\s*(\d{2}\/\d{2}\/\d{4})/i);
    const expDays   = f(/Dias de Experi[eê]ncia:\s*(\d+)/i);
    const roleRaw   = f(/Fun[cç][aã]o:\s*\d+\s*-\s*(.+?)(?:\s{2,}|Data:)/i);
    const salaryRaw = f(/Sal[aá]rio:\s*([\d\.,]+)/i);
    const hoursRaw  = f(/Horas Semanais:\s*([\d\.,]+)/i);
    const lotacao   = f(/Lota[cç][aã]o:\s*\d+\s*-\s*(.+?)(?:\s{2,}|\d{3}\.)/i);
    const payBank   = f(/Banco Pagamento:\s*(\d+)/i);
    const gfipCat   = f(/Categoria GFIP:\s*(\d+)/i);
    const gfipOcc   = f(/Ocorr[eê]ncia GFIP:\s*(\d+)/i);
    const inssOpt   = f(/Op[cç][aã]o Desconto INSS:\s*(\d)/i);
    const empBond   = f(/V[ií]nculo Empregat[ií]cio:\s*(\d+)/i);
    const caged     = f(/C[oó]digo Admiss[aã]o CAGED:\s*(\d+)/i);
    const unionized = /Sindicalizado:.*\[X\]\s*Sim/i.test(text);
    const unionCode = f(/Sindicato:\s*(\d+)/i);
    const unionName = f(/Sindicato:\s*\d+\s*-\s*(.+?)(?:\n)/i);
    const status    = /Situa[cç][aã]o:\s*Ativo/i.test(text) ? 'active' : 'inactive';

    // Dependentes
    const dependents: ParsedDependent[] = [];
    const depSec = text.match(/Dependentes:([\s\S]*?)(?:Eventos Fixos:|$)/i);
    if (depSec) {
      const lines = depSec[1].trim().split('\n').filter(l => l.trim() && !/^C[oó]digo/.test(l.trim()));
      for (const line of lines) {
        const dm = line.match(/^(\d+)\s+(.+?)\s{2,}(\w+)\s+(\d{2}\/\d{2}\/\d{4})?\s*([SN])\s+([SN])/);
        if (dm) {
          dependents.push({
            code: dm[1], name: dm[2].trim(), relationship: parseRel(dm[3]),
            birthDate: parseDate(dm[4]), salaryFamily: dm[5] === 'S', irDeduction: dm[6] === 'S',
          });
        }
      }
    }

    const salary = salaryRaw ? parseFloat(salaryRaw.replace(/\./g, '').replace(',', '.')) : null;
    const weeklyHours = hoursRaw ? parseFloat(hoursRaw.replace(',', '.')) : null;

    return {
      registrationNumber: regNum ?? '',
      fullName:      clean(fullName) ?? '',
      motherName:    clean(motherName),
      fatherName:    clean(fatherName),
      nickname:      clean(nickname),
      phone:         fullPhone,
      cellPhone:     null,
      street:        clean(street),
      neighborhood:  clean(neighborhood),
      city:          clean(city),
      addressState:  addrState?.toUpperCase() ?? null,
      zipCode:       zipCode ? zipCode.replace(/\D/g,'').replace(/(\d{5})(\d{3})/,'$1-$2') : null,
      maritalStatus: parseMarital(marital),
      raceColor:     parseRace(race),
      nationality:   nationality ?? '10',
      hasDisability: disability,
      educationLevel: parseEdu(education),
      birthDate:     parseDate(birthDate),
      birthCity:     clean(birthCity),
      birthState:    birthState?.toUpperCase() ?? null,
      taxId:         parseCpf(taxId),
      rgNumber:      clean(rgNumber),
      rgIssuer:      clean(rgIssuer),
      rgState:       rgState?.toUpperCase() ?? null,
      rgDate:        parseDate(rgDate),
      pisNumber:     clean(pisNumber),
      pisDate:       parseDate(pisDate),
      ctpsNumber:    clean(ctpsNum),
      ctpsSeries:    clean(ctpsSer),
      ctpsState:     null,
      voterTitle:    clean(vTitle),
      voterZone:     clean(vZone),
      voterSection:  clean(vSection),
      voterDate:     null,
      militaryCert:  null,
      cnhNumber:     null,
      hireDate:      parseDate(hireDate),
      experienceDays: expDays ? parseInt(expDays) : null,
      role:          clean(roleRaw),
      salary,
      weeklyHours,
      department:    null,
      lotacao:       clean(lotacao),
      paymentBank:   clean(payBank),
      gfipCategory:  clean(gfipCat),
      gfipOccurrence: clean(gfipOcc),
      inssOption:    clean(inssOpt),
      employmentBond: clean(empBond),
      cagedCode:     clean(caged),
      isUnionized:   unionized,
      unionCode:     clean(unionCode),
      unionName:     clean(unionName),
      bankAgency:    null,
      bankAccount:   null,
      status,
      dependents,
      rawText:       text,
    };
  }
}
