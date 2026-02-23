# Handoff Packet: Studio Node Library from Game API Spec

> **Status:** Research complete. Ready for implementation.
> **Created:** 2026-02-20
> **Context:** Today the Studio workflow editor’s “Game” category is hardcoded: six node types in `NodeSearchPalette.tsx`, config schemas in `nodeConfig.ts`, and types in `types/index.ts`. Adding a new game action (e.g. move-to, play-sound, interact-with) requires code changes in multiple places. This feature drives the Game node library from a **game API spec** (DB table or JSON file) so new actions appear in the palette and in execution without hardcoding each node type. Depends on or complements the game control bridge (see `studio-game-control-node-library-handoff.md`).

---

## 1. The Idea

**The Studio “Game” node palette and node configs are generated from a single source of truth — a game API spec.** The spec lists every action the game supports (id, label, description, parameters with type/required/default). Studio loads this spec (on app load or when opening the workflow editor), builds the Game category in the node palette from it, and generates or looks up config schemas so each node has the right fields. Execution still sends the same contract (`object_type: 'game'`, `action`, `player_id`, `inputs`); the bridge on the game server already dispatches by action. So: **one spec, one place to add new actions;** Studio and the game stay in sync without editing palette/config/type files by hand.

---

## 2. Why This Matters

- **Today:** Adding a new game action (e.g. play-sound, move-to, interact-with) requires edits in `NodeSearchPalette.tsx`, `nodeConfig.ts`, `types/index.ts`, `WorkflowEditorPage.tsx` (title map), and `useExecution.ts` (if not generic). Easy to forget a file or get out of sync.
- **After:** Add or update a row in the spec (DB or JSON); Studio reads it and shows the new node with the right fields. Game server adds the same action to the bridge; no Studio code change for the palette.
- **Single source of truth:** Game authors (or our team) define “what the game can do” once; Studio reflects it. Useful for multiple games or when the game API evolves.

---

## 3. Architecture

```
Game API spec (source of truth)
    │  Stored in: Supabase table (e.g. game_api_actions) OR static JSON (e.g. game-api-spec.json)
    │  Shape: { id, action, label, description, icon?, parameters: [{ id, type, label, required, default }] }
    ▼
Studio: load spec (on init or when opening editor)
    │  Fetch from Supabase or import JSON
    ▼
Build Game category
    │  One palette entry per spec row → NodeSearchPalette "Game" nodes
    ▼
Build config schemas
    │  Convert parameters → NodeConfigSchema fields (text, number, json, etc.); add playerId
    ▼
Execution
    │  Node type = e.g. game-{action} or generic game-action with config.action; same body to bridge
    ▼
Game control bridge (existing)
    │  Dispatches by action; no change needed if actions are already implemented
```

---

## 4. How It Works Today (Before)

- **Palette:** `studio/src/components/canvas/NodeSearchPalette.tsx` — `nodeCategories` includes a hardcoded `game` category with six entries: `game-show-text`, `game-give-item`, `game-give-gold`, `game-teleport`, `game-open-gui`, `game-set-variable`. Each has id, type, label, description, icon.
- **Config:** `studio/src/lib/nodeConfig.ts` — One `NodeConfigSchema` per game node type (e.g. `gameShowTextConfigSchema`), with sections and fields (text, mapId, x, y, playerId, etc.). Schemas are registered in a `schemas` object keyed by node type.
- **Types:** `studio/src/types/index.ts` — `NodeType` is a union that includes each game node type string.
- **Editor:** `studio/src/pages/WorkflowEditorPage.tsx` — `handleAddNode` uses a `titleMap` that maps node type to title/subtitle for the new node; game types are listed explicitly.
- **Execution:** `studio/src/hooks/useExecution.ts` — A switch/case block lists each game node type and builds `object_type`, `action`, `player_id`, `inputs` from node type and config. Adding a new type requires adding a case or a generic branch.

---

## 5. How It Should Work (After)

