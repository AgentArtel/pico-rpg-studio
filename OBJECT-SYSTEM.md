# Workflow Object System

> **Status:** Active Development  
> **Last Updated:** 2026-02-19  
> **Components:** Mailbox, Desk, Bulletin Board (planned)

The Workflow Object System connects real-world APIs (Gmail, etc.) to in-game objects. Players interact with these objects to fetch data, process it, and move it through a pipeline that eventually feeds into AI agents.

---

## Overview

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Mailbox   │───▶│  Inventory  │───▶│    Desk     │───▶│    Agent    │
│  (Gmail)    │    │  (letters)  │    │ (process)   │    │  (AI/Quest) │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                                         │
       ▼                                         ▼
workflow_context:                        workflow_context:
- unread_emails                          - processed_mail
```

**Key Concept:** Data flows through the game like a postal system. Players are mail carriers moving letters between objects.

---

## Objects

### Mailbox

**Template ID:** `mailbox`  
**Purpose:** Fetch emails from Gmail and convert to in-game items  
**Position:** Simplemap (600, 400)

#### Player Interaction

When a player interacts with the mailbox, they see a menu:

```
What would you like to do?
├─ 📬 Get Mail
├─ ✉️ Send Mail
└─ Leave
```

**Get Mail Flow:**
1. Player chooses "Get Mail"
2. Game calls Edge Function: `object-api` with `action: 'fetch_emails'`
3. Edge Function reads Gmail via OAuth token from `user_integrations`
4. Emails stored in `workflow_context` as `unread_emails`
5. `EmailItem` added to player inventory (count = number of emails)
6. Player sees: "📬 You collected 5 letters."

**Send Mail Flow:**
1. Player chooses "Send Mail"
2. Game prompts for: recipient, subject, body
3. Game calls Edge Function: `action: 'send_email'`
4. Edge Function sends via Gmail API
5. Player sees: "✉️ Your letter has been sent!"

---

### Desk

**Template ID:** `desk`  
**Purpose:** Process raw emails into structured data for AI agents  
**Position:** Simplemap (420, 420), (450, 450), or user-defined

#### Player Interaction

```
The desk is covered in papers.
├─ 📋 Process Mail
├─ 🔍 Check Status
└─ Leave
```

**Process Mail Flow:**
1. Player chooses "Process Mail"
2. Game calls Edge Function: `action: 'process_mail'`
3. Edge Function reads `unread_emails` from `workflow_context`
4. Data transformation:
   ```typescript
   // Input: Raw Gmail data
   { id, threadId, subject, from, date, snippet }
   
   // Output: Clean processed data
   { id, from: "Sender Name", subject, received, status: "processed" }
   ```
5. Stores as `processed_mail` in `workflow_context`
6. Deletes original `unread_emails` record
7. Returns: "Processed 5 letters. Ready for agent review."
8. Mail items consumed from inventory

**Check Status Flow:**
1. Shows count of unread and processed mail waiting

---

## Database Schema

### object_templates

Defines available object types.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Template ID (mailbox, desk, etc.) |
| `name` | text | Display name |
| `description` | text | What the object does |
| `is_enabled` | boolean | Can be spawned? |

### object_instances

Places specific objects on maps.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Instance ID |
| `template_id` | text | References object_templates |
| `map_id` | text | Which map (simplemap, etc.) |
| `position` | jsonb | `{ x: number, y: number }` |
| `is_enabled` | boolean | Spawned in game? |

### workflow_context

Temporary data storage between workflow steps.

| Column | Type | Description |
|--------|------|-------------|
| `player_id` | text | Who owns this data |
| `data_type` | text | `unread_emails`, `processed_mail` |
| `payload` | jsonb | The actual data |
| `created_at` | timestamp | When stored |

### user_integrations

OAuth credentials for external APIs.

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | uuid | Player ID |
| `provider` | text | `google` (for Gmail) |
| `access_token` | text | OAuth access token |
| `refresh_token` | text | OAuth refresh token |
| `is_active` | boolean | Valid? |

---

## Game Code Structure

### File: `main/services/objectSpawner.ts`

Dynamically creates RPGJS Event classes for each object instance.

```typescript
// Key functions:
- spawnMapObjects(map, mapId)    // Loads objects from DB, spawns on map
- createObjectEventClass()       // Creates RpgEvent subclass with onAction
- handleMailboxInteraction()     // Mailbox menu logic
- handleDeskInteraction()        // Desk menu logic
```

### File: `main/items/EmailItem.ts`

RPGJS item definition for mail in inventory.

```typescript
@Item({
  name: 'Email',
  description: 'An unread email message',
  consumable: true
})
export class EmailItem {}
```

---

## Edge Function: object-api

**Path:** `studio/supabase/functions/object-api/index.ts`

### Endpoints

All requests POST to `/functions/v1/object-api`:

```json
{
  "object_type": "mailbox|desk|bulletin-board",
  "action": "fetch_emails|send_email|process_mail|check_desk",
  "player_id": "uuid",
  "inputs": { ... }
}
```

### Mailbox Actions

**`fetch_emails`**
- Reads Gmail inbox (max 5 unread)
- Stores in `workflow_context.unread_emails`
- Returns inventory_delta to add EmailItems

**`send_email`**
- Inputs: `{ to, subject, body }`
- Sends via Gmail API
- Returns success/failure

### Desk Actions

**`process_mail`**
- Reads `unread_emails` from workflow_context
- Transforms: extracts sender name, subject, date
- Writes to `processed_mail`
- Deletes `unread_emails`
- Returns inventory_delta to remove EmailItems

**`check_desk`**
- Returns counts of unread and processed mail

---

## Studio Integration

### Managing Objects in Studio

**Objects Page → Templates Tab:**
- Create/edit object templates (mailbox, desk, etc.)
- Set ID, name, icon, description

**Objects Page → Instances Tab:**
- Place objects on maps
- Set position (x, y coordinates)
- Toggle enabled/disabled
- Visual mini-map shows placed objects

### Gmail OAuth Setup

1. Go to **Integrations** page in Studio
2. Click **Connect Gmail**
3. Complete Google OAuth flow
4. Credentials stored in `user_integrations` table
5. Game uses these credentials via Edge Function

---

## Data Flow Example

**Step-by-step walkthrough:**

```
1. PLAYER walks to Mailbox (600, 400)
   └─ Interacts → chooses "Get Mail"
   
