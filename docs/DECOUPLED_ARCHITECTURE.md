# Agent Artel — Decoupled Architecture Blueprint

> **Philosophy:** Don't rebuild n8n. USE n8n. Get the automation-game loop working with proven tools, understand the data shapes, then migrate later.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [The Three Pillars](#2-the-three-pillars)
3. [How They Connect: Supabase as the Shared Spine](#3-how-they-connect-supabase-as-the-shared-spine)
4. [The Proxy Pattern: Edge Functions as a Secure Relay](#4-the-proxy-pattern-edge-functions-as-a-secure-relay)
5. [Data Flow: Game Object → Edge Function → n8n → Supabase](#5-data-flow-game-object--edge-function--n8n--supabase)
6. [NPC AI Chat: Hybrid Approach](#6-npc-ai-chat-hybrid-approach)
7. [Database Schema: Shared Contract](#7-database-schema-shared-contract)
8. [n8n's Role: What It Owns](#8-n8ns-role-what-it-owns)
9. [Studio's New Role: Game Content, Not Workflow Execution](#9-studios-new-role-game-content-not-workflow-execution)
10. [Game Server's Role: Trigger and Display](#10-game-servers-role-trigger-and-display)
11. [Concrete Example: The Mailbox Flow (Before vs After)](#11-concrete-example-the-mailbox-flow-before-vs-after)
12. [Concrete Example: NPC AI Chat (Hybrid)](#12-concrete-example-npc-ai-chat-hybrid)
13. [Edge Function Contracts (API Specs)](#13-edge-function-contracts-api-specs)
14. [What Changes in Existing Code](#14-what-changes-in-existing-code)
15. [What Stays the Same](#15-what-stays-the-same)
16. [Known Bugs to Fix During Transition](#16-known-bugs-to-fix-during-transition)
17. [Migration Path: n8n → Custom Engine (Future)](#17-migration-path-n8n--custom-engine-future)
18. [Decision Log](#18-decision-log)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SUPABASE (Shared Spine)                      │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────────────┐  │
│  │ Postgres │  │ Realtime │  │   Auth    │  │  Edge Functions   │  │
│  │ Database │  │ Channels │  │           │  │  (Secure Proxy)   │  │
│  └──────────┘  └──────────┘  └───────────┘  └───────────────────┘  │
│       ▲              ▲                              │               │
│       │              │                              │               │
└───────┼──────────────┼──────────────────────────────┼───────────────┘
        │              │                              │
        │              │                              ▼
   ┌────┴────┐    ┌────┴────┐                  ┌──────────┐
   │  Studio │    │  Game   │                  │   n8n    │
   │ (React) │    │(RPG-JS) │                  │(Webhooks)│
   └─────────┘    └─────────┘                  └──────────┘
```

**Three independent apps. One shared database. No direct connections between them.**

---

## 2. The Three Pillars

### Pillar 1: RPG-JS Game (`/my-rpg-game/`)
- **Responsibility:** The player experience. Renders the 2D world, handles movement, interactions, displays results.
- **Triggers automations** by calling Supabase Edge Functions when players interact with objects.
- **Reads results** from Supabase tables (or from Edge Function responses).
- **Never calls n8n directly.** Never knows n8n exists.

### Pillar 2: Agent Artel Studio (`/studio/`)
- **Responsibility:** Game content management. NPC authoring, object placement, dashboard, game configuration.
- **Writes to Supabase** (NPC configs, object templates, etc.).
- **Broadcasts changes** to the game via Supabase Realtime.
- **Can view n8n workflow status** via Supabase tables (execution logs written by n8n).
- **Does NOT execute workflows.** That's n8n's job now.

### Pillar 3: n8n (Self-hosted / Cloud)
- **Responsibility:** All automation and workflow execution.
- **Receives triggers** from Supabase Edge Functions via webhooks.
- **Executes workflows:** Gmail, Slack, AI calls, scheduling, data transforms.
- **Writes results back** to Supabase tables.
- **Has its own UI** for building, debugging, and monitoring workflows.
- **Never exposed to the game client.** All access goes through Edge Function proxies.

---

## 3. How They Connect: Supabase as the Shared Spine

Every app connects to the same Supabase project (`ktxdbeamrxhjtdattwts`). They communicate through:

| Channel | Who → Who | Purpose |
|---------|-----------|---------|
| **Database tables** | All three read/write | Shared state (NPCs, objects, player data, workflow results) |
| **Realtime broadcast** | Studio → Game | Instant NPC updates (create/update/delete) |
| **Realtime postgres_changes** | DB → Game | Backup sync when table rows change |
| **Edge Functions** | Game → n8n | Secure proxy relay (game calls edge fn, edge fn calls n8n webhook) |
| **Edge Functions** | Game → AI | Direct AI calls for latency-sensitive NPC chat |
| **Webhooks** | Edge Fn → n8n | Trigger n8n workflows |
| **Database writes** | n8n → Supabase | n8n writes results back to shared tables |

**Key rule: No app talks directly to another app. All communication goes through Supabase.**

---

## 4. The Proxy Pattern: Edge Functions as a Secure Relay

The game client/server calls Supabase Edge Functions. The Edge Function then decides:

- **For automations (mailbox, desk, etc.):** Forward to an n8n webhook, return the result.
- **For NPC AI chat:** Call the AI provider directly (low-latency path).
- **For simple CRUD:** Read/write Supabase directly.

```
Game Server                 Supabase Edge Function              n8n
    │                              │                             │
    │  POST /functions/v1/         │                             │
    │  object-action               │                             │
    │  {object_type, action,       │                             │
    │   player_id, inputs}         │                             │
    │─────────────────────────────>│                             │
    │                              │                             │
    │                              │  Lookup n8n webhook URL     │
    │                              │  from env/config            │
    │                              │                             │
    │                              │  POST webhook URL           │
    │                              │  {object_type, action,      │
    │                              │   player_id, inputs,        │
    │                              │   timestamp}                │
    │                              │─────────────────────────────>│
    │                              │                             │
    │                              │                   n8n runs workflow
    │                              │                   (fetch Gmail, etc.)
    │                              │                             │
    │                              │   {success, message,        │
    │                              │    inventory_delta, data}   │
    │                              │<─────────────────────────────│
    │                              │                             │
    │  {success, message,          │                             │
    │   inventory_delta, data}     │                             │
    │<─────────────────────────────│                             │
    │                              │                             │
    │  Apply to game               │                             │
    │  (add items, show text)      │                             │
```

### Why this pattern?

1. **Security:** n8n webhook URLs never touch client code or game server config. Only the Edge Function knows them.
2. **Flexibility:** Swap n8n for your own engine later — only the Edge Function changes. Game code untouched.
3. **Validation:** The Edge Function can validate requests, add auth context, rate-limit, log — before forwarding.
4. **Consistent interface:** The game always calls the same Edge Function URL with the same contract. What happens behind it is an implementation detail.

---

## 5. Data Flow: Game Object → Edge Function → n8n → Supabase

### The General Pattern

```
1. Player interacts with game object (e.g., clicks Mailbox)
2. Game server calls Edge Function: POST /functions/v1/object-action
3. Edge Function forwards to n8n webhook with standardized payload
4. n8n workflow executes:
   a. Reads credentials/tokens from Supabase (user_integrations)
   b. Calls external API (Gmail, Slack, etc.)
   c. Processes/transforms data
   d. Writes results to Supabase (workflow_context, workflow_runs)
   e. Returns response to Edge Function
5. Edge Function returns response to game server
6. Game server applies result:
   - Adds items to player inventory
   - Shows text to player
   - Updates game state
```

### Two Response Modes

**Mode A: Synchronous (webhook response)**
n8n returns the result directly in the webhook response. The Edge Function passes it through.
- Best for: Quick actions (fetch emails, check status)
- Latency: ~1-5 seconds

**Mode B: Asynchronous (DB write + poll/subscribe)**
n8n writes results to `workflow_context` or a dedicated results table. The game reads from there.
- Best for: Long-running workflows (batch processing, multi-step chains)
- The Edge Function can return immediately with `{ status: 'processing', run_id: '...' }`
- The game polls or subscribes to Realtime for the result

**Start with Mode A. Move to Mode B when needed.**

---

## 6. NPC AI Chat: Hybrid Approach

NPC chat uses a **dual-path architecture:**

### Path 1: Direct Edge Function (default — low latency)
For normal conversations, the existing `npc-ai-chat` Edge Function calls AI providers directly.
This stays as-is. It's fast and works.

```
Player talks to NPC → npc-ai-chat Edge Function → OpenAI/Gemini/Kimi → response
```

### Path 2: n8n Webhook (complex behaviors)
For NPCs that need to trigger real-world actions (send an email, check a calendar, run a workflow), the NPC's response can include **action requests** that route through n8n.

```
Player: "Butler, check my email and summarize it"
→ npc-ai-chat → AI responds with tool_call: {name: "check_email"}
→ Game detects action tool_call → calls Edge Function → n8n webhook
→ n8n fetches Gmail, summarizes, writes to workflow_context
→ Game reads result → NPC speaks the summary
```

### How the game decides which path:

```
if (response.toolCalls) {
  for (const tool of response.toolCalls) {
    if (isGameAction(tool.name)) {
      // move, say, emote — handle locally in game
      executeTool(tool)
    } else if (isWorkflowAction(tool.name)) {
      // check_email, send_slack, etc. — route to n8n
      const result = await callEdgeFunction('object-action', {
        object_type: 'npc-workflow',
        action: tool.name,
        player_id: player.id,
        inputs: tool.arguments
      })
      // Feed result back to NPC for narration
      await continueConversation(npc, player, result)
    }
  }
}
```

### Game actions vs Workflow actions:

| Game Actions (local) | Workflow Actions (→ n8n) |
|----------------------|--------------------------|
| `move` | `check_email` |
| `say` | `send_email` |
| `emote` | `check_calendar` |
| `generate_image` | `send_slack` |
| `give_item` | `fetch_weather` |
| `teleport` | `run_query` |
| | `schedule_task` |

---

## 7. Database Schema: Shared Contract

All three apps read/write these tables. The schema IS the API contract between them.

### Tables Owned by Studio (Studio writes, others read)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `agent_configs` | NPC definitions | id, name, prompt, model, skills, spawn_config, appearance, behavior, is_enabled |
| `object_templates` | Object type definitions | id, name, actions, category, base_entity_type |
| `object_instances` | Placed objects on maps | template_id, map_id, position, custom_config |
| `studio_ideas` | Idea scratchpad | content, tag |

### Tables Owned by Game (Game writes, others read)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `player_state` | Live player positions | player_id, map_id, position, direction, status |
| `npc_instances` | Active NPC instances | config_id, instance_id, map_id, position, status |
| `agent_memory` | NPC conversation logs | session_id, npc_id, player_id, role, content |

### Tables Owned by n8n (n8n writes, game reads)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `workflow_context` | Data pipeline between objects | player_id, data_type, payload, workflow_run_id, expires_at |
| `workflow_runs` | Execution history | player_id, workflow_id, status, logs |

### Tables Shared (multiple writers)

| Table | Purpose | Writers |
|-------|---------|---------|
| `user_integrations` | OAuth tokens | Studio (setup), n8n (refresh tokens) |
| `sync_status` | Sync tracking | All three |
| `studio_workflows` | Workflow definitions | Studio (design), n8n (execution status) |
| `studio_executions` | Execution logs | n8n (writes), Studio (reads) |
| `studio_activity_log` | Audit trail | All three |
| `studio_credentials` | API keys | Studio (manages), n8n (reads) |

### New Table: `n8n_webhook_registry`

```sql
CREATE TABLE IF NOT EXISTS n8n_webhook_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action_key TEXT NOT NULL UNIQUE,       -- e.g., 'mailbox.fetch_emails', 'desk.process_mail'
  webhook_url TEXT NOT NULL,             -- the n8n webhook URL (never exposed to clients)
  method TEXT DEFAULT 'POST',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  timeout_ms INTEGER DEFAULT 30000,      -- how long to wait for n8n response
  response_mode TEXT DEFAULT 'sync',     -- 'sync' (wait for response) or 'async' (fire-and-forget)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Examples:
INSERT INTO n8n_webhook_registry (action_key, webhook_url, description) VALUES
  ('mailbox.fetch_emails', 'https://your-n8n.com/webhook/abc123', 'Fetch Gmail inbox'),
  ('mailbox.send_email',   'https://your-n8n.com/webhook/def456', 'Send email via Gmail'),
  ('desk.process_mail',    'https://your-n8n.com/webhook/ghi789', 'Process unread emails'),
  ('desk.check_desk',      'https://your-n8n.com/webhook/jkl012', 'Check desk status'),
  ('npc.check_email',      'https://your-n8n.com/webhook/mno345', 'NPC-triggered email check'),
  ('npc.send_slack',       'https://your-n8n.com/webhook/pqr678', 'NPC-triggered Slack message');
```

This table lets you:
- Register n8n webhook URLs without hardcoding them in Edge Functions
- Enable/disable routes dynamically
- Change n8n URLs without redeploying Edge Functions
- Track which automations exist

---

## 8. n8n's Role: What It Owns

### What n8n handles:

1. **All external API integrations** — Gmail, Slack, Calendar, Weather, etc.
2. **Data transformation** — Parse emails, format messages, extract data
3. **Scheduling** — Cron-triggered workflows (e.g., "check email every 5 minutes")
4. **Multi-step chains** — Fetch emails → summarize with AI → post to Slack → write to DB
5. **Error handling** — Retries, fallbacks, error notifications
6. **Credential management** — n8n's built-in credential store (or reads from `user_integrations`)

### What n8n does NOT handle:

- Game rendering or logic (that's RPG-JS)
- NPC management UI (that's Studio)
- Real-time player sync (that's Supabase Realtime)
- Direct NPC conversation (that's the `npc-ai-chat` Edge Function)

### n8n Workflow Organization

Suggested workflow naming convention:
```
[Object] - [Action] - [Description]
─────────────────────────────────────
Mailbox - Fetch Emails - Get Gmail inbox for player
Mailbox - Send Email - Send email via Gmail
Desk - Process Mail - Summarize and categorize emails
Desk - Check Status - Return desk item counts
NPC - Check Email - NPC-triggered email lookup
NPC - Send Slack - NPC-triggered Slack message
Cron - Email Digest - Daily email summary at 9am
Cron - Cleanup - Remove expired workflow_context rows
```

### n8n ↔ Supabase Connection

n8n connects to Supabase via:
- **Supabase node** (built-in n8n node) — for table reads/writes
- **HTTP Request node** — for Edge Function calls if needed
- **Postgres node** — direct DB access for complex queries

n8n reads from:
- `user_integrations` (OAuth tokens)
- `workflow_context` (intermediate data)
- `agent_configs` (NPC details, if needed for AI context)

n8n writes to:
- `workflow_context` (results, intermediate data)
- `workflow_runs` (execution logs)
- `studio_executions` (for Studio dashboard visibility)
- `studio_activity_log` (audit trail)

---

## 9. Studio's New Role: Game Content, Not Workflow Execution

### What Studio keeps:

- **NPC Management** — Full CRUD, broadcast to game ✅
- **Object Template/Instance Management** — Define and place objects ✅
- **Dashboard** — Show stats from Supabase (active NPCs, players, workflow runs) ✅
- **Map Browser** — View entities on maps ✅
- **Ideas Scratchpad** — Quick notes ✅
- **Integrations Page** — Setup OAuth connections (writes to `user_integrations`) ✅
- **Credentials Page** — Manage API keys ✅
- **Play Game** — Iframe to the live game ✅
- **Settings** — User preferences ✅

### What Studio deprioritizes (for now):

- **Workflow Editor** — Keep the code, but it's not the execution engine anymore. Could evolve into a "workflow designer" that exports to n8n format, or a monitoring view.
- **Execution History** — Reads from `studio_executions` (written by n8n) instead of running its own.
- **Agent Library** — Future feature. Templates could export as n8n workflow JSON.

### New Studio features (future):

- **n8n Workflow Monitor** — Show n8n execution status by reading from `workflow_runs` / `studio_executions`
- **Webhook Registry UI** — Manage `n8n_webhook_registry` entries
- **Object ↔ Workflow Mapping** — Visual UI to connect game objects to n8n webhooks

---

## 10. Game Server's Role: Trigger and Display

The game server is a **thin client for automations:**

1. **Detect player interaction** (click mailbox, talk to NPC, etc.)
2. **Call the appropriate Edge Function** with a standardized payload
3. **Receive the result** and apply it to the game world
4. **Never knows or cares** what happens behind the Edge Function

### Game server responsibilities:

| Responsibility | How |
|---------------|-----|
| Render world | RPG-JS + PixiJS |
| Player movement | RPG-JS built-in |
| NPC spawning | Read `agent_configs` from Supabase at startup + Realtime sync |
| Object spawning | Read `object_instances` from Supabase at startup |
| NPC conversation | Call `npc-ai-chat` Edge Function |
| Object interaction | Call `object-action` Edge Function (which proxies to n8n) |
| Inventory management | Apply `inventory_delta` from Edge Function responses |
| Player state | Write to `player_state` table |
| Memory | Write to `agent_memory` table |

---

## 11. Concrete Example: The Mailbox Flow (Before vs After)

### BEFORE (Current — Edge Function does everything)

```
1. Player clicks Mailbox
2. Game: POST /functions/v1/object-api
   Body: { object_type: "mailbox", action: "fetch_emails", player_id: "abc" }
3. Edge Function:
   a. Queries user_integrations for Google OAuth token
   b. Calls Gmail API directly: GET googleapis.com/gmail/v1/users/me/messages
   c. Parses email data
   d. Stores in workflow_context table
   e. Returns { success: true, message: "3 letters", inventory_delta: { add: [{type:"email", count:3}] } }
4. Game: Adds 3 EmailItems to player inventory, shows "3 letters collected"
```

**Problem:** All the Gmail logic is hardcoded in a Deno Edge Function. Can't see the data flow. Hard to debug. Hard to extend.

### AFTER (New — Edge Function proxies to n8n)

```
1. Player clicks Mailbox
2. Game: POST /functions/v1/object-action
   Body: { object_type: "mailbox", action: "fetch_emails", player_id: "abc" }
3. Edge Function:
   a. Looks up n8n_webhook_registry for action_key = 'mailbox.fetch_emails'
   b. Forwards to n8n: POST https://n8n.example.com/webhook/abc123
      Body: { object_type: "mailbox", action: "fetch_emails", player_id: "abc", timestamp: "..." }
   c. Waits for n8n response
4. n8n Workflow:
   a. [Webhook Trigger] receives the request
   b. [Supabase Node] reads user_integrations for player's Google token
   c. [Gmail Node] fetches inbox (using n8n's built-in Gmail integration!)
   d. [Function Node] transforms to game format
   e. [Supabase Node] writes to workflow_context
   f. [Respond to Webhook] returns: { success: true, message: "3 letters", inventory_delta: {...} }
5. Edge Function: Passes n8n response back to game
6. Game: Same as before — adds items, shows text
```

**Benefits:**
- You can SEE every step in n8n's execution view
- You can see the exact Gmail API response data
- You can add steps (filter spam, summarize with AI) by dragging nodes
- You can test the workflow independently of the game
- If something breaks, n8n shows you exactly where

---

## 12. Concrete Example: NPC AI Chat (Hybrid)

### Simple conversation (Path 1 — Direct)

```
Player: "Hello, Elara"
→ Game calls npc-ai-chat Edge Function (same as today)
→ Edge Function calls OpenAI directly
→ Returns: { text: "Greetings, traveler!", toolCalls: [] }
→ NPC speaks in game
```

No change. Fast. Works.

### NPC triggers a workflow action (Path 2 — via n8n)

```
Player: "Butler, check my email"
→ Game calls npc-ai-chat Edge Function
→ Edge Function calls OpenAI with tools: [check_email, send_email, ...]
→ Returns: { text: "Let me check...", toolCalls: [{ name: "check_email", arguments: {} }] }
→ Game sees toolCall "check_email" is a WORKFLOW action (not a game action)
→ Game calls Edge Function: POST /functions/v1/object-action
  Body: { object_type: "npc-workflow", action: "check_email", player_id: "abc" }
→ Edge Function → n8n webhook → Gmail → response
→ Game feeds result back to NPC conversation
→ NPC: "You have 3 unread emails. One from Sarah about the project deadline."
```

---

## 13. Edge Function Contracts (API Specs)

### `object-action` (NEW — replaces `object-api`)

The unified proxy Edge Function for all game object interactions.

**Request:**
```typescript
POST /functions/v1/object-action
Authorization: Bearer SUPABASE_ANON_KEY
Content-Type: application/json

{
  object_type: string,       // "mailbox" | "desk" | "bulletin-board" | "npc-workflow" | ...
  action: string,            // "fetch_emails" | "send_email" | "process_mail" | ...
  player_id: string,         // Supabase auth user ID
  inputs?: Record<string, any>,  // Action-specific inputs
  context?: {                // Optional game context
    map_id?: string,
    npc_id?: string,
    session_id?: string
  }
}
```

**Edge Function logic:**
```typescript
// 1. Validate request
// 2. Build action_key: `${object_type}.${action}`
// 3. Look up n8n_webhook_registry for the action_key
// 4. If found and is_active: forward to n8n webhook, return response
// 5. If not found: return { success: false, error: { code: 'NO_WORKFLOW', message: '...' } }
```

**Response (standardized — same whether from n8n or direct):**
```typescript
// Success:
{
  success: true,
  message: string,                              // Human-readable for game text
  inventory_delta?: {
    add: Array<{ type: string, count: number, metadata?: any }>,
    remove: Array<{ type: string, count: number }>
  },
  data?: Record<string, any>,                   // Additional data (email contents, etc.)
  workflow_run_id?: string                       // For async tracking
}

// Error:
{
  success: false,
  error: {
    code: string,                               // Machine-readable error code
    message: string,                            // Human-readable for game text
    retryable: boolean
  }
}
```

### `npc-ai-chat` (KEEP — no changes)

Stays as-is. Direct AI provider calls for low-latency NPC conversation.

**Request:** (unchanged)
```typescript
POST /functions/v1/npc-ai-chat
{
  npcId, playerId, playerName, message?,
  config: { name, personality, model, skills },
  history: Array<{ role, content }>
}
```

**Response:** (unchanged)
```typescript
{ text: string, toolCalls?: Array<{ name, arguments }>, tokens?: { prompt, completion, total } }
```

### Other Edge Functions (KEEP for now)

| Function | Status | Notes |
|----------|--------|-------|
| `npc-ai-chat` | **Keep** | Core NPC chat, latency-sensitive |
| `object-api` | **Replace** with `object-action` | New proxy version |
| `gemini-chat` | **Keep** | Used by Studio's AI Agent node |
| `gemini-vision` | **Keep** | Used by Studio |
| `gemini-embed` | **Keep** | Used by Studio |
| `generate-image` | **Keep** | Used by NPC tool calls |
| `kimi-chat` | **Keep** | Used by Studio |
| `execute-http` | **Keep** | Used by Studio's HTTP node |

---

## 14. What Changes in Existing Code

### Edge Functions

| Change | Description |
|--------|-------------|
| **New: `object-action`** | Proxy Edge Function that looks up `n8n_webhook_registry` and forwards to n8n |
| **Deprecate: `object-api`** | Keep the code but stop using it. The logic moves into n8n workflows |

### Game Server (`my-rpg-game/`)

| File | Change |
|------|--------|
| `services/objectSpawner.ts` | Change Edge Function URL from `object-api` to `object-action`. **Payload format stays the same.** |
| `services/npcSpawner.ts` | Add workflow action routing: if `toolCall.name` is a workflow action, call `object-action` Edge Function instead of handling locally |
| `realtime/contentSync.ts` | Fix schema mismatch: change `schema: 'game'` to `schema: 'public'` |
| `server.ts` | No changes needed |
| `services/aiService.ts` | No changes needed |
| `services/memoryService.ts` | No changes needed |
| `player.ts` | No changes needed |

### Studio (`/studio/`)

| File | Change |
|------|--------|
| `src/lib/gameBroadcast.ts` | Wire into NPC pages (currently exists but not imported) |
| `src/pages/ExecutionHistory.tsx` | Read from `workflow_runs` / `studio_executions` (written by n8n) |
| `src/pages/Dashboard.tsx` | Add n8n workflow stats from `workflow_runs` table |

### Database

| Change | Description |
|--------|-------------|
| **New table: `n8n_webhook_registry`** | Registry of n8n webhook URLs keyed by action_key |
| **Apply: `APPLY_TO_SUPABASE.sql`** | Create core tables that haven't been applied yet |
| **Verify: `object_templates`, `object_instances`** | Ensure these exist (not in APPLY_TO_SUPABASE.sql) |
| **Verify: `workflow_context`, `workflow_runs`** | Ensure these exist |

---

## 15. What Stays the Same

- ✅ **Supabase project** — Same project, same tables, same auth
- ✅ **Game client/server** — Same RPG-JS setup, same maps, same sprites
- ✅ **NPC AI chat** — Same Edge Function, same flow
- ✅ **NPC management in Studio** — Same CRUD, same broadcast
- ✅ **Object templates/instances** — Same data model
- ✅ **Player state persistence** — Same flow
- ✅ **Agent memory** — Same flow
- ✅ **Realtime NPC sync** — Same broadcast channel (after fixing schema bug)
- ✅ **Game response format** — `{ success, message, inventory_delta }` is preserved
- ✅ **All existing code** — Nothing deleted. `object-api` still exists, just not called.

---

## 16. Known Bugs to Fix During Transition

### Bug 1: Schema Mismatch in contentSync.ts
```typescript
// CURRENT (broken):
.on('postgres_changes', { event: '*', schema: 'game', table: 'agent_configs' }, handler)

// FIX:
.on('postgres_changes', { event: '*', schema: 'public', table: 'agent_configs' }, handler)
```
The `agent_configs` table is in `public` schema, not `game`. This means the postgres_changes subscription never fires — only the broadcast channel works.

### Bug 2: gameBroadcast.ts Not Wired
The file exists at `studio/src/lib/gameBroadcast.ts` but is not imported by any Studio page. NPC CRUD in Studio writes to the database but doesn't broadcast to the game in real-time. Need to import and call from NPC management pages.

### Bug 3: Missing Tables
`APPLY_TO_SUPABASE.sql` doesn't create `object_templates`, `object_instances`, `workflow_context`, `workflow_runs`, or `user_integrations`. These are referenced in code and types but may not exist in the database. Verify and create if missing.

### Bug 4: Workflow Save Not Wired
`WorkflowEditorPage.tsx` `handleSaveWorkflow` only does `console.log('Saving workflow...')`. Not critical for the new architecture (n8n handles workflows), but worth noting.

### Bug 5: Dev Auth Fallback
In `server.ts`, when no auth token is provided, it falls back to a hardcoded UUID. This won't match any `user_integrations` entries, so object actions requiring OAuth will fail in dev mode. Consider creating a test user with matching credentials.

---

## 17. Migration Path: n8n → Custom Engine (Future)

The beauty of this architecture: **when you're ready to replace n8n, you only change one thing — the Edge Function.**

### Phase 1 (Now): Use n8n
```
Game → Edge Function → n8n webhook → result
```

### Phase 2 (Later): Build custom engine
```
Game → Edge Function → your custom API → result
```

### Phase 3 (Eventually): Full integration
```
Game → Edge Function → Studio's workflow engine → result
```

The game never changes. The response contract never changes. Only the Edge Function's forwarding target changes.

### What you'll learn from n8n that informs your custom engine:
- Exact data shapes for each integration (Gmail response format, etc.)
- Which workflow patterns are actually used (linear? branching? loops?)
- Error handling patterns that matter in practice
- Which n8n features you actually need vs. which are bloat
- How credentials and OAuth token refresh should work
- Timing — how long workflows take, where bottlenecks are

---

## 18. Decision Log

| Decision | Rationale |
|----------|-----------|
| Use n8n for automations instead of building custom | Get the game loop working fast. See data shapes. Build custom later with knowledge. |
| Edge Functions as proxy to n8n | Security (no n8n URLs in client). Flexibility (swap backend later). Validation layer. |
| Keep `npc-ai-chat` as direct Edge Function | Latency-sensitive. Already works. No benefit from routing through n8n. |
| Hybrid NPC approach (direct + n8n for actions) | Best of both: fast chat + powerful automations when NPCs need to do real things. |
| `n8n_webhook_registry` table | Decouple webhook URLs from code. Enable/disable routes. Change URLs without redeploy. |
| Don't delete existing code | Everything built has value. The `object-api` Edge Function is a working reference implementation. The Studio workflow editor can evolve. |
| Standardized response format | `{ success, message, inventory_delta }` works for any backend. Game code doesn't care who generated the response. |
| Database as communication layer | Clean decoupling. Each app is independently deployable. No direct app-to-app connections. |

---

## Quick Start Checklist

When you're ready to implement:

- [ ] Apply `APPLY_TO_SUPABASE.sql` to create missing core tables
- [ ] Create `n8n_webhook_registry` table
- [ ] Verify `object_templates`, `object_instances`, `workflow_context`, `workflow_runs`, `user_integrations` tables exist
- [ ] Create the `object-action` Edge Function (proxy)
- [ ] Set up n8n and create the first webhook workflow (e.g., Mailbox → Fetch Emails)
- [ ] Register the webhook URL in `n8n_webhook_registry`
- [ ] Update `objectSpawner.ts` to call `object-action` instead of `object-api`
- [ ] Fix `contentSync.ts` schema mismatch (`'game'` → `'public'`)
- [ ] Wire `gameBroadcast.ts` into Studio NPC pages
- [ ] Test the full loop: click Mailbox in game → Edge Function → n8n → Gmail → result in game
