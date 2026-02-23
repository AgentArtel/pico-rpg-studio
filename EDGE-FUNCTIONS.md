# Supabase Edge Functions

> **Status:** Active Development  
> **Last Updated:** 2026-02-19  
> **Location:** `studio/supabase/functions/`

Edge Functions handle API calls that require secrets (API keys, OAuth tokens) and operate on the database. They keep credentials secure while allowing the game to integrate with external services.

---

## Available Functions

| Function | Purpose | Called By |
|----------|---------|-----------|
| `object-api` | Workflow objects (Mailbox, Desk) | Game server |
| `npc-ai-chat` | NPC AI conversations | Game server |

---

## object-api

**Path:** `studio/supabase/functions/object-api/index.ts`

Handles workflow automation objects that interact with external APIs (Gmail, etc.).

### Request Format

```http
POST /functions/v1/object-api
Content-Type: application/json
Authorization: Bearer <SUPABASE_ANON_KEY>

{
  "object_type": "mailbox|desk|bulletin-board",
  "action": "fetch_emails|send_email|process_mail|...",
  "player_id": "uuid-string",
  "inputs": { /* action-specific data */ },
  "workflow_run_id": "optional-uuid"
}
```

### Response Format

```json
{
  "success": true|false,
  "message": "Human-readable result",
  "inventory_delta": {
    "add": [{ "type": "email", "count": 5 }],
    "remove": [{ "type": "email", "count": 5 }]
  },
  "error": {
    "code": "ERROR_CODE",
    "message": "What went wrong",
    "retryable": true|false
  }
}
```

---

## Mailbox Handler

### Action: `fetch_emails`

Fetches unread emails from Gmail and stores them for the player.

**Process:**
1. Look up player's Gmail credentials from `user_integrations`
2. Call Gmail API: `GET /gmail/v1/users/me/messages?labelIds=INBOX&q=is:unread`
3. Get details for each message (subject, from, date, snippet)
4. Store in `workflow_context` with `data_type: 'unread_emails'`
5. Return inventory_delta to add EmailItems

**Example Request:**
```json
{
  "object_type": "mailbox",
  "action": "fetch_emails",
  "player_id": "b879b298-6797-4d73-bd10-1e01fca086f1"
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "5 letters collected",
  "inventory_delta": {
    "add": [{ "type": "email", "count": 5 }],
    "remove": []
  }
}
```

**Error Codes:**
- `CREDENTIALS_NOT_FOUND` - Gmail not connected in Studio
- `TOKEN_EXPIRED` - OAuth token expired, need to reconnect
- `GMAIL_API_ERROR` - Gmail API call failed

---

### Action: `send_email`

Sends an email via Gmail.

**Inputs:**
```json
{
  "to": "recipient@example.com",
  "subject": "Email subject",
  "body": "Email body text"
}
```

**Process:**
1. Build RFC 2822 email content
2. Base64URL encode
3. POST to Gmail API: `/gmail/v1/users/me/messages/send`

**Example Response:**
```json
{
  "success": true,
  "message": "✉️ Letter sent!",
  "inventory_delta": { "add": [], "remove": [] }
}
```

---

## Desk Handler

### Action: `process_mail`

Transforms raw Gmail data into clean structured data for AI agents.

**Process:**
1. Read `workflow_context` where `data_type = 'unread_emails'`
2. Transform each email:
   ```typescript
   {
     id: email.id,
     from: email.from?.split('<')[0].trim(),  // "John Doe" from "John Doe <john@...>"
     subject: email.subject,
     received: email.date,
     status: 'processed'
   }
   ```
3. Insert new record with `data_type: 'processed_mail'`
4. Delete original `unread_emails` record
5. Return inventory_delta to remove EmailItems

**Example Request:**
```json
{
  "object_type": "desk",
  "action": "process_mail",
  "player_id": "b879b298-6797-4d73-bd10-1e01fca086f1"
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Processed 5 letters. Ready for agent review.",
  "inventory_delta": {
    "add": [],
    "remove": [{ "type": "email", "count": 5 }]
  }
}
```