1. **Spec is defined** (once): Either (A) a Supabase table `game_api_actions` with columns e.g. `id`, `action`, `label`, `description`, `icon`, `parameters` (JSONB), or (B) a JSON file (e.g. in Studio or fetched from a URL) with an array of action definitions. Each action has `action` (e.g. `show-text`, `teleport`, `play-sound`) and `parameters` (array of `{ id, type, label, required, defaultValue }`).
2. **Studio loads spec** when the app or workflow editor loads: fetch from Supabase (e.g. `from('game_api_actions').select('*')`) or load JSON. Cache in memory or React state/context.
3. **Palette:** The Game category is built from the spec: for each action, add an entry with `type: \`game-${action}\`` (or a single generic type with `action` in config), `label`, `description`, and an icon (from spec or a default).
4. **Config:** For each action, generate a `NodeConfigSchema`: one section, fields = mapping of `parameters` to config fields (text, number, json, etc.) plus the shared `playerId` field. Either register these dynamically in `getNodeConfigSchema` (lookup by node type) or prebuild a map from the spec at load time.
5. **Types:** Either (A) keep extending `NodeType` with literal types for each action (harder to keep in sync) or (B) use a single type e.g. `'game-action'` and store `action` in the node config; execution reads `config.action` and sends it in the request body.
6. **Execution:** Either (A) one case per known action (generated or hand-maintained) or (B) a single generic case for all game nodes: build `action` from `node.type` (strip `game-` prefix) or from `config.action`, and `inputs` from config (all keys except `playerId`). Same payload to the bridge.
7. **Result:** Adding a new action = add row to spec (or entry to JSON). Studio shows the new node; execution sends the new action; bridge must implement it on the game server (see game-control handoff).

---

## 6. API / Data Contracts

### Game API spec (per action)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Unique key (e.g. `show-text`, `play-sound`) |
| action | string | Yes | Same as id; used in request body (e.g. `show-text`) |
| label | string | Yes | Display name in palette (e.g. "Show Text") |
| description | string | No | Short description for palette tooltip |
| icon | string | No | Icon name or identifier (e.g. lucide icon name) |
| parameters | array | Yes | List of parameter definitions (see below) |

### Parameter (per parameter)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Key in `inputs` (e.g. `text`, `soundId`) |
| type | string | Yes | One of: text, textarea, number, json, select |
| label | string | Yes | Field label in config panel |
| required | boolean | No | Default false |
| defaultValue | any | No | Default for the field |
| placeholder | string | No | Placeholder text |
| options | array | No | For select: `[{ label, value }]` |

### Example spec (JSON)

```json
[
  {
    "id": "show-text",
    "action": "show-text",
    "label": "Show Text",
    "description": "Display a message to the player",
    "icon": "MessageSquare",
    "parameters": [
      { "id": "text", "type": "textarea", "label": "Message", "required": true },
      { "id": "talkWith", "type": "text", "label": "Talk With (optional)" }
    ]
  },
  {
    "id": "play-sound",
    "action": "play-sound",
    "label": "Play Sound",
    "description": "Play a sound for the player",
    "icon": "Volume2",
    "parameters": [
      { "id": "soundId", "type": "text", "label": "Sound ID", "required": true },
      { "id": "forEveryone", "type": "select", "label": "For everyone on map", "defaultValue": false, "options": [{ "label": "No", "value": false }, { "label": "Yes", "value": true }] }
    ]
  }
]
```

### Studio → bridge request (unchanged)

Same as in `studio-game-control-node-library-handoff.md`: `{ object_type: 'game', action, player_id, inputs }`. The spec only defines what appears in the palette and how `inputs` are built from the node config; the contract is unchanged.

---

## 7. Implementation Plan

### Step 1: Define spec format and source

