# Internal Plugins Policy

> **Scope:** Game (RPG-JS). Plugins apply to the game only, not to Studio.
> **Created:** 2026-02-20

---

## Summary

- We treat all plugins as **internal-only**: same structure where it helps, but we never publish to npm or the RPG-JS community.
- **Existing code in the game’s `main/` stays as-is**; we adopt plugins/modules for **new** work.
- **Plugins = game.** Studio does not use RPG-JS plugins; the only “Studio” case is a game plugin that exists to connect with Studio (e.g. game-control bridge).

---

## Internal-only plugins

- Use the **same structure** (e.g. `plugins/<name>/` with `server/`, `client/`, `index.ts`, optional `config.json`) if it helps organization.
- **Don’t** worry about: publishing to npm, `rpgjs-*` naming, or public APIs.
- **Do** get: clear boundaries, `rpg.toml` as a list of “features,” and optional `config.json` + `globalConfig` for options.
- You can call them **modules** (folders in `modules` in `rpg.toml`) and use **plugin** when the folder has `config.json` and feels reusable.

---

## Leave as-is, organize going forward

- **Existing code** (ContentSync, npcSpawner, memoryService, objectSpawner, player state in `main/player.ts`, etc.) stays in `main/`; no big refactor.
- **New features** get organized as modules (or plugins) from day one.

| Situation | Where it lives |
|-----------|----------------|
| New, self-contained feature (e.g. a new system, integration, or subsystem) | New entry in the game’s `rpg.toml` → e.g. `./plugins/my-feature` or `./modules/my-feature` with `client/`, `server/`, `index.ts`. |
| New game content (maps, events, items, story-specific logic) | Existing `main/` (events, maps, database, `player.ts` hooks, etc.). |
| New optional/reusable behavior that needs config | Same as first row, plus a `config.json` (namespace + schema) so you can tune it from `rpg.toml`. |

---

## Where this is enforced

- **Game repo:** `my-rpg-game/.cursor/rules/internal-plugins-policy.mdc` — Cursor rule so the policy is applied when working in the game.
- **Ideas:** This file (`ideas/internal-plugins-policy.md`) — single reference for the policy.
- **Handoff:** `ideas/game-features-as-rpgjs-plugins-handoff.md` — extraction plan; includes a Policy subsection that aligns with this.
