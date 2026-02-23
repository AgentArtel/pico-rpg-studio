/**
 * Workflow Runner Service
 * Executes saved workflow_templates by calling the same object-action Edge Function
 * that live player interactions use — same contract, same path.
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EDGE_FN_URL = `${process.env.SUPABASE_URL}/functions/v1/object-action`
const EDGE_FN_KEY = process.env.SUPABASE_ANON_KEY!

export async function executeWorkflow(
  workflowId: string,
  userId: string,
  triggeredBy: 'manual' | 'schedule' | 'npc'
): Promise<{ success: boolean; stepsCompleted: number; error?: string }> {
  // Load workflow
  const { data: workflow, error: loadError } = await supabase
    .from('workflow_templates')
    .select('*')
    .eq('id', workflowId)
    .single()

  if (loadError || !workflow) {
    return { success: false, stepsCompleted: 0, error: 'Workflow not found' }
  }

  // Create run record
  const { data: run, error: runError } = await supabase
    .from('workflow_runs')
    .insert({
      workflow_id: workflowId,
      player_id: userId,
      status: 'running',
      logs: [],
    })
    .select()
    .single()

  if (runError || !run) {
    return { success: false, stepsCompleted: 0, error: 'Could not create run record' }
  }

  const logs: any[] = []
  let stepsCompleted = 0

  // Execute steps sequentially — same object-action Edge Function as live play
  for (const step of workflow.steps) {
    try {
      const res = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${EDGE_FN_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          object_type: step.object_type,
          action: step.action,
          player_id: userId,
          inputs: { params: step.params || {} },
          workflow_run_id: run.id,
        }),
      })

      const result = await res.json()
      logs.push({
        step: step.order,
        action: `${step.object_type}.${step.action}`,
        success: result.success,
        timestamp: new Date().toISOString(),
      })

      if (!result.success) {
        await supabase.from('workflow_runs').update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          logs,
        }).eq('id', run.id)
        return { success: false, stepsCompleted, error: result.error?.message }
      }

      stepsCompleted++
    } catch (err: any) {
      await supabase.from('workflow_runs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        logs,
      }).eq('id', run.id)
      return { success: false, stepsCompleted, error: err.message }
    }
  }

  // Mark complete and increment run count
  await Promise.all([
    supabase.from('workflow_runs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      logs,
    }).eq('id', run.id),
    supabase.from('workflow_templates').update({
      run_count: (workflow.run_count || 0) + 1,
      last_run_at: new Date().toISOString(),
    }).eq('id', workflowId),
  ])

  console.log(`[WorkflowRunner] Completed workflow "${workflow.name}" — ${stepsCompleted} steps (${triggeredBy})`)
  return { success: true, stepsCompleted }
}

export async function listWorkflows(userId: string) {
  const { data } = await supabase
    .from('workflow_templates')
    .select('id, name, description, steps, run_count, last_run_at, created_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  return data || []
}
