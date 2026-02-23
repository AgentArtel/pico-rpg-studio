# Workflow RPG: Senior Developer Brief

**Purpose:** Handoff document for a senior developer to understand the product vision and technical direction of “N8N as an RPG,” and to produce a concrete implementation plan. No implementation work is requested from this brief—only planning and design.

**One-line concept:** *“What if N8N was actually an RPG game?”*

---

## 1. Vision Summary

We want to build **workflow automation as a game**. Instead of connecting nodes on a canvas (N8N/Zapier style), the user:

- **Walks** to objects in a 2D game world (e.g. mailbox, desk, bulletin board).
- **Carries** “data” as inventory items (e.g. emails, tagged emails, summaries).
- **Interacts** with objects (e.g. “get mail,” “drop on desk to tag,” “pin summary to board”).
- **Records** their play session and can **save it as a workflow** to replay later or schedule (e.g. “Butler NPC runs this at 9am”).

Same outcomes as N8N (Gmail → filter → label → Slack), but the interface is spatial and playful. Target users: people who find node-based automation abstract or intimidating, and who prefer a visual, game-like way to automate tasks.

**Pitch line:** *“Your APIs are NPCs and objects in your personal game world. Workflow automation that feels like Stardew Valley, not coding.”*

---

## 2. Core Architecture Principle: Object → Edge Function

**Critical constraint:** The game server (RPG-JS) does **not** implement third-party API logic (Gmail, Slack, etc.) directly. All integration work happens in **Supabase Edge Functions** that we build and own.

- **Game world objects** (mailbox, desk, bulletin board, etc.) are **actors**. When the player (or an automated NPC) uses an object, the game server:
  - Builds a **payload** (object id, action, player id, inventory/context, credentials reference, etc.).
  - Calls a **Supabase Edge Function** (the “object API”) via HTTP with that payload.
- The **Edge Function**:
  - Performs the real work (call Gmail, Slack, transform data, etc.).
  - Uses credentials stored/secured in Supabase (e.g. user-linked OAuth tokens, API keys).
  - Returns a **structured result** (e.g. “items to add to inventory,” “success/failure,” “message to show”).
- The **game server** then:
  - Applies the result (e.g. add/remove items, update player state, show text).
  - Optionally records the step for **workflow recording** (see below).

So: **objects in the world are thin clients to an Edge Function API.** The game handles only world state, inventory, and UX; the Edge Function handles all external integrations and business logic.

---

## 3. Concepts to Plan For

### 3.1 Objects (Actors) and the Object API

- **Object** = an interactive map entity (RpgEvent in RPG-JS terms), e.g. Mailbox, Desk, Bulletin Board, Computer.
- Each object type has a **logical action** (e.g. `fetch_emails`, `tag_emails`, `post_summary`). When the player (or automation) triggers that object, the server sends a request to the **object API** (Edge Function).
- **Object API** = Supabase Edge Function(s) that:
  - Accept a standardized payload (object id, action, user/player id, input data such as item types/counts, options like “label name”).
  - Resolve user credentials (e.g. from Supabase vault or `user_credentials` table) and call external services.
  - Return a **result contract** the game server understands: e.g. `{ success, itemsToAdd?, itemsToRemove?, message?, error? }`.

The senior dev should define:

- The **request schema** (object_id, action, user_id/player_id, body/context).
- The **response schema** (success, items, messages, errors).
- How **credentials** are stored and referenced (e.g. by integration name + user id), and how the Edge Function fetches them securely (no credentials in game client or in the payload itself).

### 3.2 Data as Inventory

- “Data” in workflows is represented as **game items** (e.g. Email, TaggedEmail, Summary). The player carries them in inventory; objects add/remove them based on Edge Function results.
- The Edge Function may receive **item types/counts** as input (e.g. “10 Emails, tag as Work”) and return **item changes** (e.g. remove 10 Email, add 10 TaggedEmail). The game server translates that into `player.addItem` / `player.removeItem` (or equivalent).

Plan for:

- A small set of **canonical item types** for the first workflows (e.g. Email, TaggedEmail, Summary).
- Whether “item” payloads sent to the Edge Function need to carry opaque payloads (e.g. email IDs) or only type + count; and how the Edge Function returns item updates.

