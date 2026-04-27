# LEDGR — Certificado Digital: Guia de Implantação Fase 1.1

## 1. Instalar dependências no backend

```bash
cd D:\Projetos\Ledgr
npm install --prefix apps/api node-forge @peculiar/x509
```

> As demais dependências (`node-signpdf`, `pdf-lib`, `xml-crypto`) são instaladas nas fases 1.2 e 1.4.

---

## 2. Adicionar ao schema.prisma

Copiar o bloco abaixo **antes** do fechamento do arquivo (antes do último `}`):

```prisma
model Certificate {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  companyId    String   @map("company_id") @db.Uuid
  alias        String   @map("alias") @db.VarChar
  type         String   @map("type") @db.VarChar
  usage        String[] @map("usage")
  encryptedKey String   @map("encrypted_key") @db.Text
  certificate  String   @map("certificate") @db.Text
  subject      String   @map("subject") @db.VarChar
  issuer       String   @map("issuer") @db.VarChar
  serialNumber String   @map("serial_number") @db.VarChar
  validFrom    DateTime @map("valid_from") @db.Timestamp(6)
  validTo      DateTime @map("valid_to") @db.Timestamp(6)
  fingerprint  String   @map("fingerprint") @db.VarChar(64)
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt    DateTime @default(now()) @map("updated_at") @db.Timestamp(6)

  company      Company  @relation(fields: [companyId], references: [id])

  @@index([companyId, isActive])
  @@index([validTo])
  @@map("certificates")
}
```

Em `model Company`, adicionar a relation:
```prisma
certificates Certificate[]
```

---

## 3. Rodar a migration

```powershell
# Na raiz do monorepo
npx prisma migrate dev --name add_certificates
```

---

## 4. Adicionar variável de ambiente

No arquivo `.env` (raiz ou `apps/api/.env`):

```env
# Gerar com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
LEDGR_MASTER_KEY=<64 caracteres hex>

# Alertas de certificado
CERT_EXPIRY_WARN_DAYS=30
CERT_EXPIRY_CRON="0 7 * * *"
```

**IMPORTANTE:** A LEDGR_MASTER_KEY protege TODAS as chaves privadas.
Nunca commitar no git. Armazenar em gerenciador de secrets em produção.

---

## 5. Copiar arquivos do módulo

```
apps/api/src/core/certificates/
├── crypto.service.ts             ← CryptoService (AES-256-GCM)
├── signing.service.ts            ← SigningService (parse .p12, hash, assinar)
├── certificates.service.ts       ← CertificatesService (CRUD + cron)
├── certificates.controller.ts    ← REST endpoints
├── certificates.module.ts        ← Módulo NestJS
└── dto/
    └── certificates.dto.ts       ← DTOs
```

```
frontend/src/pages/documents/
├── CertificatesPage.tsx          ← Listagem com badges
└── CertificateImportModal.tsx    ← Modal upload + preview

frontend/src/components/
└── SignaturePanel.tsx             ← Painel inline nos documentos
```

---

## 6. Registrar no AppModule

```typescript
// apps/api/src/app.module.ts
import { CertificatesModule } from './core/certificates/certificates.module';

@Module({
  imports: [
    // ...módulos existentes...
    CertificatesModule,
  ],
})
export class AppModule {}
```

---

## 7. Atualizar DocumentsModule

```typescript
// apps/api/src/core/documents/documents.module.ts
import { CertificatesModule } from '../certificates/certificates.module';

@Module({
  imports: [PrismaModule, CertificatesModule],
  // ...
})
export class DocumentsModule {}
```

E aplicar o patch em `documents.service.ts` conforme `PATCH_documents.service.md`.

---

## 8. Atualizar rotas frontend

O `index.tsx` já tem a rota `/app/documents/signatures/certificates` apontando para `CertificateManager`.
Substituir o import:

```typescript
// Antes:
import { CertificateManager } from '../pages/documents';

// Depois (ou atualizar o barrel export em pages/documents/index.ts):
import { CertificatesPage } from '../pages/documents/CertificatesPage';
```

E na rota:
```tsx
<Route path="app/documents/signatures/certificates" element={
  <ProtectedRoute><CertificatesPage /></ProtectedRoute>
} />
```

---

## 9. Integrar SignaturePanel nos documentos existentes

Em `ContratoView.tsx`, `AgeView.tsx`, `StatuteView.tsx` — adicionar no rodapé:

```tsx
import { SignaturePanel } from '../../components/SignaturePanel';

// No return, após o conteúdo do documento:
<SignaturePanel documentId={docId} onSigned={reloadDocument} />
```

---

## Endpoints disponíveis após a implantação

| Método | Endpoint                      | Descrição                              |
|--------|-------------------------------|----------------------------------------|
| GET    | /certificates                 | Listar certificados da empresa         |
| GET    | /certificates/:id             | Buscar um certificado                  |
| POST   | /certificates/preview         | Parse .p12 sem salvar (preview)        |
| POST   | /certificates/import          | Importar certificado                   |
| PATCH  | /certificates/:id             | Atualizar alias/uso/status             |
| DELETE | /certificates/:id             | Desativar (soft delete)                |
| POST   | /certificates/:id/evict       | Remover chave do cache em memória      |
| POST   | /documents/:id/sign           | Assinar documento (com certId no body) |

---

## Próxima fase: 1.2 — Assinatura PAdES real em PDF

Após validar a fase 1.1, instalar:
```bash
npm install --prefix apps/api node-signpdf pdf-lib
```
E implementar `SigningService.signPdf()` completo com integração ao Puppeteer/MinIO.
