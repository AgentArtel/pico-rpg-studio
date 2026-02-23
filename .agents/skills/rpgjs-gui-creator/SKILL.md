---
name: rpgjs-gui-creator
description: Create RPG-JS Vue.js GUI components with proper RPG-JS bindings, styling, and event handling. Use when the user wants to create game UI elements like menus, dialogs, HUDs, inventory screens, or custom interfaces in an RPG-JS game.
---

# RPG-JS GUI Creator

Creates Vue.js 3 GUI components with proper RPG-JS bindings and lifecycle management.

## Quick Start

Create a simple menu:
```
Create a quest log GUI that displays active quests
```

Create a HUD:
```
Create a player status HUD with HP/MP bars
```

Create an inventory:
```
Create an inventory GUI with item slots
```

## GUI Types

| Type | Description | Features |
|------|-------------|----------|
| `dialog` | Text display | Typewriter effect, choices |
| `menu` | Navigation UI | Multiple layouts, navigation |
| `hud` | Heads-up display | Real-time updates, overlays |
| `inventory` | Item management | Grid, drag-drop, tooltips |
| `shop` | Buy/sell interface | Item lists, prices |
| `notification` | Alerts/popups | Auto-dismiss, animations |
| `custom` | Specialized UI | Game-specific interfaces |

## Basic Structure

```vue
<template>
    <div class="my-gui">
        <!-- Content -->
    </div>
</template>

<script lang="ts">
export default {
    name: 'my-gui',
    inject: ['rpgEngine', 'rpgKeypress', 'rpgGuiClose', 'rpgGui', 'rpgStage'],
    props: ['propName'],
    mounted() {
        this.rpgEngine.controls.stopInputs()
    },
    methods: {
        close() {
            this.rpgGuiClose('my-gui')
            this.rpgEngine.controls.listenInputs()
        }
    }
}
</script>

<style scoped>
.my-gui { }
</style>
```

## Inject Properties

| Property | Description |
|----------|-------------|
| `rpgEngine` | Game engine instance |
| `rpgKeypress` | Keyboard input observable |
| `rpgGuiClose` | Close GUI function |
| `rpgGui` | GUI management |
| `rpgStage` | PixiJS stage |

## Common Patterns

### Close on Action Key
```typescript
mounted() {
    this.rpgEngine.controls.stopInputs()
    this.obsKeyPress = this.rpgKeypress.subscribe(({ control }) => {
        if (control?.actionName == Control.Action) {
            this.close()
        }
    })
},
unmounted() {
    if (this.obsKeyPress) this.obsKeyPress.unsubscribe()
}
```

### Receive Props from Server
```vue
<script>
export default {
    props: ['gold', 'items'],
    mounted() {
        console.log(this.gold)  // Data passed from server
    }
}
</script>
```

### Open GUI from Server
```typescript
// In player.ts or event.ts
player.gui('my-gui').open({ 
    gold: player.gold,
    items: player.items 
})
```

### Background Blur Effect
```typescript
mounted() {
    const blur = new this.rpgEngine.PIXI.BlurFilter()
    this.rpgStage.filters = [blur]
},
unmounted() {
    this.rpgStage.filters = null
}
```

### Hide Other GUIs
```typescript
mounted() {
    if (this.rpgGui.exists('rpg-controls')) {
        this.rpgGui.hide('rpg-controls')
    }
}
```

## GUI Registration

In `client.ts`:
```typescript
import { RpgModule, RpgClient } from '@rpgjs/client'
import MyGui from './gui/my-gui.vue'

@RpgModule<RpgClient>({
    gui: [MyGui]
})
export default class RpgClientEngine {}
```

## Styling Guidelines

### Positioning
```css
.my-gui {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 100;
}
```

### Centered Window
```css
.window {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    min-width: 300px;
    min-height: 200px;
}
```

### RPG Aesthetic
```css
.gui-container {
    background: rgba(0, 0, 0, 0.85);
    border: 2px solid #c0c0c0;
    border-radius: 8px;
    color: white;
    font-family: 'Courier New', monospace;
    padding: 16px;
}
```

## Common Components

### Choice Selection
```vue
<template>
    <div class="choices">
        <div 
            v-for="(choice, index) in choices" 
            :key="index"
            :class="{ selected: index === selectedIndex }"
            @click="select(index)"
        >
            {{ choice.text }}
        </div>
    </div>
</template>
```

### Progress Bar
```vue
<template>
    <div class="bar-container">
        <div class="bar-fill" :style="{ width: percentage + '%' }"></div>
    </div>
</template>
```

### Item Grid
```vue
<template>
    <div class="item-grid">
        <div v-for="item in items" :key="item.id" class="item-slot">
            <img :src="item.icon" />
            <span class="count">{{ item.count }}</span>
        </div>
    </div>
</template>
```

## Built-in Controls

```typescript
import { Control } from '@rpgjs/client'

Control.Action    // Confirm/Interact
Control.Back      // Cancel/Menu
Control.Up        // Navigate up
Control.Down      // Navigate down
Control.Left      // Navigate left
Control.Right     // Navigate right
```

## GUI State Management

Check if GUI exists:
```typescript
if (this.rpgGui.exists('gui-name')) { }
```

Hide/show GUIs:
```typescript
this.rpgGui.hide('gui-name')
this.rpgGui.show('gui-name')
```

## Example: Quest Log

```vue
<template>
    <div class="quest-log">
        <h2>Quest Log</h2>
        <div class="quest-list">
            <div v-for="quest in quests" :key="quest.id" class="quest">
                <h3>{{ quest.name }}</h3>
                <p>{{ quest.description }}</p>
                <span class="status">{{ quest.status }}</span>
            </div>
        </div>
        <button @click="close">Close</button>
    </div>
</template>

<script>
import { Control } from '@rpgjs/client'

export default {
    name: 'rpg-quest-log',
    inject: ['rpgEngine', 'rpgKeypress', 'rpgGuiClose'],
    props: ['quests'],
    mounted() {
        this.rpgEngine.controls.stopInputs()
        this.obsKeyPress = this.rpgKeypress.subscribe(({ control }) => {
            if (control?.actionName == Control.Back) {
                this.close()
            }
        })
    },
    methods: {
        close() {
            this.rpgGuiClose('rpg-quest-log')
            this.rpgEngine.controls.listenInputs()
        }
    },
    unmounted() {
        if (this.obsKeyPress) this.obsKeyPress.unsubscribe()
    }
}
</script>
```
