---
name: rpgjs-event-creator
description: Create RPG-JS events (NPCs) with proper decorators, hitboxes, graphics, and interaction logic. Use when the user wants to create a new NPC, enemy, interactive object, shopkeeper, quest giver, or any map event in an RPG-JS game.
---

# RPG-JS Event Creator

Creates events (NPCs) with proper structure, lifecycle hooks, and interaction patterns.

## Quick Start

Create a basic NPC:
```
Create a villager event that gives the player 10 gold
```

Create an enemy:
```
Create a slime enemy that battles the player
```

Create a shopkeeper:
```
Create a shopkeeper with a shop GUI
```

## Event Types

| Type | Description | Common Methods |
|------|-------------|----------------|
| `villager` | Friendly NPC with dialogue | `showText()`, `setGraphic()` |
| `shopkeeper` | Sells items to player | `gui('shop').open()` |
| `quest-giver` | Gives/accepts quests | `setVariable()`, `getVariable()` |
| `enemy` | Hostile creature | Battle logic, `hp` manipulation |
| `animated` | Moving NPC | `infiniteMoveRoute()`, `speed` |
| `dynamic` | Spawned at runtime | `createDynamicEvent()` |

## Event Structure

```typescript
@EventData({
    name: 'EV-001',
    hitbox: { width: 32, height: 16 }
})
export default class MyEvent extends RpgEvent {
    onInit() {
        // Initialization
    }
    
    async onAction(player: RpgPlayer) {
        // Player interaction
    }
}
```

## Lifecycle Hooks

| Hook | When Called | Use For |
|------|-------------|---------|
| `onInit()` | Event spawned | Set graphic, hitbox, speed |
| `onAction(player)` | Player presses action key | Dialogue, interactions |
| `onPlayerTouch(player)` | Player touches event | Triggers, hazards |
| `onChanges()` | Event state changes | Sync client |

## Common Patterns

### Dialogue NPC
```typescript
async onAction(player: RpgPlayer) {
    await player.showText('Hello traveler!', { talkWith: this })
    await player.showText('Safe travels!')
}
```

### Gold Giver
```typescript
async onAction(player: RpgPlayer) {
    await player.showText('Here is 10 gold.')
    player.gold += 10
}
```

### Conditional Dialogue
```typescript
async onAction(player: RpgPlayer) {
    if (player.getVariable('MET_NPC')) {
        await player.showText('Welcome back!')
    } else {
        await player.showText('Nice to meet you!')
        player.setVariable('MET_NPC', true)
    }
}
```

### Moving NPC
```typescript
onInit() {
    this.setGraphic('male')
    this.speed = Speed.Slow
    this.infiniteMoveRoute([ Move.tileRandom() ])
}
```

### Shopkeeper
```typescript
async onAction(player: RpgPlayer) {
    player.gui('shop').open({ 
        items: [Potion, Sword],
        buy: true,
        sell: true
    })
}
```

### Quest Giver
```typescript
async onAction(player: RpgPlayer) {
    const questState = player.getVariable('QUEST_TUTORIAL')
    
    if (!questState) {
        await player.showText('Please help me find my cat!')
        player.setVariable('QUEST_TUTORIAL', 'started')
    } else if (questState === 'started') {
        await player.showText('Have you found my cat?')
    } else if (questState === 'completed') {
        await player.showText('Thank you for your help!')
    }
}
```

## Event Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Event ID from @EventData |
| `speed` | Speed | Movement speed enum |
| `frequency` | number | Action frequency |
| `through` | boolean | Can walk through |
| `trigger` | string | Collision trigger type |

## Speed Values

```typescript
Speed.Slowest  // 1 tile/sec
Speed.Slow     // 2 tiles/sec
Speed.Normal   // 3 tiles/sec
Speed.Fast     // 4 tiles/sec
Speed.Fastest  // 5 tiles/sec
```

## Movement Commands

```typescript
Move.tileUp(n)
Move.tileDown(n)
Move.tileLeft(n)
Move.tileRight(n)
Move.tileRandom()
Move.towardPlayer(player)
Move.awayFromPlayer(player)
```

## Components

```typescript
import { Components } from '@rpgjs/server'

this.setComponentsTop(Components.text('{name}'))
this.setComponentsBottom(Components.bar())
```

## Naming Conventions

Event IDs should be descriptive:
- `EV-TOWN-VILLAGER-001`
- `EV-FOREST-ENEMY-WOLF`
- `EV-CASTLE-SHOPKEEPER`

## Dynamic Event Creation

From player or another event:
```typescript
const map = player.getCurrentMap()
map?.createDynamicEvent({
    x: player.position.x + 5,
    y: player.position.y + 5,
    event: DynamicEventClass
})
```
