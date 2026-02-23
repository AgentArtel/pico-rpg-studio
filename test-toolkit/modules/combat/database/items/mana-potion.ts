import { Item } from '@rpgjs/database'

@Item({
    id: 'mana-potion',
    name: 'Mana Potion',
    description: 'Restores 30 MP',
    price: 150,
    consumable: true,
    spValue: 30,
    hitRate: 1,
    addStates: [],
    removeStates: [],
    elements: [],
    paramsModifier: {}
})
export default class ManaPotion {}
