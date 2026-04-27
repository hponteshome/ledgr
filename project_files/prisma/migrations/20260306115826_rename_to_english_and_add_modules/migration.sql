/*
  Warnings:

  - You are about to drop the `empresas` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `perfis` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `usuario_empresas` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `usuarios` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "usuario_empresas" DROP CONSTRAINT "usuario_empresas_empresa_id_fkey";

-- DropForeignKey
ALTER TABLE "usuario_empresas" DROP CONSTRAINT "usuario_empresas_usuario_id_fkey";

-- DropForeignKey
ALTER TABLE "usuarios" DROP CONSTRAINT "FK_ca703457be468790bd9bbacd313";

-- DropTable
DROP TABLE "empresas";

-- DropTable
DROP TABLE "perfis";

-- DropTable
DROP TABLE "usuario_empresas";

-- DropTable
DROP TABLE "usuarios";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document" VARCHAR NOT NULL,
    "document_type" VARCHAR NOT NULL,
    "email" VARCHAR NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR NOT NULL,
    "nickname" VARCHAR,
    "birth_date" TIMESTAMP(6),
    "phone" VARCHAR,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_email_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "is_document_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" VARCHAR,
    "two_factor_active" BOOLEAN NOT NULL DEFAULT false,
    "last_access" TIMESTAMP(6),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "blocked_until" TIMESTAMP(6),
    "refresh_token" VARCHAR,
    "profile_id" UUID,
    "status" VARCHAR NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR,
    "permissions" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tax_id" VARCHAR(14) NOT NULL,
    "legal_name" VARCHAR NOT NULL,
    "trade_name" VARCHAR,
    "is_headquarter" BOOLEAN NOT NULL DEFAULT false,
    "opening_date" DATE NOT NULL,
    "street" VARCHAR NOT NULL,
    "number" VARCHAR NOT NULL,
    "complement" VARCHAR,
    "neighborhood" VARCHAR NOT NULL,
    "zip_code" VARCHAR(8) NOT NULL,
    "state" VARCHAR(2) NOT NULL,
    "city" VARCHAR NOT NULL,
    "email" VARCHAR,
    "phone_1" VARCHAR,
    "phone_2" VARCHAR,
    "equity" DECIMAL(15,2) NOT NULL,
    "legal_nature" VARCHAR NOT NULL,
    "size" VARCHAR NOT NULL,
    "tax_regime" VARCHAR NOT NULL,
    "status" VARCHAR NOT NULL,
    "status_date" DATE NOT NULL,
    "simples_data" JSON,
    "mei_data" JSON,
    "last_rfb_sync" TIMESTAMP(6),
    "partners" JSONB,
    "type" VARCHAR DEFAULT 'CLIENT',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_companies" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "role" VARCHAR DEFAULT 'ADMIN',

    CONSTRAINT "user_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "incra" VARCHAR,
    "car" VARCHAR,
    "registry_office_id" VARCHAR,
    "iptu" VARCHAR,
    "fiscal_id" VARCHAR,
    "property_tax_id" VARCHAR,
    "municipal_registry" VARCHAR,
    "registry_status_history" TEXT,
    "address" VARCHAR,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "full_name" VARCHAR NOT NULL,
    "tax_id" VARCHAR(11) NOT NULL,
    "social_id" VARCHAR,
    "birth_date" DATE NOT NULL,
    "hire_date" DATE NOT NULL,
    "termination_date" DATE,
    "role" VARCHAR NOT NULL,
    "salary" DECIMAL(15,2) NOT NULL,
    "department" VARCHAR,
    "status" VARCHAR NOT NULL DEFAULT 'active',

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corporate_books" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "type" VARCHAR NOT NULL,
    "book_number" INTEGER NOT NULL,
    "is_digital_signed" BOOLEAN NOT NULL DEFAULT false,
    "digital_signature" TEXT,
    "jucesp_certification" VARCHAR,
    "certification_date" DATE,
    "content_url" VARCHAR,
    "status" VARCHAR NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corporate_books_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_document_key" ON "users"("document");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "companies_tax_id_key" ON "companies"("tax_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_companies_user_id_company_id_key" ON "user_companies"("user_id", "company_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_companies" ADD CONSTRAINT "user_companies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_companies" ADD CONSTRAINT "user_companies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_books" ADD CONSTRAINT "corporate_books_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
