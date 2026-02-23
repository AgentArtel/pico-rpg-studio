/**
 * Real-time Content Sync Service
 * Listens to Supabase changes and syncs NPCs in real-time
 */

import dotenv from 'dotenv'
dotenv.config()

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import { RpgMap } from '@rpgjs/server'
import { NPCConfig, ContentChangeEvent } from '../types/npc'
import { spawnNPC, updateNPC, despawnNPC, clearAllNPCs } from '../services/npcSpawner'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('[ContentSync] Supabase credentials not found. Real-time sync disabled.')
}

export class ContentSyncService {
  private supabase: SupabaseClient | null = null
  private channel: RealtimeChannel | null = null
  private broadcastChannel: RealtimeChannel | null = null
  private getMap: (mapId: string) => Promise<RpgMap | undefined> | RpgMap | undefined
  private isConnected: boolean = false
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5

  constructor(getMap: (mapId: string) => Promise<RpgMap | undefined> | RpgMap | undefined) {
    this.getMap = getMap
    
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      })
    }
  }

  /**
   * Start listening to content changes
   */
  async start(): Promise<void> {
    if (this.isConnected) {
      return
    }

    if (!this.supabase) {
      console.warn('[ContentSync] Supabase not configured. Real-time sync disabled.')
      return
    }

    // Starting real-time sync

    try {
      // Clean up existing channels before creating new ones (prevents zombie subscriptions)
      if (this.channel) {
        this.channel.unsubscribe()
        this.channel = null
      }
      if (this.broadcastChannel) {
        this.broadcastChannel.unsubscribe()
        this.broadcastChannel = null
      }

      // Subscribe to agent_configs table changes
      this.channel = this.supabase
        .channel('content_changes', {
          config: {
            broadcast: { self: true }
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'agent_configs'
          },
          (payload) => this.handleContentChange(payload)
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'agent_configs',
            filter: 'is_enabled=eq.false'
          },
          (payload) => this.handleNPCDisabled(payload)
        )
        .subscribe((status) => {
          this.handleSubscriptionStatus(status)
        })

      // Also listen for broadcast events from Studio
      this.setupBroadcastListener()
      

    } catch (error) {
      console.error('[ContentSync] Failed to start:', error)
      this.handleReconnect()
    }
  }

  /**
   * Stop listening to content changes
   */
  async stop(): Promise<void> {
    if (this.channel) {
      await this.channel.unsubscribe()
      this.channel = null
    }
    if (this.broadcastChannel) {
      await this.broadcastChannel.unsubscribe()
      this.broadcastChannel = null
    }
    this.isConnected = false
  }

  /**
   * Handle subscription status changes
   */
  private handleSubscriptionStatus(status: string) {
    console.log(`[ContentSync] Subscription status: ${status}`)
    
    switch (status) {
      case 'SUBSCRIBED':
        this.isConnected = true
        this.reconnectAttempts = 0
        console.log('[ContentSync] Connected to real-time updates')
        break
        
      case 'TIMED_OUT':
        // Don't immediately reconnect — Supabase client retries internally
        console.log('[ContentSync] Subscription timed out, waiting for retry...')
        break

      case 'CLOSED':
      case 'CHANNEL_ERROR':
        this.isConnected = false
        console.error('[ContentSync] Connection lost')
        this.handleReconnect()
        break
    }
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[ContentSync] Max reconnection attempts reached')
      return
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectAttempts++

    console.log(`[ContentSync] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
    
    setTimeout(() => {
      this.start()
    }, delay)
  }

  /**
   * Set up broadcast listener for immediate Studio updates
   */
  private setupBroadcastListener() {
    if (!this.supabase) return

    this.broadcastChannel = this.supabase.channel('content_broadcast')

    this.broadcastChannel
      .on('broadcast', { event: 'npc_created' }, ({ payload }) => {
        this.handleInsert(payload as NPCConfig)
      })
      .on('broadcast', { event: 'npc_updated' }, ({ payload }) => {
        this.handleUpdate(payload as NPCConfig)
      })
      .on('broadcast', { event: 'npc_deleted' }, ({ payload }) => {
        this.handleDelete({ id: payload.id } as NPCConfig)
      })
      .subscribe()
  }

  /**
   * Handle content change from database
   */
  private async handleContentChange(payload: any) {
    const { eventType, new: newRecord, old: oldRecord } = payload



    switch (eventType) {
      case 'INSERT':
        if (newRecord?.is_enabled) {
          await this.handleInsert(newRecord as NPCConfig)
        }
        break
        
      case 'UPDATE':
        if (newRecord?.is_enabled) {
          await this.handleUpdate(newRecord as NPCConfig)
        } else if (oldRecord?.is_enabled && !newRecord?.is_enabled) {
          // NPC was disabled
          await this.handleDelete(oldRecord as NPCConfig)
        }
        break
        
      case 'DELETE':
        await this.handleDelete(oldRecord as NPCConfig)
        break
    }
  }

  /**
   * Handle NPC being disabled via filter
   */
  private async handleNPCDisabled(payload: any) {
    const { old: oldRecord } = payload
    if (oldRecord) {

      await this.handleDelete(oldRecord as NPCConfig)
    }
  }

  /**
   * Handle INSERT event
   */
  private async handleInsert(config: NPCConfig): Promise<void> {

    
    const success = await spawnNPC(config, this.getMap)
    
    if (success) {

    } else {
      console.error(`[ContentSync] ✗ Failed to spawn NPC ${config.name}`)
    }
  }

  /**
   * Handle UPDATE event
   */
  private async handleUpdate(config: NPCConfig): Promise<void> {

    
    const success = await updateNPC(config, this.getMap)
    
    if (success) {

    } else {
      console.error(`[ContentSync] ✗ Failed to update NPC ${config.name}`)
    }
  }

  /**
   * Handle DELETE event
   */
  private async handleDelete(config: NPCConfig): Promise<void> {

    
    const success = await despawnNPC(config.id, this.getMap)
    
    if (success) {

    } else {
      console.warn(`[ContentSync] NPC ${config.id} was not spawned`)
    }
  }

  /**
   * Load all enabled NPCs from database on server start
   */
  async loadAllNPCs(): Promise<number> {
    // Loading NPCs from database

    if (!this.supabase) {
      console.warn('[ContentSync] Supabase not configured. Skipping NPC load.')
      return 0
    }

    try {
      const { data, error } = await this.supabase
        
        .from('agent_configs')
        .select('*')
        .eq('is_enabled', true)

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {

        return 0
      }



      let spawnedCount = 0
      for (const config of data as NPCConfig[]) {
        const success = await spawnNPC(config, this.getMap)
        if (success) spawnedCount++
      }

      if (spawnedCount > 0) console.log(`[Server] Spawned ${spawnedCount} NPCs`)
      return spawnedCount
    } catch (error) {
      console.error('[ContentSync] Error loading NPCs:', error)
      return 0
    }
  }

  /**
   * Clear all NPCs (for shutdown/restart)
   */
  async clearAll(): Promise<void> {
    await clearAllNPCs(this.getMap)
  }

  /**
   * Check if connected to real-time updates
   */
  isRealtimeConnected(): boolean {
    return this.isConnected
  }
}

// Singleton instance
let contentSyncService: ContentSyncService | null = null

export function getContentSyncService(getMap?: (mapId: string) => RpgMap | undefined): ContentSyncService {
  if (!contentSyncService && getMap) {
    contentSyncService = new ContentSyncService(getMap)
  }
  if (!contentSyncService) {
    throw new Error('ContentSyncService not initialized')
  }
  return contentSyncService
}

export function resetContentSyncService(): void {
  contentSyncService = null
}
