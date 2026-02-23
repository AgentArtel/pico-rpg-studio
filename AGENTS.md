# RPG-JS Project

## Project Overview

RPG-JS is a TypeScript framework for creating RPG (Role-Playing Games) and MMORPG (Massively Multiplayer Online Role-Playing Games) that run in the browser. The framework is designed so that the same codebase can be used for both single-player RPGs and multiplayer MMORPGs.

**Key Capabilities:**
- Create both RPG and MMORPG with the same codebase
- WebGL-based rendering using PixiJS v7
- Real-time multiplayer with Socket.io v4
- Tiled Map Editor integration for level design
- Vue.js v3 for UI/GUI development
- Cross-platform support (desktop, mobile, gamepad)

**Websites:**
- Main Site: https://rpgjs.dev
- Documentation: https://docs.rpgjs.dev
- Playground: https://playground.rpgjs.dev
- Community: https://community.rpgjs.dev

## The Three Projects

This repo is one product: the **game** ([my-rpg-game](my-rpg-game/)) is the RPG-JS game server; **Studio** ([studio](studio/)) is the admin/agent/workflow UI that syncs with the game and deploys PicoClaw; **PicoClaw** ([picoclaw](picoclaw/)) is the AI agent runtime that powers NPC chat and tools. They share Supabase and Edge Functions (object-api, npc-ai-chat, picoclaw-bridge). For a full overview, see [README.md](README.md) and [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md).

## Repository Structure

This repository is organized as a monorepo. The three main products are my-rpg-game, studio, and picoclaw; RPG-JS is the framework source (optional local reference).

```
/
├── my-rpg-game/            # (1) Game — RPG-JS game server
│   ├── main/               # Game modules (player, events, worlds, services)
│   ├── rpg.toml            # Game configuration
│   ├── package.json
│   └── Dockerfile
├── studio/                 # (2) Studio — React admin + Edge Functions
│   ├── src/                # Frontend (pages, components, hooks)
│   └── supabase/functions/ # object-api, npc-ai-chat, picoclaw-bridge
├── picoclaw/               # (3) PicoClaw — AI agent runtime (Go)
│   └── ...                 # Used for NPC agents and optional studio assistants
├── RPG-JS/                 # Framework source (Lerna monorepo)
│   ├── packages/           # client, server, compiler, plugins, etc.
│   └── tests/
├── docs/                   # Documentation (PROJECT_OVERVIEW, implementation, guides)
├── ideas/                  # Feature ideas and handoffs
└── docs/implementation/    # Agent task briefs and handoffs
```

## Plugins and Modules (my-rpg-game)

- All plugins/modules are **internal use only** (not published).
- **Existing code in `main/`** (ContentSync, npcSpawner, memoryService, objectSpawner, player state, workflows) **stays as-is**. Do not refactor into plugins unless explicitly requested.
- **New work:** Put new self-contained features in new modules (e.g. `./plugins/...` or `./modules/...`) registered in `rpg.toml`; keep new game content (events, maps, items, story) in `main/`.

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Language | TypeScript | 5.x |
| Build Tool | Vite | 4.x |
| Rendering | PixiJS | 7.x |
| UI Framework | Vue.js | 3.x |
| Networking | Socket.io | 4.x |
| Server | Node.js | 18+ |
| Testing | Vitest | 1.x |
| Monorepo | Lerna | 6.x |

## Key Configuration Files

### RPG-JS Framework (`/RPG-JS/`)

- **`lerna.json`** - Lerna monorepo configuration defining package locations
- **`package.json`** - Root package.json with workspace scripts
- **`tsconfig.json`** - TypeScript configuration for the framework
- **`netlify.toml`** - Documentation site deployment config

### Game Project (`/my-rpg-game/`)

- **`rpg.toml`** - Main game configuration file (see Configuration section)
- **`package.json`** - Game dependencies and scripts
- **`tsconfig.json`** - TypeScript configuration
- **`Dockerfile`** - Container deployment configuration
- **`vercel.json`** / **`netlify.toml`** - Static hosting configurations

## Build and Development Commands

### Framework Development (in `/RPG-JS/`)

```bash
# Install dependencies and build all packages
npm install

# Development mode with hot reload (uses sample2)
npm run dev

# Watch all packages for changes
npm run dev:watch

# Build all packages
npm run build

# Run framework tests
npm test

# Publish packages with Lerna
npm run lerna:publish
```

### Game Development (in `/my-rpg-game/`)

