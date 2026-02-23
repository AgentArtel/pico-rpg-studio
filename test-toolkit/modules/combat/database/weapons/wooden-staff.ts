import { Weapon, Element } from '@rpgjs/database'

@Weapon({
    id: 'wooden-staff',
    name: 'Wooden Staff',
    description: 'A simple wooden staff for mages',
    price: 400,
    atk: 8,
    pdef: 0,
    twoHanded: false,
    elements: [Element.Physical],
    paramsModifier: {
        int: 5
    }
})
export default class WoodenStaff {}
