// src/pages/companies/corporate/statute/types.ts
export interface Statute {
  id: string;
  companyId: string;
  companyName?: string;
  version: number;
  approvalDate: string;
  registrationDate?: string;
  registrationNumber?: string;
  notaryOffice?: string;
  status: 'draft' | 'approved' | 'registered' | 'archived';
  chapters: Chapter[];
  amendments?: Amendment[];
  consolidatedText?: string;
  fileUrl?: string;
  createdAt: string;
  updatedAt: string;
}
export interface Age {
  id: string;
  companyId: string;
  companyName?: string;
  version: number;
  approvalDate: string;
  registrationDate?: string;
  registrationNumber?: string;
  notaryOffice?: string;
  status: 'draft' | 'approved' | 'registered' | 'archived';
  chapters: Chapter[];
  amendments?: Amendment[];
  consolidatedText?: string;
  fileUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  articles: Article[];
}

export interface Article {
  id: string;
  number: number;
  title?: string;
  content: string;
  paragraphs?: Paragraph[];
}

export interface Paragraph {
  id: string;
  number: string; // Pode ser "1", "1º", "2-A", etc.
  content: string;
  items?: string[]; // Para incisos
}

export interface Amendment {
  id: string;
  version: number;
  date: string;
  description: string;
  approvedBy: string; // Ata ou assembleia que aprovou
  articles: string[]; // IDs dos artigos alterados
  before?: string;
  after?: string;
}