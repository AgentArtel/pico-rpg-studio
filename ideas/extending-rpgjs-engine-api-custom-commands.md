# Handoff Packet: Extending the RPG-JS Engine API (Custom Commands)

> **Status:** Research complete. Ready for implementation.
> **Created:** 2026-02-20
> **Context:** The game control bridge (see `studio-game-control-node-library-handoff.md`) dispatches to built-in RpgPlayer methods (teleport, showText, playSound, etc.). Some behaviors (e.g. “trigger interaction with event by id”) are not built into RPG-JS. This doc is the single reference for how to add new “commands” — either as methods on the player instance or as server-side helpers keyed by player_id.

---

## 1. The Idea

**Add new “commands” that the game control bridge (or any server code) can call** so that Studio workflows and in-game logic can use behaviors beyond the built-in Player Commands. Two approaches: (1) **extend `RpgPlayer`** by adding a method on the prototype (e.g. `player.triggerInteraction(eventId)`), or (2) **add server helpers** that take `player_id` (and optionally engine) and perform the action (e.g. `playSoundForPlayer(engine, playerId, soundId)`). Both integrate with the same dispatch layer; prototype methods are used when you already have a `player` instance; helpers are used when you only have an id (e.g. from Studio).

---

## 2. Why This Matters

- **Built-in commands** cover teleport, showText, playSound, addItem, setVariable, changeMap, moveTo, etc. They do not cover “run this event’s onAction for this player” or custom game logic.
- **Custom commands** keep the same mental model: “do something to/for a player.” The bridge’s switch (action) can call either a built-in method or a custom one.
- **Single reference:** This doc is the place to look when adding any new command, so we don’t duplicate the pattern in multiple handoffs.

---

## 3. Architecture

```
Dispatch layer (game control bridge)
    │  Has: player_id, action, inputs
    │  Resolves: player = World.getUser(player_id)
    ▼
Built-in command?
    │  Yes → player.teleport(inputs), player.showText(...), etc.
    │  No  → custom command
    ▼
Custom command (one of two)
    ├── Option A: player.myMethod(inputs)   ← RpgPlayer.prototype extension
    └── Option B: myHelper(engine, player_id, inputs)  ← standalone function that gets player and does work
```

---

## 4. How It Works Today (Before)

- **RPG-JS** exposes Player Commands via mixins (MoveManager, GuiManager, ItemManager, VariableManager, GoldManager, etc.). There is no built-in “trigger event interaction by id.”
- **Our game** uses `player` only inside hooks and events where the instance exists. We have not yet added prototype extensions or a formal “custom command” registry.
- **Official example:** The emotion-bubbles plugin extends `RpgPlayer.prototype.showEmotionBubble` and declares the type in `declare module '@rpgjs/server'`.

---

## 5. How It Should Work (After)

- **Option A (prototype):** In the game (or a local plugin), we add a file that (1) declares the new method on `RpgPlayer` for TypeScript, (2) implements `RpgPlayer.prototype.newMethod = function(...) { ... }`. The bridge then does e.g. `player.triggerInteraction(inputs.targetId)`.
- **Option B (helper):** We add a function e.g. `dispatchCustomAction(engine, playerId, action, inputs)` that resolves the player, then calls the appropriate logic (which may itself call a prototype method or do one-off work). The bridge calls this for actions that are not built-in.
- **Result:** New actions (e.g. `interact-with`, or future proximity) are implemented once and exposed to Studio via the same `action` + `inputs` contract.

---

## 6. API / Data Contracts

**N/A for this doc.** The contract for “custom command” is the same as the game control bridge: the bridge receives `action` + `inputs` and calls either a known built-in or a custom handler. Custom handlers can accept the same `inputs` shape as defined in `studio-game-control-node-library-handoff.md` (e.g. `interact-with` → `inputs.targetId`).

---

## 7. Implementation Plan

### Option A: Add a method on RpgPlayer (prototype)

**Location:** e.g. `my-rpg-game/main/extensions/playerCommands.ts` (or a local plugin under `plugins/`).

1. **Declare the type** so TypeScript knows about the new method:

```ts
import { RpgPlayer } from '@rpgjs/server'

declare module '@rpgjs/server' {
  export interface RpgPlayer {
    triggerInteraction: (eventId: string) => Promise<void>
  }
}
```

