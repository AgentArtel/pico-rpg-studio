# RPG-JS Development Toolkit

A collection of AI skills and rules for rapid RPG-JS game development with Claude Code / Cursor.

## Quick Start

1. **Create a new module:**
   ```
   Create a quest module with events and a GUI
   ```

2. **Create an NPC:**
   ```
   Create a shopkeeper event that opens a shop GUI
   ```

3. **Create an item:**
   ```
   Create a health potion that restores 50 HP
   ```

4. **Create a GUI:**
   ```
   Create a quest log GUI to display active quests
   ```

## Skills

| Skill | Purpose | Trigger Examples |
|-------|---------|------------------|
| `rpgjs-module-creator` | Scaffold new modules | "Create a combat module" |
| `rpgjs-event-creator` | Create NPCs/events | "Create a villager NPC" |
| `rpgjs-database-creator` | Create items/skills/classes | "Create a fireball spell" |
| `rpgjs-gui-creator` | Create Vue.js GUIs | "Create an inventory screen" |
| `rpgjs-quest-system` | Design and implement quests (variables, givers, objectives, quest log) | "Add a quest to defeat 5 slimes" |
| `rpgjs-tiled-assistant` | Fix Tiled map issues | "Fix my map tileset paths" |

## Files

```
.agents/
├── skills/
│   ├── rpgjs-module-creator/
│   │   ├── SKILL.md
│   │   └── assets/
│   │       ├── player.ts.template
│   │       ├── server.ts.template
│   │       ├── client.ts.template
│   │       ├── index.ts.template
│   │       ├── event.ts.template
│   │       ├── map.ts.template
│   │       ├── item.ts.template
│   │       ├── gui.vue.template
│   │       └── spritesheet.ts.template
│   ├── rpgjs-event-creator/SKILL.md
│   ├── rpgjs-database-creator/SKILL.md
│   ├── rpgjs-gui-creator/SKILL.md
│   ├── rpgjs-quest-system/SKILL.md
│   ├── rpgjs-tiled-assistant/SKILL.md
│   └── README.md (this file)
└── 
.cursorrules              # Coding conventions
```

## Usage Examples

### Creating a Combat System

```
Create a combat module with:
- Enemy events (slime, goblin)
- Weapons (iron sword, wooden staff)
- A battle HUD GUI
```

### Creating a Quest System

```
Create a quest system with:
- A quest giver NPC
- Quest items
- A quest log GUI
```

Or use the **rpgjs-quest-system** skill for variable-based quest state, objectives, and wiring the quest log to player variables.

### Creating a Shop

```
Create a shop with:
- A shopkeeper NPC
- Items for sale (potions, weapons)
- A shop GUI
```

## Conventions

The `.cursorrules` file enforces:
- TypeScript strict mode
- Proper decorator usage
- Event naming conventions
- Import patterns
- Hook structure

## Module Structure

A complete module:
```
module-name/
├── player.ts          # Player hooks
├── server.ts          # Server engine hooks
├── client.ts          # Client engine hooks
├── index.ts           # Module exports
├── events/            # NPC events
├── maps/              # Map definitions
├── spritesheets/      # Sprite definitions
├── database/
│   ├── items/         # Item definitions
│   ├── skills/        # Skill definitions
│   └── classes/       # Class definitions
├── gui/               # Vue GUI components
└── worlds/            # Tiled map files
```

## Tips

1. **Always use `async/await`** for player interactions
2. **Export type hooks** explicitly (`RpgPlayerHooks`, etc.)
3. **Use descriptive event IDs** (e.g., `EV-TOWN-SHOPKEEPER`)
4. **Check map existence** before operations: `player.getCurrentMap()?.`
5. **Register modules** in `rpg.toml`

## Resources

- [RPG-JS Docs](https://docs.rpgjs.dev)
- [RPG-JS Community](https://community.rpgjs.dev)
