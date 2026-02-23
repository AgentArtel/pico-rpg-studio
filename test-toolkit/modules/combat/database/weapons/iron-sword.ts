import { Weapon, Element } from '@rpgjs/database'

@Weapon({
    id: 'iron-sword',
    name: 'Iron Sword',
    description: 'A sturdy iron sword',
    price: 500,
    atk: 15,
    pdef: 0,
    twoHanded: false,
    elements: [Element.Physical],
    paramsModifier: {}
})
export default class IronSword {}
