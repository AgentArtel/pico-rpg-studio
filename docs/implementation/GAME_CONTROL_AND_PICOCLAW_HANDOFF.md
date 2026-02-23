# Handoff: Game Control API + PicoClaw `game_control` Tool (Option A, Scale-Ready)

> **Status:** Research complete. Ready for Claude Code to turn into sprint + task briefs.  
> **Created:** 2026-02-20  
> **Task delegation:** See [TASK_DELEGATION.md](./TASK_DELEGATION.md). Assign implementation to **Cursor** (logic, APIs, tools) and **Lovable** (deploy, DB, Edge Functions, bugs).

---

## For Claude Code — Next Steps

1. **Read** this handoff and [TASK_DELEGATION.md](./TASK_DELEGATION.md).
2. **Produce** a **sprint** (e.g. `docs/implementation/sprints/YYYY-MM-game-control-picoclaw/`) with:
   - **MASTER_PLAN.md** — phases, dependencies, and order of work.
   - **Task briefs** — one file per task (or one doc with sections), each labeled **Assignee: Cursor** or **Assignee: Lovable** per the delegation rules.
3. **Reference** the action → RPG-JS mapping in `ideas/studio-game-control-node-library-handoff.md` (Section 6) when writing the dispatch-layer and `game_control` tool briefs.
4. **Order** tasks so that: session store + game server dispatch exist before the Control API; Control API exists before the PicoClaw tool and Studio routing.

---

## 1. Purpose

- **Game Control API:** One HTTP API that accepts `player_id`, `action`, and `inputs`, resolves the player to the correct game server, and runs RPG-JS `RpgPlayer` methods (show text, give item, teleport, set variable, etc.). Built for **scale** (stateless API + session store + multiple game servers).
- **PicoClaw integration:** Add a single **`game_control`** tool so NPC agents can call this API during their loop. NPCs can then show dialogue, give items, set quest variables, and teleport players from within the agent.
- **Player identity:** Design for **per-player accounts and profiles**, stable **playerId**, and **persistent chatId per NPC** so each NPC “remembers” a player across sessions.

This handoff summarizes research (what’s built in Studio and PicoClaw), the chosen design (Option A, scalable), and player-identity decisions so **Claude Code** can produce a sprint, master plan, and task briefs for **Cursor** and **Lovable**.

---

## 2. Research Summary — What’s Built

### 2.1 Studio (as-is)

- **Game nodes:** Six node types: `game-show-text`, `game-give-item`, `game-give-gold`, `game-teleport`, `game-open-gui`, `game-set-variable`. Configs in `studio/src/lib/nodeConfig.ts`; execution in `studio/src/hooks/useExecution.ts`.
- **Execution path:** Game nodes build `{ object_type: 'game', action, player_id, inputs }` and call `supabase.functions.invoke('object-action', { body })`. **object-action** looks up `n8n_webhook_registry` by `action_key = game.<action>`. No `game.*` webhooks are seeded, so result is typically `NO_WORKFLOW` and the **game server is never driven**.
- **No direct game control:** There is no Edge Function or game-server endpoint that receives these payloads and calls `RpgPlayer` methods. See `ideas/studio-game-control-node-library-handoff.md` for the intended bridge.

### 2.2 PicoClaw Integration (as-is)

- **NPC → PicoClaw:** When an NPC has a row in `picoclaw_agents` with `agent_config_id = npcId` and `deployment_status = 'running'`, **npc-ai-chat** (Edge Function) forwards the player message to PicoClaw:
  - `POST ${PICOCLAW_GATEWAY_URL}/v1/chat`
  - Body: `{ message, session_key: "${picoclaw_agent_id}:${npcId}_${playerId}", channel: 'game', agent_id }`
- **PicoClaw response:** Gateway returns a single final text `{ response, session_key }`. Tool calls are executed **inside** PicoClaw only; the game never sees tool_calls. npc-ai-chat returns `{ text: pcData.response, toolCalls: [] }`.
- **Memory:** After PicoClaw responds, npc-ai-chat writes user and assistant messages to `agent_memory` with `session_id = ${npcId}_${playerId}`, `npc_id`, `player_id`. So conversation history is keyed by (npc, player).
- **PicoClaw tools (today):** Per-agent tools: web search, web fetch, read/write file, exec, message, spawn (subagent), cron. Skills can register additional tools. Tools can implement `ContextualTool` and receive `(channel, chatID)`.
- **Studio ↔ PicoClaw:** **picoclaw-bridge** Edge Function handles deploy/stop/status; pushes config and workspaces to PicoClaw. Agents are linked to NPCs via `picoclaw_agents.agent_config_id`.

