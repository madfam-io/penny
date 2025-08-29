-- 001_initial_schema.sql
-- Initial database schema setup with extensions and basic tables

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create custom types
CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'deleted');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'unpaid');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');
CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');
CREATE TYPE webhook_status AS ENUM ('pending', 'delivered', 'failed');
CREATE TYPE tool_execution_status AS ENUM ('pending', 'running', 'completed', 'failed', 'canceled');
CREATE TYPE artifact_type AS ENUM ('text', 'markdown', 'chart', 'dashboard', 'image', 'document', 'code', 'data');
CREATE TYPE notification_type AS ENUM ('info', 'warning', 'error', 'success');
CREATE TYPE audit_action AS ENUM ('create', 'read', 'update', 'delete', 'login', 'logout', 'invite', 'execute');

-- Create sequences for numeric IDs where needed
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1000;

-- Create migration tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) NOT NULL PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checksum VARCHAR(255)
);

-- Insert this migration
INSERT INTO schema_migrations (version, checksum) 
VALUES ('001', md5('001_initial_schema.sql'))
ON CONFLICT (version) DO NOTHING;