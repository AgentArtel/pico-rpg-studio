# Handoff Packet: Game Features as RPG-JS Plugins

> **Status:** Research complete. Ready for implementation.
> **Created:** 2026-02-20
> **Context:** The game (my-rpg-game) implements several features inline in `main/` — realtime Supabase sync for NPCs, player state sync, dynamic AI NPCs, object spawner, conversation memory, and Studio broadcast. This idea extracts them into RPG-JS-style plugins for **internal use only**: better structure and reuse across our own projects. **We do not publish these plugins to the RPG-JS community, npm, or the RPG-JS repo.** They stay in our repo(s) and are consumed only by our games (e.g. via local path or private package).

---

## 1. The Idea

**Turn the game’s current “inline” infrastructure into RPG-JS plugins** so that: (1) Supabase realtime → entity sync, (2) player state → Supabase, (3) config-driven AI NPCs with pluggable memory/AI, (4) Supabase conversation memory, (5) database-driven map objects with “onAction → API,” and (6) Studio ↔ game broadcast are each a separate, configurable, installable module. The game then becomes a consumer of these plugins plus game-specific content (events, items, handlers). No single “mega plugin” — one idea per plugin, with clear boundaries and config.

---

## 2. Why This Matters

- **Reuse:** Our own games (and future projects) can use “sync entities from Supabase” or “persist player position to a table” without reimplementing.
- **Maintainability:** Bug fixes and improvements live in one place; the game just upgrades the plugin.
- **Testing:** Plugins can be unit-tested in isolation; the game only tests its own content.
- **Clear boundaries:** Game-specific logic (Mailbox, Desk, Archivist, email items) stays in the game; only the generic patterns move into plugins.

**Scope — no public publishing:** These plugins are **not** published to the RPG-JS community, npm, or the RPG-JS repository. They are private/internal modules used only within our codebase (e.g. `./plugins/rpgjs-entity-sync` or a private package). The RPG-JS plugin format (e.g. `RpgModule`, `config.json`) is used for consistency and structure only.

### Policy (how we use plugins day-to-day)

- **Plugins apply to the game only** (not Studio). Studio does not use RPG-JS plugins; the only exception is a game-side plugin whose purpose is to connect with Studio (e.g. game-control bridge).
- **Internal-only:** We do not publish. Same structure and optional `config.json` for organization; no npm or `rpgjs-*` requirement.
- **Leave existing code in `main/` as-is.** This handoff describes a possible extraction; until we do it, ContentSync, npcSpawner, etc. stay in `main/`. **New** separable systems should go into `./plugins/` or `./modules/` and be registered in the game’s `rpg.toml`. See `ideas/internal-plugins-policy.md`.

---

## 3. Architecture (Target State)

```
rpgjs-supabase-entity-sync (plugin)
    │  config: schema, table, getMap, optional normalizeConfig / createEntityFromRow
    │  subscribes to Supabase realtime (postgres_changes + optional broadcast)
    ▼
Game: provides spawner that turns a row → RpgEvent (or uses plugin default)

rpgjs-supabase-player-state (plugin)
    │  config: Supabase client (or URL/key), table name, optional fields to sync
    │  hooks: onJoinMap (and optionally onMove / onLeaveMap) → upsert row
    ▼
Game: no code; just config in rpg.toml

rpgjs-dynamic-ai-npcs (plugin)
    │  config: config shape; adapter interfaces: getMemory, saveMemory, generateResponse
    ▼
Game: implements adapters (Supabase + npc-ai-chat Edge Function); plugin handles spawn, onAction, tool dispatch, idle/wander

rpgjs-supabase-npc-memory (plugin, or part of dynamic-ai-npcs)
    │  config: table/schema for agent_memory
    ▼
Game: uses as default memory adapter for AI NPCs

rpgjs-supabase-object-spawner (plugin)
    │  config: table name, action URL (or adapter), optional itemClassMap / response→addItem
    ▼
Game: registers per-template handlers or uses generic “POST + optional addItem” flow

Studio broadcast (optional part of entity-sync or separate)
    │  Studio sends npc_created / npc_updated / npc_deleted via Supabase Realtime broadcast
    ▼
Entity-sync plugin: optional “instant apply” channel so game doesn’t wait for postgres_changes
```

---

## 4. How It Works Today (Before)

All logic lives inside the game repo, under `my-rpg-game/main/`:

| Feature | Current location | What it does |
|--------|------------------|--------------|
| **Realtime entity sync** | `main/realtime/contentSync.ts` | `ContentSyncService`: subscribes to `agent_configs` (postgres_changes + broadcast channel `content_broadcast`), calls `spawnNPC` / `updateNPC` / `despawnNPC` / `clearAllNPCs` from `main/services/npcSpawner.ts`. Constructor takes `getMap(mapId)`. Table/schema and “NPC” semantics are hardcoded. |
| **Player state sync** | `main/player.ts` | In `onJoinMap`, upserts to `player_state` (player_id, map_id, position, direction, last_seen_at) via Supabase. Client created from env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY). |
| **Dynamic AI NPCs** | `main/services/npcSpawner.ts` | `createNPCClass(config)`, `spawnNPC`, `updateNPC`, `despawnNPC`; uses `aiService` and `memoryService`. Config shape is `NPCConfig` from `main/types/npc.ts`. Idle behavior, move/say/emote/tool execution (including generate_image via Edge Function) are inline. |
| **Conversation memory** | `main/services/memoryService.ts` | `MemoryService`: getMemory(npcId, playerId), saveMemory(npcId, playerId, role, content). Table `agent_memory`, session_id = `${npcId}_${playerId}`. |
| **Object spawner** | `main/services/objectSpawner.ts` | Loads `object_templates` from Supabase, spawns events per template; `onAction` calls object-action Edge Function. Handlers for desk, mailbox, archivist, butler and `ITEM_CLASS_MAP` (email, tagged-email, etc.) are game-specific. |
| **Studio broadcast** | `main/realtime/broadcast.ts` (Studio) + `contentSync.setupBroadcastListener()` (game) | Studio calls `broadcastNPCCreated/Updated/Deleted`; game listens on `content_broadcast` and applies immediately so Studio doesn’t wait for postgres_changes. |

Dependencies: `server.ts` wires contentSync in `onStart`, passes `getMap` that uses `engine.getScene('map').loadMap(mapId)`. NPC spawner and object spawner are called from contentSync and server.ts after maps load.

---

## 5. How It Should Work (After)

- **Game** lists plugins in `rpg.toml` via **local paths** (or private packages), e.g. `./plugins/supabase-entity-sync`, `./plugins/supabase-player-state`, etc. We do not use public `@rpgjs/*` or publish to npm/RPG-JS.
- Each plugin exposes **config** via `config.json` and `rpg.toml` (e.g. `[supabase_entity_sync] table = 'agent_configs' schema = 'public'`). Plugin uses `@RpgModule<RpgServer>({ engine: { onStart(...) }, ... })` and optionally extends `RpgPlayer` or provides injectable adapters.
- **Game** only: (1) implements adapter interfaces (e.g. AI + memory for dynamic NPCs, or passes a custom spawner to entity-sync), (2) keeps game-specific events, items, and object handlers in `main/`, (3) removes or shrinks the current inline implementations so they delegate to the plugin or are replaced by it.
- **Result:** Same behavior for players and Studio; code is split into reusable plugins + thin game glue.

---

## 6. API / Data Contracts

This handoff describes **multiple plugins**, each with their own config and (where applicable) adapter interfaces. Exact request/response shapes are plugin-specific.

### Plugin config (per plugin)

Each plugin follows RPG-JS convention: `config.json` defines JSON Schema for its `rpg.toml` section; the plugin reads `server.globalConfig.<namespace>.*` (or equivalent). Example for entity-sync:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| schema | string | No | Supabase schema (default `public`) |
| table | string | Yes | Table to watch (e.g. `agent_configs`) |
| getMap | N/A | Yes | Injected by game: (mapId) => Promise<RpgMap \| undefined> |
| createEntityFromRow | function | No | (row) => RpgEvent class or instance; if omitted, plugin may expect a default spawner or another adapter |

### Adapter interfaces (dynamic AI NPCs)

The game implements these; the plugin calls them:

- **Memory:** `getMemory(npcId, playerId, limit?): Promise<{ role, content }[]>`; `saveMemory(npcId, playerId, role, content): Promise<void>`.
- **AI:** `generateResponse(npcId, playerId, config, history, message?): Promise<{ text, toolCalls? }>`.

Exact signatures should match what the current `memoryService` and `aiService` expose so the game can pass them in or the plugin can accept optional injectables.

### Database / Supabase

- Plugins assume Supabase client is provided (via config or env). No change to table schemas for the first version — plugins use existing tables (`agent_configs`, `player_state`, `agent_memory`, `object_templates`). Schema names and table names are configurable where it makes sense.

---

## 7. Implementation Plan

### Step 1: Create plugin scaffolding (per plugin)

For each candidate plugin, run `npx rpgjs generate module <name>` (e.g. `supabase-entity-sync`) in a **local** `plugins/` directory (e.g. `my-rpg-game/plugins/` or `kimi-rpg/plugins/`). We do not publish to npm or the RPG-JS repo. Add `config.json` with a JSON Schema for the plugin’s `rpg.toml` section. Implement server (and client if needed) entrypoints using `@RpgModule<RpgServer>({ ... })`. In `rpg.toml`, reference via path: `./plugins/supabase-entity-sync`.