2. GAME calls object-api
   └─ action: 'fetch_emails', player_id: '...'
   
3. EDGE FUNCTION
   ├─ Reads Gmail API using stored OAuth token
   ├─ Gets 5 unread emails
   ├─ Stores in workflow_context (data_type: 'unread_emails')
   └─ Returns: { inventory_delta: { add: [{type: 'email', count: 5}] } }
   
4. GAME adds 5 EmailItems to player inventory
   └─ Shows: "📬 You collected 5 letters."
   
5. PLAYER walks to Desk (420, 420)
   └─ Interacts → chooses "Process Mail"
   
6. GAME calls object-api
   └─ action: 'process_mail', player_id: '...'
   
7. EDGE FUNCTION
   ├─ Reads workflow_context (unread_emails)
   ├─ Transforms: {from: "John", subject: "Meeting", ...}
   ├─ Stores in workflow_context (data_type: 'processed_mail')
   ├─ Deletes unread_emails record
   └─ Returns: { inventory_delta: { remove: [{type: 'email', count: 5}] } }
   
8. GAME removes EmailItems from inventory
   └─ Shows: "Processed 5 letters. Ready for agent review."
   
9. AI AGENT (future) reads processed_mail
   └─ Generates quests, responses, actions based on mail content
```

---

## Adding New Objects

To add a new workflow object:

1. **Create Template** (Studio → Objects → Templates):
   ```sql
   INSERT INTO object_templates (id, name, description, is_enabled)
   VALUES ('my-object', 'My Object', 'What it does', true);
   ```

2. **Place Instance** (Studio → Objects → Instances):
   ```sql
   INSERT INTO object_instances (template_id, map_id, position, is_enabled)
   VALUES ('my-object', 'simplemap', '{"x": 500, "y": 400}', true);
   ```

3. **Add Handler** (`objectSpawner.ts`):
   ```typescript
   if (templateId === 'my-object') {
     return this.handleMyObjectInteraction(player)
   }
   ```

4. **Add Edge Function Logic** (`object-api/index.ts`):
   ```typescript
   case 'my-object':
     result = await handleMyObject(supabase, action, playerId, inputs)
     break
   ```

5. **Restart game server** to load new objects

---

## Future Extensions

### Planned Objects

| Object | Purpose | Data Source |
|--------|---------|-------------|
| `bulletin-board` | Community quests/notices | Manual / Generated |
| `calendar` | Schedule events | Google Calendar |
| `file-cabinet` | Document storage | Google Drive |
| `telephone` | Voice interactions | ElevenLabs |

### Workflow Pipeline

Future AI agent integration:

```
Mailbox → Desk → Agent Terminal → Generated Quest
                ↓
         AI reads processed_mail
         analyzes priority
         creates in-game quest
         "Reply to John's meeting request"
```

---

## Troubleshooting

**Objects not spawning:**
- Check `object_instances.is_enabled = true`
- Check `object_templates.is_enabled = true`
- Verify `map_id` matches (e.g., 'simplemap')
- Check server logs: `[ObjectSpawner] Found X objects`

**Gmail not connecting:**
- Verify `user_integrations` has active record
- Check token hasn't expired
- Reconnect in Studio → Integrations

**Desk says "No mail to process":**
- Must visit mailbox first to fetch emails
- Check `workflow_context` has `unread_emails` for your player_id

---

## Related Files

| File | Purpose |
|------|---------|
| `main/services/objectSpawner.ts` | Spawns objects, handles interactions |
| `main/items/EmailItem.ts` | Inventory item definition |
| `studio/supabase/functions/object-api/index.ts` | Edge Function for API calls |
| `studio/src/pages/ObjectTemplates.tsx` | Studio UI for templates |
| `studio/src/hooks/useObjectTemplates.ts` | React hooks for objects |
