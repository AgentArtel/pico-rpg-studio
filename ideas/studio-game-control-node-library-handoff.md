# Handoff Packet: Studio Game Control — Node Library Mapped to Game API

> **Status:** Research complete. Ready for implementation.
> **Created:** 2026-02-20
> **Context:** Studio has a workflow editor with a "Game" category of nodes (Show Text, Give Item, Give Gold, Teleport, Open GUI, Set Variable). Execution today sends these to the `object-action` Edge Function, which looks up n8n webhooks — so game control does not touch the RPG-JS game server. This feature adds a direct bridge so workflows can call the game's built-in Player Commands (teleport, showText, playSound, addItem, setVariable, etc.) and optionally extend with custom commands.

---

## 1. The Idea

**Studio workflows should be able to control the running RPG-JS game** by dispatching actions (show text, teleport, give item, play sound, move, interact with, etc.) to a specific player. The game server (or a thin Edge Function that talks to it) receives `player_id` + `action` + `inputs`, resolves the live `RpgPlayer`, and calls the corresponding RPG-JS Player Command. No n8n required for game control. Optionally, the Studio node library can be driven from a **game API spec** (DB or file) so new actions stay in sync with the game.

---

## 2. Why This Matters

- **Today:** Game nodes in Studio send to `object-action` → n8n webhook. No `game.*` webhooks are seeded, so game nodes typically get `NO_WORKFLOW`. The game server is never told to teleport a player or show text.
- **After:** One clear path: Studio (or object-action) → **game control bridge** → RPG-JS `RpgPlayer` methods. Workflows can move players, show dialog, give items, play sounds, and trigger interactions without n8n.
- **Reuse:** RPG-JS already exposes the right API (Player Commands: Move, GUI, Item, Variable, Gold, etc.). We are not reinventing it — we add the **dispatch layer** that maps `(player_id, action, inputs)` to those commands.
- **Extensibility:** Custom commands (e.g. `triggerInteraction(eventId)`) can be added via `RpgPlayer.prototype` or server helpers and exposed as new nodes/spec entries.

---

## 3. Architecture

```
Studio Workflow Editor
    │  User runs workflow with game nodes (e.g. "Teleport Player", "Play Sound")
    ▼
useExecution.ts
    │  Builds body: { object_type: 'game', action: 'teleport', player_id, inputs }
    │  Invokes object-action (or dedicated game-control endpoint)
    ▼
Option A: Supabase Edge Function (e.g. game-control)
    │  Resolves player: e.g. call game server HTTP/Socket API with same body
    ▼
Option B: Game server HTTP/Socket endpoint (my-rpg-game)
    │  Receives { player_id, action, inputs }
    │  Resolves RpgPlayer: World.getUser(player_id) or scene/map API
    ▼
Dispatch layer (new)
    │  switch (action): 'teleport' → player.teleport(inputs); 'show-text' → player.showText(...); etc.
    ▼
RPG-JS RpgPlayer (existing)
    │  player.teleport(), player.showText(), player.playSound(), player.addItem(), player.setVariable(), ...
    ▼
Game client (browser) — player sees movement, dialog, sound, etc.
```

**Data flow:** Studio sends the same contract already used for game nodes: `object_type`, `action`, `player_id`, `inputs`. The bridge turns that into one or more calls to `RpgPlayer` (and optionally custom methods).

---

## 4. How It Works Today (Before)

- **Studio** (`studio/src/`):
  - **Node palette:** Game category lists 6 node types: `game-show-text`, `game-give-item`, `game-give-gold`, `game-teleport`, `game-open-gui`, `game-set-variable`. Defined in `NodeSearchPalette.tsx`, configs in `nodeConfig.ts`, types in `types/index.ts`.
  - **Execution:** `useExecution.ts` (approx. lines 395–444) builds `object_type = 'game'`, `action` from node type (e.g. `show-text`), `player_id` from config (default `studio-test`), and `inputs` from node config. It calls `supabase.functions.invoke('object-action', { body: { object_type, action, player_id, inputs } })`.
