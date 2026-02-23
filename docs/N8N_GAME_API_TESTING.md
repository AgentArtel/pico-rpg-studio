# Testing the n8n Game API Workflow

## 1. Webhook URL must match workflow path

The corrected workflow uses webhook path **`game-api`**. object-action forwards to the URL in `n8n_webhook_registry`.

- If your n8n workflow is at **.../webhook-test/game-api** (or **.../webhook/game-api** when active), run the SQL below in Supabase so all action_keys point there.
- If you kept the path as **Mailbox** in n8n, skip this and use your existing `register-mailbox-webhook.sql`.

```sql
-- Point all game actions to the game-api workflow (run in Supabase SQL Editor)
UPDATE public.n8n_webhook_registry
SET webhook_url = 'https://mbsartel.app.n8n.cloud/webhook-test/game-api',
    updated_at = now()
WHERE action_key IN ('mailbox.fetch_emails', 'desk.process_mail', 'desk.check_desk');
```

For production, use `/webhook/game-api` (no `-test`) in the URL when the workflow is active.

## 2. Checklist before testing

- [ ] n8n: Workflow imported and **activated** (or use Test URL for webhook-test).
- [ ] n8n: Gmail node has credentials set (for fetch_emails).
- [ ] Supabase: Ran the UPDATE above (or your register SQL) so `webhook_url` matches the workflow path.
- [ ] Game: Server running (`npm run dev` in my-rpg-game).
- [ ] Game: `.env` has `SUPABASE_URL` and `SUPABASE_ANON_KEY` (object-action is called by the game server).

## 3. In-game tests

1. **Mailbox – fetch emails**
   - Walk to the **mailbox** in-game and interact.
   - Expected: "Checking mailbox..." then "Fetched N emails" (or "No new emails"); inventory gains N× Email items.

2. **Desk – check status**
   - Walk to the **desk**, interact, choose **Check Status**.
   - Expected: Message like "Desk checked - summary generated"; no inventory change (add/remove empty in corrected workflow).

3. **Desk – process mail**
   - At the desk, choose **Process Mail**.
   - Expected: "Mail processed and tagged"; inventory loses 1 Email, gains 1 Tagged Email (per corrected response).

## 4. If the game shows "Something went wrong"

- In n8n: Open the workflow run for that request; confirm the **Respond to Webhook** node returned JSON with `success: true` and `inventory_delta` (with `count` on each entry).
- In Supabase: Check `n8n_webhook_registry` – correct `webhook_url` and `is_active = true`.
- If the webhook receives body in `body`: in the Switch node use `$json.body.object_type` and `$json.body.action` instead of `$json.object_type` / `$json.action`.

## 5. Optional: direct webhook test (no game)

```bash
# Replace URL with your n8n webhook (test or prod)
curl -X POST https://mbsartel.app.n8n.cloud/webhook-test/game-api \
  -H "Content-Type: application/json" \
  -d '{"object_type":"desk","action":"check_desk","player_id":"test-123","inputs":{},"workflow_run_id":null,"timestamp":"2025-01-01T00:00:00.000Z"}'
```

Expected response: `{"success":true,"message":"Desk checked - summary generated","inventory_delta":{"add":[],"remove":[]}}`
