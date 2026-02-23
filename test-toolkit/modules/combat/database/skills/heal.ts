import { Skill, SkillType } from '@rpgjs/database'

@Skill({
    id: 'heal',
    name: 'Heal',
    description: 'Restores HP to an ally',
    skillType: SkillType.Skill,
    power: 40,
    variance: 10,
    hitRate: 100,
    mpCost: 10,
    element: undefined,
    addStates: [],
    removeStates: [],
    paramsModifier: {}
})
export default class Heal {}
