# Handoff: Studio PicoClaw Alignment — OpenClaw Parity

> **Status:** Research complete. Ready for Claude Code to investigate and plan implementation.
> **Created:** 2026-02-20
> **Task delegation:** See [TASK_DELEGATION.md](./TASK_DELEGATION.md). Assign implementation to **Cursor** (logic, APIs, Studio UI) and **Lovable** (deploy, DB, Edge Functions) as appropriate.

---

## For Claude Code — Next Steps

1. **Read** this handoff and [ideas/studio-picoclaw-alignment-openclaw-parity-handoff.md](../ideas/studio-picoclaw-alignment-openclaw-parity-handoff.md).
2. **Investigate** the codebase as needed: gateway chat handler, picoclaw-bridge handleChat, AgentChatTest, session/memory tables, skills tables and deploy payload.
3. **Produce** a **sprint** (e.g. `docs/implementation/sprints/YYYY-MM-studio-picoclaw-alignment/`) with **MASTER_PLAN.md** (phases, dependencies, order of work) and **task briefs** (one file per task or one doc with sections), each labeled **Assignee: Cursor** or **Assignee: Lovable** per TASK_DELEGATION.
4. **Order** tasks so that: DB/schema changes (if any) and backend contracts come before UI; session list can precede streaming; skills UI and SKILL.md format can be parallel to chat improvements.

---

## 1. Purpose

Align Studio with an OpenClaw-style control plane for PicoClaw: **chat streaming** and **tool-call visibility**, **session list**, **OpenClaw-style skills** and **skill library**, **usage** (tokens/cost) when available, and **gateway health**. This handoff gives Claude Code the research summary and verification so it can turn the work into a sprint, master plan, and task briefs for Cursor and Lovable.

---

## 2. Research Summary — What's Built

### PicoClaw gateway

- [picoclaw/pkg/health/server.go](picoclaw/pkg/health/server.go) — `POST /v1/chat` accepts `message`, `session_key`, `agent_id`; returns single JSON `{ response, session_key }`. No streaming, no `tool_calls` in response.

### picoclaw-bridge

- [studio/supabase/functions/picoclaw-bridge/index.ts](studio/supabase/functions/picoclaw-bridge/index.ts) — `handleChat`: for Gemini agents uses Google GenAI SDK and returns final text; for non-Gemini calls gateway `/v1/chat`. Returns `{ success, response, session_key }` only. No streaming, no tool data.

### Studio

- [studio/src/components/agents/AgentChatTest.tsx](studio/src/components/agents/AgentChatTest.tsx) — Chat test panel; uses `useChatWithAgent` from [studio/src/hooks/usePicoClawAgents.ts](studio/src/hooks/usePicoClawAgents.ts). Shows "Thinking…" then one assistant message. No streaming, no tool display.

### Sessions

- **PicoClaw:** [picoclaw/pkg/session/manager.go](picoclaw/pkg/session/manager.go) — Sessions in memory + disk (`{workspace}/sessions/{sanitizedKey}.json`). No `ListKeys` or HTTP list/history API.
- **Studio/DB:** `agent_memory` (game NPCs): `agent_id`, `session_id` (e.g. `${npcId}_${playerId}`), `role`, `content`. `studio_agent_memory` (studio agent chat): same shape. Bridge and npc-ai-chat write to these after each turn.

### Skills

- Tables: `picoclaw_skills`, `picoclaw_agent_skills`. Bridge builds `skills/{slug}/SKILL.md` from `skill_md` when pushing workspace to PicoClaw on deploy.

### Usage

- No gateway or bridge exposure of tokens/cost. No usage tab in Studio.

---

## 3. Verification Table (Can We Align?)

| Feature | Align? | With current PicoClaw? | Notes |
|--------|--------|------------------------|-------|
| Chat streaming | Yes | No | Need Studio-only stream or PicoClaw streaming endpoint. |
| Tool-call visibility | Yes | No | Gateway/bridge must return or stream tool_calls. |
| Session list | Yes | Yes (from DB) | Use agent_memory / studio_agent_memory; no gateway change. |
| Skills (OpenClaw SKILL.md + library) | Yes | Yes | Studio + DB; bridge already sends skill_md. |
| Usage (tokens/cost) | Yes | No | Need PicoClaw or own tracking + API + Studio UI. |
| Gateway/health | Yes | Yes | Already in place; extend if gateway adds more. |

---

## 4. What Needs to Be Built (High Level)

### Session list (Studio + DB)

- **What:** New UI (e.g. session list panel or tab) that queries distinct `(agent_id, session_id)` from `studio_agent_memory` and `agent_memory`; load history for a selected session from same tables.
- **Assignee:** Cursor (UI + hooks); Lovable if new RPC or DB view.
- **Dependency:** None on PicoClaw. Can be done first.

### Skills — OpenClaw-style SKILL.md + library

- **What:** Store/display SKILL.md with optional YAML frontmatter; "Skill library" UI (browse, add from template or paste/import). Confirm PicoClaw loader behavior for frontmatter; strip in bridge if needed.
- **Assignee:** Cursor (UI, form, library); Lovable if DB migration.
- **Dependency:** None on PicoClaw. Can run in parallel with other work.

### Chat streaming

- **What:** Either (A) **Studio-only:** new or extended Edge Function that streams from LLM (Gemini/Kimi) for Studio agent chat; Studio consumes SSE/stream. Or (B) **PicoClaw:** new gateway endpoint (e.g. SSE) and agent-loop streaming; bridge and Studio consume stream.
- **Assignee:** Cursor (Studio stream consumer, optional bridge changes); PicoClaw gateway changes = Cursor or separate.
- **Dependency:** If Option B, PicoClaw work precedes or runs in parallel with Studio consumer.

### Tool-call visibility

- **What:** Gateway (or bridge) returns or streams `tool_calls` / intermediate steps; Studio displays them in AgentChatTest (e.g. collapsible "Tool calls").
- **Assignee:** Cursor (Studio UI + bridge if bridge aggregates); PicoClaw gateway change = Cursor or separate.
- **Dependency:** Backend must expose tool_calls before or with Studio UI. May share PicoClaw changes with streaming.

### Usage

- **What:** Design and implement a source of truth (e.g. new gateway response field or separate logging + DB table), then Studio usage tab that reads from it.
- **Assignee:** TBD (Cursor for Studio UI; backend = Cursor or Lovable per design).
- **Dependency:** Source of usage data must exist before or with Studio UI.

### Gateway health

- **What:** Keep current behavior; extend Studio display if gateway adds more to `/health` or admin.
- **Assignee:** Cursor (Studio only).
- **Dependency:** None.

---

## 5. References

- **Idea document:** [ideas/studio-picoclaw-alignment-openclaw-parity-handoff.md](../ideas/studio-picoclaw-alignment-openclaw-parity-handoff.md)
- **Task delegation:** [docs/implementation/TASK_DELEGATION.md](docs/implementation/TASK_DELEGATION.md)
- **Comparison chat (optional):** User's exported OpenClaw vs PicoClaw comparison doc for feature-parity context (e.g. `/Users/artelio/Desktop/cursor_comparison_of_openclaw_and_picoc.md` or local copy).
