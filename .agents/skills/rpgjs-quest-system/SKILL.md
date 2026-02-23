---
name: rpgjs-quest-system
description: Design and implement quests in RPG-JS using player variables, quest giver events, objectives, and optional quest log GUI. Use when the user wants to add quests, quest givers, objectives, rewards, or wire a quest log to quest state.
---

# RPG-JS Quest System

Implement quests using **player variables** for state, **quest giver events** for start/turn-in dialogue, and optional **quest log GUI** that reads the same state.

## Quick Start

Create a simple "kill count" quest:
```
Create a quest where the player must defeat 5 slimes and return to the quest giver for a reward
```

Create a "talk to" quest:
```
Create a quest where the player must talk to the shopkeeper, then return to the quest giver
```

Create a quest log that shows active and completed quests:
```
Create a quest log GUI that displays quests from player variables
```

## Quest State (Variables)

Store quest state with `player.setVariable(key, value)` and `player.getVariable(key)`.

**Conventions:**

- **Quest state:** one variable per quest, e.g. `quest_defeat_slimes` = `'not_started'` | `'active'` | `'completed'`.
- **Objective progress:** separate variables if needed, e.g. `quest_defeat_slimes_count` = number.
- Use **unique, consistent keys** (e.g. `quest_<questid>`, `quest_<questid>_<objective>`).

Example:
```typescript
// Not started
if (!player.getVariable('quest_defeat_slimes')) { ... }

// Start quest
player.setVariable('quest_defeat_slimes', 'active')
player.setVariable('quest_defeat_slimes_count', 0)

// Update objective (e.g. in server/player hook when slime dies)
player.setVariable('quest_defeat_slimes_count', (player.getVariable('quest_defeat_slimes_count') || 0) + 1)

// Complete
player.setVariable('quest_defeat_slimes', 'completed')
```

## Quest Giver Event

Use one event (or multiple) whose `onAction` branches on quest state. Follow **rpgjs-event-creator** for event structure.

**Branches:**

1. **Not started** – Explain quest, then set state to `'active'` and initialize objective counters.
2. **Active** – Show current objective or "Come back when you're done." Optionally check objectives here and move to completion.
3. **Completed** – Give rewards (gold, items), then keep state as `'completed'` (or set `'turned_in'` if you need to track turn-in separately).

Example:
```typescript
async onAction(player: RpgPlayer) {
    const state = player.getVariable('quest_defeat_slimes')

    if (!state) {
        await player.showText('Please defeat 5 slimes!', { talkWith: this })
        player.setVariable('quest_defeat_slimes', 'active')
        player.setVariable('quest_defeat_slimes_count', 0)
        return
    }

    if (state === 'active') {
        const count = player.getVariable('quest_defeat_slimes_count') || 0
        if (count >= 5) {
            await player.showText('Thank you! Here is your reward.')
            player.gold += 100
            player.setVariable('quest_defeat_slimes', 'completed')
        } else {
            await player.showText(`You have defeated ${count}/5 slimes.`)
        }
        return
    }

    if (state === 'completed') {
        await player.showText('Thanks again for your help!')
    }
}
```

## Objective Types

| Type | How to track | Where to update |
|------|----------------|------------------|
| **Talk to NPC** | Set variable when that NPC's `onAction` runs | In the target NPC's event |
| **Collect item** | Check item count in inventory or variable | In quest giver turn-in or when item is added |
| **Kill count** | Increment variable when enemy dies / battle ends | Server or player hook (e.g. battle end, or enemy event) |

For **kill count**, you must increment the counter somewhere (e.g. in a server hook when a battle ends with a given enemy type, or when an enemy event is "defeated"). The quest giver only reads the variable.

## Rewards

In the "completed" branch (when turning in):

```typescript
player.gold += 100
player.addItem(Potion, 3)
```

Use **rpgjs-database-creator** for reward items. Optional: give a key item or set another variable to unlock the next quest.

## Quest Log GUI

- **Data source:** Build the list of quests from player variables on the **server**, then pass it when opening the GUI: `player.gui('rpg-quest-log').open({ quests: buildQuestList(player) })`.
- **buildQuestList(player):** For each quest id you support, read `player.getVariable('quest_<id>')` and any objective variables; return an array of `{ id, name, description, status, objectives: [{ text, completed }] }`.
- The Vue component receives `quests` as a prop and displays them. Follow **rpgjs-gui-creator** for injects, `rpgGuiClose`, and styling.

Opening the log (e.g. from a key in `player.ts` or from a menu):

```typescript
const quests = [
    {
        id: 'defeat_slimes',
        name: 'Defeat the Slimes',
        description: 'Defeat 5 slimes and return for a reward.',
        status: player.getVariable('quest_defeat_slimes') || 'not_started',
        objectives: [
            { text: `Slimes defeated: ${player.getVariable('quest_defeat_slimes_count') || 0}/5`, completed: (player.getVariable('quest_defeat_slimes_count') || 0) >= 5 }
        ]
    }
].filter(q => q.status !== 'not_started') // or show all
player.gui('rpg-quest-log').open({ quests })
```

## Multi-Step Quests

Use one variable per step, e.g. `quest_main_step` = 1, 2, 3. In the quest giver, check the step and required conditions; when met, advance: `player.setVariable('quest_main_step', 2)`. Optional: use one variable per objective (e.g. `quest_main_talked_blacksmith`) and derive "step" from which objectives are done.

## Repeatable vs One-Time

- **One-time:** Set state to `'completed'` after reward; quest giver shows "Thanks again" and does not give reward again.
- **Repeatable:** After giving reward, set state back to `'active'` and reset objective counters so the player can do the quest again.

## File Layout

- **Quest logic:** In **events** (quest giver NPC) and optionally in **player.ts** or **server.ts** for updating objectives (e.g. on kill, on item receive).
- **Quest log GUI:** In `module/gui/` (e.g. `quest-log.vue`). Register and open by id (e.g. `rpg-quest-log`).

## Cross-References

- **Quest giver event structure:** Use **rpgjs-event-creator** (decorators, hitbox, `onInit`, `async onAction`).
- **Reward items:** Use **rpgjs-database-creator** to define items, then `player.addItem(ItemClass, count)`.
- **Quest log UI:** Use **rpgjs-gui-creator** for Vue structure, injects, and closing with `rpgGuiClose`.
- **Conventions:** Follow `.cursor/rules` for type safety (typed params, no `any`).
