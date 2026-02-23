# Game documentation

Short reference for the Workflow RPG game server codebase (this package).

## Architecture

The game syncs with **Supabase** for content, NPCs, workflow objects, and player state. At startup it loads the game registry and subscribes to real-time changes. The **NPC spawner** and **object spawner** read from the database and create/update/remove NPCs and workflow objects on maps. The **workflow runner** and **AI service** power object actions and NPC conversations. **ContentSync** (realtime) keeps the game in sync with Studio edits (new NPCs, object placements, etc.) without a restart.

## Key modules

All paths below are under `main/`.

| Module | Role |
|--------|------|
| **`services/npcSpawner`** | Spawns/updates/removes NPCs from DB; handles NPC actions and AI chat via `aiService` and `memoryService`. |
| **`services/objectSpawner`** | Spawns workflow objects (e.g. Mailbox, Desk) on maps; uses `workflowRunner` for object actions. |
| **`realtime/contentSync`** | Subscribes to Supabase realtime; drives NPC and object spawn/update/despawn via npcSpawner and objectSpawner. |
| **`services/workflowRunner`** | Runs workflow executions (e.g. fetch mail, process data) and records results. |
| **`services/aiService`** | Calls AI APIs (e.g. Kimi, Gemini, Groq) for NPC responses and idle thoughts. |
| **`services/memoryService`** | Stores and retrieves NPC conversation history per player. |
| **`services/gameRegistrySync`** | Syncs game registry (maps, etc.) from Supabase at startup. |
| **`events/`** | RPG-JS event classes (e.g. Mailbox, Desk, villager) that define map interactables. |
| **`items/`** | Game item definitions (e.g. EmailItem, TaggedEmail, Summary) used in inventory and workflows. |

## Adding content

- **Maps and worlds** — Add or edit Tiled maps and world in `main/worlds/` (e.g. `worlds/maps/*.tmx`, `worlds/myworld.world`).
- **Events (NPCs / objects)** — Add new event classes in `main/events/` and register them in the game; for **database-driven NPCs and workflow objects**, create and edit them in **Studio** and the DB—they are spawned automatically by the NPC and object spawners.
- **Items** — Add item definitions under `main/items/` (and DB/schema as needed).

## Environment and Supabase

- **Env vars** — See the [repository root README](../../README.md) and the [game readme](../readme.md). Required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in `my-rpg-game/.env`.
- **Migrations and setup** — Run Supabase migrations and scripts from `supabase/` (e.g. `supabase/migrations/`, `supabase/setup-database.sh`). Full steps are in the root README.
