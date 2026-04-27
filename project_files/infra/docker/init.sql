CREATE DATABASE ledgr_app;
GRANT ALL PRIVILEGES ON DATABASE ledgr_app TO ledgr;
\c ledgr_app
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Perfis
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    permissions JSONB NOT NULL, -- Estrutura: { companies: [], services: {}, routines: {} }
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Ajuste na Tabela de Usuários
ALTER TABLE users 
ADD COLUMN profile_id UUID REFERENCES profiles(id),
ADD COLUMN status VARCHAR(20) DEFAULT 'active',
ADD COLUMN deleted_at TIMESTAMP;

-- 3. Tabela de Auditoria
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    target_id UUID,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);