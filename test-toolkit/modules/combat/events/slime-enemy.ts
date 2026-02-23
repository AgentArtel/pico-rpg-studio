import { RpgEvent, EventData, RpgPlayer, Speed, Move } from '@rpgjs/server'

@EventData({
    name: 'EV-COMBAT-SLIME-001',
    hitbox: {
        width: 32,
        height: 16
    }
})
export default class SlimeEnemyEvent extends RpgEvent {
    onInit() {
        this.setGraphic('slime')
        this.setHitbox(32, 16)
        this.speed = Speed.Slow
        // Random movement for enemy
        this.infiniteMoveRoute([Move.tileRandom()])
    }
    
    async onAction(player: RpgPlayer) {
        await player.showText('The slime attacks!', { talkWith: this })
        // Initiate battle
        player.gui('battle').open({
            enemy: 'slime',
            level: 1
        })
    }
    
    onPlayerTouch(player: RpgPlayer) {
        // Trigger battle on contact
        this.onAction(player)
    }
}
