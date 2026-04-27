-- 1. Renomear Tabela de Usuários e Colunas
ALTER TABLE public.usuarios RENAME TO users;
ALTER TABLE public.users RENAME COLUMN "nomeCompleto" TO full_name;
ALTER TABLE public.users RENAME COLUMN "senhaHash" TO password_hash;
ALTER TABLE public.users RENAME COLUMN "tipoDocumento" TO document_type;
ALTER TABLE public.users RENAME COLUMN documento TO document;
ALTER TABLE public.users RENAME COLUMN "dataNascimento" TO birth_date;
ALTER TABLE public.users RENAME COLUMN ativo TO is_active;
ALTER TABLE public.users RENAME COLUMN "emailConfirmado" TO is_email_confirmed;
ALTER TABLE public.users RENAME COLUMN "doisFatoresAtivo" TO two_factor_active;
ALTER TABLE public.users RENAME COLUMN "refreshToken" TO refresh_token;
ALTER TABLE public.users RENAME COLUMN "criadoEm" TO created_at;
ALTER TABLE public.users RENAME COLUMN "atualizadoEm" TO updated_at;

-- 2. Renomear Tabela de Empresas (Tenants) e Colunas
ALTER TABLE public.empresas RENAME TO tenants;
ALTER TABLE public.tenants RENAME COLUMN cnpj TO tax_id;
ALTER TABLE public.tenants RENAME COLUMN "razaoSocial" TO legal_name;
ALTER TABLE public.tenants RENAME COLUMN "nomeFantasia" TO trade_name;
ALTER TABLE public.tenants RENAME COLUMN logradouro TO street;
ALTER TABLE public.tenants RENAME COLUMN numero TO number;
ALTER TABLE public.tenants RENAME COLUMN bairro TO neighborhood;
ALTER TABLE public.tenants RENAME COLUMN cep TO zip_code;
ALTER TABLE public.tenants RENAME COLUMN municipio TO city;
ALTER TABLE public.tenants RENAME COLUMN uf TO state;
ALTER TABLE public.tenants RENAME COLUMN "regimeTributario" TO tax_regime;
ALTER TABLE public.tenants RENAME COLUMN "naturezaJuridica" TO legal_nature;
ALTER TABLE public.tenants RENAME COLUMN "capitalSocial" TO capital_social;
ALTER TABLE public.tenants RENAME COLUMN "ultimaConsultaRFB" TO last_rfb_sync;
ALTER TABLE public.tenants RENAME COLUMN "criadoEm" TO created_at;
ALTER TABLE public.tenants RENAME COLUMN "atualizadoEm" TO updated_at;

-- Adicionar coluna de tipo (Default CLIENT para empresas existentes)
ALTER TABLE public.tenants ADD COLUMN type VARCHAR DEFAULT 'CLIENT';

-- 3. Criar a Tabela de Junção (Multi-tenancy)
CREATE TABLE public.user_tenants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    role VARCHAR DEFAULT 'ADMIN',
    CONSTRAINT user_tenants_unique UNIQUE (user_id, tenant_id)
);

-- 4. Migrar Relacionamentos Existentes
-- Vincula cada empresa ao usuário que a criou originalmente (campo criadoPor)
INSERT INTO public.user_tenants (user_id, tenant_id, role)
SELECT CAST("criadoPor" AS uuid), id, 'ADMIN'
FROM public.tenants
WHERE "criadoPor" IS NOT NULL;

-- 5. Limpeza de colunas legadas que não usaremos no novo Schema
ALTER TABLE public.tenants DROP COLUMN "cnpjRaiz", DROP COLUMN "cnpjFilial", DROP COLUMN "cnpjDigitos", DROP COLUMN "criadoPor";