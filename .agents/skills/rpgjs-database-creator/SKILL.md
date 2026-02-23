---
name: rpgjs-database-creator
description: Create RPG-JS database entities (items, weapons, armors, skills, classes, actors, enemies, states) with proper decorators and RPG mechanics. Use when the user wants to create items, skills, character classes, enemies, or any database entity for an RPG-JS game.
---

# RPG-JS Database Creator

Creates database entities (items, skills, classes, enemies, etc.) with proper RPG mechanics and decorators.

## Quick Start

Create an item:
```
Create a health potion that restores 50 HP
```

Create a weapon:
```
Create an iron sword with 10 attack power
```

Create a skill:
```
Create a fireball spell that deals damage
```

## Database Types

| Type | Decorator | Use For |
|------|-----------|---------|
| `item` | `@Item()` | Consumables, key items |
| `weapon` | `@Weapon()` | Equippable weapons |
| `armor` | `@Armor()` | Equippable armor |
| `skill` | `@Skill()` | Abilities, spells |
| `class` | `@Class()` | Character classes |
| `actor` | `@Actor()` | Playable characters |
| `enemy` | `@Enemy()` | Monsters, bosses |
| `state` | `@State()` | Status effects |

## File Locations

```
module/
└── database/
    ├── items/
    │   └── potion.ts
    ├── weapons/
    │   └── sword.ts
    ├── armors/
    ├── skills/
    ├── classes/
    ├── actors/
    ├── enemies/
    └── states/
```

## Item Template

```typescript
import { Item } from '@rpgjs/database'

@Item({
    id: 'potion',
    name: 'Potion',
    description: 'Restores 50 HP',
    price: 100,
    consumable: true,
    hpValue: 50,
    hitRate: 1,
    addStates: [],
    removeStates: [],
    elements: [],
    paramsModifier: {}
})
export default class Potion {}
```

## Weapon Template

```typescript
import { Weapon, Element } from '@rpgjs/database'

@Weapon({
    id: 'iron-sword',
    name: 'Iron Sword',
    description: 'A sturdy iron sword',
    price: 500,
    atk: 10,
    pdef: 0,
    twoHanded: false,
    elements: [Element.Fire],
    paramsModifier: {}
})
export default class IronSword {}
```

## Armor Template

```typescript
import { Armor, ArmorType } from '@rpgjs/database'

@Armor({
    id: 'leather-armor',
    name: 'Leather Armor',
    description: 'Basic leather protection',
    price: 300,
    pdef: 5,
    mdef: 2,
    type: ArmorType.Body,
    paramsModifier: {}
})
export default class LeatherArmor {}
```

## Skill Template

```typescript
import { Skill, SkillType, Element } from '@rpgjs/database'

@Skill({
    id: 'fireball',
    name: 'Fireball',
    description: 'Hurls a ball of fire',
    skillType: SkillType.Skill,
    power: 50,
    variance: 20,
    hitRate: 95,
    mpCost: 10,
    element: Element.Fire,
    addStates: [],
    removeStates: [],
    paramsModifier: {}
})
export default class Fireball {}
```

## Class Template

```typescript
import { Class } from '@rpgjs/database'

@Class({
    id: 'warrior',
    name: 'Warrior',
    description: 'A mighty warrior',
    equippable: ['sword', 'axe', 'shield', 'armor'],
    skillsToLearn: [
        { level: 1, skill: Slash },
        { level: 5, skill: PowerAttack }
    ],
    statesEfficiency: [],
    elementsEfficiency: [],
    params: {
        maxhp: { start: 100, end: 9999 },
        maxsp: { start: 20, end: 999 },
        str: { start: 10, end: 999 },
        dex: { start: 8, end: 999 },
        agi: { start: 6, end: 999 },
        int: { start: 4, end: 999 }
    },
    paramsModifier: {}
})
export default class Warrior {}
```

## Enemy Template

```typescript
import { Enemy, Element } from '@rpgjs/database'

@Enemy({
    id: 'slime',
    name: 'Slime',
    description: 'A gelatinous monster',
    gold: 10,
    exp: 5,
    hp: 50,
    sp: 0,
    params: {
        maxhp: 50,
        maxsp: 0,
        str: 5,
        dex: 3,
        agi: 2,
        int: 1
    },
    elementsEfficiency: [
        { element: Element.Fire, rate: 1.5 },
        { element: Element.Water, rate: 0.5 }
    ],
    statesEfficiency: [],
    actions: [
        { skill: Attack, rate: 5 }
    ],
    items: [
        { item: Potion, rate: 0.1 }
    ],
    paramsModifier: {}
})
export default class Slime {}
```

## State Template

```typescript
import { State } from '@rpgjs/database'

@State({
    id: 'poison',
    name: 'Poison',
    description: 'Loses HP over time',
    priority: 50,
    restriction: 'none',
    removeAtBattleEnd: false,
    removeByRestriction: false,
    autoRemovalTiming: 2,
    minTurns: 3,
    maxTurns: 5,
    removeByDamage: false,
    chanceByDamage: 100,
    removeByWalking: false,
    stepsToRemove: 100,
    paramsModifier: {
        hp: -10  // Lose 10 HP per turn
    }
})
export default class Poison {}
```

## Elements

Available elements:
```typescript
Element.Physical
Element.Fire
Element.Ice
Element.Thunder
Element.Water
Element.Earth
Element.Wind
Element.Light
Element.Darkness
```

## Weapon Types

```typescript
WeaponType.Sword
WeaponType.Axe
WeaponType.Spear
WeaponType.Bow
WeaponType.Staff
WeaponType.Mace
// Custom types defined in configuration
```

## Armor Types

```typescript
ArmorType.Shield
ArmorType.Head
ArmorType.Body
ArmorType.Accessory
```

## Skill Types

```typescript
SkillType.Skill    // Magic/abilities
SkillType.Item     // Use item
```

## Damage Formula

Default damage formula for skills:
```
a.atk * 4 - b.def * 2
```

Where:
- `a` = attacker
- `b` = target
- `atk` = attack parameter
- `def` = defense parameter

## Using Items in Code

```typescript
import Potion from './database/items/Potion'

// Give item to player
player.addItem(Potion, 5)

// Remove item from player
player.removeItem(Potion, 1)

// Use item
player.useItem(Potion)

// Check if player has item
player.hasItem(Potion)
```

## Using Skills in Code

```typescript
import Fireball from './database/skills/Fireball'

// Learn skill
player.learnSkill(Fireball)

// Use skill
player.useSkill(Fireball, target)

// Check if player knows skill
player.hasSkill(Fireball)
```
