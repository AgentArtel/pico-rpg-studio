# Workflow RPG — Game Server

RPG-JS game server for **Workflow RPG**: an AI-powered multiplayer RPG where NPCs are intelligent agents and workflow objects connect to real APIs. **This game server is one of three projects in this repo** (game, Studio, PicoClaw). See the [repository root README](../README.md) for the full stack.

## Prerequisites

- **Node.js 18+**
- **Supabase** project (for content sync, NPCs, objects, player state)

For full setup (Studio, database migrations, Edge Functions), see the repository root [README](../README.md).

## Quick start

```bash
npm install
```

Create a `.env` in this directory (see root README for Supabase setup):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Start the game server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). **Studio** (admin panel) runs separately from the repo root—see [README](../README.md).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (MMORPG mode) |
| `RPG_TYPE=rpg npm run dev` | Single-player RPG mode |
| `npm run build` | Production build (`NODE_ENV=production npm run build`) |
| `npm start` | Run production server (`node dist/server/main.mjs`) |

## Project layout

| Path | Description |
|------|-------------|
| `main/` | Game module: `server.ts`, `player.ts`, `events/`, `items/`, `worlds/`, `realtime/`, `services/`, `types/` |
| `rpg.toml` | RPG-JS config: modules and start map/graphic |
| `supabase/` | Migrations and setup scripts |

## Plugin / module policy (internal)

- **Plugins = game only.** They are RPG-JS modules (entries in `rpg.toml`). Studio does not use them.
- **Internal-only:** We do not publish to npm or the RPG-JS repo. Use `./plugins/<name>` or `./modules/<name>` for new separable features; add `config.json` when you need options.
- **Existing code in `main/` stays as-is.** New, self-contained systems go in plugins/modules; new game content (maps, events, items) stays in `main/`. See [ideas/internal-plugins-policy.md](../ideas/internal-plugins-policy.md) in the repo.

## Documentation

- [Repository README](../README.md) — Quick Start, Studio, architecture
- [AGENTS.md](../AGENTS.md) — Build, deploy, and code conventions
- [OBJECT-SYSTEM.md](../OBJECT-SYSTEM.md) — Workflow objects (Mailbox, Desk)
- [Game docs](./docs/README.md) — Architecture and key modules (this package)

## Production

### Build and run (Node)

```bash
NODE_ENV=production npm run build
npm start
```

### Docker

```bash
docker build -t rpg .
docker run -p 3000:3000 -d rpg
```

## Resources

- [RPG-JS Documentation](https://docs.rpgjs.dev)
- [RPG-JS Community](https://community.rpgjs.dev)

## Credits for sample package assets

### Sounds

[Davidvitas](https://www.davidvitas.com/portfolio/2016/5/12/rpg-music-pack)  
Attribution 4.0 International (CC BY 4.0) — https://creativecommons.org/licenses/by/4.0/deed.en

### Graphics

[Pipoya](https://pipoya.itch.io)

### Icons

https://game-icons.net