2. **Implement the method** on the prototype. Use `this` as the player; use `this.getCurrentMap()`, engine APIs, etc., to resolve the event and call its `onAction`:

```ts
RpgPlayer.prototype.triggerInteraction = async function (eventId: string) {
  const map = this.getCurrentMap()
  if (!map) return
  // Resolve event by id — exact API depends on RPG-JS (e.g. map.getEventById or iterate events)
  const event = (map as any).getEventById?.(eventId) ?? /* fallback */
  if (event && typeof event.onAction === 'function') {
    await event.onAction(this)
  }
}
```

3. **Import this file** once at server startup (e.g. in `server.ts` or the module that loads first) so the prototype is extended before any request is handled.

4. **Bridge:** In the game control dispatch, for `action === 'interact-with'`, call `player.triggerInteraction(inputs.targetId)`.

### Option B: Add a helper (by player_id)

**Location:** Same file or a dedicated `gameControlBridge.ts`.

1. **Implement a function** that takes engine (or scene), player_id, and inputs:

```ts
export async function playSoundForPlayer(
  engine: RpgServerEngine,
  playerId: string,
  soundId: string,
  forEveryone?: boolean
): Promise<void> {
  const player = World.getUser(playerId) as RpgPlayer
  if (!player) return
  player.playSound(soundId, forEveryone ?? false)
}
```

2. **Bridge:** For actions that don’t map to a single `player.*` call, the dispatch layer calls this helper (or a generic `dispatchCustom(engine, playerId, action, inputs)` that switches on action and calls the right helper).

### Adding more commands later

- **Prototype:** Add another `declare module` + `RpgPlayer.prototype.anotherMethod = ...` in the same or a new file; ensure it’s loaded at startup.
- **Helper:** Add another case in the bridge’s switch or in `dispatchCustom`, and implement the helper that resolves player and performs the action.

---

## 8. Database Changes

**N/A** — no schema changes for adding custom commands.

---

## 9. What Changes in Existing Code

| File | Change | Breaking? |
|------|--------|-----------|
| `my-rpg-game/main/extensions/playerCommands.ts` (new) | Declare + implement prototype and/or helpers | No |
| `my-rpg-game/main/server.ts` (or entry module) | Import extensions so prototype is registered at startup | No |
| Game control bridge (when implemented) | Add cases for custom actions that call new method or helper | No |

---

## 10. What Stays the Same

- Built-in RPG-JS Player Commands unchanged.
- Studio payload shape (`object_type`, `action`, `player_id`, `inputs`) unchanged.
- No change to RPG-JS core or node_modules.

---

## 11. Gotchas and Edge Cases

- **Load order:** Prototype extensions must run before any code that receives the first game-control request. Import the extensions file in the server entrypoint or in the module that creates the engine.
- **Event resolution:** RPG-JS may not expose `getEventById`; you may need to iterate map events or maintain a custom registry keyed by event id. Document how event ids are defined (Tiled name, map+name, etc.).
- **Type declaration scope:** `declare module '@rpgjs/server'` augments the interface globally. If you have multiple files that extend RpgPlayer, they can all declare in the same module block or merge; avoid duplicate declarations for the same method name.

---

## 12. Sources

### Official Documentation

- RPG-JS create-plugin: `docs/advanced/create-plugin.md` (RpgModule, config).
- Emotion-bubbles plugin (prototype extension): `RPG-JS/packages/plugins/emotion-bubbles/src/server.ts` — `declare module` + `RpgPlayer.prototype.showEmotionBubble`.

### Codebase References

- `my-rpg-game/node_modules/@rpgjs/server` — RpgPlayer, GuiManager, MoveManager (built-in commands).
- `ideas/studio-game-control-node-library-handoff.md` — Bridge, action → inputs mapping, custom command mention (Step 5).

---

## 13. Open Questions

1. **Event id format:** How are event ids defined (per-map, global, Tiled object name)? Needed to implement `triggerInteraction` robustly.
2. **Registry for custom actions:** Should the bridge maintain a `Map<action, handler>` so new custom commands are registered without editing the switch statement, or is a switch sufficient for a small set of actions?
