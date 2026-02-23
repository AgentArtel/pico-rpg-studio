# Handoff Packet: Glass Canvas — AI Creator Personas & Identity-Owned Storefronts

> **Status:** Research complete. Ready for implementation.
> **Created:** 2026-02-20
> **Context:** Extend the game/studio/PicoClaw stack with an in-world NPC (stained glass artisan) who "owns" a real webapp, Glass Canvas, for selling stained glass patterns. The webapp is populated by AI agent creator personas (branches of the identity owner); consumers browse and buy; only the identity owner sees generation and management UI. Scaled rollout: one capability at a time until the agent can run the full business.

---

## 1. The Idea

**Glass Canvas** is a separate webapp (deployed on Lovable) for creating, selling, and sharing stained glass patterns and completed works. It shares the same database as Studio in a **dedicated schema**; frontend content is driven by DB tables mapped to a JSON schema so updating the website is as simple as updating the right table (CMS-style). In the RPG game, an NPC (stained glass artisan / pattern designer) is the in-fiction owner of this business. The **identity owner** (e.g. Artel/Satori) controls everything via **Studio**: they manage multiple **creator personas** (AI agent branches), each with its own PicoClaw agent, user account (as if human), brand, storefront, and catalog. Revenue attributes to the identity owner. Consumers never see generation or draft UI. Rollout is phased: Phase 1 = agent + dashboard + Dream + NPC on map; MVP = Glass Canvas app + schema + CMS + deploy + image gen; post-MVP = backend functions, manager role, sub-agents, in-game objects.

---

## 2. Why This Matters

- **Unified fiction + product:** The same identity that backs the in-game NPC can own and operate a real product (Glass Canvas), with AI personas as public storefronts.
- **Scaled automation:** Start with owner-driven publishing; add agent-driven generation, then scheduling, then full store operations in phases.
- **Clear role model:** Owner (full control), Creator persona (public storefront + private ops via Studio), Consumer (browse/buy only) — with a golden rule that consumers never see generation.
- **Revenue and attribution:** All creator sales flow to the identity owner; creator personas are not separate legal or billing entities.
- **Reusable pattern:** Built so any NPC can own a storefront later (configurable link); new Pico agents can take over storefronts. Shared auth across all webapps and businesses.

---

## 3. Architecture

```
Identity Owner (Artel)
    │
    ├── Studio (current codebase)
    │   ├── New routes: Agent dashboard, business view, personas, drafts, scheduling
    │   ├── Agent dashboard: config, knowledge, tools, role, tasks, schedule, files, manifesto, Dream
    │   └── Link PicoClaw agent → agent_configs (NPC) + optional business_id / Dream
    │
    ├── Creator Persona A  (DB row + auth user + one PicoClaw agent)
    │   └── Storefront A, listings, completed works → Glass Canvas schema
    ├── Creator Persona B  (DB row + auth user + one PicoClaw agent)
    │   └── Storefront B, listings, completed works → Glass Canvas schema
    │
    ▼
Shared DB (Studio Supabase)
    ├── public.picoclaw_agents, agent_configs, agent_memory, ...
    ├── identity_owners / creator_personas (new or extended)
    └── glass_canvas.* schema (listings, completed_works, pages/content for CMS)
    │
    ▼
Glass Canvas Webapp (separate deploy, Lovable)
    │   Reads/writes glass_canvas schema; CMS = update content in DB
    │   Public: feed, storefronts, purchase, download; no generation UI
    │
    ▼
Consumers (real users + AI agents acting as users)
    — No generation UI; browse/buy only. Owner alone sees which users are AI.
```

**In-game link:** The NPC (stained glass artisan) is backed by the same identity/agent as the Owner of Glass Canvas. Architecture is **configurable** so any NPC could own a storefront later; first instance: Artel's NPC = Glass Canvas owner.

---

## 4. Roles and Capabilities

### A) Creator (AI Agent Persona)

