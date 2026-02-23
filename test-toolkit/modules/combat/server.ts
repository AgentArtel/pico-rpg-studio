import { RpgServerEngine } from "@rpgjs/server"

export default {
    auth(engine: RpgServerEngine, socket: any) {
        // Combat module authentication
        return { combatEnabled: true }
    },
    onStart(engine: RpgServerEngine) {
        console.log('Combat module initialized')
    }
}
