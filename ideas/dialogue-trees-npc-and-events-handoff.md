# Handoff Packet: Dialogue Trees for NPCs and Map Events

> **Status:** Research complete. Ready for implementation.
> **Created:** 2026-02-20
> **Context:** Studio currently has no way to author scripted dialogue (greetings, quests, choices). NPCs use a single `welcome_message` and AI chat; scripted behavior lives in code (e.g. quest-giver events). This feature adds a dialogue-tree system in Studio so authors can build scripted lines, player choices, conditions, and outcomes—and **mix** scripted segments with AI chat for the same NPC, plus attach trees to **non-NPC map events** (signs, doors, triggers) so the same format drives both NPC and world dialogue.

---

## 1. The Idea

**Authors create scripted dialogue trees in Studio and attach them to NPCs and/or map events.** A tree is a graph of nodes: lines (NPC/text), choices (player options with optional conditions), and end nodes (outcomes: show text, give item, set variable, open GUI). When the player talks to an NPC that has a tree, the game runs the tree first; an end node can **hand off to AI** so the rest of the conversation is AI-driven. When the player interacts with a map event that has an assigned tree, the game runs the same tree (no AI). One data format and one runner for both NPCs and events; NPCs get an optional “when to run script” (every time vs first time only) and “hand off to AI” at the end of the scripted block.

---

## 2. Why This Matters

- **Control with AI NPCs:** You keep authored moments (greeting, quest offer, turn-in) while still using AI for open conversation. Scripted first, then hand off to AI in one conversation.
- **Reuse for world interaction:** Same trees and runner for map events (signs, doors, triggers)—no second system. Studio assigns a tree to an event id; game looks up and runs it on interaction.
- **No code for scripted content:** Quest givers, merchants, and one-off events can be authored in Studio instead of editing RPG-JS event classes.
- **Single conversation = scripted then AI:** One “talk” session can run a tree (e.g. greeting + quest offer) then continue with the existing NPC AI chat when the tree ends with “hand off to AI.”

---

## 3. Architecture

```
Studio
  dialogue_trees (table): id, name, description, tree (JSONB)
  agent_configs.dialogue_tree_id (optional), behavior.dialogue_tree_trigger
  dialogue_tree_assignments (table): dialogue_tree_id, entity_type, entity_id
       │
       │  Author creates/edits trees; attaches to NPC (form) or event (assignments UI)
       ▼
Game server (RPG-JS)
  On NPC talk:
    if dialogue_tree_id && trigger → fetch tree, run tree (state machine)
    if end node has handoffToAi → run NPC AI chat for next input
  On map event interact:
    lookup dialogue_tree_assignments (entity_type=map_event, entity_id)
    if found → fetch tree, run same tree runner (no talkWith; no AI handoff)
       │
       ▼
Tree runner (shared)
  State: currentNodeId, player
  Line → showText; Choice → showChoices + conditions; End → run actions (+ optional handoffToAi)
  Outcomes: show_text, give_item, give_gold, set_variable, open_gui
```

---

## 4. How It Works Today (Before)

- **Studio:** `src/pages/NPCs.tsx`, `src/components/npcs/NPCFormModal.tsx` — NPC form has name, prompt, `welcome_message` (single string), category, skills, spawn, behavior. No dialogue tree. No UI for map events.
- **Game:** `my-rpg-game/main/services/npcSpawner.ts` — On talk, if AI NPC: greeting is a hardcoded random line (not `welcome_message` from DB), then AI chat via Edge Function. Scripted behavior is in code (e.g. `test-toolkit/modules/combat/events/quest-giver.ts`: `showText`, `getVariable`/`setVariable`).
- **Supabase:** `agent_configs` has `welcome_message`; no `dialogue_trees` or `dialogue_tree_assignments`. No assignment of scripted dialogue to map events.

---

## 5. How It Should Work (After)

