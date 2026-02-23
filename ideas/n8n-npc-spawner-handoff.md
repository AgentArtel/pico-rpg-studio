# Handoff Packet: Spawn NPCs from n8n Workflows

> **Status:** Research complete. Ready for implementation.
> **Created:** 2026-02-18
> **Context:** Part of the larger architectural shift to decouple the game from custom workflow execution and use n8n as the automation backend.

---

## 1. The Idea

On game server startup, query the n8n REST API for all active workflows tagged `"npc"`, extract game metadata (spawn position, map, sprite, personality) from inside each workflow, and spawn them as live NPCs on the RPG-JS map. When a player interacts with an NPC, the game calls that workflow's webhook to handle the conversation/action.

**n8n becomes the single source of truth for what NPCs exist, where they spawn, and what they do.**

---

## 2. Why This Matters

Currently, NPC definitions live in the `agent_configs` Supabase table and are managed via the Studio UI. The new architecture decouples things so:

- **n8n owns the NPC logic** — each NPC is a workflow. The workflow IS the NPC.
- **No custom workflow engine needed** — n8n handles all the automation, AI calls, integrations.
- **Full visibility** — you can see every NPC's conversation flow, API calls, and data transforms in n8n's UI.
- **Each NPC's behavior is self-contained** — one workflow = one NPC = one webhook endpoint.
- **Adding a new NPC = creating a new n8n workflow** with the right tag and config node.

---

## 3. Architecture

```
Game Server Startup
    │
    ▼
Call n8n API (via Edge Function or directly from server)
    GET /api/v1/workflows?tags=npc&active=true
    Header: X-N8N-API-KEY: <key>
    │
    ▼
For each workflow in response:
    ├─ Parse "NPC Config" Set node → { npcName, mapId, spawnX, spawnY, spriteName, personality, ... }
    ├─ Parse Webhook node → webhook path → full webhook URL
    │
    ▼
Spawn RPG-JS dynamic event at (spawnX, spawnY) on mapId
    - Graphic = spriteName
    - On interaction → POST to that NPC's webhook URL
    │
    ▼
Player interacts with NPC
    │
    ▼
Game Server → Edge Function (proxy) → n8n webhook → workflow runs → response
    │
    ▼
Game displays NPC response text, applies inventory changes, etc.
```

---

## 4. n8n Workflow Structure (Per NPC)

Each NPC workflow in n8n should follow this pattern:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Webhook    │────>│  NPC Config  │────>│  AI / Logic  │────>│   Respond    │
│  (trigger)   │     │  (Set node)  │     │  (your flow) │     │ to Webhook   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Webhook Node
- Type: `n8n-nodes-base.webhook`
- Method: POST
- The `parameters.path` field contains the UUID used to construct the URL
- Production URL: `https://<n8n-host>/webhook/<path>`

### NPC Config Node (Set Node)
- Type: `n8n-nodes-base.set`
- Name: **must be `"NPC Config"`** (this is how the game finds it)
- Contains key-value assignments with game metadata:

| Field | Type | Required | Example | Purpose |
|-------|------|----------|---------|---------|
| `npcName` | string | Yes | `"Mira the Merchant"` | Display name in game |
| `mapId` | string | Yes | `"village_square"` | Which map to spawn on |
| `spawnX` | number | Yes | `200` | X pixel coordinate |
| `spawnY` | number | Yes | `300` | Y pixel coordinate |
| `spriteName` | string | Yes | `"female_villager"` | RPG-JS sprite/graphic name |
| `personality` | string | No | `"friendly merchant"` | Used as AI system prompt context |
| `wanderRadius` | number | No | `50` | Pixels the NPC wanders from spawn |
| `welcomeMessage` | string | No | `"Welcome to my shop!"` | Text shown on first interaction |

### AI / Logic Nodes
- This is the actual NPC behavior — entirely up to the workflow designer
- Could be: AI Agent node, Gmail integration, Slack, database queries, anything n8n supports
- Receives the player interaction payload from the webhook

### Respond to Webhook Node
- Must return the standardized game response format (see section 8)

---

## 5. n8n Tags Convention

| Tag | Purpose |
|-----|---------|
| `npc` | **Required.** Marks this workflow as an NPC. The game queries for this tag. |
| `active-world` | Optional. Could distinguish NPCs meant for live game vs. test NPCs. |
| `<map-name>` | Optional. e.g., `village_square`. Allows filtering NPCs by map. |
| `<npc-type>` | Optional. e.g., `merchant`, `quest-giver`, `hostile`. For categorization. |

