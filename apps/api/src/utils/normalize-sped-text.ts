// apps/api/src/utils/normalize-sped-text.ts
/**
 * Normaliza texto para gravação segura em arquivo SPED (ISO-8859-1/latin1).
 *
 * Buffer.from(str, 'latin1') no Node NÃO lança erro para caracteres fora de
 * 0x00-0xFF - ele trunca o code point pro byte baixo silenciosamente (ex:
 * U+2019 "'" vira byte 0x19, um controle invisível). Isso corrompe o arquivo
 * sem nenhum aviso, geralmente vindo de texto colado do Word/Google Docs
 * (aspas curvas, travessão longo, reticências como caractere único, espaço
 * não separável).
 *
 * Estratégia: NFC primeiro (letras acentuadas do português - á, ã, ç, é etc.
 * - já são um único code point <= 0xFF em NFC, exatamente o range do
 * Latin-1 Supplement, então passam intactas). Para o que sobrar fora desse
 * range, fallback via NFD (decompõe em base + marca combinante) e remoção
 * das marcas combinantes - preserva o caractere base quando possível, nunca
 * deixa passar um code point > 0xFF pro Buffer.
 */
const SMART_PUNCTUATION: Record<string, string> = {
  '‘': "'", '’': "'", // aspas simples curvas
  '“': '"', '”': '"', // aspas duplas curvas
  '–': '-', '—': '-', // en-dash, em-dash
  '…': '...',              // reticências (1 caractere)
  ' ': ' ',                // espaço não separável
};

const COMBINING_MARKS = /[̀-ͯ]/g;

export function normSpedText(input: string | null | undefined): string {
  if (!input) return '';
  let out = '';
  for (const ch of input.normalize('NFC')) {
    if (SMART_PUNCTUATION[ch]) { out += SMART_PUNCTUATION[ch]; continue; }
    const code = ch.codePointAt(0)!;
    if (code <= 0xFF) { out += ch; continue; }
    const decomposed = ch.normalize('NFD').replace(COMBINING_MARKS, '');
    for (const dch of decomposed) {
      if (dch.codePointAt(0)! <= 0xFF) out += dch;
    }
  }
  return out;
}
