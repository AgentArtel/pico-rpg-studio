-- Point object-action to the n8n workflow with path "game-api" (corrected workflow).
-- Run in Supabase SQL Editor. Use webhook-test for testing, /webhook/game-api when workflow is active.

UPDATE public.n8n_webhook_registry
SET webhook_url = 'https://mbsartel.app.n8n.cloud/webhook-test/game-api',
    updated_at = now()
WHERE action_key IN ('mailbox.fetch_emails', 'desk.process_mail', 'desk.check_desk');
