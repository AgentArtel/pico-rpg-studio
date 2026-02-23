# Task Delegation — Agent Roles and Assignment

This document defines **who does what** so Claude Code can assign task briefs to the correct agent in the correct order. Use it when creating sprints and task briefs.

---

## Agent Definitions

### Claude Code — System Overseer

**Role:** Oversees the full stack (frontend, backend, infra). Turns ideas into shippable features by producing plans and task briefs; does not implement day-to-day code.

**Responsibilities:**

- **Research & design:** Investigate codebase, APIs, and constraints; produce handoff docs and architecture notes.
- **Sprint & plan:** Turn a handoff/idea into a **sprint** with a **master plan** and **task briefs**.
- **Task assignment:** Assign each task brief to **Lovable** or **Cursor** per the rules below.
- **Review & audit:** Review code and plans; audit for consistency, security, and alignment with the master plan.
- **Flow control:** Define the **order** of tasks (e.g. backend contract first, then frontend, then deployment) so Cursor and Lovable receive work in the right sequence.

**Does NOT:** Implement feature code locally, deploy to production, or manage the database directly. That work is delegated.

---

### Cursor Agent — Project Manager & Heavy Implementation

**Role:** Local development lead. Implements the harder, logic-heavy work from task briefs created by Claude Code. Focus on correctness and structure.

**Responsibilities:**

- **Implement task briefs:** Execute assigned task briefs from Claude Code (backend + frontend, with emphasis on complex logic).
- **Heavy frontend:** Website design, routing, multi-step flows, state management, and non-trivial UI logic.
- **Heavy backend:** Game control dispatch layer, PicoClaw tool implementation, API contracts, session/store integration.
- **Mixed stacks:** Features that span frontend and backend (e.g. Studio game nodes calling game-control, NPC chat + tools).
- **Local dev:** Run and verify features locally (game server, Studio, PicoClaw); fix integration issues.
- **Align with specs:** Implement to match schemas, API shapes, and behaviors defined in Claude Code’s briefs and handoffs.

**Does NOT:** Own production deployment, Edge Function deployment, or database migrations as primary executor — those are Lovable’s domain, using artifacts (migrations, function code) produced by or specified by Claude Code/Cursor.

---

### Lovable Agent — Deployment, Database, and Backend Fixes

**Role:** Production and platform. Deploys frontend, manages the database, deploys Edge Functions, and fixes backend/UI bugs using the files and specs produced by Claude Code and Cursor.

**Responsibilities:**

- **Frontend deployment:** Deploy Studio (or game client) to production; minor frontend tweaks and bug fixes.
- **Database management:** Full database lifecycle — migrations, RLS, indexes, and data fixes. Uses migrations/schemas created or specified by Claude Code/Cursor.
- **Edge Function deployment:** Deploy and configure Supabase Edge Functions from the code/specs provided.
- **Backend issues & bugs:** Fix backend and integration bugs (e.g. Edge Function errors, API mismatches) in line with what Claude Code/Cursor created.
- **Environment & config:** Keep env vars, secrets, and deployment config in sync with the intended design.

**Does NOT:** Invent new feature architecture or task briefs; works from existing files and briefs so that deployment and DB match what was designed and implemented.

---

## Assignment Rules (for Claude Code)

When creating task briefs, assign as follows:

| Task type | Assign to | Notes |
|-----------|-----------|--------|
| Research, handoff docs, sprint plan, task briefs | **Claude Code** | Author only |
| New API contracts, game control dispatch, PicoClaw tools | **Cursor** | Heavy logic |
| New Studio UI flows, workflow execution changes, complex forms | **Cursor** | Heavy frontend |
| New DB schema, migrations, RLS | **Cursor** (author) → **Lovable** (apply/deploy) | Cursor writes migration files; Lovable runs and manages DB |
| Edge Function logic (new or major changes) | **Cursor** (author) → **Lovable** (deploy) | Cursor writes code; Lovable deploys |
| Frontend deployment, minor UI bugs, styling fixes | **Lovable** | |
| Database deployment, RLS fixes, data fixes | **Lovable** | Using Cursor/Claude artifacts |
| Edge Function deployment, env/config for EF | **Lovable** | |
| Bug fixes in backend/Edge Functions (post-Cursor implementation) | **Lovable** | Align with existing code |
| Integration testing and “make it work in prod” | **Lovable** (or Cursor for local) | Clarify in brief |

---

## Flow Summary

```
Idea / Handoff
      │
      ▼
Claude Code: research → sprint + master plan + task briefs
      │
      ├── Task brief A (backend/game control) ──► Cursor: implement
      ├── Task brief B (migrations/schema)     ──► Cursor: write ──► Lovable: apply/deploy
      ├── Task brief C (Edge Function)         ──► Cursor: implement ──► Lovable: deploy
      ├── Task brief D (Studio UI)             ──► Cursor: implement
      └── Task brief E (deploy + bug fixes)    ──► Lovable: deploy & fix
```

---

## Reference

- **Handoff for this feature:** [GAME_CONTROL_AND_PICOCLAW_HANDOFF.md](./GAME_CONTROL_AND_PICOCLAW_HANDOFF.md)
- **Implementation index:** [README.md](./README.md)
