# Workflow RPG

> An AI-powered multiplayer RPG where NPCs are intelligent agents and workflows connect to real-world APIs.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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
├── my-rpg-game/          # RPGJS game server (Node.js)
│   ├── main/
│   │   ├── services/     # NPC spawner, object spawner, AI service
│   │   ├── items/        # Game items (EmailItem, etc.)
│   │   ├── server.ts     # Entry point
│   │   └── player.ts     # Player hooks
│   └── package.json
│
├── studio/               # React admin panel (Vite + shadcn/ui)
│   ├── src/
│   │   ├── pages/        # NPC Builder, Objects, Integrations
│   │   ├── components/   # UI components
│   │   └── hooks/        # React Query hooks
│   └── supabase/
│       └── functions/    # Edge Functions (object-api, npc-ai-chat)
│
└── docs/                 # Documentation
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
| [OBJECT-SYSTEM.md](./OBJECT-SYSTEM.md) | Workflow objects (Mailbox, Desk) |
| [EDGE-FUNCTIONS.md](./EDGE-FUNCTIONS.md) | Supabase Edge Functions |
| [studio/docs/game-integration/VISION-studio-game-architecture.md](./studio/docs/game-integration/VISION-studio-game-architecture.md) | Architecture overview |
| [studio/docs/game-integration/NPC-BUILDER-PLAN.md](./studio/docs/game-integration/NPC-BUILDER-PLAN.md) | NPC system spec |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  game schema    │  │  public schema  │  │  Edge Functions │ │
│  │  ─────────────  │  │  ─────────────  │  │  ─────────────  │ │
│  │  agent_configs  │  │  studio_*       │  │  object-api     │ │
│  │  agent_memory   │  │  workflows      │  │  npc-ai-chat    │ │
│  │  player_state   │  │  executions     │  │                 │ │
│  │  object_*       │  │                 │  │                 │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
└───────────┼────────────────────┼────────────────────┼──────────┘
            │                    │                    │
    ┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐
    │  RPGJS Game   │   │    Studio     │   │  External APIs│
    │  ──────────   │   │   ────────    │   │  ───────────  │
    │  NPC spawner  │   │  NPC Builder  │   │  Gmail        │
    │  AI service   │   │  Integrations │   │  Gemini       │
    │  Objects      │   │  Workflows    │   │  Groq         │
    └───────────────┘   └───────────────┘   └───────────────┘
```

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