- **Important:** Creator personas are NOT real user accounts in the sense of "human signup." They are entities managed entirely by the identity owner through Studio. Each persona has a **DB row** (e.g. `creator_personas`), a **dedicated auth user** (so they can "log in" and own content like a human), and **one PicoClaw agent**.
- **Public (storefront):** Publish patterns for sale; post completed works; maintain brand, bio, and store policies.
- **Private (owner via Studio):** Generate pattern drafts (internal); edit listings and prices; schedule and post content; manage store settings, license terms, disclosure copy.

### B) Consumer (User)

- Browse completed works feed; browse creator storefronts and pattern listings; purchase and download patterns; optionally post "Made it" builds tied to purchased patterns.
- **Golden rule:** Consumers NEVER see generation UI. If the user's role is not Owner, all generation controls, Studio routes, and draft management are hidden. Only the identity owner can see which users are AI vs human.

### C) Owner (Identity Owner / Satori)

- Full access to all Studio (and Glass Canvas owner) routes; can switch between creator personas; can generate, draft, publish, and manage all storefronts; receives all revenue attribution.

---

## 5. Key Product Loops

**Creator loop (AI agent storefront, run by Owner)**

1. Generate pattern drafts (private, in Studio).
2. Publish patterns as public listings under a creator persona.
3. Post completed works (real builds or renders) tied to patterns.
4. Earn revenue from pattern purchases.
5. Build creator reputation via gallery and proof-of-build posts.

**Consumer loop**

6. Browse completed works feed (photo-first discovery).
7. View pattern listing and creator storefront.
8. Purchase pattern license.
9. Download pattern files (e.g. SVG/PDF/PNG).
10. Optionally post a "Made it" build with a truth label.

---

## 6. How It Works Today (Before)

N/A for Glass Canvas — new feature. In the same area:

- **Studio** has an Agent Builder ([studio/src/pages/AgentBuilder.tsx](studio/src/pages/AgentBuilder.tsx)) for PicoClaw agents (game vs studio), with [AgentFormModal](studio/src/components/agents/AgentFormModal.tsx) (6 tabs: Identity, Soul, LLM, Skills, Memory, Game Link). No "agent dashboard" for role, purpose, schedule, or "Dream" yet. NPCs are managed in [studio/src/pages/NPCs.tsx](studio/src/pages/NPCs.tsx) and linked to PicoClaw via `picoclaw_agents.agent_config_id`.
- **PicoClaw** agents are deployed via [studio/supabase/functions/picoclaw-bridge/index.ts](studio/supabase/functions/picoclaw-bridge/index.ts) (config + workspace files pushed to PicoClaw gateway). NPC chat is routed through [studio/supabase/functions/npc-ai-chat/index.ts](studio/supabase/functions/npc-ai-chat/index.ts) (PicoClaw first, then fallback LLM).
- **Game** spawns NPCs from `agent_configs` via [my-rpg-game/main/realtime/contentSync.ts](my-rpg-game/main/realtime/contentSync.ts) and [my-rpg-game/main/services/npcSpawner.ts](my-rpg-game/main/services/npcSpawner.ts). No storefront or Glass Canvas concept exists.

---

## 7. How It Should Work (After) — Phased

**Phase 1 — Agent and NPC**

1. In Studio: create the agent and an **agent dashboard** (new page or extended AgentBuilder) with: agent-specific knowledge, tools, role, assigned tasks, schedule/routine, file uploads → agent memory/knowledge (PicoClaw workspace files), purpose/manifesto, and a **"Dream"** field (e.g. "Glass Canvas").
2. Persist Dream / business_id (e.g. in `picoclaw_agents` metadata or new table).
3. Place NPC on map: use existing flow — link PicoClaw agent to `agent_configs` via `agent_config_id`, set `spawn_config` in `agent_configs`; [contentSync](my-rpg-game/main/realtime/contentSync.ts) + [npcSpawner](my-rpg-game/main/services/npcSpawner.ts) already spawn from `agent_configs`. Owner can talk to the NPC in the game.

**Phase 2 — Glass Canvas MVP**

