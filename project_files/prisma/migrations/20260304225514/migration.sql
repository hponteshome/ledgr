-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document" VARCHAR NOT NULL,
    "document_type" VARCHAR NOT NULL,
    "email" VARCHAR NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR NOT NULL,
    "nick" VARCHAR,
    "birth_date" TIMESTAMP(6),
    "telefone" VARCHAR,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_email_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "documentoConfirmado" BOOLEAN NOT NULL DEFAULT false,
    "doisFatoresSegredo" VARCHAR,
    "two_factor_active" BOOLEAN NOT NULL DEFAULT false,
    "ultimoAcesso" TIMESTAMP(6),
    "tentativasFalhas" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" TIMESTAMP(6),
    "refresh_token" VARCHAR,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "perfil_id" UUID,
    "deleted_at" TIMESTAMP(6),
    "status" VARCHAR NOT NULL DEFAULT 'ativo',

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tax_id" VARCHAR(14) NOT NULL,
    "legal_name" VARCHAR NOT NULL,
    "trade_name" VARCHAR,
    "isSede" BOOLEAN NOT NULL DEFAULT false,
    "dataAbertura" DATE NOT NULL,
    "street" VARCHAR NOT NULL,
    "number" VARCHAR NOT NULL,
    "complemento" VARCHAR,
    "neighborhood" VARCHAR NOT NULL,
    "zip_code" VARCHAR(8) NOT NULL,
    "state" VARCHAR(2) NOT NULL,
    "city" VARCHAR NOT NULL,
    "email" VARCHAR,
    "telefone1" VARCHAR,
    "telefone2" VARCHAR,
    "capital_social" DECIMAL(15,2) NOT NULL,
    "legal_nature" VARCHAR NOT NULL,
    "porte" VARCHAR NOT NULL,
    "tax_regime" VARCHAR NOT NULL,
    "situacao" VARCHAR NOT NULL,
    "dataSituacao" DATE NOT NULL,
    "simples" JSON,
    "mei" JSON,
    "last_rfb_sync" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "socios" JSONB,
    "type" VARCHAR DEFAULT 'CLIENT',

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_empresas" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "usuario_id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "role" VARCHAR DEFAULT 'ADMIN',

    CONSTRAINT "usuario_empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" VARCHAR,
    "permissions" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perfis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UQ_604e2077971f192d85cffb5c437" ON "usuarios"("document");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_446adfc18b35418aac32ae0b7b5" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_f5ed71aeb4ef47f95df5f8830b8" ON "empresas"("tax_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_empresas_unique" ON "usuario_empresas"("usuario_id", "empresa_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "FK_ca703457be468790bd9bbacd313" FOREIGN KEY ("perfil_id") REFERENCES "perfis"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario_empresas" ADD CONSTRAINT "usuario_empresas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario_empresas" ADD CONSTRAINT "usuario_empresas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