### Step 2: Extract Supabase entity sync

- **New plugin:** `rpgjs-supabase-entity-sync`.
- **Move/adapt:** Logic from `my-rpg-game/main/realtime/contentSync.ts` (subscribe to table, handle INSERT/UPDATE/DELETE, reconnect, optional broadcast listener). Make table/schema configurable; accept `getMap` and optional `createEntityFromRow` or spawner interface so the game can still use `npcSpawner`-style creation.
- **Game:** In `server.ts` onStart, remove direct ContentSyncService usage; instead rely on the plugin. Pass `getMap` via plugin config or a registered hook. Keep `npcSpawner` in the game initially, or move it to a separate “dynamic NPC” plugin and have entity-sync call into it.

### Step 3: Extract player state sync

- **New plugin:** `rpgjs-supabase-player-state`.
- **Move/adapt:** The `onJoinMap` Supabase upsert from `my-rpg-game/main/player.ts` into the plugin. Plugin registers a player hook (e.g. `onJoinMap`) that reads config (table name, Supabase client or URL/key), then upserts. Optional: `onLeaveMap` or periodic sync for position.
- **Game:** Remove Supabase and player_state logic from `player.ts`; add plugin to `rpg.toml` and set table name (and credentials if not from env).

### Step 4: Extract conversation memory

- **New plugin:** `rpgjs-supabase-npc-memory` (or fold into Step 5).
- **Move/adapt:** `MemoryService` from `main/services/memoryService.ts` into the plugin. Plugin exposes a class or factory that takes Supabase client and table/schema; implements `getMemory` / `saveMemory`. Game (or dynamic-AI-NPC plugin) uses it as the memory adapter.
- **Game:** Replace `memoryService` usage with the plugin’s adapter.

### Step 5: Extract dynamic AI NPCs

- **New plugin:** `rpgjs-dynamic-ai-npcs`.
- **Move/adapt:** From `main/services/npcSpawner.ts`: create NPC class from config, onAction → load memory → call AI adapter → handle tool calls (move, say, emote, generate_image, etc.), idle/wander. Config shape (spawn, skills, behavior, model) stays; AI and memory are **adapter interfaces** the game implements (e.g. calling npc-ai-chat Edge Function and Supabase memory).
- **Game:** Implements AI and memory adapters; passes them to the plugin or registers them via config. Game keeps tool implementations that call external APIs (e.g. generate-image) or the plugin defines a “tool registry” the game fills.

### Step 6: Extract object spawner

- **New plugin:** `rpgjs-supabase-object-spawner`.
- **Move/adapt:** From `main/services/objectSpawner.ts`: load rows from a configurable table, spawn events per template. Generic “onAction”: POST to a configurable URL (or call an adapter) with object_type, action, player_id, inputs; optionally map response to `player.addItem` via an item map. Game-specific handlers (desk, mailbox, archivist, butler) stay in the game as overrides or a “handler registry” the plugin calls into.
- **Game:** Registers handlers or item map; plugin handles the rest.

### Step 7: Broadcast (optional)

- Either: extend `rpgjs-supabase-entity-sync` with an optional “broadcast channel” config so Studio can push npc_created/updated/deleted for instant apply.
- Or: small standalone plugin or document that Studio and game use a shared channel name and payload shape; game’s entity-sync (or plugin) subscribes.

### Step 8: Game cleanup

- Remove or slim down: `contentSync.ts`, player_state logic in `player.ts`, `memoryService.ts`, `npcSpawner.ts`, `objectSpawner.ts` to the minimum that delegates to plugins or stays as game-specific content.
- Update `server.ts` to rely on plugins’ onStart and hooks; ensure `getMap` and any adapters are passed per plugin requirements.
- Keep in game: `aiService.ts` (as adapter), `MailboxEvent`, `DeskEvent`, `villager`, email items, and any handler logic that is story/UX-specific.

---

## 8. Database Changes

**N/A for the refactor.** Plugins use existing tables (`agent_configs`, `player_state`, `agent_memory`, `object_templates`). If a plugin later introduces a new table (e.g. for generic “world variables”), that would be a separate migration in that plugin’s docs or repo.

---

## 9. What Changes in Existing Code