- **object-action** (`studio/supabase/functions/object-action/index.ts`):
  - Builds `action_key = object_type + '.' + action` (e.g. `game.teleport`).
  - Looks up `n8n_webhook_registry` for that key. If found, forwards the body to the n8n webhook; otherwise returns `{ error: { code: 'NO_WORKFLOW', message: '...' } }`.
- **Game server** (`my-rpg-game/main/`):
  - Never receives these requests. No HTTP or Socket endpoint exists for "control player by id." Player commands are only used inside the server (events, hooks) where a `RpgPlayer` instance is already available.

So: **game nodes in Studio do not currently drive the game.** They go to object-action → n8n only.

---

## 5. How It Should Work (After)

1. **User** adds a game node (e.g. "Teleport Player") in Studio, sets `mapId`, `x`, `y`, `playerId` (or leave default), and runs the workflow.
2. **Studio** `useExecution.ts` sends the same payload to either:
   - **object-action** with a new behavior: for `object_type === 'game'`, call the **game control bridge** instead of n8n (e.g. forward to game server or to a dedicated Edge Function that calls the game), or
   - A **dedicated game-control** Edge Function or game server URL that implements the bridge.
3. **Bridge** (game server or Edge Function that talks to it):
   - Receives `{ object_type, action, player_id, inputs }`.
   - Resolves `RpgPlayer`: e.g. `World.getUser(player_id)` (or equivalent from RPG-JS server API).
   - If player not found, returns `{ success: false, error: 'Player not found' }`.
   - Dispatches by `action` to the corresponding Player Command (see Section 6). For example:
     - `teleport` → `player.changeMap(inputs.mapId, { x: inputs.x, y: inputs.y })` or same-map `player.teleport({ x, y })`
     - `show-text` → `player.showText(inputs.text, { talkWith: inputs.talkWith })`
     - `play-sound` → `player.playSound(inputs.soundId, inputs.forEveryone)`
     - `give-item` → `player.addItem(inputs.itemId, inputs.count ?? 1)`
     - `set-variable` → `player.setVariable(inputs.key, inputs.value)`
     - etc.
   - Returns `{ success: true, data?: any }` or `{ success: false, error: string }`.
4. **Studio** receives the result and shows it in the execution panel (already supported for object-action today).

Optional later: **Node library from spec** — load a game API spec (from Supabase table or JSON) and build the Game category and node configs from it so new actions (e.g. move-to, interact-with) appear in the palette without hardcoding each node type.

---

## 6. API / Data Contracts

The contract is the same one Studio already sends for game nodes. The bridge consumes it.

### Request (from Studio to object-action or game-control)

```json
{
  "object_type": "string — always 'game' for game control",
  "action": "string — e.g. 'show-text', 'teleport', 'give-item', 'play-sound', 'set-variable', 'open-gui', 'give-gold'",
  "player_id": "string — RPG-JS player id (e.g. Supabase user id from auth)",
  "inputs": "object — action-specific parameters (see table below)"
}
```

### Response (Success)

```json
{
  "success": true,
  "data": {}
}
```

### Response (Error)

```json
{
  "success": false,
  "error": {
    "code": "string — e.g. PLAYER_NOT_FOUND, INVALID_ACTION",
    "message": "string — human-readable"
  }
}
```

### Action → inputs mapping (and RPG-JS mapping)

| action         | inputs (key)     | RPG-JS call |
|----------------|------------------|-------------|
| `show-text`    | text, talkWith?, playerId (overridden by top-level player_id) | `player.showText(inputs.text, { talkWith })` |
| `teleport`     | mapId?, x, y     | If mapId and different map: `player.changeMap(inputs.mapId, { x, y })`; else `player.teleport({ x, y })` |
| `give-item`    | itemId, count?  | `player.addItem(inputs.itemId, inputs.count ?? 1)` |
| `give-gold`    | amount           | `player.gold += inputs.amount` (or GoldManager API) |
| `set-variable` | key, value       | `player.setVariable(inputs.key, inputs.value)` |
| `open-gui`     | guiId, data?    | `player.callGui(inputs.guiId, inputs.data)` or equivalent |
| `play-sound`   | soundId, forEveryone? | `player.playSound(inputs.soundId, inputs.forEveryone ?? false)` |
| `move-to`      | x, y, mapId?    | Same as teleport (instant) or `player.moveTo({ x, y }).subscribe()` for pathfinding |
| `move`         | direction, steps? | `player.moveByDirection(direction, deltaTime)` or compute position and moveTo |
| `interact-with`| targetId (event id) | Custom: resolve event, call `event.onAction(player)` (requires new helper or RpgPlayer.prototype method) |