### 2.3 Game Server (my-rpg-game)

- **Auth / player id:** On connect, the game server uses a `playerId` (from auth/token). Same id is used in Supabase (`player_state`, workflows) and in npc-ai-chat as `playerId`.
- **No control API:** No HTTP or Socket endpoint exists for “control player by id.” All `RpgPlayer` usage is inside server code (events, hooks). `RpgWorld.getPlayer(playerId)` requires the player to be **connected** (in World).

### 2.4 RPG-JS Built-in API

- **Express `/api`:** Optional, configured in `rpg.toml` with `[api] enabled = true` and `authSecret`. Current routes: `GET /api/players`, `PUT /api/maps`, `PUT /api/tilesets`, `PUT /api/worlds`. **No** player control (show text, give item, teleport, variables). So a **new** control surface is required (either extend this API or add a separate control service that talks to the game server).

---

## 3. Chosen Approach — Option A, Scale-Ready

- **Single tool name:** One PicoClaw tool, **`game_control`**, with parameters: `player_id`, `action`, `inputs` (JSON). The LLM chooses the action and inputs; the tool does one HTTP POST to the Game Control API.
- **Single Game Control API:** One stateless HTTP API (e.g. `POST /game-control` or equivalent) with body `{ player_id, action, inputs }`. It:
  - Authenticates the request (e.g. Bearer token or internal secret).
  - Resolves “which game server has this player?” from a **session store** (e.g. Redis or Supabase table: `player_id → game_server_id` or URL).
  - Forwards the command to that game server (or returns “player not connected”).
- **Game server (per instance):** Exposes a small **internal** control endpoint (or subscribes to a queue) that only the Control API (or trusted backend) calls. It resolves `RpgPlayer` via `RpgWorld.getPlayer(player_id)` and runs a **dispatch layer**: `switch (action)` → `player.showText(...)`, `player.addItem(...)`, `player.changeMap(...)`, etc. See `ideas/studio-game-control-node-library-handoff.md` for the action → RPG-JS mapping table.
- **Scale:** Control API can run many replicas behind a load balancer. Game servers scale independently. Session store is the only shared state. PicoClaw is just another client of the Control API via the `game_control` tool.

---

## 4. Player Identity and Persistent Chat (Design for Scale)

- **Player account and profile:** Each player has an account; identity is a stable **playerId** (e.g. Supabase auth user id or a dedicated game profile id). Design all APIs and tools to use this **playerId** as the canonical key for “who is this player.”
- **Persistent chatId with NPCs:** So NPCs “remember” players across sessions:
  - **Stable session key for PicoClaw:** Keep a **persistent chatId** per (player, NPC) pair. For example: `chatId = playerId` (one chat per player per NPC) or `chatId = ${playerId}_${npcId}` if you need multiple threads per NPC. Current npc-ai-chat uses `session_key = ${picoclaw_agent_id}:${npcId}_${playerId}` and `session_id = ${npcId}_${playerId}` for `agent_memory`. Recommend:
    - **session_key** (PicoClaw): Include both agent and conversation identity, e.g. `{agent_id}:game:{playerId}:{npcId}` so PicoClaw’s session is stable per player per NPC.
    - **chat_id** (for tools): Pass a stable `chat_id` when channel is `game`, e.g. `playerId` or `playerId_npcId`, so the `game_control` tool (or future ContextualTools) can default `player_id` from context if desired.
  - **agent_memory:** Continue keying by `session_id = ${npcId}_${playerId}` (or the same stable id used as chat_id) so history is per player per NPC and persists.
- **Design for “each player has their own account and profile”:**
  - All control API and tool calls use **playerId**.
  - Session store maps `playerId → game_server_id` when the player is connected.
  - Optionally introduce a **profiles** or **players** table (keyed by playerId) for display name, preferences, or other profile data; out of scope for this handoff but the API should not assume “anonymous” players.

---

## 5. What Needs to Be Built (High Level)

1. **Game Control API (stateless)**  
   - Auth, validate body, resolve player → game server from session store, forward to game server’s internal control endpoint. Return success/error.  
   - **Assignee:** Cursor (design + implement). Lovable (deploy if hosted as Edge Function or separate service).

