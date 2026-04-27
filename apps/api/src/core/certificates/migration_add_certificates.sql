-- ================================================================
-- LEDGR — Migration: add_certificates
-- Executar: npx prisma migrate dev --name add_certificates
-- (O Prisma vai gerar o SQL automaticamente a partir do schema.
--  Este arquivo é a referência SQL manual para revisão.)
-- ================================================================

CREATE TABLE "certificates" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "company_id"     UUID         NOT NULL,
  "alias"          VARCHAR      NOT NULL,          -- ex: "e-CNPJ A1 — Receita Federal"
  "type"           VARCHAR      NOT NULL,          -- "A1" | "A3" | "GOVBR"
  "usage"          TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],  -- ["SIGNING","TRANSMISSION"]

  -- Chave privada cifrada (AES-256-GCM)
  -- Formato: base64(iv):base64(authTag):base64(ciphertext)
  "encrypted_key"  TEXT         NOT NULL,

  -- Certificado público — cadeia completa PEM
  "certificate"    TEXT         NOT NULL,

  -- Metadados extraídos na importação
  "subject"        VARCHAR      NOT NULL,          -- CN do titular
  "issuer"         VARCHAR      NOT NULL,          -- AC emissora
  "serial_number"  VARCHAR      NOT NULL,
  "valid_from"     TIMESTAMP(6) NOT NULL,
  "valid_to"       TIMESTAMP(6) NOT NULL,
  "fingerprint"    VARCHAR(64)  NOT NULL,          -- SHA-256 hex do cert DER

  "is_active"      BOOLEAN      NOT NULL DEFAULT true,
  "created_at"     TIMESTAMP(6) NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMP(6) NOT NULL DEFAULT now(),

  CONSTRAINT "certificates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "certificates_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT
);

CREATE INDEX "certificates_company_id_is_active_idx"  ON "certificates"("company_id", "is_active");
CREATE INDEX "certificates_valid_to_idx"              ON "certificates"("valid_to");   -- alertas expiração

-- ================================================================
-- Acrescentar ao schema.prisma (model Certificate):
-- ================================================================
-- model Certificate {
--   id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
--   companyId    String   @map("company_id") @db.Uuid
--   alias        String   @map("alias") @db.VarChar
--   type         String   @map("type") @db.VarChar
--   usage        String[] @map("usage")
--   encryptedKey String   @map("encrypted_key") @db.Text
--   certificate  String   @map("certificate") @db.Text
--   subject      String   @map("subject") @db.VarChar
--   issuer       String   @map("issuer") @db.VarChar
--   serialNumber String   @map("serial_number") @db.VarChar
--   validFrom    DateTime @map("valid_from") @db.Timestamp(6)
--   validTo      DateTime @map("valid_to") @db.Timestamp(6)
--   fingerprint  String   @map("fingerprint") @db.VarChar(64)
--   isActive     Boolean  @default(true) @map("is_active")
--   createdAt    DateTime @default(now()) @map("created_at") @db.Timestamp(6)
--   updatedAt    DateTime @default(now()) @map("updated_at") @db.Timestamp(6)
--
--   company      Company  @relation(fields: [companyId], references: [id])
--
--   @@index([companyId, isActive])
--   @@index([validTo])
--   @@map("certificates")
-- }
--
-- Em model Company adicionar:
--   certificates Certificate[]