**Proximity awareness:** Deferred; no contract yet. Can be added later (e.g. `get-nearby` action returning players/events in radius).

---

## 7. Implementation Plan

### Step 1: Game server — dispatch layer

**Location:** `my-rpg-game/main/` — new file e.g. `services/gameControlBridge.ts` or inside an existing server hook / HTTP route.

- Implement a function `dispatchGameAction(playerId: string, action: string, inputs: Record<string, any>): Promise<{ success: boolean; data?: any; error?: string }>`.
- Resolve player: use RPG-JS server API to get `RpgPlayer` by id (e.g. `World.getUser(playerId)` — verify exact API in `@rpgjs/server`).
- Switch on `action` and call the corresponding `player.*` method with `inputs`. Handle errors (e.g. player not found, invalid action).
- Export or call this from the place that will receive the request (next step).

### Step 2: Game server — receive requests

**Option A — HTTP endpoint on game server**

- Add an Express (or existing server) route, e.g. `POST /game-control`, body: `{ object_type, action, player_id, inputs }`.
- If `object_type !== 'game'`, return 400 or forward to existing object-action behavior.
- Call the dispatch layer from Step 1 with `player_id`, `action`, `inputs`. Return JSON `{ success, data }` or `{ success: false, error }`.
- Secure the route (e.g. API key or Supabase JWT) so only Studio or Edge Function can call it.

**Option B — Edge Function calls game server**

- New Edge Function `game-control` (or extend object-action): receives same body, calls game server HTTP endpoint (Option A) with the body, returns the response to Studio.
- Game server URL from env (e.g. `GAME_SERVER_URL`).

### Step 3: Studio — route game nodes to bridge

**Location:** `studio/src/hooks/useExecution.ts`

- For `object_type === 'game'` (or for node types that already send `object_type: 'game'`), either:
  - Call the new **game-control** Edge Function instead of object-action, or
  - Configure object-action so that when `action_key` is `game.*` it forwards to the game control bridge instead of n8n.
- No change to node config or palette required for existing 6 nodes; they already send the right shape.

### Step 4 (optional): New actions and nodes

- Add new actions to the bridge: `move-to`, `move`, `play-sound`, `interact-with` (and later proximity).
- In Studio: add corresponding node types in `NodeSearchPalette.tsx`, `nodeConfig.ts`, `types/index.ts`, and `useExecution.ts` (or generic handling so new actions work without code change if using a spec later).
- Implement `interact-with` on the game server: resolve event by id (e.g. from current map or registry), then call `event.onAction(player)`.

### Step 5 (optional): Add custom commands via prototype

**Location:** e.g. `my-rpg-game/main/extensions/playerCommands.ts` or a plugin.

- Example: `player.triggerInteraction(eventId)`.
- Declare in `declare module '@rpgjs/server' { export interface RpgPlayer { triggerInteraction(eventId: string): Promise<void> } }`.
- Implement `RpgPlayer.prototype.triggerInteraction = async function(eventId) { ... }` (resolve event, call onAction). Then in the bridge, for `action === 'interact-with'`, call `player.triggerInteraction(inputs.targetId)`.

---

## 8. Database Changes

**N/A for the minimal bridge.** Existing tables (`studio_workflows`, `studio_executions`, `n8n_webhook_registry`) are unchanged for this feature.

If later you add a **game API spec** table (e.g. `game_api_actions`) to drive the node library, that would be a new migration. Not required for the first version.

