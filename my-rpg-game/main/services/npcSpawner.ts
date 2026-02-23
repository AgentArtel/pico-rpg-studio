/**
 * NPC Spawner Service
 * Manages dynamic NPC creation, updates, and removal
 */

import { RpgMap, RpgEvent, EventData, RpgPlayer, Speed, Move } from '@rpgjs/server'
import { NPCConfig } from '../types/npc'
import { aiService } from './aiService'
import { memoryService } from './memoryService'

// Registry to track spawned NPCs
const spawnedNPCs: Map<string, typeof RpgEvent> = new Map()
const npcInstances: Map<string, RpgEvent> = new Map()

/**
 * Normalize database config to expected format
 */
function normalizeConfig(config: any): NPCConfig {
  return {
    ...config,
    // Map spawn_config to spawn
    spawn: config.spawn || {
      map: config.spawn_config?.mapId || 'simplemap',
      x: config.spawn_config?.x ?? 400,
      y: config.spawn_config?.y ?? 300
    },
    // Map default_sprite to graphic
    graphic: config.graphic || config.default_sprite || 'female',
    // Map prompt to personality
    personality: config.personality || config.prompt || 'You are a helpful NPC.',
    // Normalize skills array
    skills: config.skills?.map((s: any) => typeof s === 'string' ? s : s.name) || [],
    // Map required_tokens to inventory
    inventory: config.inventory || config.required_tokens || [],
    // Ensure behavior has defaults
    behavior: {
      idleInterval: 0,
      patrolRadius: 0,
      greetOnProximity: false,
      ...config.behavior
    }
  }
}

/**
 * Create a dynamic NPC class from configuration
 */
export function createNPCClass(config: NPCConfig): typeof RpgEvent {
  // Check if we already created this class
  if (spawnedNPCs.has(config.id)) {
    return spawnedNPCs.get(config.id)!
  }

  @EventData({
    name: config.id,
    hitbox: { width: 32, height: 16 }
  })
  class DynamicNPC extends RpgEvent {
    private config: NPCConfig = config
    private idleTimer: NodeJS.Timeout | null = null
    private isInConversation: boolean = false

    onInit() {
      // Set visual
      this.setGraphic(config.graphic)
      
      // Set behavior properties
      this.speed = this.getSpeedFromBehavior()
      
      // Start idle behavior if enabled
      if (config.behavior.idleInterval > 0 && config.skills.includes('move')) {
        this.startIdleBehavior()
      }


    }

    async onAction(player: RpgPlayer) {
      if (this.isInConversation) return

      // Stop idle behavior during conversation
      this.stopIdleBehavior()
      this.isInConversation = true

      try {
        // Greet if enabled
        if (config.behavior.greetOnProximity && config.skills.includes('say')) {
          await this.greet(player)
        }

        // Handle AI conversation
        await this.handleConversation(player)
      } finally {
        this.isInConversation = false
        // Resume idle behavior
        if (config.behavior.idleInterval > 0) {
          this.startIdleBehavior()
        }
      }
    }

    onPlayerTouch(player: RpgPlayer) {
      if (config.behavior.greetOnProximity && config.skills.includes('say')) {
        this.greet(player)
      }
    }

    /**
     * AI-powered conversation handler
     */
    private async handleConversation(player: RpgPlayer) {
      const playerName = player.name || 'Adventurer'
      
      // Get conversation history
      const history = await memoryService.getMemory(config.id, player.id)
      
      // Add player greeting
      await memoryService.saveMemory(config.id, player.id, 'user', 
        `${playerName} approaches and says hello.`)

      // Generate AI response via Edge Function (no API keys needed!)
      const formattedHistory = memoryService.formatForAI(history)
      const response = await aiService.generateResponse(
        config.id,
        player.id,
        playerName,
        config,
        formattedHistory
      )

      // Response already saved by Edge Function, but save here as backup
      if (response.text) {
        await memoryService.saveMemory(config.id, player.id, 'assistant', response.text)
      }

      // Show to player
      await player.showText(response.text, { talkWith: this })

      // Execute any tool calls
      if (response.toolCalls) {
        for (const tool of response.toolCalls) {
          await this.executeTool(tool, player)
        }
      }
    }

    /**
     * Simple greeting
     */
    private async greet(player: RpgPlayer) {
      const greetings = [
        `Hello there!`,
        `Greetings, traveler!`,
        `Well met!`,
        `Ah, a visitor!`
      ]
      const greeting = greetings[Math.floor(Math.random() * greetings.length)]
      
      await player.showText(greeting, { talkWith: this })
      
      // Save to memory
      await memoryService.saveMemory(config.id, player.id, 'assistant', greeting)
    }

    /**
     * Execute a tool call from AI
     */
    private async executeTool(tool: { name: string; arguments: any }, player: RpgPlayer) {


      switch (tool.name) {
        case 'move':
          if (this.position && tool.arguments.direction) {
            const distance = tool.arguments.distance || 1
            const pixels = distance * 32 // Assuming 32px tiles
            
            switch (tool.arguments.direction) {
              case 'up':
                this.moveTo(this.position.x, this.position.y - pixels)
                break
              case 'down':
                this.moveTo(this.position.x, this.position.y + pixels)
                break
              case 'left':
                this.moveTo(this.position.x - pixels, this.position.y)
                break
              case 'right':
                this.moveTo(this.position.x + pixels, this.position.y)
                break
            }
          }
          break

        case 'say':
          if (tool.arguments.message) {
            await player.showText(tool.arguments.message, { talkWith: this })
            await memoryService.saveMemory(config.id, player.id, 'assistant', tool.arguments.message)
          }
          break

        case 'emote':
          // Show emotion bubble or animation
          const emotion = tool.arguments.emotion || 'happy'

          break

        case 'generate_image':
          // Check if NPC has image-gen token
          if (config.inventory.includes('image-gen-token') && config.skills.includes('generate_image')) {
            await player.showText("Let me create that image for you...", { talkWith: this })
            
            try {
              // Call Supabase Edge Function
              const { data, error } = await fetch(
                `${process.env.SUPABASE_URL}/functions/v1/generate-image`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    prompt: tool.arguments.prompt,
                    style: tool.arguments.style || 'fantasy'
                  })
                }
              ).then(r => r.json())

              if (data?.imageUrl) {
                await player.showText(`Here's your image: ${data.imageUrl}`, { talkWith: this })
              } else {
                await player.showText("I'm sorry, I couldn't create that image.", { talkWith: this })
              }
            } catch (error) {
              console.error('Image generation error:', error)
              await player.showText("My mystical camera seems to be malfunctioning...", { talkWith: this })
            }
          } else {
            await player.showText("I don't have the ability to create images.", { talkWith: this })
          }
          break
      }
    }

    /**
     * Idle behavior - wander and think
     */
    private startIdleBehavior() {
      if (this.idleTimer) return

      const interval = config.behavior.idleInterval
      if (interval <= 0) return

      this.idleTimer = setInterval(async () => {
        if (this.isInConversation) return

        // Random movement
        if (config.skills.includes('move') && Math.random() < 0.3) {
          this.wander()
        }

        // Generate idle thought (optional - for debugging)
        if (Math.random() < 0.1) {
          const thought = await aiService.generateIdleThought(config)

        }
      }, interval)
    }

    private stopIdleBehavior() {
      if (this.idleTimer) {
        clearInterval(this.idleTimer)
        this.idleTimer = null
      }
    }

    private wander() {
      const radius = config.behavior.patrolRadius * 32 // Convert tiles to pixels
      const angle = Math.random() * Math.PI * 2
      const distance = Math.random() * radius
      
      const newX = this.position.x + Math.cos(angle) * distance
      const newY = this.position.y + Math.sin(angle) * distance

      this.moveTo(newX, newY)
    }

    private getSpeedFromBehavior(): Speed {
      // Could be customized based on config
      return Speed.Normal
    }

    /**
     * Clean up when NPC is destroyed
     */
    onDestroy() {
      this.stopIdleBehavior()
      npcInstances.delete(config.id)

    }
  }

  // Store the class
  spawnedNPCs.set(config.id, DynamicNPC)
  return DynamicNPC
}

