import { RpgEvent, EventData, RpgPlayer } from '@rpgjs/server'
import { IronSword, HealthPotion } from '../database/items'

@EventData({
    name: 'EV-COMBAT-SHOPKEEPER-001',
    hitbox: {
        width: 32,
        height: 16
    }
})
export default class ShopkeeperEvent extends RpgEvent {
    onInit() {
        this.setGraphic('merchant')
        this.setHitbox(32, 16)
    }
    
    async onAction(player: RpgPlayer) {
        // Quest: Visit the shopkeeper (objective completed when player talks here)
        const visitQuest = player.getVariable('quest_visit_shopkeeper')
        if (visitQuest === 'active') {
            player.setVariable('quest_visit_shopkeeper', 'completed')
        }

        await player.showText('Welcome to my shop!', { talkWith: this })
        player.gui('shop').open({
            items: [IronSword, HealthPotion],
            buy: true,
            sell: true
        })
    }
}
