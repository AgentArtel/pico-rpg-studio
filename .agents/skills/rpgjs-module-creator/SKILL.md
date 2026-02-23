---
name: rpgjs-module-creator
description: Scaffold new RPG-JS modules with proper structure including player hooks, server/client files, events, maps, and database folders. Use when the user wants to create a new module, add a feature module, or set up a new game system in an RPG-JS project.
---

# RPG-JS Module Creator

Scaffolds new RPG-JS modules with complete structure following framework conventions.

## Quick Start

Create a new module:
```
Create a combat module
```

This generates:
```
modules/combat/
├── player.ts       # Player hooks
├── server.ts       # Server engine hooks
├── client.ts       # Client engine hooks
├── index.ts        # Module exports
├── events/         # NPC events
├── maps/           # Map definitions
├── spritesheets/   # Sprite definitions
├── database/
│   ├── items/      # Item definitions
│   ├── skills/     # Skill definitions
│   └── classes/    # Class definitions
├── gui/            # Vue GUI components
└── worlds/         # Tiled map files
```

## Usage Patterns

### Basic Module

```
Create a quest module with player hooks and server authentication
```

### Feature Module with Database

```
Create a crafting module with items, recipes, and a GUI
```

### Minimal Module

```
Create a simple utils module
```

## Module Types

| Type | Description | Includes |
|------|-------------|----------|
| `full` | Complete module | All files + database + GUI |
| `standard` | Typical gameplay module | Hooks + events + maps |
| `minimal` | Simple utility module | Basic hooks only |
| `gui-only` | UI overlay module | Client hooks + GUI folder |
| `database-only` | Data definitions | Database folders only |

## Asset Templates

Use templates from `assets/` folder:

- `assets/player.ts.template` - Player hooks template
- `assets/server.ts.template` - Server engine hooks template
- `assets/client.ts.template` - Client engine hooks template
- `assets/index.ts.template` - Module index template
- `assets/event.ts.template` - Event class template
- `assets/map.ts.template` - Map definition template
- `assets/item.ts.template` - Database item template
- `assets/gui.vue.template` - Vue GUI component template

## Implementation Steps

1. **Parse user intent** - Determine module type and required components
2. **Create directory structure** - Use `mkdir -p` for all folders
3. **Copy templates** - Populate files from `assets/` with proper naming
4. **Update rpg.toml** - Add module to modules array
5. **Verify** - Ensure imports and exports are correct

## rpg.toml Update Pattern

Add module to `[modules]` array:
```toml
modules = [
    './main',
    './modules/MODULE_NAME',  # Add here
    '@rpgjs/default-gui'
]
```

## Common Patterns

### Combat Module Example
```
modules/combat/
├── player.ts          # onInput for attack key
├── server.ts          # Battle manager
├── events/
│   └── enemy.ts       # Enemy NPC
└── database/
    ├── skills/
    │   └── fireball.ts
    └── items/
        └── sword.ts
```

### Quest Module Example
```
modules/quest/
├── player.ts          # Quest tracking
├── events/
│   ├── quest-giver.ts
│   └── quest-target.ts
└── gui/
    └── quest-log.vue
```

### Shop Module Example
```
modules/shop/
├── events/
│   └── shopkeeper.ts
├── database/
│   └── items/
└── gui/
    └── shop.vue
```