```bash
# Install dependencies
npm install

# Start development server (MMORPG mode)
npm run dev
# Or: RPG_TYPE=mmorpg npm run dev

# Start in RPG mode (single player)
RPG_TYPE=rpg npm run dev

# Change port
PORT=4000 npm run dev

# Production build (MMORPG)
NODE_ENV=production npm run build

# Production build (RPG)
NODE_ENV=production RPG_TYPE=rpg npm run build

# Start production server
npm start
```

### Documentation (in `/docs/`)

```bash
npm install
npm run dev    # Start dev server
npm run build  # Build for production
```

## Project Architecture

### Module System

RPG-JS uses a module-based architecture where games are composed of modules:

```typescript
// rpg.toml
modules = [
    './main',                      # Local module
    '@rpgjs/default-gui',          # Official plugin
    '@rpgjs/gamepad',              # Gamepad support
    '@rpgjs/mobile-gui'            # Mobile UI
]
```

Each module can contain:
- **`player.ts`** - Player lifecycle hooks
- **`server.ts`** - Server engine hooks
- **`client.ts`** - Client engine hooks
- **`events/`** - Event/NPC definitions
- **`maps/`** - Tiled map files (.tmx)
- **`spritesheets/`** - Sprite definitions
- **`database/`** - Items, skills, classes, etc.
- **`gui/`** - Vue/React GUI components
- **`sounds/`** - Audio files
- **`worlds/`** - World map definitions

### Player Hooks Example

```typescript
// main/player.ts
import { RpgPlayer, type RpgPlayerHooks, Control, Components } from '@rpgjs/server'

const player: RpgPlayerHooks = {
    onConnected(player: RpgPlayer) {
        player.name = 'PlayerName'
        player.setComponentsTop(Components.text('{name}'))
    },
    onInput(player: RpgPlayer, { input }) {
        if (input == Control.Back) {
            player.callMainMenu()
        }
    },
    async onJoinMap(player: RpgPlayer) {
        await player.showText('Welcome!')
    }
}

export default player
```

### Event (NPC) Example

```typescript
// main/events/villager.ts
import { RpgEvent, EventData, RpgPlayer } from '@rpgjs/server'

@EventData({
    name: 'EV-1',
    hitbox: { width: 32, height: 16 }
})
export default class VillagerEvent extends RpgEvent {
    onInit() {
        this.setGraphic('female')
    }
    async onAction(player: RpgPlayer) {
        await player.showText('Hello!')
        player.gold += 10
    }
}
```

## Configuration (rpg.toml)

The `rpg.toml` file is the main configuration for RPG-JS games:

```toml
# Game name
name = 'My Game'

# Module loading order
modules = [
    './main',
    '@rpgjs/default-gui',
    '@rpgjs/gamepad'
]

# Starting position
[start]
    map = 'simplemap'
    graphic = 'hero'
    hitbox = [16, 16]

# Compiler options
[compilerOptions]
    # Custom path aliases
    [compilerOptions.alias]
        "@" = "./src"

# Build configuration
[compilerOptions.build]
    outputDir = 'dist'
    serverUrl = 'https://myserver.com'  # For client-server separation
    pwaEnabled = true

# Vite configuration passthrough
[vite]
    logLevel = "silent"

# Express server configuration
[express]
    port = 3000
    static = 'public'

# Input bindings
[inputs]
    [inputs.action]
        bind = "Space"
        repeat = false
    [inputs.back]
        bind = "Escape"
```

## Testing

### Unit Testing Setup

Install testing dependencies:
```bash
npm install @rpgjs/testing vitest jsdom canvas --save-dev
```

### Test File Example

```typescript
// main/__tests__/player.spec.ts
import { RpgPlayer, RpgModule, RpgServer } from '@rpgjs/server';
import { testing, clear } from '@rpgjs/testing';
import { beforeEach, afterEach, test, expect } from 'vitest';
import player from '../player';

@RpgModule<RpgServer>({ player })
class RpgServerModule {}

let currentPlayer: RpgPlayer;

beforeEach(async () => {
    const fixture = await testing([{ server: RpgServerModule }]);
    const clientFixture = await fixture.createClient();
    currentPlayer = clientFixture.player;
});

test('player has correct name', () => {
    expect(currentPlayer.name).toBe('YourName')
});

afterEach(() => {
    clear();
});
```

### Running Tests

Add to `package.json`:
```json
{
  "scripts": {
    "test": "npx vitest --config node_modules/@rpgjs/compiler/src/test/vitest.config.ts"
  }
}
```

