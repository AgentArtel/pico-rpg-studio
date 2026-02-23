-- Register the mailbox n8n webhook so object-action forwards to it.
-- Run this in Supabase SQL Editor (project used by the game and Studio).
-- Flow: Game → object-action Edge Function → this n8n webhook URL.

INSERT INTO public.n8n_webhook_registry (action_key, webhook_url, description, is_active)
VALUES (
  'mailbox.fetch_emails',
  'https://mbsartel.app.n8n.cloud/webhook-test/Mailbox',
  'Mailbox interaction – fetch/send mail via n8n',
  true
)
ON CONFLICT (action_key) DO UPDATE SET
  webhook_url = EXCLUDED.webhook_url,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Desk uses the same n8n workflow URL; workflow branches on object_type/action.
INSERT INTO public.n8n_webhook_registry (action_key, webhook_url, description, is_active)
VALUES (
  'desk.process_mail',
  'https://mbsartel.app.n8n.cloud/webhook-test/Mailbox',
  'Desk – process mail (same workflow as mailbox)',
  true
)
ON CONFLICT (action_key) DO UPDATE SET
  webhook_url = EXCLUDED.webhook_url,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.n8n_webhook_registry (action_key, webhook_url, description, is_active)
VALUES (
  'desk.check_desk',
  'https://mbsartel.app.n8n.cloud/webhook-test/Mailbox',
  'Desk – check status (same workflow as mailbox)',
  true
)
ON CONFLICT (action_key) DO UPDATE SET
  webhook_url = EXCLUDED.webhook_url,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = now();
