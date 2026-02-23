/**
 * Server Configuration with Real-time Content Sync
 * Updated to support Phase 1: Real-time NPC Sync
 */

// Load environment variables first
import dotenv from 'dotenv'
dotenv.config()

import { RpgServerEngine } from '@rpgjs/server'
import { createClient } from '@supabase/supabase-js'
import { getContentSyncService } from './realtime/contentSync'
import { spawnMapObjects } from './services/objectSpawner'
import { syncGameRegistry } from './services/gameRegistrySync'

export default {
  /**
   * Authentication hook
   * Validates player token and links to Supabase user
   */
  async auth(engine: RpgServerEngine, socket: any) {
    try {
      const token = socket.handshake.auth.token
      
      // For dev mode: use default user if no token
      if (!token) {
        return 'b879b298-6797-4d73-bd10-1e01fca086f1'
      }

      // Verify token with Supabase
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!
      )

      const { data: { user }, error } = await supabase.auth.getUser(token)

      if (error || !user) {
        console.log('[Auth] Invalid token:', error?.message)
        return null
      }

      console.log(`[Auth] Player authenticated: ${user.email}`)

      return user.id
    } catch (error) {
      console.error('[Auth] Error:', error)
      return null
    }
  },

  /**
   * Server start hook
   * Initializes real-time content sync
   */
  async onStart(engine: RpgServerEngine) {
    // Server starting

    // Initialize real-time content sync
    // Use loadMap to get map instances (required for createDynamicEvent)
    const contentSync = getContentSyncService(async (mapId: string) => {
      const sceneMap = engine.getScene('map') as any
      if (!sceneMap) {
        console.log(`[Server] SceneMap not found`)
        return undefined
      }
      
      // loadMap returns a map instance with createDynamicEvent
      const map = await sceneMap.loadMap?.(mapId)
      if (!map) {
        console.log(`[Server] Map not found: ${mapId}`)
      }
      return map
    })

    // Start listening to database changes
    await contentSync.start()

    // Delay NPC and object loading to ensure maps are loaded
    setTimeout(async () => {
      const sceneMap = engine.getScene('map') as any
      const availableMaps = sceneMap?.getMaps?.() || []

      // Sync available maps/sprites/skills to game_registry for Studio dropdowns
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        )
        await syncGameRegistry(supabase, availableMaps)
      }

      // Spawn NPCs
      const spawnedCount = await contentSync.loadAllNPCs()
      console.log(`[Server] Game server started with ${spawnedCount} NPCs`)
      
      // Spawn workflow objects
      for (const mapClass of availableMaps) {
        const map = await sceneMap.loadMap?.(mapClass.id)
        if (map) {
          await spawnMapObjects(map, mapClass.id)
        }
      }
    }, 2000)
  },

  /**
   * Server shutdown hook
   * Clean up resources
   */
  async onShutdown(engine: RpgServerEngine) {
    console.log('[Server] Shutting down...')

    const contentSync = getContentSyncService()
    
    // Stop real-time sync
    await contentSync.stop()
    
    // Clear all spawned NPCs
    await contentSync.clearAll()

    console.log('[Server] Shutdown complete')
  }
}