---

### Action: `check_desk`

Returns status of mail waiting at the desk.

**Returns:**
```json
{
  "success": true,
  "message": "📬 3 new letters waiting.",
  "status": {
    "unread": 3,
    "processed": 0
  }
}
```

---

## Data Storage

### workflow_context Table

Temporary storage for data moving through the pipeline.

```sql
CREATE TABLE workflow_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text NOT NULL,
  data_type text NOT NULL,  -- 'unread_emails', 'processed_mail'
  payload jsonb NOT NULL,
  workflow_run_id uuid REFERENCES workflow_runs(id),
  created_at timestamp DEFAULT now()
);
```

**Data Types:**

| Type | Description | Created By | Consumed By |
|------|-------------|------------|-------------|
| `unread_emails` | Raw Gmail data | mailbox:fetch_emails | desk:process_mail |
| `processed_mail` | Clean structured data | desk:process_mail | AI agent (future) |

---

## Gmail Integration

### OAuth Flow

1. **User connects Gmail** (Studio → Integrations):
   - Click "Connect Gmail"
   - Redirect to Google OAuth
   - User grants `gmail.readonly` and `gmail.modify` scopes
   - Callback stores tokens in `user_integrations`

2. **Game uses token** (via Edge Function):
   - Edge Function reads `user_integrations.access_token`
   - Calls Gmail API with `Authorization: Bearer <token>`
   - Handles token refresh if needed (future)

### user_integrations Schema

```sql
CREATE TABLE user_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  provider text NOT NULL,  -- 'google'
  provider_account_id text,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamp,
  scope text,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(user_id, provider)
);
```

---

## Deployment

### Deploy a Function

```bash
cd studio
npx supabase functions deploy object-api --project-ref ktxdbeamrxhjtdattwts
```

### View Logs

```bash
npx supabase functions logs object-api --project-ref ktxdbeamrxhjtdattwts
```

### Local Development

```bash
# Start local Supabase
npx supabase start

# Serve function locally
npx supabase functions serve object-api --env-file .env
```

---

## Security

### Environment Variables

Set in Supabase Dashboard → Project Settings → Secrets:

| Secret | Purpose |
|--------|---------|
| `SUPABASE_URL` | Database connection |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin database access |

**Never** expose these in frontend code. Edge Functions are server-side only.

### CORS

Functions allow cross-origin requests:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

### Authentication

Game server calls use `SUPABASE_ANON_KEY` in Authorization header. The Edge Function uses `SERVICE_ROLE_KEY` internally for database access.

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "retryable": true|false
  }
}
```

### Common Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `CREDENTIALS_NOT_FOUND` | OAuth not connected | Visit Studio → Integrations |
| `TOKEN_EXPIRED` | OAuth token expired | Reconnect in Studio |
| `GMAIL_API_ERROR` | Gmail API failed | Check Gmail status, retry |
| `SEND_FAILED` | Email send failed | Check recipient, retry |
| `MISSING_FIELDS` | Required inputs missing | Fill all fields |
| `INTERNAL_ERROR` | Unexpected error | Check logs, report bug |

---

## Adding New Actions

To add a new action to an existing handler:

1. **Add action handler** in `object-api/index.ts`:
```typescript
if (action === 'my_new_action') {
  // Your logic here
  return {
    success: true,
    message: 'Action completed',
    inventory_delta: { add: [], remove: [] }
  }
}
```

2. **Deploy the function:**
```bash
npx supabase functions deploy object-api --project-ref ktxdbeamrxhjtdattwts
```

3. **Update game code** to call the new action.

---

## Related Documentation

- [OBJECT-SYSTEM.md](./OBJECT-SYSTEM.md) - Game-side object interactions
- [studio/docs/game-integration/README.md](./studio/docs/game-integration/README.md) - Studio integration overview
