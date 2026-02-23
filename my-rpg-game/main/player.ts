/**
 * Player Hooks with Real-time State Sync
 */

import dotenv from 'dotenv'
dotenv.config()

import { RpgPlayer, type RpgPlayerHooks, Control, Components } from '@rpgjs/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null

const player: RpgPlayerHooks = {
  onConnected(player: RpgPlayer) {
    // Set default name and enable movement
    if (!player.name || player.name === 'Player') {
      player.name = 'Adventurer'
    }
    player.setComponentsTop(Components.text('{name}'))
    player.canMove = true
  },

  async onJoinMap(player: RpgPlayer) {
    const map = player.getCurrentMap()
    if (!map) return
    
    player.canMove = true

    if (!supabase) return

    try {
      await supabase
        .from('player_state')
        .upsert({
          player_id: player.id,
          map_id: map.id,
          position: { x: player.position.x, y: player.position.y },
          direction: player.direction,
          last_seen_at: new Date().toISOString()
        }, { onConflict: 'player_id' })
    } catch (error) {
      console.error('[Player] Error updating state:', error)
    }
  },

  onInput(player: RpgPlayer, { input }) {
    if (input === Control.Back) {
      player.callMainMenu()
    }
  }
}

export default player