---

## 6. n8n API Reference (What You Need)

### Authentication

All API calls use the `X-N8N-API-KEY` header.

**How to create an API key:**
1. n8n dashboard → Settings → n8n API
2. Create an API key, copy it (shown only once)
3. Store in environment variable (`N8N_API_KEY`)

### List Workflows (the main call)

```http
GET /api/v1/workflows?tags=npc&active=true
Host: <your-n8n-host>
X-N8N-API-KEY: <your-api-key>
```

**Response:**
```json
{
  "data": [
    {
      "id": "wf_abc123",
      "name": "Mira the Merchant",
      "active": true,
      "tags": [
        { "id": "1", "name": "npc" },
        { "id": "2", "name": "village_square" }
      ],
      "nodes": [
        {
          "name": "Webhook",
          "type": "n8n-nodes-base.webhook",
          "parameters": { "path": "5aff8c63-06c1-436b-a6e2-698b227c22d5" },
          "webhookId": "5aff8c63-06c1-436b-a6e2-698b227c22d5"
        },
        {
          "name": "NPC Config",
          "type": "n8n-nodes-base.set",
          "parameters": {
            "assignments": {
              "assignments": [
                { "name": "npcName", "value": "Mira the Merchant", "type": "string" },
                { "name": "mapId", "value": "village_square", "type": "string" },
                { "name": "spawnX", "value": 200, "type": "number" },
                { "name": "spawnY", "value": 300, "type": "number" },
                { "name": "spriteName", "value": "female_villager", "type": "string" },
                { "name": "personality", "value": "friendly merchant", "type": "string" }
              ]
            }
          }
        }
      ],
      "connections": { ... },
      "settings": { ... }
    }
  ],
  "nextCursor": null
}
```

### Pagination

If `nextCursor` is not null, there are more results:
```http
GET /api/v1/workflows?tags=npc&active=true&cursor=<nextCursor>&limit=100
```

### Other Useful Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/workflows/{id}` | Get full details of a single workflow |
| `GET /api/v1/tags` | List all tags on the instance |
| `POST /api/v1/workflows/{id}/activate` | Activate a workflow (spawns the NPC) |
| `POST /api/v1/workflows/{id}/deactivate` | Deactivate a workflow (despawns the NPC) |
| `GET /api/v1/executions?workflowId={id}&limit=1` | Last execution of a workflow |

---

## 7. Implementation Plan

### Step 1: Create a new service — `n8nService.ts`

Location: `my-rpg-game/main/services/n8nService.ts`

Responsibilities:
- Fetch NPC workflows from n8n API on startup
- Parse NPC Config nodes into game-ready objects
- Reconstruct webhook URLs from Webhook nodes
- Cache the workflow list in memory
- Optionally refresh on a timer or on-demand