### 3.3 Workflow Recording and Replay

- **Recording:** As the player uses objects, the server records a **sequence of steps** (e.g. object_id, action, input items/params, timestamp). This can be in-memory until “Save workflow?” is confirmed, then persisted (e.g. `workflow_templates` or `saved_workflows` in Supabase).
- **Replay:** A **workflow runner** (on the game server or triggered by a cron/scheduled job) loads a saved workflow and executes each step by **calling the same Object API** with the same logical payloads (user context may come from the workflow owner or an NPC “butler”). So the same Edge Function that powers “player uses mailbox” also powers “replay step 1: mailbox fetch.”
- **Scheduling:** e.g. “Run this workflow daily at 9am” can be implemented with Supabase cron or pg_cron calling an Edge Function that invokes the workflow runner, or the game server polling; the senior dev can choose the most maintainable option.

Plan for:

- **Step schema** (object_id, action, params, order).
- **Storage** (tables such as `workflow_templates`, `saved_workflows`, and optionally `workflow_runs` for history).
- **Replay semantics:** same Object API contract; runner applies returned item/state changes to the correct “actor” (player or system/NPC context).

### 3.4 NPC Automation (Optional but In Scope)

- An “NPC” (e.g. Butler) can be the **narrative wrapper** for a scheduled workflow: “Butler checks mailbox at 9am” = run workflow X at 9am. The NPC doesn’t need to pathfind; it’s the avatar for “this workflow runs at this time.”
- Design should allow: workflow owned by user, run in a “system” or “NPC” context, with results applied appropriately (e.g. deliver “mail” to player’s inventory or post to Slack without needing the player online).

---

## 4. What Already Exists (Repo Context)

- **RPG-JS game** in `my-rpg-game/`: maps, RpgEvents, player state, inventory (`addItem` / `removeItem` / `getItem`), GUIs (e.g. shop), Supabase auth and persistence. See `AGENTS.md` for stack and structure.
- **Supabase:** Auth, `player_state`, `agent_configs` (NPCs), real-time content sync. Schema reference: `APPLY_TO_SUPABASE.sql`. No workflow or object_api tables yet.
- **Docs:** `docs/MODERNIZATION_SUMMARY.md`, `docs/RPGJS_MODERNIZATION_PLAN.md`, and related docs describe Supabase integration and AI NPCs; workflow RPG is an additional product layer on top.

The senior dev should assume the game client and existing server hooks stay; the new work is **Object API (Edge Function), request/response contract, workflow storage, recording/replay, and optional scheduling/NPC automation**.

---

## 5. Out of Scope for This Document

- No implementation of Edge Functions, game events, or DB migrations in this brief.
- No detailed UI/UX specs (e.g. exact “Drop on desk?” flow)—only the concept that “use object → call Edge Function → apply result.”
- No specific list of integrations (Gmail, Slack, etc.) beyond the idea that they are implemented inside Edge Functions and keyed by user credentials.

---

## 6. Requested Deliverable

A **concrete plan** that a team can implement from, including:

1. **Object API**
   - Edge Function(s) responsibility and URL(s).
   - Request/response schema and error handling.
   - Credential storage and resolution (where, how, RLS if applicable).

2. **Data model**
   - New Supabase tables (e.g. workflow_templates, saved_workflows, user_credentials or equivalent) and any columns needed on existing tables.

3. **Game server**
   - How the server calls the Object API (when an object is used), and how it applies the result (inventory, messages).
   - How “use item on object” or “action on object” is represented so the server can build the correct payload.

4. **Workflow recording and replay**
   - Step format and storage.
   - When recording is started/stopped and when “Save workflow?” is persisted.
   - How replay is triggered (manual vs scheduled) and how it invokes the same Object API.

5. **Scheduling and NPC automation (if in scope)**
   - How a workflow is associated with a schedule and/or NPC.
   - How the runner is invoked (cron, queue, or game server tick).

6. **Phasing**
   - Suggested order of implementation (e.g. single object + one Edge Function → recording → replay → scheduling).
   - Dependencies and risks.

This document is the single source of the **idea and constraints**; the senior developer’s plan is the source of the **technical design and tasks**.