---

## 9. What Changes in Existing Code

| File | Change | Breaking? |
|------|--------|-----------|
| `my-rpg-game/main/server.ts` (or new file) | Add game control bridge + HTTP route or hook that receives and dispatches game actions | No |
| `studio/src/hooks/useExecution.ts` | For game nodes, call game-control (or object-action with new behavior) instead of only object-action → n8n | No — same payload shape |
| `studio/supabase/functions/object-action/index.ts` (optional) | If routing game.* to bridge: add branch that calls game server or game-control Edge Function instead of n8n | No |

---

## 10. What Stays the Same

- Studio workflow editor UI, node palette, and node config schemas for existing game nodes (no change required for first version).
- RPG-JS Player Commands: we use them as-is (teleport, showText, playSound, addItem, setVariable, etc.). No fork or patch of the engine.
- object-action behavior for non-game actions (mailbox, desk, n8n webhooks) — unchanged unless you explicitly route only `game.*` to the bridge.
- Supabase auth and player_id: game server already associates socket with user id; bridge uses that same id to resolve `RpgPlayer`.

---

## 11. Gotchas and Edge Cases

- **Player not in game:** If `player_id` is valid in DB but the player is not connected (no live socket), `World.getUser(player_id)` may be null. Bridge should return a clear error (e.g. `PLAYER_NOT_CONNECTED`) so Studio can show a sensible message.
- **Map/event resolution:** For `teleport` to another map, ensure `mapId` is loaded on the server. For `interact-with`, event ids may be per-map or global — document how event ids are produced (e.g. Tiled event name, or a custom registry).
- **Async commands:** Some RPG-JS methods return Promises (e.g. `changeMap`, `showText`). Bridge must await them and return only after the command completes (or document fire-and-forget for specific actions if needed).
- **object-action vs game-control:** If object-action is used for both n8n and game control, ensure game.* never hits n8n (e.g. check object_type first and route to bridge before looking up n8n_webhook_registry).

---

## 12. Sources

### Official Documentation

- RPG-JS docs — Player Commands Server-Side: Common, Move, GUI, Item, Variable, Gold Commands (local: `docs/commands/*.md`, or docs.rpgjs.dev if available).
- RPG-JS create-plugin / create-module: `docs/advanced/create-plugin.md`, `docs/guide/create-module.md`.

### Codebase References

- `studio/src/hooks/useExecution.ts` (lines ~395–444) — game node execution, object-action invoke.
- `studio/supabase/functions/object-action/index.ts` — action_key lookup, n8n forward.
- `studio/src/components/canvas/NodeSearchPalette.tsx` — Game category node list.
- `studio/src/lib/nodeConfig.ts` — game node config schemas.
- `my-rpg-game/node_modules/@rpgjs/server` — RpgPlayer (Player.ts, GuiManager, MoveManager, VariableManager, ItemManager, GoldManager).
- `my-rpg-game/main/player.ts` — onJoinMap player_state sync; no game control today.
- `my-rpg-game/main/server.ts` — auth, onStart (contentSync, spawn NPCs/objects); no HTTP route for control.

---

## 13. Open Questions

1. **Where should the bridge live?** Game server HTTP route vs. Edge Function that calls the game server — tradeoffs: latency, auth, and whether the game server is always reachable from Supabase (e.g. same network or public URL).
2. **Exact API for resolving player by id:** Confirm in `@rpgjs/server` the correct way to get `RpgPlayer` from a string id (e.g. `World.getUser(id)`, or scene/map iteration). May depend on RPG-JS version.
3. **Event id for interact-with:** How are event ids defined (Tiled event name, map + name, or a custom id from object_templates)? Needed to implement `triggerInteraction` or equivalent.
4. **Node library from spec:** Should the first version hardcode the 6 existing nodes + new ones (move-to, move, play-sound, interact-with), or introduce a `game_api_actions` table (or JSON spec) and generate palette/config from it from the start?
5. **Proximity and other future actions:** Leave as placeholder in the handoff; implement when needed.