1. **Studio — Dialogue Trees list:** New page (e.g. “Dialogue” in sidebar). List all `dialogue_trees`; Create / Edit / Delete. Edit opens tree editor.
2. **Studio — Tree editor:** Form or simple node list: add Line / Choice / End nodes; set text, next node, choices (label, next, optional condition), end actions. Save writes `tree` JSONB (version, startNodeId, nodes). Optional: default first line from NPC `welcome_message` when creating a tree for an NPC.
3. **Studio — NPC form:** Dropdown “Dialogue tree” (optional); “When to run script”: Every time (then AI) | First time only (then AI) | Never. Saves `dialogue_tree_id` and `behavior.dialogue_tree_trigger` (or equivalent).
4. **Studio — Map events:** UI to assign a tree to an event (e.g. event id or mapId:eventId). Writes `dialogue_tree_assignments` (entity_type=`map_event`, entity_id).
5. **Game — NPC talk:** If NPC has `dialogue_tree_id` and trigger ≠ never: (first_time_only: check player var `met_<npc_id>`). Run tree. If current node is End with `handoffToAi: true`: run actions, then wait for next input and call existing NPC AI chat (same session). Else (no tree or trigger never): current behavior (AI + greeting).
6. **Game — Map event interact:** Resolve event to entity_id; lookup `dialogue_tree_assignments`; if tree, run same tree runner; no AI handoff.
7. **Tree runner:** Shared state machine: Line → showText (talkWith for NPC, none for event); Choice → showChoices, filter by condition (player var); End → run outcome actions; support handoffToAi for NPC only.

---

## 6. API / Data Contracts

### Dialogue tree (JSONB in `dialogue_trees.tree`)

```ts
interface DialogueTree {
  version: 1;
  startNodeId: string;
  nodes: Record<string, DialogueNode>;
}

type DialogueNode = LineNode | ChoiceNode | EndNode;

interface LineNode {
  type: 'line';
  text: string;
  nextNodeId: string | null;
  choices?: Choice[];
}

interface Choice {
  id: string;
  label: string;
  nextNodeId: string;
  condition?: Condition;
}

interface Condition {
  type: 'variable';
  key: string;
  op: 'eq' | 'neq' | 'gte' | 'gt' | 'lte' | 'lt' | 'set' | 'notSet';
  value?: string | number;
}

interface ChoiceNode {
  type: 'choice';
  prompt?: string;
  choices: Choice[];
}

interface EndNode {
  type: 'end';
  actions?: OutcomeAction[];
  handoffToAi?: boolean;   // NPC only: after actions, next input goes to AI
}

type OutcomeAction =
  | { type: 'show_text'; text: string }
  | { type: 'give_item'; itemId: string; count?: number }
  | { type: 'give_gold'; amount: number }
  | { type: 'set_variable'; key: string; value: string | number }
  | { type: 'open_gui'; guiId: string; data?: Record<string, unknown> };
```

### NPC config (behavior / dialogue)

| Field | Type | Description |
|-------|------|-------------|
| dialogue_tree_id | UUID (agent_configs) | Optional; references dialogue_trees.id |
| dialogue_tree_trigger | 'always_first' \| 'first_time_only' \| 'never' | When to run tree (default when tree set: always_first) |

### dialogue_tree_assignments (map events / objects)

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| dialogue_tree_id | UUID | FK dialogue_trees(id) ON DELETE CASCADE |
| entity_type | TEXT | e.g. 'map_event', 'object_instance' |
| entity_id | TEXT | e.g. event name, or mapId:eventName |
| UNIQUE(entity_type, entity_id) | | One tree per entity |

### Game → Tree fetch

- **Option A:** Game server (or Edge Function) fetches by id: `GET /dialogue-tree/:id` or Supabase `from('dialogue_trees').select('tree').eq('id', id).single()`.
- **Option B:** When loading NPCs/maps, batch-fetch trees for all assigned entities and cache in memory.
- Contract: response is `{ tree: DialogueTree }` or the row’s `tree` JSONB.

---

## 7. Implementation Plan

### Phase 1 — Data and types

