-- ============================================================================
-- Email schema: data organized by what it is (emails), with columns for AI
-- ============================================================================
-- Run in Supabase SQL Editor or via supabase db push. Links to owner/account
-- via owner_id; when auth is added, player_id can reference the same identity.
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. Schema and grants
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS email;

GRANT USAGE ON SCHEMA email TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA email TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA email GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. inbox_emails: fetched emails, keyed by owner (not player_id)
-- -----------------------------------------------------------------------------
CREATE TABLE email.inbox_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who this email belongs to (account/owner; map to player_id when auth exists)
  owner_id TEXT NOT NULL,

  -- Gmail / provider identifiers
  gmail_message_id TEXT,
  thread_id TEXT,

  -- Core email fields
  subject TEXT,
  snippet TEXT,
  "from" TEXT,
  "to" TEXT,
  received_at TIMESTAMPTZ,
  labels JSONB DEFAULT '[]'::JSONB,

  -- Full content (optional; populated when needed)
  body_plain TEXT,
  body_html TEXT,
  raw_metadata JSONB DEFAULT '{}'::JSONB,

  -- AI input: what we send to the model (prompt, selected text, etc.)
  ai_input_prompt TEXT,
  ai_input_context JSONB DEFAULT '{}'::JSONB,

  -- AI output: summary, tags, and raw response
  ai_output_summary TEXT,
  ai_output_tags TEXT[] DEFAULT '{}'::TEXT[],
  ai_output_raw JSONB,
  ai_processed_at TIMESTAMPTZ,
  ai_model TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE email.inbox_emails IS 'Fetched emails; organized by type. owner_id = account/owner (not player_id until auth).';
COMMENT ON COLUMN email.inbox_emails.owner_id IS 'Account/owner this email belongs to; map to player_id when auth is in place.';
COMMENT ON COLUMN email.inbox_emails.ai_input_prompt IS 'Exact prompt or text sent to AI for processing.';
COMMENT ON COLUMN email.inbox_emails.ai_input_context IS 'Structured context (e.g. instructions, schema) sent to AI.';
COMMENT ON COLUMN email.inbox_emails.ai_output_summary IS 'AI-generated summary.';
COMMENT ON COLUMN email.inbox_emails.ai_output_tags IS 'AI-generated tags or labels.';

-- Indexes for lookups by owner and by Gmail id
CREATE INDEX idx_inbox_emails_owner_id ON email.inbox_emails (owner_id);
CREATE INDEX idx_inbox_emails_gmail_message_id ON email.inbox_emails (gmail_message_id);
CREATE INDEX idx_inbox_emails_received_at ON email.inbox_emails (received_at DESC);
CREATE INDEX idx_inbox_emails_ai_processed_at ON email.inbox_emails (ai_processed_at) WHERE ai_processed_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. updated_at trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION email.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inbox_emails_updated_at
  BEFORE UPDATE ON email.inbox_emails
  FOR EACH ROW EXECUTE FUNCTION email.set_updated_at();
