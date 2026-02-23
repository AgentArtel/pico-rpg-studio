/**
 * Broadcast Helper for Studio → Game Communication
 * Studio uses this to notify game of immediate changes
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Notify game of new NPC creation
 * Called from Studio after inserting to database
 */
export async function broadcastNPCCreated(npcData: any): Promise<void> {
  await supabase.channel('content_broadcast').send({
    type: 'broadcast',
    event: 'npc_created',
    payload: npcData
  })
}

/**
 * Notify game of NPC update
 * Called from Studio after updating database
 */
export async function broadcastNPCUpdated(npcData: any): Promise<void> {
  await supabase.channel('content_broadcast').send({
    type: 'broadcast',
    event: 'npc_updated',
    payload: npcData
  })
}

/**
 * Notify game of NPC deletion
 * Called from Studio after deleting from database
 */
export async function broadcastNPCDeleted(npcId: string): Promise<void> {
  await supabase.channel('content_broadcast').send({
    type: 'broadcast',
    event: 'npc_deleted',
    payload: { id: npcId }
  })
}
