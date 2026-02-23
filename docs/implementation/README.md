# Implementation Documentation

This folder holds handoff packets, research summaries, and implementation plans for features that span Studio, the game, and PicoClaw. **Claude Code** uses these to create sprints, master plans, and task briefs for **Cursor** and **Lovable** agents.

## Contents

| Document | Purpose | Audience |
|----------|---------|----------|
| [TASK_DELEGATION.md](./TASK_DELEGATION.md) | Agent roles and task assignment rules (Lovable, Cursor, Claude Code) | All agents; reference when assigning work |
| [GAME_CONTROL_AND_PICOCLAW_HANDOFF.md](./GAME_CONTROL_AND_PICOCLAW_HANDOFF.md) | Research + idea: Game Control API + PicoClaw `game_control` tool, player identity, scale | Claude Code (sprint/plan author); Cursor/Lovable (context) |
| [GLASS_CANVAS_IMPLEMENTATION_APPROACH.md](./GLASS_CANVAS_IMPLEMENTATION_APPROACH.md) | Phased implementation: Glass Canvas webapp, agent dashboard, creator personas, schema; file index | Claude Code (sprint/task briefs); Cursor/Lovable (context) |
| [STUDIO_PICOCLAW_ALIGNMENT_HANDOFF.md](./STUDIO_PICOCLAW_ALIGNMENT_HANDOFF.md) | Research + handoff: Studio OpenClaw parity (chat streaming, tool visibility, sessions, skills, usage); Claude Code (sprint/plan); Cursor/Lovable (context) | Claude Code (sprint/plan author); Cursor/Lovable (context) |

## Flow

1. **Claude Code** reads the handoff, audits plans, and turns the idea into a **sprint** with a **master plan** and **task briefs**.
2. Task briefs are assigned per [TASK_DELEGATION.md](./TASK_DELEGATION.md) (Lovable vs Cursor).
3. **Cursor** implements assigned briefs (heavy frontend/backend, local development).
4. **Lovable** uses outputs from Claude Code (e.g. migrations, Edge Function specs) for deployment, DB management, Edge Function deployment, and bug fixes.

## Related

- **This repo is one product:** **game** (my-rpg-game), **Studio**, and **PicoClaw**. See [Project overview](../PROJECT_OVERVIEW.md) and [README](../../README.md) for how they work together.
- **Ideas:** [../ideas/studio-game-control-node-library-handoff.md](../ideas/studio-game-control-node-library-handoff.md) — original game control bridge idea (no PicoClaw tool). [../ideas/glass-canvas-ai-creator-personas-handoff.md](../ideas/glass-canvas-ai-creator-personas-handoff.md) — Glass Canvas AI creator personas and identity-owned storefronts. [../ideas/studio-picoclaw-alignment-openclaw-parity-handoff.md](../ideas/studio-picoclaw-alignment-openclaw-parity-handoff.md) — Studio PicoClaw alignment (OpenClaw parity).
- **Studio architecture:** [../studio-architecture/QUICK_REFERENCE.md](../studio-architecture/QUICK_REFERENCE.md).
