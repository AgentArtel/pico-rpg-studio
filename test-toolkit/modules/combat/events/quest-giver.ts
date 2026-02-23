import { RpgEvent, EventData, RpgPlayer } from '@rpgjs/server'

/** Build quest list from player variables for quest log GUI (rpgjs-quest-system pattern). */
function buildQuestListFromVariables(player: RpgPlayer): Array<{ id: string; name: string; description: string; status: string; objectives: Array<{ text: string; completed: boolean }> }> {
    const list: Array<{ id: string; name: string; description: string; status: string; objectives: Array<{ text: string; completed: boolean }> }> = []

    const defeatState = player.getVariable('QUEST_DEFEAT_SLIMES')
    if (defeatState) {
        const count = player.getVariable('SLIMES_DEFEATED') ?? 0
        const completed = defeatState === 'completed'
        list.push({
            id: 'defeat_slimes',
            name: 'Defeat the Slimes',
            description: 'Help the village by defeating 5 slimes.',
            status: defeatState === 'completed' ? 'completed' : 'active',
            objectives: [{ text: `Defeat slimes (${count}/5)`, completed }]
        })
    }

    const visitState = player.getVariable('quest_visit_shopkeeper')
    if (visitState) {
        const done = visitState === 'completed' || visitState === 'turned_in'
        list.push({
            id: 'visit_shopkeeper',
            name: 'Visit the Shopkeeper',
            description: 'Go talk to the shopkeeper in town.',
            status: done ? 'completed' : 'active',
            objectives: [{ text: 'Talk to the shopkeeper', completed: done }]
        })
    }

    return list
}

@EventData({
    name: 'EV-COMBAT-QUEST-GIVER-001',
    hitbox: {
        width: 32,
        height: 16
    }
})
export default class QuestGiverEvent extends RpgEvent {
    onInit() {
        this.setGraphic('villager')
        this.setHitbox(32, 16)
    }

    async onAction(player: RpgPlayer) {
        // Defeat slimes quest
        const questState = player.getVariable('QUEST_DEFEAT_SLIMES')
        if (!questState) {
            await player.showText('Please defeat 5 slimes!', { talkWith: this })
            player.setVariable('QUEST_DEFEAT_SLIMES', 'started')
            player.setVariable('SLIMES_DEFEATED', 0)
        } else if (questState === 'started') {
            const slimesDefeated = player.getVariable('SLIMES_DEFEATED') ?? 0
            if (slimesDefeated >= 5) {
                await player.showText('Thank you! Here is your reward.')
                player.gold += 100
                player.setVariable('QUEST_DEFEAT_SLIMES', 'completed')
            } else {
                await player.showText(`You have defeated ${slimesDefeated}/5 slimes.`)
            }
        } else if (questState === 'completed') {
            await player.showText('Thanks again for your help!')
        }

        // Visit shopkeeper quest
        const visitState = player.getVariable('quest_visit_shopkeeper')
        if (!visitState) {
            await player.showText('I need you to go speak with the shopkeeper. Come back when you have.', { talkWith: this })
            player.setVariable('quest_visit_shopkeeper', 'active')
        } else if (visitState === 'active') {
            await player.showText('Have you visited the shopkeeper yet?')
        } else if (visitState === 'completed') {
            await player.showText('You found the shopkeeper. Here is 50 gold for your trouble.')
            player.gold += 50
            player.setVariable('quest_visit_shopkeeper', 'turned_in')
        } else if (visitState === 'turned_in') {
            await player.showText('Thanks for helping out.')
        }

        // Open quest log with server-built data when player has quests (rpgjs-quest-system pattern)
        const updatedList = buildQuestListFromVariables(player)
        if (updatedList.length > 0) {
            player.gui('rpg-quest-log').open({ quests: updatedList })
        }
    }
}
