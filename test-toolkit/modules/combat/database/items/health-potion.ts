import { Item } from '@rpgjs/database'

@Item({
    id: 'health-potion',
    name: 'Health Potion',
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
export default class HealthPotion {}