**Pseudocode:**
```typescript
interface N8nNpcConfig {
  workflowId: string;
  workflowName: string;
  webhookUrl: string;       // full URL: https://n8n-host/webhook/<path>
  npcName: string;
  mapId: string;
  spawnX: number;
  spawnY: number;
  spriteName: string;
  personality?: string;
  wanderRadius?: number;
  welcomeMessage?: string;
}

class N8nService {
  private apiKey: string;      // from env: N8N_API_KEY
  private baseUrl: string;     // from env: N8N_BASE_URL (e.g. https://your-n8n.com)
  private cache: N8nNpcConfig[] = [];

  async fetchNpcWorkflows(): Promise<N8nNpcConfig[]> {
    const allWorkflows = [];
    let cursor = null;

    do {
      const url = new URL(`${this.baseUrl}/api/v1/workflows`);
      url.searchParams.set('active', 'true');
      url.searchParams.set('tags', 'npc');
      url.searchParams.set('limit', '100');
      if (cursor) url.searchParams.set('cursor', cursor);

      const res = await fetch(url.toString(), {
        headers: { 'X-N8N-API-KEY': this.apiKey }
      });
      const data = await res.json();
      allWorkflows.push(...data.data);
      cursor = data.nextCursor;
    } while (cursor);

    // Client-side tag verification (safety net for known n8n bug)
    const npcWorkflows = allWorkflows.filter(w =>
      w.tags?.some(t => t.name === 'npc')
    );

    this.cache = npcWorkflows.map(w => this.parseWorkflow(w));
    return this.cache;
  }

  private parseWorkflow(workflow: any): N8nNpcConfig {
    // Find the NPC Config Set node
    const configNode = workflow.nodes.find(
      (n: any) => n.name === 'NPC Config' && n.type === 'n8n-nodes-base.set'
    );

    // Extract assignments into a key-value map
    const assignments = configNode?.parameters?.assignments?.assignments ?? [];
    const config: Record<string, any> = {};
    for (const a of assignments) {
      config[a.name] = a.value;
    }

    // Find the Webhook node and reconstruct the URL
    const webhookNode = workflow.nodes.find(
      (n: any) => n.type === 'n8n-nodes-base.webhook'
    );
    const webhookPath = webhookNode?.parameters?.path ?? webhookNode?.webhookId;

    return {
      workflowId: workflow.id,
      workflowName: workflow.name,
      webhookUrl: `${this.baseUrl}/webhook/${webhookPath}`,
      npcName: config.npcName ?? workflow.name,
      mapId: config.mapId ?? 'simplemap',
      spawnX: Number(config.spawnX) || 0,
      spawnY: Number(config.spawnY) || 0,
      spriteName: config.spriteName ?? 'hero',
      personality: config.personality,
      wanderRadius: Number(config.wanderRadius) || 0,
      welcomeMessage: config.welcomeMessage,
    };
  }

  getNpcsByMap(mapId: string): N8nNpcConfig[] {
    return this.cache.filter(npc => npc.mapId === mapId);
  }
}
```

### Step 2: Modify NPC spawner to accept n8n configs

Update `npcSpawner.ts` to create dynamic events from `N8nNpcConfig` objects. The key difference: when the player interacts, the game calls the NPC's `webhookUrl` (via Edge Function proxy) instead of the `npc-ai-chat` Edge Function.

### Step 3: Hook into game server startup

In `server.ts` `onStart()`:
```
1. Initialize N8nService
2. Call fetchNpcWorkflows()
3. For each NPC config, spawn on the correct map
```

This replaces (or supplements) the current `contentSync.loadAllNPCs()` which reads from `agent_configs` in Supabase.

### Step 4: Create the Edge Function proxy (optional but recommended)

If you don't want the n8n webhook URLs in the game server env (or want to add validation/logging), create an `npc-interact` Edge Function:

```typescript
// Game server calls:
POST /functions/v1/npc-interact
{ workflow_id: "wf_abc123", player_id: "...", message: "Hello" }

// Edge Function:
// 1. Look up webhook URL (from a registry table, or call n8n API)
// 2. Forward to n8n webhook
// 3. Return response to game
```

**Alternative:** Since the game server is a Node.js backend (not a browser client), it CAN call n8n webhooks directly without CORS issues. The Edge Function proxy adds a security layer but is not strictly necessary for server-to-server calls.

### Step 5: Environment variables needed

```env
# In my-rpg-game/.env (or equivalent)
N8N_BASE_URL=https://your-n8n-instance.com   # no trailing slash
N8N_API_KEY=n8n_api_xxxxxxxxxxxxxxxxx
```

---

## 8. Response Contract (n8n Webhook → Game)

Every NPC workflow's "Respond to Webhook" node must return this shape:

```json
{
  "success": true,
  "text": "Hello traveler! Welcome to my shop.",
  "toolCalls": [],
  "inventory_delta": {
    "add": [],
    "remove": []
  },
  "data": {}
}
```

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `success` | boolean | Yes | Did the workflow complete successfully |
| `text` | string | Yes | What the NPC says — shown in game dialogue |
| `toolCalls` | array | No | Game actions: `[{ name: "move", arguments: { direction: "left" } }]` |
| `inventory_delta` | object | No | Items to add/remove from player inventory |
| `data` | object | No | Arbitrary extra data (quest progress, flags, etc.) |

On error:
```json
{
  "success": false,
  "error": {
    "code": "AI_TIMEOUT",
    "message": "The merchant seems lost in thought...",
    "retryable": true
  }
}
```

---

## 9. Gotchas and Edge Cases

### Tags Filter Bug
The `?tags=npc` parameter had a known bug (returned all workflows regardless) in n8n versions before v1.119.1. **Always do client-side tag verification** as a safety net.

