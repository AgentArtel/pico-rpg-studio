import { RpgPlayer, type RpgPlayerHooks, Control, Components } from '@rpgjs/server'

const player: RpgPlayerHooks = {
    onConnected(player: RpgPlayer) {
        // Initialize combat stats display
        player.setComponentsTop(Components.text('{name} - HP: {hp}/{maxHp}'))
    },
    onInput(player: RpgPlayer, { input }) {
        // Open combat menu with action key
        if (input == Control.Action) {
            player.gui('combat-menu').open()
        }
        if (input == Control.Back) {
            player.callMainMenu()
        }
    },
    async onJoinMap(player: RpgPlayer) {
        // Check for enemy encounters
        console.log(`Player ${player.name} entered combat zone`)
    }
}

export default player
