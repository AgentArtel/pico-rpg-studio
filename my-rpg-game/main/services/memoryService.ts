/**
 * NPC Memory Service
 * Manages conversation history with players
 * Stores/retrieves from game.agent_memory table
 */

import dotenv from 'dotenv'
dotenv.config()

import { createClient } from '@supabase/supabase-js'
import { AgentMemory } from '../types/npc'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export class MemoryService {
  private supabase: ReturnType<typeof createClient> | null = null

  constructor() {
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey)
    } else {
      console.warn('[MemoryService] Supabase credentials not found. Memory disabled.')
    }
  }

  /**
   * Get conversation history for a specific NPC-Player session
   */
  async getMemory(npcId: string, playerId: string, limit: number = 20): Promise<AgentMemory[]> {
    if (!this.supabase) return []
    
    const sessionId = `${npcId}_${playerId}`
    
    const { data, error } = await this.supabase
      
      .from('agent_memory')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('Error fetching memory:', error)
      return []
    }

    return data || []
  }

  /**
   * Save a message to conversation history
   */
  async saveMemory(
    npcId: string,
    playerId: string,
    role: 'user' | 'assistant' | 'system',
    content: string
  ): Promise<void> {
    if (!this.supabase) return
    
    const sessionId = `${npcId}_${playerId}`
    
    const { error } = await this.supabase
      
      .from('agent_memory')
      .insert({
        session_id: sessionId,
        npc_id: npcId,
        player_id: playerId,
        role,
        content,
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error saving memory:', error)
    }
  }

  /**
   * Format memory for AI API consumption
   */
  formatForAI(memories: AgentMemory[]): Array<{ role: string; content: string }> {
    return memories.map(m => ({
      role: m.role,
      content: m.content
    }))
  }

  /**
   * Clear conversation history
   */
  async clearMemory(npcId: string, playerId: string): Promise<void> {
    if (!this.supabase) return
    
    const sessionId = `${npcId}_${playerId}`
    
    const { error } = await this.supabase
      
      .from('agent_memory')
      .delete()
      .eq('session_id', sessionId)

    if (error) {
      console.error('Error clearing memory:', error)
    }
  }

  /**
   * Get memory summary for Studio display
   */
  async getMemorySummary(npcId: string): Promise<{
    totalConversations: number
    uniquePlayers: number
    lastActive: string | null
  }> {
    if (!this.supabase) {
      return { totalConversations: 0, uniquePlayers: 0, lastActive: null }
    }
    
    const { data, error } = await this.supabase
      
      .from('agent_memory')
      .select('*')
      .like('session_id', `${npcId}_%`)

    if (error || !data) {
      return { totalConversations: 0, uniquePlayers: 0, lastActive: null }
    }

    const uniquePlayers = new Set(data.map(m => m.session_id.split('_')[1]))
    const lastActive = data.length > 0 
      ? data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
      : null

    return {
      totalConversations: data.length,
      uniquePlayers: uniquePlayers.size,
      lastActive
    }
  }
}

// Singleton instance
export const memoryService = new MemoryService()
