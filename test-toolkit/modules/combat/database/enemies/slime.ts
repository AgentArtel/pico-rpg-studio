import { Enemy, Element } from '@rpgjs/database'
import { HealthPotion } from '../items'

@Enemy({
    id: 'slime',
    name: 'Slime',
    description: 'A gelatinous monster',
    gold: 15,
    exp: 8,
    hp: 60,
    sp: 0,
    params: {
        maxhp: 60,
        maxsp: 0,
        str: 8,
        dex: 4,
        agi: 3,
        int: 1
    },
    elementsEfficiency: [
        { element: Element.Fire, rate: 1.5 },
        { element: Element.Water, rate: 0.5 }
    ],
    statesEfficiency: [],
    actions: [
        { skill: 'attack', rate: 5 }
    ],
    items: [
        { item: HealthPotion, rate: 0.15 }
    ],
    paramsModifier: {}
})
export default class Slime {}
