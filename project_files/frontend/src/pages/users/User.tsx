export interface User {
  id: string;
  name: string;
  nickname?: string; // Variable for future use
  document: string;
  documentType: 'CPF' | 'CNPJ';
  email: string;
  status: 'active' | 'inactive';
  role: {
    id: string;
    name: string;
  };
}