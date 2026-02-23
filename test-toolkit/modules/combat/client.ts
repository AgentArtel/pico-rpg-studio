import { RpgClientEngineHooks, RpgClientEngine, RpgModule, RpgClient } from "@rpgjs/client"
import CombatMenu from './gui/combat-menu.vue'
import PlayerHud from './gui/player-hud.vue'
import QuestLog from './gui/quest-log.vue'

const client: RpgClientEngineHooks = {
    onConnectError(engine: RpgClientEngine, err: Error) {
        console.error('Combat module connection error:', err.message)
    }
}

@RpgModule<RpgClient>({
    gui: [CombatMenu, PlayerHud, QuestLog]
})
class CombatClient {}

export default client
