// src/pages/users/User.ts
export interface User {
  id: string;
  name: string;           // ← backend usa 'name' no UserDto
  nickname?: string;
  email: string;
  document: string;        // ← backend usa 'document'
  documentType: 'CPF' | 'PASSPORT' | 'RNE'; // ← backend usa DocumentType
  phone?: string;          // ← backend tem phone
  isActive: boolean;       // ← backend usa isActive
  status: 'active' | 'inactive' | 'blocked' | 'deleted';
  level?: string;
  profile?: {
    id: string;
    name: string;
    permissions?: any;
  };
  createdAt?: string;
  updatedAt?: string;
  lastAccess?: string;
  emailConfirmed?: boolean;
  documentConfirmed?: boolean;
  twoFactorActive?: boolean;
}