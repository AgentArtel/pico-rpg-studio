import { Skill, SkillType, Element } from '@rpgjs/database'

@Skill({
    id: 'fireball',
    name: 'Fireball',
    description: 'Hurls a ball of fire at the enemy',
    skillType: SkillType.Skill,
    power: 50,
    variance: 20,
    hitRate: 95,
    mpCost: 15,
    element: Element.Fire,
    addStates: [],
    removeStates: [],
    paramsModifier: {}
})
export default class Fireball {}