- **Option A (Supabase):** Create table `game_api_actions` (or reuse an existing table). Columns: `id`, `action`, `label`, `description`, `icon`, `parameters` (JSONB). Seed with current six actions + any new ones. Add a migration.
- **Option B (JSON):** Add a file e.g. `studio/public/game-api-spec.json` or `studio/src/data/gameApiSpec.json` with the array of actions. Optionally fetch from a URL at runtime.
- Document the schema so the game team can add actions.

### Step 2: Load spec in Studio

- **Location:** `studio/src/hooks/useGameApiSpec.ts` (new) or similar.
- **Logic:** On mount (or when opening workflow editor), fetch spec from Supabase or import/load JSON. Return `{ actions: GameActionSpec[], loading, error }`. Cache so we don’t refetch every time.
- **Context (optional):** Provide spec via React context so palette and config can consume it.

### Step 3: Build Game category from spec

- **Location:** `studio/src/components/canvas/NodeSearchPalette.tsx`.
- **Change:** Instead of a hardcoded `game` category with six nodes, build it from the spec: `actions.map(a => ({ id: \`game-${a.action}\`, type: \`game-${a.action}\`, label: a.label, description: a.description, icon: getIcon(a.icon) }))`. If spec is loaded async, show a loading state or fallback to a minimal list until loaded.
- **Icons:** Map icon name (string) to Lucide component (e.g. a map from spec icon to component).

### Step 4: Config schema from spec

- **Location:** `studio/src/lib/nodeConfig.ts` (or a new `studio/src/lib/gameNodeConfig.ts`).
- **Change:** Add a function `getGameNodeConfigSchema(actionSpec): NodeConfigSchema` that builds a schema from one spec entry: one section, fields = parameters mapped to ConfigField (type, label, required, defaultValue, etc.) plus the shared `playerId` field. Then either:
  - **Dynamic lookup:** In `getNodeConfigSchema(nodeType)`, if `nodeType.startsWith('game-')`, load spec (or use cached), find action, and return `getGameNodeConfigSchema(action)`.
  - **Prebuild:** When spec loads, build a map `gameSchemas[nodeType] = getGameNodeConfigSchema(action)` and merge into or override the main schemas object.
- **Backward compatibility:** Keep existing hardcoded game schemas as fallback if spec fails to load or for specific types that need custom UI.

### Step 5: Node type and execution

- **Option A (one type per action):** Keep `NodeType` including e.g. `'game-show-text' | 'game-play-sound' | ...`. Either extend the union from the spec at runtime (if TypeScript allows) or use a generic `'game-action'` and treat `game-*` as string.
- **Option B (generic game-action):** Add `'game-action'` to NodeType; node config holds `action: string` and the rest of inputs. Palette still shows one node per spec entry but the node’s `type` is `game-action` and `config.action` is the action id. Execution always uses `config.action` and `config` for inputs.
- **Execution:** In `useExecution.ts`, either (1) keep a case per known game type that builds action from node.type (e.g. `node.type.replace('game-', '')`) and inputs from config, or (2) one case for all `node.type.startsWith('game-')` or `node.type === 'game-action'`: `action = config.action ?? node.type.replace('game-', '')`, `inputs = { ...config }` (omit playerId or pass it as top-level player_id). Same body to the bridge.

### Step 6: Editor title map (if needed)

- **Location:** `studio/src/pages/WorkflowEditorPage.tsx` — `handleAddNode` titleMap.
- **Change:** For game nodes, either (1) add a generic entry for `game-action` or for any `game-*` type, or (2) build title map from spec (e.g. `game-${a.action}: { title: a.label, subtitle: a.description }`). So new actions get a title without editing the map.

### Step 7: Seed spec with current actions

- Add rows (or JSON entries) for: show-text, give-item, give-gold, teleport, open-gui, set-variable. Match current fields in `nodeConfig.ts`. Then add new actions (e.g. play-sound, move-to, interact-with) as they are implemented on the bridge.

---

## 8. Database Changes

**Only if using Supabase as spec source:**

