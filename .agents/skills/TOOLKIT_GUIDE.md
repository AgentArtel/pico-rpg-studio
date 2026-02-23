# RPG-JS Development Toolkit - User Guide

Quick reference guide for using the RPG-JS AI development toolkit.

---

## 🛠️ Tool Overview

| Tool | Purpose | Use When |
|------|---------|----------|
| **rpgjs-module-creator** | Scaffold new modules | Starting a new feature system |
| **rpgjs-event-creator** | Create NPCs/events | Adding characters or interactables |
| **rpgjs-database-creator** | Create items/skills/etc | Adding game content |
| **rpgjs-gui-creator** | Create UI components | Building menus and HUDs |
| **rpgjs-tiled-assistant** | Fix map issues | Tiled map problems |

---

## 1. rpgjs-module-creator

Creates complete RPG-JS modules with folder structure and boilerplate.

### Creates:
- `player.ts` - Player hooks
- `server.ts` - Server engine hooks  
- `client.ts` - Client engine hooks
- `index.ts` - Module exports
- Folders: `events/`, `maps/`, `database/`, `gui/`, `worlds/`

### Example Prompts:
```
Create a quest system module with events and GUI
```
```
Create an inventory module with item management
```
```
Create a dialogue system module for conversations
```
```
Create a trading module with player-to-player exchange
```
```
Create a minimal utils module for helper functions
```

---

## 2. rpgjs-event-creator

Creates NPCs and interactive map events.

### Features:
- `@EventData` decorator setup
- Lifecycle hooks: `onInit()`, `onAction()`, `onPlayerTouch()`
- Player interactions: dialogue, shops, battles
- Movement patterns and animations

### Example Prompts:
```
Create a shopkeeper that sells weapons and potions
```
```
Create a slime enemy that moves randomly and attacks on touch
```
```
Create a quest giver NPC with multiple dialogue states
```
```
Create a villager that gives the player 100 gold
```
```
Create a healer NPC that restores player HP
```
```
Create a chest event that gives a random item
```
```
Create a guard that blocks passage until player has a key
```
```
Create a boss enemy with high stats and a death event
```

---

## 3. rpgjs-database-creator

Creates game data: items, weapons, armors, skills, classes, enemies, states.

### Creates:
- `@Item()` - Consumables and key items
- `@Weapon()` - Equippable weapons
- `@Armor()` - Protective gear
- `@Skill()` - Spells and abilities
- `@Class()` - Character classes
- `@Enemy()` - Monsters and bosses
- `@State()` - Status effects

### Example Prompts:
```
Create a health potion that restores 50 HP and costs 100 gold
```
```
Create a fireball skill that deals fire damage and costs 15 MP
```
```
Create an iron sword with 15 attack power
```
```
Create a leather armor with 5 defense
```
```
Create a slime enemy with 60 HP that drops health potions
```
```
Create a warrior class that learns slash at level 1
```
```
Create a poison state that deals 10 damage per turn
```
```
Create a dragon boss enemy with fire breath attack
```
```
Create a mana potion that restores 30 MP
```
```
Create a healing spell that restores 40 HP to an ally
```

---

## 4. rpgjs-gui-creator

Creates Vue.js user interface components.

### Features:
- Vue 3 single-file components
- RPG-JS engine bindings (`rpgEngine`, `rpgKeypress`, `rpgGui`)
- Keyboard navigation support
- RPG-style styling and effects

### Example Prompts:
```
Create a combat menu with Attack, Skills, Items, Defend, Flee options
```
```
Create a player HUD showing HP, MP, and gold bars
```
```
Create a quest log GUI that displays active quests and objectives
```
```
Create an inventory GUI with item slots and tooltips
```
```
Create a shop GUI showing items with prices and buy/sell buttons
```
```
Create a dialogue box with typewriter text effect
```
```
Create a main menu with New Game, Load Game, Options, Exit
```
```
Create a status screen showing player stats and equipment
```
```
Create a notification popup for quest updates
```
```
Create a skill selection menu for choosing abilities
```

---

## 5. rpgjs-tiled-assistant

Validates and fixes Tiled map integration issues.

### Fixes:
- Tileset path problems (absolute → relative)
- Missing "Events" layer
- Map loading errors
- @MapData configuration

### Example Prompts:
```
Fix my Tiled map tileset paths
```
```
Why aren't my events showing up on the map?
```
```
Validate my TMX file structure
```
```
Help me set up a new map called "dungeon-level-1"
```
```
Fix "Cannot find tileset" error in my map
```
```
Why is my map showing black/blank?
```
```
How do I position events in Tiled correctly?
```
```
Fix broken tileset references in my world files
```

---

## 🎯 Complete Workflow Example

Building a magic system step-by-step:

**Step 1:** Create module
```
Create a magic system module
```

**Step 2:** Add spells and items
```
Create a fireball spell, ice bolt spell, and heal spell
```
```
Create a wizard staff weapon and mage robe armor
```
```
Create a mana potion that restores 50 MP
```

**Step 3:** Create NPC
```
Create a wizard NPC that teaches spells
```

**Step 4:** Create UI
```
Create a spell book GUI showing learned spells
```
```
Create a mana bar HUD
```

**Step 5:** Fix map
```
Set up the wizard tower map with the wizard NPC positioned
```

---

## 💡 Quick Tips

1. **Be specific** - Include names, numbers, and effects
2. **Mention integrations** - Say "with shop GUI" or "that opens inventory"
3. **Chain requests** - Build modules step by step
4. **Check .cursorrules** - Reference for coding conventions

---

## 📚 Resources

- **Skills location:** `.agents/skills/`
- **Coding rules:** `.cursorrules`
- **This guide:** `.agents/skills/TOOLKIT_GUIDE.md`
- **Project docs:** https://docs.rpgjs.dev
- **Community:** https://community.rpgjs.dev
