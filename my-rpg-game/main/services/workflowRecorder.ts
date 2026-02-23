/**
 * Workflow Recorder Service
 * Tracks in-progress recording sessions in a server-side Map keyed by player.id.
 * Does NOT use player.setVariable / player.getVariable (not in this codebase).
 * When the player saves, steps are persisted to the workflow_templates table in Supabase.
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RecordingStep {
  order: number
  object_type: string
  action: string
  params: Record<string, any>
  expected_inputs: string[]
  credentials_ref: string
}

interface RecordingSession {
  active: boolean
  steps: RecordingStep[]
  startTime: number
}

// Server-side recording state — keyed by player.id
const recordingSessions = new Map<string, RecordingSession>()

export function startRecording(player: { id: string }): void {
  recordingSessions.set(player.id, {
    active: true,
    steps: [],
    startTime: Date.now(),
  })
  console.log(`[WorkflowRecorder] Started recording for player ${player.id}`)
}

export function isRecording(playerId: string): boolean {
  return recordingSessions.get(playerId)?.active === true
}

export function appendStep(playerId: string, step: Omit<RecordingStep, 'order'>): void {
  const session = recordingSessions.get(playerId)
  if (!session || !session.active) return
  session.steps.push({
    ...step,
    order: session.steps.length + 1,
  })
  console.log(`[WorkflowRecorder] Appended step ${session.steps.length} (${step.object_type}.${step.action}) for player ${playerId}`)
}

export function cancelRecording(playerId: string): void {
  recordingSessions.delete(playerId)
  console.log(`[WorkflowRecorder] Cancelled recording for player ${playerId}`)
}

export async function stopAndSave(
  player: { id: string },
  name: string
): Promise<{ id: string; name: string } | null> {
  const session = recordingSessions.get(player.id)
  if (!session || !session.active || session.steps.length === 0) {
    console.warn(`[WorkflowRecorder] No active recording with steps for player ${player.id}`)
    return null
  }

  const { data, error } = await supabase
    .from('workflow_templates')
    .insert({
      user_id: player.id,
      name,
      description: `${session.steps.length}-step workflow recorded in-game`,
      steps: session.steps,
      is_active: true,
    })
    .select('id, name')
    .single()

  recordingSessions.delete(player.id)

  if (error) {
    console.error('[WorkflowRecorder] Save failed:', error)
    return null
  }

  console.log(`[WorkflowRecorder] Saved workflow "${name}" (${session.steps.length} steps) for player ${player.id}`)
  return data
}