1. **Migration:** Add table `dialogue_trees` (id UUID PK, name TEXT, description TEXT, tree JSONB NOT NULL, created_at, updated_at). Add column `agent_configs.dialogue_tree_id` UUID NULL FK dialogue_trees(id) ON DELETE SET NULL. Add table `dialogue_tree_assignments` (id UUID PK, dialogue_tree_id UUID NOT NULL FK, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, UNIQUE(entity_type, entity_id)).
2. **Types:** Regenerate Supabase types. Add TypeScript interfaces for DialogueTree, DialogueNode, Choice, Condition, OutcomeAction in Studio (e.g. `src/types/dialogue.ts`) and in game (e.g. `my-rpg-game/main/types/dialogue.ts` or shared).

### Phase 2 — Studio: list and attach

3. **Dialogue Trees page:** Create `src/pages/DialogueTrees.tsx`. List `dialogue_trees` (name, description, updated_at). Create (insert placeholder), Edit (navigate to editor), Delete (with confirm). Add route and sidebar entry in `App.tsx` and `Sidebar`.
4. **NPC form:** In `NPCFormModal.tsx`, add dropdown “Dialogue tree” (options from dialogue_trees), optional “When to run script” (always_first / first_time_only / never). Save/load `dialogue_tree_id` and trigger in behavior or dedicated column.

### Phase 3 — Studio: tree editor

5. **Tree editor page:** Create `src/pages/DialogueTreeEditor.tsx` (or inline in DialogueTrees with id in state). Toolbar: name, description, Save, Cancel. Node list: Add Line / Choice / End; each node has type-specific fields (text, nextNodeId, choices with label/nextNodeId/condition, end actions). Validate: startNodeId exists; all nextNodeIds reference existing nodes.
6. **Persistence:** On Save, upsert `dialogue_trees` (name, description, tree). Optionally default first Line text from `agent_configs.welcome_message` when creating from NPC context.

### Phase 4 — Studio: map event assignments

7. **Assignments UI:** Add UI to assign a tree to a map event: e.g. “Event ID” (text), “Map ID” (text), “Dialogue tree” (dropdown). Save to `dialogue_tree_assignments` with entity_type=`map_event`, entity_id=`mapId:eventName` or agreed convention. Could be a dedicated “Map event dialogue” page or section in Map Browser / Map Agent.

### Phase 5 — Game: load and run tree (NPCs)

8. **Fetch tree:** When loading NPCs with dialogue_tree_id, fetch tree (Supabase from server or Edge Function). Cache by tree id.
9. **NPC onAction:** If dialogue_tree_id set and trigger allows: run tree (state machine). Line → player.showText(text, { talkWith: this }); Choice → show choices (filter by condition via player.getVariable); End → run actions (setVariable, addItem, gold, gui.open). If End has handoffToAi: set “next input to AI” and on next message call existing NPC AI chat. For first_time_only, set player var e.g. met_<npc_id> after first run.
10. **No tree / trigger never:** Keep current behavior (greeting + AI chat).

### Phase 6 — Game: run tree for map events

11. **Event interact:** In RpgEvent onAction (or equivalent) for map events that are not AI NPCs: resolve event to entity_id (e.g. mapId:eventName). Lookup dialogue_tree_assignments by entity_type=map_event, entity_id. If found, fetch tree and run same tree runner; showText without talkWith (or with event as speaker if engine supports). No handoffToAi.

### Phase 7 — Polish

12. **Edit from NPC:** When editing an NPC with dialogue_tree_id, “Edit dialogue tree” link to open tree editor for that tree.
13. **Validation:** In editor, ensure no orphan nodes; startNodeId and all nextNodeIds exist.

---

## 8. Database Changes

```sql
-- New table: dialogue trees
CREATE TABLE IF NOT EXISTS public.dialogue_trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  tree JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- NPC link (optional)
ALTER TABLE public.agent_configs
  ADD COLUMN IF NOT EXISTS dialogue_tree_id UUID REFERENCES public.dialogue_trees(id) ON DELETE SET NULL;

-- Assignments for map events (and optionally other entities)
CREATE TABLE IF NOT EXISTS public.dialogue_tree_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dialogue_tree_id UUID NOT NULL REFERENCES public.dialogue_trees(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_dialogue_tree_assignments_lookup
  ON public.dialogue_tree_assignments(entity_type, entity_id);
```

