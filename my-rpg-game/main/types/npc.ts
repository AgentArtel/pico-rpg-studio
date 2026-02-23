/**
 * NPC Types for Real-time Content Sync
 * These types match the public.agent_configs table in Supabase
 */

export interface NPCConfig {
  id: string
  name: string
  category?: string
  base_entity_type?: string
  default_sprite?: string
  icon?: string
  description?: string
  prompt?: string
  personality?: string
  welcome_message?: string
  model?: {
    provider?: string
    model?: string
    temperature?: number
  }
  skills?: Array<{name: string, description?: string} | string>
  required_tokens?: string[]
  memory_config?: {
    contextWindow?: number
    rememberPlayer?: boolean
  }
  spawn_config?: {
    mapId?: string
    x?: number
    y?: number
  }
  appearance?: {
    sprite?: string
    animations?: Record<string, any>
  }
  behavior?: {
    wander?: boolean
    wanderRadius?: number
    patrolPath?: any[]
    idleInterval?: number
    patrolRadius?: number
    greetOnProximity?: boolean
  }
  is_enabled: boolean
  created_at?: string
  updated_at?: string
  
  // Legacy fields for compatibility
  graphic?: string
  spawn?: {
    map: string
    x: number
    y: number
  }
  inventory?: string[]
}

export interface AgentMemory {
  id?: string
  session_id: string
  npc_id?: string
  player_id?: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  metadata?: Record<string, any>
  created_at?: string
}

export interface PlayerState {
  id?: string
  player_id: string
  map_id: string
  position: { x: number; y: number }
  direction?: string
  status?: string
  last_seen_at?: string
}

export interface NPCInstance {
  id?: string
  config_id: string
  instance_id: string
  map_id: string
  position: { x: number; y: number }
  status?: string
  current_players?: string[]
  spawned_at?: string
  last_activity_at?: string
}

export interface APIIntegration {
  id: string
  name: string
  skill_name: string
  required_item_id: string
  requires_env: string[]
  is_enabled: boolean
}

export interface ContentChangeEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: NPCConfig | null
  oldRecord: NPCConfig | null
}