4. Define `glass_canvas` schema (listings, completed_works, pages/content for CMS).
5. Build Glass Canvas webapp (separate repo or folder): connect to same Supabase project, read/write `glass_canvas` schema, CMS to update content from DB.
6. Deploy to Lovable. Implement image generation + save to user account (existing or new Edge Function); store references in DB. All backend functions needed for MVP wired and working at deploy.

**Phase 3 — Post-MVP**

7. List backend functions for Glass Canvas; break down and integrate into game design (per project rules). Decide which tasks the main Pico agent handles vs sub-agents/specialized agents. Persona role transitions into **manager** overseeing multiple agents.
8. In-game: player or AI-NPC goes to an object for analytics report → takes to another NPC/object for evaluation/report (improvements, user journey issues). System works together end-to-end.

**Later**

9. Specialized agents (analytics/SEO, branding, marketing, customer service, feature development) as branches off the manager agent. Each focused on a task; in-game objects/NPCs for reports and evaluations.

---

## 8. API / Data Contracts

**Identity and personas**

- **Identity owner:** Same auth entity as Studio (e.g. Supabase `auth.users` id or dedicated `identity_owners` table). All webapps share auth; one login works across Studio, Glass Canvas, future businesses.
- **Creator persona:** Row in `creator_personas` with `identity_owner_id`, `name`, `brand`, `storefront_slug`, `user_id` (FK to auth.users — the persona's "user" account), `picoclaw_agent_id` (FK to `picoclaw_agents`). Only identity owner sees `is_ai` or equivalent.

**Glass Canvas content (to be detailed in implementation)**

- **Listings:** Pattern metadata, files (SVG/PDF/PNG), price, license terms, `creator_persona_id`.
- **Completed works / feed:** Post content, media, link to pattern(s), `creator_persona_id`.
- **Purchases:** `user_id`, pattern/listing id, license, download entitlement; revenue attribution to identity owner.
- **CMS:** Pages/content tables keyed for frontend schema; update content = UPDATE row.

**Consumers:** No generation or draft APIs exposed; role checks on all Studio/owner endpoints.

---

## 9. Implementation Plan

### Step 1: Schema and identity/persona tables

**Location:** [studio/supabase/migrations/](studio/supabase/migrations/) (new migration)

- Add or extend tables: `identity_owners` (or use auth.users + profile), `creator_personas` (id, identity_owner_id, name, brand, user_id FK auth, picoclaw_agent_id FK picoclaw_agents, storefront_slug, created_at, updated_at). Optionally add `dream` / `business_id` to `picoclaw_agents` or a small `agent_business` link table.
- Add `glass_canvas` schema (or `public` with prefix): e.g. `glass_canvas.listings`, `glass_canvas.completed_works`, `glass_canvas.pages` for CMS.

### Step 2: Studio — Agent dashboard

**Location:** [studio/src/App.tsx](studio/src/App.tsx), [studio/src/pages/AgentBuilder.tsx](studio/src/pages/AgentBuilder.tsx) or new [studio/src/pages/AgentDashboard.tsx](studio/src/pages/AgentDashboard.tsx), new components under [studio/src/components/agents/](studio/src/components/agents/)

- Add route/page for "Agent dashboard" (or extend AgentBuilder) with: agent-specific knowledge, tools, role, assigned tasks, schedule/routine, file upload → memory/knowledge, purpose/manifesto, **Dream** (e.g. Glass Canvas). Persist to DB (picoclaw_agents metadata or new columns/table).
- Optionally include Dream or business context in workspace files pushed by [studio/supabase/functions/picoclaw-bridge/index.ts](studio/supabase/functions/picoclaw-bridge/index.ts).

### Step 3: Game — NPC placement and link

**Location:** Existing flow; no new files required for Phase 1.

- Ensure NPC can be placed from Studio: already supported via `agent_configs` + `spawn_config`; PicoClaw agent linked via `agent_config_id`. ContentSync and npcSpawner spawn from `agent_configs`. Link agent to Dream/business_id in Studio when creating or editing the agent.

### Step 4: Glass Canvas webapp and schema

**Location:** New repo or subdir for Glass Canvas app; [studio/supabase/migrations/](studio/supabase/migrations/) for schema

- Define and migrate `glass_canvas` (or equivalent) tables. New webapp: connect to same Supabase project, read/write schema, implement CMS (content from DB). Deploy to Lovable.

### Step 5: Image generation and save

**Location:** [studio/supabase/functions/generate-image](studio/supabase/functions/generate-image) or new Edge Function; storage bucket and DB references

- Image generation + save to user account; store file references in shared DB (e.g. by user_id / creator_persona_id).

### Step 6: Post-MVP — Backend functions and manager role

**Location:** Design doc / task briefs; [picoclaw/pkg/tools/spawn.go](picoclaw/pkg/tools/spawn.go), [picoclaw/pkg/agent/loop.go](picoclaw/pkg/agent/loop.go); game objects/NPCs

- List backend functions; assign to main agent vs sub-agents (PicoClaw spawn/subagent allowlist). Manager role; in-game objects for analytics and evaluation reports. See [docs/implementation/GAME_CONTROL_AND_PICOCLAW_HANDOFF.md](docs/implementation/GAME_CONTROL_AND_PICOCLAW_HANDOFF.md) for game control API pattern.

---

## 10. Database Changes

```sql
-- Example shape; exact names and columns to be finalized in implementation.

-- Option A: identity_owners if not using auth.users only
CREATE TABLE IF NOT EXISTS public.identity_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Creator personas: one per AI storefront identity
CREATE TABLE IF NOT EXISTS public.creator_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_owner_id UUID NOT NULL REFERENCES public.identity_owners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  storefront_slug TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  picoclaw_agent_id UUID NOT NULL REFERENCES public.picoclaw_agents(id) ON DELETE RESTRICT,
  is_ai BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Glass Canvas schema (or public with prefix)
CREATE SCHEMA IF NOT EXISTS glass_canvas;

CREATE TABLE IF NOT EXISTS glass_canvas.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_persona_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_paths JSONB,
  price_cents INTEGER,
  license_terms TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS glass_canvas.completed_works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_persona_id UUID NOT NULL,
  listing_id UUID REFERENCES glass_canvas.listings(id),
  title TEXT,
  media_paths JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CMS: content keyed for frontend (e.g. homepage, about, store policies)
CREATE TABLE IF NOT EXISTS glass_canvas.pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

RLS and grants to be added per shared-auth and owner-only access rules.

---

## 11. What Changes in Existing Code

| File | Change | Breaking? |
|------|--------|-----------|
| [studio/src/App.tsx](studio/src/App.tsx) | Add new page/route for agent dashboard or Glass Canvas owner | No |
| [studio/src/pages/AgentBuilder.tsx](studio/src/pages/AgentBuilder.tsx) | Optional: Dream/business link field or link to dashboard | No |
| [studio/src/components/agents/](studio/src/components/agents/) | New components for agent dashboard (knowledge, tasks, schedule, Dream, file upload) | No |
| [studio/supabase/functions/picoclaw-bridge/index.ts](studio/supabase/functions/picoclaw-bridge/index.ts) | Optional: include Dream or business context in workspace files | No |
| New: Glass Canvas webapp | New codebase; same Supabase project, glass_canvas schema | N/A |
| New: [studio/supabase/migrations/](studio/supabase/migrations/) | New migration(s) for identity_owners, creator_personas, glass_canvas schema | No |

Existing NPC/agent flow (npcSpawner, npc-ai-chat, picoclaw-bridge, AgentBuilder, NPCs page) remains unchanged for non–Glass Canvas agents.

---

## 12. What Stays the Same

- Existing Studio workflow/NPC/agent builder and PicoClaw deployment flow.
- Game mechanics unrelated to Glass Canvas; NPC chat and tools (e.g. game_control) unchanged except for any explicit "open Glass Canvas" or "view my store" action added later.
- Consumer-facing experience of the game unless we add in-game links to Glass Canvas (e.g. NPC dialogue that points to the webapp).
- Auth model (Supabase Auth); we extend it with shared use across apps and optional identity_owners/creator_personas, not replace it.
- [studio/src/hooks/usePicoClawAgents.ts](studio/src/hooks/usePicoClawAgents.ts) and [studio/src/integrations/supabase/types.ts](studio/src/integrations/supabase/types.ts) patterns; new tables get types and hooks as needed.

---

## 13. Gotchas and Edge Cases

### Role confusion

Consumers must never get Owner or Creator (Studio) capabilities. Enforce strict RBAC and UI hiding: if role is not Owner, hide all generation controls, Studio routes, and draft management.

### AI persona user accounts

Each creator persona has a real auth user (so they can own content and appear in feeds). Only the identity owner can see which users are AI (e.g. `is_ai` or equivalent). Ensure RLS and admin UI respect this.

### Shared auth and RLS

Multiple apps (Studio, Glass Canvas) share the same DB and auth. RLS policies must be consistent: e.g. identity owner can manage their creator_personas and glass_canvas content; consumers can only read public storefront data and their own purchases.

### Revenue and legal

Clarify whether creator personas need disclosure ("AI-generated") on listings or storefronts. Revenue routing and tax/legal implementation are out of scope for this handoff but should be tracked elsewhere.

---

## 14. Sources

### Codebase References

- [studio/src/pages/AgentBuilder.tsx](studio/src/pages/AgentBuilder.tsx) — Agent Builder page, game vs studio agents
- [studio/src/components/agents/AgentFormModal.tsx](studio/src/components/agents/AgentFormModal.tsx) — 6-tab agent form (Identity, Soul, LLM, Skills, Memory, Game Link)
- [studio/src/hooks/usePicoClawAgents.ts](studio/src/hooks/usePicoClawAgents.ts) — CRUD, deploy, stop, chat, skills, link to game entity
- [studio/src/integrations/supabase/types.ts](studio/src/integrations/supabase/types.ts) — picoclaw_agents, agent_configs, agent_memory schema
- [studio/supabase/functions/picoclaw-bridge/index.ts](studio/supabase/functions/picoclaw-bridge/index.ts) — deploy config + workspace files to PicoClaw
- [studio/supabase/functions/npc-ai-chat/index.ts](studio/supabase/functions/npc-ai-chat/index.ts) — PicoClaw routing, session_key, channel 'game'
- [my-rpg-game/main/realtime/contentSync.ts](my-rpg-game/main/realtime/contentSync.ts) — subscribes to agent_configs, spawns NPCs
- [my-rpg-game/main/services/npcSpawner.ts](my-rpg-game/main/services/npcSpawner.ts) — createNPCClass, spawn from agent_configs
- [picoclaw/pkg/agent/instance.go](picoclaw/pkg/agent/instance.go) — agent workspace, tools, memory
- [picoclaw/pkg/agent/loop.go](picoclaw/pkg/agent/loop.go) — shared tools, skills, subagent allowlist
- [picoclaw/pkg/tools/spawn.go](picoclaw/pkg/tools/spawn.go) — async subagent spawn
- [docs/implementation/TASK_DELEGATION.md](docs/implementation/TASK_DELEGATION.md) — Cursor vs Lovable vs Claude Code

---

## 15. Open Questions

1. **Payment provider:** Which payment provider (e.g. Stripe) and where does "revenue to identity owner" get implemented — same app vs separate billing service?
2. **"Made it" and truth labels:** Exact schema and moderation for user-generated "Made it" posts and any required labels (e.g. "I made this from [pattern]").
3. **Glass Canvas repo location:** Separate repo vs subfolder in monorepo for the Glass Canvas webapp; affects CI and Lovable deploy setup.
4. **RLS for glass_canvas:** Full RLS design for identity_owners, creator_personas, and glass_canvas tables (owner vs consumer read/write) to be finalized in implementation.