### CORS
n8n doesn't set CORS headers by default. Not an issue for server-to-server calls (game server → n8n), but if you ever call from a browser, set `N8N_CORS_ALLOW_ORIGIN=*` in n8n's env.

### Webhook URL Only Works When Workflow is Active
If a workflow is deactivated, its production webhook URL returns 404. The test webhook (`/webhook-test/`) only works while the workflow editor is open. So `active: true` in the API query is essential.

### Set Node Parameter Structure
The Set node stores values in `parameters.assignments.assignments[]` (yes, double-nested). Each assignment has `{ name, value, type }`. Don't confuse with older Set node versions which used a different structure (`parameters.values.string[]`, etc.) — check your n8n version. The v2 Set node uses the `assignments` structure.

### Pagination
If you have more than ~100 NPC workflows (unlikely but possible), you need to loop with `cursor`. The implementation plan above handles this.

### Dev Auth Fallback
The current game server falls back to a hardcoded UUID when no auth token is provided. NPC webhook interactions that require a real player ID won't work in this mode. Keep this in mind for local development.

### Caching and Refresh
Fetch the workflow list once on startup. For live updates (new NPC added in n8n), options are:
- Periodic refresh (every 5 minutes)
- Manual trigger (admin command in game)
- Supabase Realtime notification (n8n writes a "refresh" signal to a table, game listens)
- n8n workflow that calls a game server endpoint when a new NPC workflow is activated

---

## 10. Relationship to Existing Systems

### What this replaces
- `contentSync.ts` `loadAllNPCs()` — currently reads from `agent_configs` table. The n8n approach replaces this as the primary NPC source.

### What this does NOT replace
- `npcSpawner.ts` `createNPCClass()` — still needed to create dynamic RPG-JS events. Just fed from a different data source.
- `aiService.ts` — may still be used for NPCs that don't need full n8n workflows (simple chat-only NPCs).
- `memoryService.ts` — conversation memory can still persist to `agent_memory`. The n8n workflow can also manage memory internally.

### Coexistence
Both systems can coexist:
- **n8n NPCs:** Fetched from n8n API, interactions go through webhooks.
- **Legacy NPCs:** Fetched from `agent_configs`, interactions go through `npc-ai-chat` Edge Function.
- The game server can load from both sources and merge the NPC lists.

---

## 11. Sources

### Official Documentation
- n8n Public REST API: https://docs.n8n.io/api/
- n8n API Reference: https://docs.n8n.io/api/api-reference/
- n8n API Authentication: https://docs.n8n.io/api/authentication/
- n8n Workflow Tags: https://docs.n8n.io/workflows/tags/
- n8n Static Data: https://docs.n8n.io/code/cookbook/builtin/get-workflow-static-data/

### Community & Bug Reports
- Tags filter bug: https://community.n8n.io/t/get-api-v1-workflows-tags-parameter-does-not-filter-results/220577
- Set workflow tags via API: https://community.n8n.io/t/set-workflow-tags-via-api/21305
- Get webhook URL from dynamic workflow: https://community.n8n.io/t/how-to-get-the-webhook-url-from-a-dynamically-created-workflow-using-the-n8n-api/205715
- Listing running executions: https://community.n8n.io/t/tutorial-listing-running-workflow-exections-with-api/172501

### GitHub Issues
- Executions `running` status not filterable: https://github.com/n8n-io/n8n/issues/19664
- Executions list missing `status` field: https://github.com/n8n-io/n8n/issues/20706

---

## 12. Open Questions (For When You Return)

1. **Should the game server call n8n API directly, or go through a Supabase Edge Function?** Server-to-server is fine for the API call. The webhook interactions should probably go through an Edge Function for consistency with the proxy pattern.

2. **Should n8n NPC workflows also write their config to `agent_configs` in Supabase?** This would let the Studio dashboard still show NPC stats without needing to call the n8n API. A simple "on activate" hook in n8n could sync to the table.

3. **How should conversation memory work for n8n NPCs?** Options: (a) n8n manages memory internally via Supabase nodes in the workflow, (b) the game server still saves to `agent_memory` and passes history to the webhook, (c) both.

4. **What happens when an NPC workflow is deactivated in n8n?** Should the game detect this and despawn the NPC? A periodic refresh of the workflow list would handle this.

5. **Naming convention for the NPC Config Set node** — is `"NPC Config"` good, or would you prefer something else? This is the key the parser looks for.