Run tests:
```bash
npm test
```

## Deployment

### MMORPG Deployment

Build produces:
- `dist/server/` - Server-side code
- `dist/client/` - Client-side code

```bash
NODE_ENV=production npm run build
node dist/server/main
```

With PM2:
```bash
pm2 start dist/server/main.js
```

### RPG (Standalone) Deployment

```bash
NODE_ENV=production RPG_TYPE=rpg npm run build
```

Deploy `dist/standalone/` to static hosting (Vercel, Netlify, etc.)

### Docker Deployment

```bash
# Build
docker build -t rpg .

# Run
docker run -p 3000:3000 -d rpg
```

### Client-Server Separation

For separate client and server deployments:

1. Set server URL in `rpg.toml`:
```toml
[compilerOptions.build]
    serverUrl = 'wss://api.mygame.com'
```

2. Start server without static file serving:
```bash
PORT=3000 STATIC_DIRECTORY_ENABLED=false node dist/server/main
```

## Code Style Guidelines

- **Language**: TypeScript 5.x with strict mode enabled
- **Module System**: ES Modules (`"type": "module"`)
- **Decorators**: Use experimental decorators for events and modules
- **Naming**: 
  - Classes: PascalCase (e.g., `RpgPlayer`, `VillagerEvent`)
  - Hooks files: camelCase (e.g., `player.ts`, `server.ts`)
  - Events: PascalCase with Event suffix (e.g., `VillagerEvent`)
- **Imports**: Use explicit imports from `@rpgjs/server` or `@rpgjs/client`
- **Types**: Always export type hooks (e.g., `RpgPlayerHooks`, `RpgClientEngineHooks`)

## Package Dependencies

### Core Framework Packages

| Package | Description |
|---------|-------------|
| `@rpgjs/server` | Server-side engine and API |
| `@rpgjs/client` | Client-side engine and rendering |
| `@rpgjs/common` | Shared utilities and code |
| `@rpgjs/compiler` | Build toolchain (vite-based) |
| `@rpgjs/database` | Database type definitions |
| `@rpgjs/testing` | Unit testing utilities |
| `@rpgjs/tiled` | Tiled map format support |
| `@rpgjs/types` | TypeScript type definitions |

### Official Plugins

| Plugin | Description |
|--------|-------------|
| `@rpgjs/default-gui` | Default UI components |
| `@rpgjs/mobile-gui` | Mobile-optimized UI |
| `@rpgjs/gamepad` | Gamepad/controller support |
| `@rpgjs/chat` | In-game chat system |
| `@rpgjs/save` | Save/load functionality |
| `@rpgjs/title-screen` | Title screen plugin |
| `@rpgjs/plugin-emotion-bubbles` | Emotion bubble effects |

## Security Considerations

- Authentication hooks available in `server.ts`
- CORS configuration supported in `rpg.toml`
- Environment variables for secrets (use `$ENV:VAR_NAME` in config)
- Socket.io for real-time communication with room isolation

## Browser Compatibility

**Supported:**
- Google Chrome
- Firefox
- Edge (WebKit version)
- Brave
- Mobile browsers (iOS Safari, Chrome Mobile)

**Not Supported:**
- Internet Explorer

## Development Toolkit

This project includes an AI Development Toolkit in `.agents/skills/` for rapid RPG-JS development:

| Skill | Purpose | Example Usage |
|-------|---------|---------------|
| `rpgjs-module-creator` | Scaffold new modules | "Create a combat module" |
| `rpgjs-event-creator` | Create NPCs/events | "Create a shopkeeper NPC" |
| `rpgjs-database-creator` | Create items/skills/classes | "Create a fireball spell" |
| `rpgjs-gui-creator` | Create Vue.js GUIs | "Create an inventory screen" |
| `rpgjs-tiled-assistant` | Fix Tiled map issues | "Fix my map tileset paths" |

See `.agents/skills/README.md` for detailed usage.

### Code Conventions

Official project rules live in `.cursor/rules/*.mdc` (Cursor rule files). They enforce RPG-JS coding conventions including file naming, imports, decorators, hook patterns, and type safety. The root `.cursorrules` file points to these rules and to this document.

## Resources

- **Documentation**: https://docs.rpgjs.dev
- **Community**: https://community.rpgjs.dev
- **Starter Template**: https://github.com/rpgjs/starter
- **Issue Tracker**: GitHub Issues in RPG-JS repository
