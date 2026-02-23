/**
 * AI Service for NPC Conversations
 * Calls Supabase Edge Functions (keeps API keys secure)
 * No API keys needed in game server - all AI goes through Supabase
 */

import dotenv from 'dotenv'
dotenv.config()

import { NPCConfig } from '../types/npc'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface AIResponse {
  text: string
  toolCalls?: ToolCall[]
  tokens?: {
    prompt: number
    completion: number
    total: number
  }
}

interface ToolCall {
  name: string
  arguments: Record<string, any>
}

export class AIService {
  private supabaseUrl: string
  private supabaseAnonKey: string

  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || ''
    this.supabaseAnonKey = process.env.SUPABASE_ANON_KEY || ''
  }

  /**
   * Generate NPC response via Edge Function
   * All AI processing happens in Supabase Edge Function
   */
  async generateResponse(
    npcId: string,
    playerId: string,
    playerName: string,
    config: NPCConfig,
    history: ChatMessage[],
    message?: string
  ): Promise<AIResponse> {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/npc-ai-chat`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.supabaseAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            npcId,
            playerId,
            playerName,
            message,
            config: {
              name: config.name,
              personality: config.personality,
              model: config.model,
              skills: config.skills
            },
            history
          })
        }
      )

      if (!response.ok) {
        const error = await response.text()
        console.error('[AIService] Edge Function error:', error)
        throw new Error(`Edge Function error: ${response.status}`)
      }

      const data = await response.json()
      
      return {
        text: data.text,
        toolCalls: data.toolCalls,
        tokens: data.tokens
      }
    } catch (error) {
      console.error('[AIService] Error:', error)
      return { 
        text: "I'm sorry, I'm having trouble thinking right now."
      }
    }
  }

  /**
   * Generate idle thought (optional - can be called via same Edge Function)
   */
  async generateIdleThought(config: NPCConfig): Promise<string> {
    // For idle thoughts, we can use the same Edge Function
    // or implement a simpler local fallback
    const thoughts = [
      "I wonder what today will bring...",
      "The weather is nice today.",
      "I should check my inventory.",
      "Maybe I'll wander around a bit.",
      "I hope someone interesting visits soon."
    ]
    
    return thoughts[Math.floor(Math.random() * thoughts.length)]
  }
}

// Singleton instance
export const aiService = new AIService()
