import { RpgPlayer } from '@rpgjs/server'
import { MapData, RpgMap } from '@rpgjs/server'

@MapData({
    id: 'combat-arena',
    file: require('./worlds/maps/combat-arena.tmx')
})
export default class CombatArenaMap extends RpgMap {
    onInit() {
        console.log('Combat Arena map loaded')
    }

    onJoin(player: RpgPlayer) {
        console.log(`Player ${player.name} entered combat arena`)
        // Show combat HUD
        player.gui('rpg-player-hud').open({
            currentHp: player.hp,
            maxHp: player.maxHp,
            currentMp: player.sp,
            maxMp: player.param.maxSp,
            gold: player.gold
        })
    }
    
    onLeave(player: RpgPlayer) {
        console.log(`Player ${player.name} left combat arena`)
        player.gui('rpg-player-hud').close()
    }
}