| File / area | Change | Breaking? |
|-------------|--------|-----------|
| `my-rpg-game/main/realtime/contentSync.ts` | Moved or replaced by plugin; game only wires plugin | Yes for direct imports |
| `my-rpg-game/main/player.ts` | Remove Supabase and player_state upsert; plugin handles it | No for players |
| `my-rpg-game/main/services/memoryService.ts` | Replaced by plugin adapter | Yes for callers |
| `my-rpg-game/main/services/npcSpawner.ts` | Moved or replaced by plugin; game provides adapters | Yes for contentSync and server |
| `my-rpg-game/main/services/objectSpawner.ts` | Core logic moved to plugin; game keeps handlers or registers them | Yes for server.ts spawnMapObjects |
| `my-rpg-game/main/server.ts` | Wire plugins (onStart, getMap); remove inline contentSync/spawn logic | No for auth |
| `my-rpg-game/rpg.toml` | Add `modules = [..., '@rpgjs/supabase-entity-sync', ...]` and plugin config | No |
| Studio `broadcast.ts` | Unchanged; game (or plugin) still listens on same channel | No |

---

## 10. What Stays the Same

- Supabase table schemas (agent_configs, player_state, agent_memory, object_templates).
- Studio behavior: create/update/delete NPCs, broadcast for instant apply.
- Game play: NPCs still spawn, talk, move; player position still synced; objects still call object-action; workflows unchanged.
- Game-specific content: events (Mailbox, Desk, villager), items (email, tagged-email, etc.), and any custom handler logic remain in the game repo.
- object-action Edge Function and Studio workflow execution: no change.

---

## 11. Gotchas and Edge Cases

- **Plugin load order:** If entity-sync depends on maps being loaded, ensure the game (or plugin) registers after the scene/map is ready. Current server.ts uses a setTimeout; plugins may need an engine hook that runs after maps exist.
- **getMap injection:** RPG-JS may not expose “get a map instance by id” the same way in all versions. The current code uses `engine.getScene('map').loadMap(mapId)`. Plugins that need this must receive it from the game (config or callback) rather than assume engine shape.
- **Adapter versioning:** If the game implements AI/memory adapters, their interface should be documented and versioned so plugin upgrades don’t break the game.
- **Naming:** We use local plugin names (e.g. `supabase-entity-sync`) and reference them by path in rpg.toml. The `rpgjs-*` npm naming convention is for public plugins; we are not publishing, so local names are fine. Namespacing in rpg.toml (e.g. `[supabase_entity_sync]`) should match plugin config.json namespace.
- **Where plugins live:** Plugins stay in our repo(s) only — e.g. `my-rpg-game/plugins/` or `kimi-rpg/plugins/` — and are referenced in rpg.toml as `./plugins/<name>`. No publishing to npm or the RPG-JS repo.

---

## 12. Sources

### Official Documentation

- RPG-JS: Creating a plugin — `docs/advanced/create-plugin.md` (generate module, config.json, RpgModule, naming `rpgjs-*`).
- RPG-JS: Module structure — `docs/guide/create-module.md` (client/server/index layout).
- Emotion-bubbles plugin (extending RpgPlayer): `RPG-JS/packages/plugins/emotion-bubbles/src/server.ts` — declare module + prototype extension.

### Codebase References

- `my-rpg-game/main/realtime/contentSync.ts` — ContentSyncService, subscribe, getMap, spawnNPC/updateNPC/despawnNPC.
- `my-rpg-game/main/player.ts` — onJoinMap, player_state upsert.
- `my-rpg-game/main/services/memoryService.ts` — getMemory, saveMemory, agent_memory table.
- `my-rpg-game/main/services/npcSpawner.ts` — createNPCClass, spawnNPC, aiService, memoryService, tool execution, idle behavior.
- `my-rpg-game/main/services/objectSpawner.ts` — object_templates, onAction → object-action, ITEM_CLASS_MAP, handlers.
- `my-rpg-game/main/realtime/broadcast.ts` (Studio) — broadcastNPCCreated/Updated/Deleted.
- `my-rpg-game/main/server.ts` — onStart contentSync, loadMap, spawn NPCs/objects.
- `my-rpg-game/main/types/npc.ts` — NPCConfig, AgentMemory.

---

## 13. Open Questions

1. **Order of extraction:** Should we extract in dependency order (e.g. memory first, then AI NPCs that use it), or do one plugin at a time and keep the rest inline until that plugin is stable?
2. **Where do plugins live?** Same repo (`kimi-rpg/plugins/` or `my-rpg-game/plugins/`) as local modules. We are not publishing to npm or the RPG-JS repo; only internal path references (e.g. `./plugins/supabase-entity-sync`).
3. **Default spawner in entity-sync:** Should the plugin ship a default “row → RpgEvent” that works for a generic config shape, or always require the game to provide a spawner? Default would allow “sync any table to map entities” with minimal game code.
4. **Workflow runner/recorder:** These are product-specific (workflow_templates, object-action steps). Leave them in the game, or extract a thin “workflow executor” plugin with configurable step runner and table names?
5. **Backward compatibility:** During migration, should the game keep the old code paths behind a flag (e.g. `USE_ENTITY_SYNC_PLUGIN=true`) so we can switch over without big-bang?