/**
 * Spawn an NPC on a map
 */
export async function spawnNPC(
  config: NPCConfig,
  getMap: (mapId: string) => Promise<RpgMap | undefined> | RpgMap | undefined
): Promise<boolean> {
  // Normalize config from database format (outside try block for error handling)
  const normalizedConfig = normalizeConfig(config)
  
  try {
    const map = await getMap(normalizedConfig.spawn.map)
    if (!map) {
      console.error(`[Spawner] Map not found: ${normalizedConfig.spawn.map}`)
      return false
    }

    // Create the NPC class
    const NPCClass = createNPCClass(normalizedConfig)

    // Spawn the NPC — createDynamicEvent returns { [eventId]: RpgEvent }, not a single instance
    const events = map.createDynamicEvent({
      x: normalizedConfig.spawn.x,
      y: normalizedConfig.spawn.y,
      event: NPCClass
    })

    const instance = Object.values(events)[0]
    if (instance) {
      npcInstances.set(normalizedConfig.id, instance)
      return true
    }

    return false
  } catch (error) {
    console.error(`[Spawner] Error spawning ${normalizedConfig.name}:`, error)
    return false
  }
}

/**
 * Update an existing NPC
 */
export async function updateNPC(
  config: NPCConfig,
  getMap: (mapId: string) => Promise<RpgMap | undefined> | RpgMap | undefined
): Promise<boolean> {
  // Remove old instance
  await despawnNPC(config.id, getMap)
  
  // Remove from class registry to force recreation
  spawnedNPCs.delete(config.id)
  
  // Spawn new instance with updated config
  return spawnNPC(config, getMap)
}

/**
 * Despawn an NPC
 */
export async function despawnNPC(
  npcId: string,
  getMap: (mapId: string) => Promise<RpgMap | undefined> | RpgMap | undefined
): Promise<boolean> {
  try {
    const instance = npcInstances.get(npcId)
    if (instance) {
      // Call destroy hook
      if (typeof (instance as any).onDestroy === 'function') {
        (instance as any).onDestroy()
      }
      
      // Remove from map
      instance.remove()
      npcInstances.delete(npcId)

      return true
    }

    return false
  } catch (error) {
    console.error(`[Spawner] Error despawning ${npcId}:`, error)
    return false
  }
}

/**
 * Get all spawned NPC instances
 */
export function getSpawnedNPCs(): Map<string, RpgEvent> {
  return npcInstances
}

/**
 * Clear all spawned NPCs
 */
export async function clearAllNPCs(
  getMap: (mapId: string) => Promise<RpgMap | undefined> | RpgMap | undefined
): Promise<void> {
  for (const [id] of npcInstances) {
    await despawnNPC(id, getMap)
  }
  spawnedNPCs.clear()
}