2. **Session store**  
   - When a player connects to a game server, register `player_id → game_server_id` (or URL). On disconnect, remove or TTL. Control API reads this to route.  
   - **Assignee:** Cursor (schema + game-server registration logic). Lovable (DB/Redis if applicable, deploy).

3. **Game server: internal control endpoint + dispatch layer**  
   - New route or queue consumer that receives `{ player_id, action, inputs }`, gets `RpgPlayer`, runs dispatch (showText, addItem, changeMap, setVariable, etc.), returns result.  
   - **Assignee:** Cursor.

4. **PicoClaw: `game_control` tool**  
   - One tool: name `game_control`, params `player_id`, `action`, `inputs`. Implementation: HTTP POST to the Game Control API. Tool returns API response to the LLM.  
   - **Assignee:** Cursor (tool code, register for game NPC agents). Lovable (deploy PicoClaw/config if needed).

5. **Inject player_id for game channel**  
   - So the agent can call `game_control` with the right player: either inject “current player id is `{{playerId}}`” in system or user message when npc-ai-chat calls PicoClaw, or pass `chat_id: playerId` and have the tool use it when channel is `game`.  
   - **Assignee:** Cursor (npc-ai-chat or bridge change).

6. **Studio game nodes → Game Control API**  
   - For `object_type === 'game'`, either have object-action call the Game Control API instead of n8n, or add a dedicated game-control Edge Function that calls the Control API. Same contract: `player_id`, `action`, `inputs`.  
   - **Assignee:** Cursor (execution path + optional Edge Function). Lovable (deploy Edge Function).

7. **Persistent chatId / session (optional but recommended)**  
   - Ensure npc-ai-chat (and PicoClaw) use a stable session_key and chat_id per (player, NPC) so memory and tool context are stable.  
   - **Assignee:** Cursor (spec and npc-ai-chat changes). Lovable (deploy).

---

## 6. Task Delegation Reference

- **Claude Code:** Use this handoff to create the **sprint**, **master plan**, and **task briefs**. Assign each brief to **Cursor** or **Lovable** per [TASK_DELEGATION.md](./TASK_DELEGATION.md).
- **Cursor:** Implements backend (control API, dispatch, session store, game server endpoint), PicoClaw `game_control` tool, npc-ai-chat/session changes, and Studio game-node routing.
- **Lovable:** Deploys frontend/Studio, DB and migrations, Edge Functions, and fixes backend/EF bugs using the artifacts from Claude Code and Cursor.

---

## 7. Key Files (for Claude Code and Cursor)

| Area | Path |
|------|------|
| npc-ai-chat (PicoClaw routing, session_key, memory) | `studio/supabase/functions/npc-ai-chat/index.ts` |
| PicoClaw bridge (deploy, config) | `studio/supabase/functions/picoclaw-bridge/index.ts` |
| Studio game node execution | `studio/src/hooks/useExecution.ts` |
| Studio game node configs | `studio/src/lib/nodeConfig.ts` |
| object-action | `studio/supabase/functions/object-action/index.ts` |
| agent_memory usage | `studio/supabase/functions/npc-ai-chat/index.ts`, `studio/src/lib/memoryService.ts` |
| Game server auth / player id | `my-rpg-game/main/` (e.g. server, player hooks) |
| PicoClaw tool registration | `picoclaw/pkg/agent/loop.go`, `picoclaw/pkg/tools/registry.go` |
| PicoClaw skills (custom tools) | `picoclaw/pkg/skills/loader.go`, agent loop tool registration |
| Game control bridge idea (actions ↔ RpgPlayer) | `ideas/studio-game-control-node-library-handoff.md` |

---

## 8. Out of Scope for This Handoff

- n8n workflows for game actions (game control is direct API + PicoClaw tool).
- Detailed RPG-JS action list (see ideas handoff); this doc assumes that contract exists or will be defined in a task brief.
- Full design of “profiles” or “players” table; only that playerId is stable and used everywhere.
- PicoClaw gateway scaling (multiple gateways); assumed to be handled separately.

---

## 9. Success Criteria (for Sprint)

- A stateless Game Control API exists and routes to the correct game server using a session store.
- Game server has an internal control endpoint and dispatch layer that runs RpgPlayer methods.
- PicoClaw NPCs have a `game_control` tool that calls that API; agents can show text, give items, set variables, teleport (as per action set).
- Studio game nodes (or object-action) drive the same API so workflows can control the game.
- Player identity uses a stable playerId; NPC–player conversation uses a persistent chatId/session so NPCs remember players across sessions.
