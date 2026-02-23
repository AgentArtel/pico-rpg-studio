# Workflow RPG

> An AI-powered multiplayer RPG where NPCs are intelligent agents and workflows connect to real-world APIs.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Three projects, one stack.** This repo contains **(1) the RPG game** ([my-rpg-game](my-rpg-game/)), **(2) Studio** ([studio](studio/)) — the admin and agent/workflow UI — and **(3) PicoClaw** ([picoclaw](picoclaw/)) — the AI agent runtime. They share Supabase: Studio configures NPCs and agents and deploys PicoClaw; the game spawns NPCs and sends player chat to PicoClaw; PicoClaw runs the agents and returns responses. See [Project overview](docs/PROJECT_OVERVIEW.md) for how they connect.

---

## What is This?

**Workflow RPG** is a browser-based multiplayer RPG built on [RPGJS](https://rpgjs.dev) where:

- **NPCs are AI agents** powered by LLMs (Kimi, Gemini, Groq)
- **Workflow objects** connect to real APIs (Gmail, Google Drive, etc.)
- **Data flows through the game** like a postal system - players carry "letters" (data) between objects
- **Everything is database-driven** - create NPCs and objects via the Studio UI, no code deploy needed

### Demo Flow

```
1. Player walks to Mailbox
   └─ Fetches real Gmail emails
   └─ Emails become "letters" in inventory

2. Player walks to Desk  
   └─ "Processes" the mail (transforms data)
   └─ Clean data stored for AI agents

3. (Future) AI Agent reads processed mail
   └─ Generates quests, responses, actions
```

---

## Project Structure

```
kimi-rpg/
├── my-rpg-game/          # (1) RPGJS game server (Node.js)
│   ├── main/
│   │   ├── services/     # NPC spawner, object spawner, AI service
│   │   ├── items/        # Game items (EmailItem, etc.)
│   │   ├── server.ts     # Entry point
│   │   └── player.ts     # Player hooks
│   └── package.json
│
├── studio/               # (2) React admin panel (Vite + shadcn/ui)
│   ├── src/
│   │   ├── pages/        # NPC Builder, Objects, Integrations
│   │   ├── components/   # UI components
│   │   └── hooks/        # React Query hooks
│   └── supabase/
│       └── functions/    # Edge Functions (object-api, npc-ai-chat, picoclaw-bridge)
│
├── picoclaw/             # (3) PicoClaw agent runtime (Go); NPC chat and tools run here
│   └── ...
│
├── RPG-JS/               # Framework source (optional local reference)
├── docs/                 # Documentation (incl. PROJECT_OVERVIEW.md)
├── ideas/                # Feature ideas and handoffs
└── docs/implementation/ # Implementation and agent handoff docs
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- Supabase account
- (Optional) Gmail account for mail integration

### 1. Clone and Install

```bash
git clone <repo-url>
cd kimi-rpg

# Install game dependencies
cd my-rpg-game
npm install

# Install Studio dependencies  
cd ../studio
npm install
```

### 2. Environment Setup

**Game** (`my-rpg-game/.env`):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Studio** (`studio/.env`):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Database Setup

Run migrations in Supabase SQL Editor:
- See `my-rpg-game/supabase/migrations/` for schema

### 4. Deploy Edge Functions

```bash
cd studio
npx supabase functions deploy object-api --project-ref your-project-ref
npx supabase functions deploy npc-ai-chat --project-ref your-project-ref
```

### 5. Start Development

```bash
# Terminal 1: Game server
cd my-rpg-game
npm run dev

# Terminal 2: Studio
cd studio
npm run dev
```

Game: http://localhost:3000  
Studio: http://localhost:5173

**Optional — run all three:** For local PicoClaw (NPC agents in chat), see [Project overview](docs/PROJECT_OVERVIEW.md#run-the-stack) and [picoclaw/INTEGRATION.md](picoclaw/INTEGRATION.md).

---

## How the Three Projects Work Together

- **Studio → Supabase:** Saves agent configs, NPC definitions, workflows, and agent memory. Studio also deploys and manages PicoClaw via the **picoclaw-bridge** Edge Function.
- **Game → Supabase:** Reads content (NPCs, objects), syncs player state, and uses Edge Functions for object actions and NPC chat.
- **Player talks to NPC:** Game sends the message to the **npc-ai-chat** Edge Function, which forwards to **PicoClaw**. PicoClaw runs the agent (LLM + skills/tools) and returns the reply; npc-ai-chat writes conversation to `agent_memory` and returns the text to the game.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SUPABASE                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │  game schema    │  │  public schema  │  │  Edge Functions             │ │
│  │  agent_configs  │  │  studio_*       │  │  object-api, npc-ai-chat,   │ │
│  │  agent_memory   │  │  workflows      │  │  picoclaw-bridge            │ │
│  │  player_state   │  │  executions     │  └──────────────┬──────────────┘ │
│  │  object_*       │  └────────┬────────┘                   │              │
│  └────────┬────────┘          │                             │              │
└───────────┼───────────────────┼─────────────────────────────┼──────────────┘
            │                   │                             │
    ┌───────▼───────┐   ┌───────▼───────┐   ┌──────────────────▼──────────────┐
    │  RPGJS Game   │   │    Studio     │   │  PicoClaw (agent runtime)      │
    │  NPC spawner  │   │  NPC Builder  │   │  Receives chat from npc-ai-chat │
    │  AI service   │   │  Integrations │   │  Runs agents, tools, LLMs        │
    │  Objects      │   │  Workflows    │   └──────────────────┬──────────────┘
    └───────┬───────┘   └───────────────┘                      │
            │                                                    │
            └──────────────────────┬────────────────────────────┘
                                   │
                         ┌────────▼────────┐
                         │  External APIs   │
                         │  Gmail, Gemini,  │
                         │  Groq, etc.      │
                         └─────────────────┘
```

---

## Key Features

### 🤖 AI NPCs

NPCs have:
- **Personality** (system prompts)
- **Memory** (conversation history)
- **Skills** (move, talk, generate images, etc.)
- **Autonomous behavior** (idle wandering, thinking)

Create/edit in Studio → spawns in game automatically.

### 📬 Workflow Objects

Objects that connect to real APIs:
- **Mailbox** - Fetch/send Gmail
- **Desk** - Process/transform data
- **Bulletin Board** (planned) - Community quests

### 🎮 Database-Driven

No code changes needed for:
- Creating new NPCs
- Placing objects on maps
- Changing NPC behavior
- Adding new API integrations

---

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) | **Three projects:** what they are, how they connect, run the stack |
| [OBJECT-SYSTEM.md](./OBJECT-SYSTEM.md) | Workflow objects (Mailbox, Desk) |
| [EDGE-FUNCTIONS.md](./EDGE-FUNCTIONS.md) | Supabase Edge Functions |
| [docs/implementation/README.md](docs/implementation/README.md) | Implementation & handoffs (agent task briefs) |
| [studio/docs/game-integration/VISION-studio-game-architecture.md](./studio/docs/game-integration/VISION-studio-game-architecture.md) | Architecture overview |
| [studio/docs/game-integration/NPC-BUILDER-PLAN.md](./studio/docs/game-integration/NPC-BUILDER-PLAN.md) | NPC system spec |

---

## Contributing

This project uses multiple AI agents for development:
- **Kimi Code** (CLI) - Code editing, debugging
- **Claude** (Cursor) - Architecture, documentation
- **Lovable** - Studio UI development

See individual component docs for contribution guidelines.

---

## License

MIT License - see LICENSE file for details.

---

## Credits

- [RPGJS](https://rpgjs.dev) - Game framework
- [Supabase](https://supabase.com) - Database + Auth + Edge Functions
- [Kimi](https://kimi.ai), [Gemini](https://ai.google.dev), [Groq](https://groq.com) - AI models