If `dialogue_tree_trigger` is stored on the NPC, add to `agent_configs.behavior` JSONB (e.g. `behavior.dialogue_tree_trigger`) or add a dedicated column; document in API contract.

---

## 9. What Changes in Existing Code

| File | Change | Breaking? |
|------|--------|------------|
| `studio/src/App.tsx` | Add Page and case for dialogue-trees (and dialogue-editor if separate) | No |
| `studio/src/components/ui-custom/Sidebar.tsx` | Add nav item for Dialogue Trees | No |
| `studio/src/components/npcs/NPCFormModal.tsx` | Add dialogue tree dropdown and “when to run script” | No |
| `studio/src/integrations/supabase/types.ts` | Regenerate after migration (new table, new column) | No |
| `my-rpg-game/main/services/npcSpawner.ts` (or equivalent) | Branch on dialogue_tree_id; fetch and run tree; handoff to AI when End has handoffToAi | No (additive) |
| Game: map event classes or object spawner | Resolve event id; lookup assignment; run tree if present | No (additive) |

---

## 10. What Stays the Same

- Existing NPC AI chat (Edge Function, memory, tools) unchanged when no tree or when tree has ended and handoffToAi was used.
- Existing workflow editor and Game Scripts page unchanged (dialogue trees are a separate feature; workflow-based dialogue can be a later phase).
- agent_configs columns other than optional dialogue_tree_id and behavior.dialogue_tree_trigger unchanged.
- RPG-JS APIs: player.showText, showChoices (or equivalent), setVariable, getVariable, addItem, gold, gui.open—use as today.

---

## 11. Gotchas and Edge Cases

- **showChoices in RPG-JS:** Confirm the exact API (e.g. `player.showChoices(labels)` or choice-by-number). If only showText exists, model choices as “numbered options” and parse input.
- **First-time only:** Use a player variable (e.g. `met_<npc_id>`) set after first tree run; clear only if you add “reset” logic. Persistence is per player.
- **Event id convention:** Agree on entity_id format for map events (e.g. `mapId:eventName` or event name only). Game and Studio must use the same convention when writing/reading assignments.
- **Handoff to AI:** After handoff, the next message is sent to the existing NPC chat API; history already contains the scripted turns if you append them to memory, or the AI may see only “player continues conversation.” Decide whether to inject a short system message so the model knows the prior exchange was scripted.
- **Orphan nodes:** Editor should prevent saving nodes that are never reachable from startNodeId; or allow but runner never visits them.

---

## 12. Sources

### Codebase References

- `studio/src/pages/NPCs.tsx` — NPC list and modal open/close
- `studio/src/components/npcs/NPCFormModal.tsx` — NPC form fields, save shape, welcome_message
- `studio/src/integrations/supabase/types.ts` — agent_configs Row/Insert/Update
- `studio/src/pages/GameScripts.tsx` — Existing “Coming Soon” vision for scripted dialogue (workflow-based; this handoff is tree-based and complementary)
- `my-rpg-game/main/services/npcSpawner.ts` — onAction, greet, handleConversation, AI chat flow
- `test-toolkit/modules/combat/events/quest-giver.ts` — Example scripted dialogue with showText, getVariable, setVariable

---

## 13. Open Questions

1. **RPG-JS choice UI:** Does the engine have a built-in “show choices and return selected index/label,” or must we use showText + number input / custom GUI?
2. **entity_id for events:** Should assignments use Tiled event name only, or composite (mapId + eventName) for same name on different maps? Affects Studio dropdown (list maps? list events per map?).
3. **Where to store dialogue_tree_trigger:** In `agent_configs.behavior` JSONB vs a dedicated column. Behavior is already JSON; keeping it there avoids another column.
4. **Memory for scripted turns:** When tree runs, should scripted lines be appended to agent_memory so the AI (after handoff) sees them? If yes, need to write assistant turns to memory during tree run.