```sql
CREATE TABLE IF NOT EXISTS public.game_api_actions (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  parameters JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed with current six actions (example for one)
INSERT INTO public.game_api_actions (id, action, label, description, icon, parameters)
VALUES (
  'show-text',
  'show-text',
  'Show Text',
  'Display a message to the player',
  'MessageSquare',
  '[{"id":"text","type":"textarea","label":"Message","required":true},{"id":"talkWith","type":"text","label":"Talk With (optional)"}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
-- Repeat for give-item, give-gold, teleport, open-gui, set-variable.
```

If using JSON file only: **N/A** for DB.

---

## 9. What Changes in Existing Code

| File | Change | Breaking? |
|------|--------|-----------|
| `studio/src/components/canvas/NodeSearchPalette.tsx` | Game category built from spec instead of hardcoded array | No (same UX) |
| `studio/src/lib/nodeConfig.ts` | Dynamic schema for game-* types from spec, or new getGameNodeConfigSchema + lookup | No (same schema shape) |
| `studio/src/types/index.ts` | Add `game-action` or keep extending union from spec (see Step 5) | Possibly (if union changes) |
| `studio/src/hooks/useExecution.ts` | One generic case for game nodes building action/inputs from config | No |
| `studio/src/pages/WorkflowEditorPage.tsx` | Title map for game nodes from spec or generic | No |
| New: `studio/src/hooks/useGameApiSpec.ts` (or similar) | Load and cache spec | No |
| New: `studio/src/data/game-api-spec.json` (optional) | Static spec if not using DB | No |

---

## 10. What Stays the Same

- Request/response contract to the game control bridge (`object_type`, `action`, `player_id`, `inputs`).
- Behavior of non-Game nodes (triggers, AI, HTTP, etc.).
- Game server bridge: it already dispatches by `action`; no change needed for bridge logic, only for adding new actions on the game side (see game-control handoff).

---

## 11. Gotchas and Edge Cases

- **Spec load failure:** If the spec fails to load (network, missing table), fall back to a minimal hardcoded list or show an error so the user can still use the editor.
- **TypeScript and dynamic node types:** If node types are fully dynamic (`game-${action}`), TypeScript’s `NodeType` may need to be `... | \`game-${string}\`` or a generic `game-action`; ensure execution and config code handle both.
- **Icons:** Spec may store icon as string; Studio must map to a Lucide component. Missing icon → use a default (e.g. Gamepad2).
- **Parameter types:** Map spec `type` to `nodeConfig` field types (text, textarea, number, json, select). If spec adds a new type (e.g. “map”), extend the mapping.
- **Versioning:** If the game API and Studio are deployed separately, ensure the spec is backward compatible (e.g. optional parameters) so old Studio doesn’t break when new actions are added.

---

## 12. Sources

### Codebase References

- `studio/src/components/canvas/NodeSearchPalette.tsx` — nodeCategories, game category.
- `studio/src/lib/nodeConfig.ts` — game node schemas (gameShowTextConfigSchema, etc.), getNodeConfigSchema, schemas object.
- `studio/src/types/index.ts` — NodeType union.
- `studio/src/hooks/useExecution.ts` — game node cases, body building.
- `studio/src/pages/WorkflowEditorPage.tsx` — handleAddNode, titleMap.
- `ideas/studio-game-control-node-library-handoff.md` — bridge, action/inputs contract.

---

## 13. Open Questions

1. **Spec source priority:** Start with JSON file (simpler, no migration) or Supabase table (editable without deploy)? Can support both: try Supabase first, fallback to JSON.
2. **Single type vs many:** Use one node type `game-action` with `config.action` vs. one type per action (`game-show-text`, etc.). Single type simplifies TypeScript and execution; per-action type matches current structure and may be easier for palette/config generation.
3. **Who edits the spec:** Only developers (file or DB migration) or should Studio have a “Game API” admin page to add/edit actions? Latter implies Supabase and a UI.
4. **Game server spec sync:** Should the game server read the same spec to validate incoming actions or to expose a “list of supported actions” endpoint? If so, spec might live in a shared repo or DB only.
