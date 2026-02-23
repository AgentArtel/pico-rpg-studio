# Handoff Packet: Studio Workflow Editor — n8n Parity, Run + Results, Persistence

> **Status:** Research complete. Ready for implementation.
> **Created:** 2026-02-19
> **Context:** Three-team brief (Claude Code as PM, Cursor as backend/game dev, Lovable as frontend) to bring the Studio workflow editor to n8n parity — same mental model, real Run execution via n8n, and actual save/load persistence. The editor exists and has a solid foundation; this is a targeted extension, not a rebuild.

---

## 1. The Idea

The Studio workflow editor looks good but is hollow in two critical ways: **Save does nothing** and **Run doesn't call n8n**. This feature closes both gaps.

The editor becomes a real design surface that mirrors n8n's mental model (trigger → nodes → connections), persists workflows to Supabase, and executes them by calling n8n via a Supabase Edge Function proxy. Users design in Studio, execute in n8n, see results back in Studio. The same workflow schema can later drive a custom engine when n8n is replaced.

---

## 2. Why This Matters

- Workflows designed in Studio should **translate directly** to n8n — same node concepts, same vocabulary.
- Right now Save is `console.log()`. Anything built in the editor disappears on refresh.
- Right now Run animates nodes locally but never touches n8n or any real backend.
- The `studio_workflows` and `studio_executions` tables **already exist in the DB** — they just need to be written to.
- Cursor and Lovable are aligned on the same feature brief. This packet gives them the grounded, codebase-verified reality before they touch a file.

---

## 3. Current State of the Editor — What's Real vs. What's Fake

This is the most important section. Read it before writing a single line of code.

| Capability | Status | Reality |
|---|---|---|
| Canvas drag, zoom, pan | ✅ Real | Works via `useNodeDrag`, `useSelection` |
| Undo/Redo (50 steps) | ✅ Real | `useUndoRedo` with full history stack |
| Port connections | ✅ Real | `useConnectionDraw` with `portRegistry` validation |
| Keyboard shortcuts | ✅ Real | `useKeyboardShortcuts` (Ctrl+Z/Y/A/S/Del) |
| Context menus | ✅ Real | `useContextMenu` |
| Node config panel | ✅ Real | Dynamic schema-driven form via `nodeConfig.ts` |
| n8n import | ✅ Real | `n8nImporter.ts` is a working converter |
| Execution (some nodes) | ⚠️ Partial | Gemini, HTTP, Code nodes call real edge functions. Others are simulated with fake delays. |
| **Save workflow** | ❌ Fake | `console.log()` only. No DB write. Ever. |
| **Load/open workflow** | ❌ Broken | `WorkflowList.tsx` queries the DB, but since nothing is ever saved, the list is always empty. |
| **Execution persistence** | ❌ Missing | `studio_executions` table exists but is never written to. |
| **Run via n8n** | ❌ Missing | No edge function exists for this. Execution is entirely local. |

**The DB tables are ready. The code that writes to them does not exist yet.**

---

## 4. Architecture

```
Studio (Browser)
    │
    │  Run button clicked
    ▼
useWorkflowRun hook
    │  POST { workflowId, graph }
    ▼
Supabase Edge Function: run-workflow
    │  looks up n8n webhook URL from env
    │  POST graph → n8n webhook
    ▼
n8n Workflow
    │  executes
    │  returns result
    ▼
Edge Function
    │  writes to studio_executions (Supabase)
    │  returns { success, duration, response, error }
    ▼
Studio ResultPanel
    │  shows status, duration, response body

────────────────────────────────

Save button clicked
    │
    ▼
useWorkflowPersistence hook
    │  UPSERT { name, nodes_data, connections_data } → studio_workflows
    ▼
Toast: "Saved"

Open workflow from WorkflowList
    │
    ▼
useWorkflowPersistence.loadWorkflow(id)
    │  SELECT * FROM studio_workflows WHERE id = ?
    │  parse nodes_data + connections_data
    ▼
useUndoRedo.reset({ nodes, connections })
Canvas re-renders with loaded workflow
```

---

## 5. How It Works Today (Before)

### Save
**File:** `studio/src/pages/WorkflowEditorPage.tsx`

```typescript
// Line ~670 — this is the entire save implementation
const handleSaveWorkflow = useCallback(() => {
  console.log('Saving workflow...', { nodes, connections });
  showSuccess('Workflow saved');
}, [nodes, connections, showSuccess]);
```

No Supabase call. No persistence. The toast says "Workflow saved" and nothing is saved.

Cmd+S is wired through `useKeyboardShortcuts` → `SAVE_SHORTCUT` → `handleSaveWorkflow` → same no-op.

### Run/Execution
**File:** `studio/src/hooks/useExecution.ts`

`startExecution()` topologically sorts nodes and runs them one by one. For supported types (Gemini, HTTP, Code, image-gen) it calls real edge functions. For everything else it waits 400–1000ms and returns `{ simulated: true }`. Results live in React state only — not written anywhere.

### WorkflowList
**File:** `studio/src/pages/WorkflowList.tsx`

Queries `studio_workflows` from Supabase with real TanStack Query. Always returns empty because nothing is ever saved.

### studio_executions
**File:** `studio/src/integrations/supabase/types.ts`

Table exists with: `id`, `workflow_id`, `status`, `started_at`, `completed_at`, `duration_ms`, `node_results`, `error_message`, `user_id`. Never written to.

---

## 6. What Needs to Be Built — By File

### New Files to Create

| File | Owner | Purpose |
|------|-------|---------|
| `src/types/workflow.ts` | Lovable | Stable `WorkflowDefinition` type, `WorkflowNode`, `WorkflowEdge`, `RunResult` |
| `src/hooks/useWorkflowRun.ts` | Lovable | POST to edge function, manage loading/result/error state |
| `src/hooks/useWorkflowPersistence.ts` | Lovable | Save, load, list workflows against Supabase |
| `src/components/RunResultPanel.tsx` | Lovable | Show run status, duration, response/error |
| `supabase/functions/run-workflow/index.ts` | Cursor | Accept run request, call n8n webhook, write to studio_executions, return result |

### Files to Modify

| File | Change | Who |
|------|--------|-----|
| `src/pages/WorkflowEditorPage.tsx` | Wire Save to `useWorkflowPersistence`. Wire Run to `useWorkflowRun`. Render `RunResultPanel`. Add workflow name state. | Lovable |
| `src/lib/nodeConfig.ts` | Add Gmail, Slack, HTTP Request node definitions with n8n-aligned names and config schemas | Lovable |
| `src/types/index.ts` | Extend `NodeType` union to include new n8n-aligned types | Lovable |
| `src/hooks/useExecution.ts` | Add n8n path: when `N8N_EXECUTION_MODE=true`, delegate to edge function instead of local execution | Lovable |
| `src/pages/WorkflowList.tsx` | Add "Open in editor" button that routes to editor with `?workflowId=` param | Lovable |
| `src/App.tsx` | Support `?workflowId=` query param on editor route — pass to editor page for load-on-mount | Lovable |

### Files That Stay Unchanged

- All canvas hooks (`useNodeDrag`, `useConnectionDraw`, `useSelection`, `useUndoRedo`, `useContextMenu`, `useTouchSupport`) — do not touch
- `Canvas.tsx`, `CanvasNode.tsx`, `ConnectionLine.tsx` — do not touch
- `portRegistry.ts`, `canvasUtils.ts` — do not touch (see gotchas re: height discrepancy)
- `n8nImporter.ts` — keep as-is; already works
- `ImportN8nModal.tsx`, `ChatPanel.tsx` — keep as-is

### Files That Are Dead Code (leave alone, don't delete yet)

- All files in `src/components/nodes/` — `AIAgentNode.tsx`, `CodeNode.tsx`, `HTTPRequestNode.tsx`, `ImageGenNode.tsx`, `MemoryNode.tsx`, `NodeCard.tsx`, `OpenAIChatNode.tsx`, `TriggerNode.tsx`, `WebhookNode.tsx`
- These are not imported by the live canvas. The canvas uses `CanvasNode.tsx` for all types. Leave for now.

---

## 7. Data Contracts

### WorkflowDefinition (new stable type)

```typescript
// src/types/workflow.ts

export interface WorkflowDefinition {
  id?: string;                     // undefined for unsaved workflows
  name: string;
  trigger: string;                 // node id of the trigger node
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  meta?: Record<string, unknown>;  // arbitrary metadata; engine-agnostic
}

export interface WorkflowNode {
  id: string;
  type: string;                    // NodeType — keep as string for engine-agnosticism
  position: { x: number; y: number };
  title: string;
  config: Record<string, unknown>; // node-specific config (url, method, prompt, etc.)
}

export interface WorkflowEdge {
  id: string;
  sourceId: string;
  sourcePort: string;              // 'output' | 'tool' | 'memory'
  targetId: string;
  targetPort: string;              // 'input' | 'tool' | 'memory'
}

export interface RunResult {
  success: boolean;
  status: 'running' | 'success' | 'error' | 'cancelled';
  duration_ms?: number;
  response?: unknown;              // raw response body from n8n or edge function
  error?: string;
  execution_id?: string;          // studio_executions.id for cross-referencing
  node_results?: Record<string, unknown>; // per-node output for step visualization
}
```

### Supabase Save Format

Map `WorkflowDefinition` → `studio_workflows` row:

```typescript
{
  name: workflow.name,
  nodes_data: workflow.nodes,          // stored as JSONB
  connections_data: workflow.edges,    // stored as JSONB (renamed from WorkflowEdge[] for clarity)
  node_count: workflow.nodes.length,
  status: 'active',
  user_id: supabase.auth.user()?.id ?? null
}
```

> **Note:** The existing `NodeData[]` + `Connection[]` types in `types/index.ts` can be used directly as the `nodes_data` / `connections_data` JSONB. The new `WorkflowDefinition` is the canonical transport/persistence type going forward. When loading, map the DB row back to `WorkflowDefinition` then call `useUndoRedo.reset()`.

### Edge Function: run-workflow

**Request** (Studio → Edge Function):
```typescript
POST /functions/v1/run-workflow
Authorization: Bearer SUPABASE_ANON_KEY
Content-Type: application/json

{
  workflowId?: string,             // if workflow is saved — pass ID so n8n can load from DB
  graph?: WorkflowDefinition,      // if unsaved — pass the full graph for n8n to execute
  playerId?: string                // optional — future use for game-triggered runs
}
```

**Edge Function logic:**
```typescript
// 1. Validate request (must have workflowId or graph)
// 2. Get N8N_WEBHOOK_URL from Deno.env (never exposed to client)
// 3. Record start time
// 4. POST to n8n:
//    { workflowId, graph, timestamp: new Date().toISOString() }
// 5. Await n8n response (with timeout: 30s default)
// 6. Calculate duration_ms
// 7. Write to studio_executions table
// 8. Return result to Studio
```

**Response** (Edge Function → Studio):
```typescript
// Success:
{
  success: true,
  status: 'success',
  duration_ms: 1234,
  response: { ... },          // raw n8n output
  execution_id: 'uuid'        // studio_executions.id
}

// Error:
{
  success: false,
  status: 'error',
  duration_ms: 1234,
  error: 'Human-readable message',
  execution_id: 'uuid'
}

// Timeout:
{
  success: false,
  status: 'error',
  duration_ms: 30000,
  error: 'Workflow timed out after 30s'
}

// Mock (when N8N_WEBHOOK_URL not set):
{
  success: true,
  status: 'success',
  duration_ms: 800,
  response: { simulated: true, message: 'Mock execution — configure N8N_WEBHOOK_URL to run for real' }
}
```

**studio_executions write:**
```typescript
await supabase.from('studio_executions').insert({
  workflow_id: workflowId ?? null,
  status: success ? 'success' : 'error',
  started_at: startTime.toISOString(),
  completed_at: new Date().toISOString(),
  duration_ms: durationMs,
  node_results: response ?? null,
  error_message: error ?? null
})
```

### n8n Webhook Payload

What the Edge Function sends to n8n:
```json
{
  "workflowId": "optional-if-saved",
  "graph": {
    "name": "My Workflow",
    "trigger": "node-id-of-trigger",
    "nodes": [...],
    "edges": [...]
  },
  "timestamp": "2026-02-19T10:00:00.000Z"
}
```

n8n receives this at a Webhook node and can either:
- (a) Execute a pre-built n8n workflow that mirrors the Studio graph, or
- (b) Use a custom n8n workflow that interprets the `graph` payload and executes it step by step

---

## 8. Node Types — Alignment with n8n

The Cursor brief asks for n8n-aligned node types. Here's what exists now and what needs to be added/renamed.

### Current Types (keep)
| Studio Type | Maps to n8n Concept | Status |
|---|---|---|
| `trigger` | Manual Trigger / Webhook Trigger | Keep, rename label to "Trigger" |
| `webhook` | Webhook node | Keep |
| `schedule` | Schedule Trigger | Keep |
| `http-tool` | HTTP Request | Keep, rename label to "HTTP Request" |
| `code-tool` | Code node | Keep, rename label to "Code" |
| `ai-agent` | AI Agent | Keep |
| `memory` | Simple Memory | Keep |
| `if` | IF node | Keep |
| `merge` | Merge node | Keep |
| `image-gen` | Keep as custom | Keep |
| `gemini-chat` | Basic LLM Chain | Keep |

### New Types to Add (in `nodeConfig.ts` + `NodeType` union)
| New Studio Type | n8n Equivalent | Config Fields |
|---|---|---|
| `gmail` | Gmail node | action (select: read/send/list), credential |
| `slack` | Slack node | action (select: postMessage/getUser), channel (text), credential |
| `set` | Set / Edit Fields node | fields (json) — sets data for next nodes |
| `n8n-workflow` | Execute Workflow | workflowId (text) — call another n8n workflow |

> **Do not add more node types than these.** Scope creep here is a risk. Get these working first.

### Trigger Enforcement (one per workflow)

On canvas mount and on node add, enforce: only one node with `type === 'trigger' || type === 'webhook' || type === 'schedule'` may exist. If a second trigger is added, show a warning toast and don't add the node. The trigger node should be visually distinct (different border color — n8n uses orange).

---

## 9. Implementation Plan

### Phase 1: Persistence (Save/Load) — Do This First

Unblocks everything else. Until save works, nothing else matters.

**Step 1.1 — Create `useWorkflowPersistence.ts`**

File: `studio/src/hooks/useWorkflowPersistence.ts`

```typescript
// Pseudocode
function useWorkflowPersistence(nodes: NodeData[], connections: Connection[]) {
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null)
  const [workflowName, setWorkflowName] = useState('Untitled Workflow')
  const [isSaving, setIsSaving] = useState(false)

  async function saveWorkflow(): Promise<void> {
    setIsSaving(true)
    const payload = {
      name: workflowName,
      nodes_data: nodes,
      connections_data: connections,
      node_count: nodes.length,
      status: 'active',
      updated_at: new Date().toISOString()
    }
    if (currentWorkflowId) {
      // UPDATE
      await supabase.from('studio_workflows').update(payload).eq('id', currentWorkflowId)
    } else {
      // INSERT
      const { data } = await supabase.from('studio_workflows').insert(payload).select().single()
      setCurrentWorkflowId(data.id)
    }
    setIsSaving(false)
  }

  async function loadWorkflow(id: string): Promise<{ nodes: NodeData[], connections: Connection[] }> {
    const { data } = await supabase.from('studio_workflows').select('*').eq('id', id).single()
    setCurrentWorkflowId(data.id)
    setWorkflowName(data.name)
    return {
      nodes: data.nodes_data as NodeData[],
      connections: data.connections_data as Connection[]
    }
  }

  async function listWorkflows() {
    return supabase.from('studio_workflows').select('id, name, updated_at, node_count, status').order('updated_at', { ascending: false })
  }

  return { saveWorkflow, loadWorkflow, listWorkflows, isSaving, workflowName, setWorkflowName, currentWorkflowId }
}
```

**Step 1.2 — Wire into `WorkflowEditorPage.tsx`**

Replace `handleSaveWorkflow`:
```typescript
// Remove:
const handleSaveWorkflow = useCallback(() => {
  console.log('Saving workflow...', { nodes, connections });
  showSuccess('Workflow saved');
}, [nodes, connections, showSuccess]);

// Replace with:
const { saveWorkflow, loadWorkflow, isSaving, workflowName, setWorkflowName, currentWorkflowId } =
  useWorkflowPersistence(nodes, connections)

const handleSaveWorkflow = useCallback(async () => {
  try {
    await saveWorkflow()
    showSuccess('Workflow saved')
  } catch (e) {
    showError('Failed to save workflow')
  }
}, [saveWorkflow, showSuccess, showError])
```

**Step 1.3 — Load on mount from URL param**

In `WorkflowEditorPage.tsx`, check for `?workflowId=` in URL on mount:
```typescript
const [searchParams] = useSearchParams()
const workflowIdParam = searchParams.get('workflowId')

useEffect(() => {
  if (workflowIdParam) {
    loadWorkflow(workflowIdParam).then(({ nodes, connections }) => {
      reset({ nodes, connections })  // useUndoRedo reset
    })
  }
}, [workflowIdParam])
```

**Step 1.4 — Add workflow name field to toolbar**

Add an inline editable text field in the editor header for `workflowName`. This is how n8n does it — the workflow name is editable inline, not in a modal.

---

### Phase 2: Run + Result Panel

**Step 2.1 — Create `run-workflow` Edge Function**

File: `studio/supabase/functions/run-workflow/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { workflowId, graph } = await req.json()

  if (!workflowId && !graph) {
    return new Response(JSON.stringify({ success: false, error: 'workflowId or graph required' }), { status: 400 })
  }

  const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL')
  const startTime = Date.now()

  let result: any
  let success = false

  if (!n8nWebhookUrl) {
    // Mock mode — n8n not configured yet
    await new Promise(r => setTimeout(r, 800))
    result = { simulated: true, message: 'Mock execution. Set N8N_WEBHOOK_URL to run for real.' }
    success = true
  } else {
    try {
      const n8nResponse = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId, graph, timestamp: new Date().toISOString() }),
        signal: AbortSignal.timeout(30000)
      })
      result = await n8nResponse.json()
      success = n8nResponse.ok
    } catch (e) {
      result = null
      success = false
      const errorMsg = e instanceof Error ? e.message : 'Unknown error'
      const duration = Date.now() - startTime

      // Write failed execution to DB
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      const { data: exec } = await supabase.from('studio_executions').insert({
        workflow_id: workflowId ?? null,
        status: 'error',
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        error_message: errorMsg
      }).select().single()

      return new Response(JSON.stringify({
        success: false, status: 'error', duration_ms: duration, error: errorMsg, execution_id: exec?.id
      }), { headers: { 'Content-Type': 'application/json' } })
    }
  }

  const duration = Date.now() - startTime
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: exec } = await supabase.from('studio_executions').insert({
    workflow_id: workflowId ?? null,
    status: success ? 'success' : 'error',
    started_at: new Date(startTime).toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: duration,
    node_results: result ?? null
  }).select().single()

  return new Response(JSON.stringify({
    success,
    status: success ? 'success' : 'error',
    duration_ms: duration,
    response: result,
    execution_id: exec?.id
  }), { headers: { 'Content-Type': 'application/json' } })
})
```

**Step 2.2 — Create `useWorkflowRun.ts`**

File: `studio/src/hooks/useWorkflowRun.ts`

```typescript
// Pseudocode
function useWorkflowRun() {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<RunResult | null>(null)
  const [duration, setDuration] = useState<number | null>(null)

  async function runWorkflow(workflowId: string | null, graph: WorkflowDefinition) {
    setStatus('running')
    setResult(null)
    try {
      const { data, error } = await supabase.functions.invoke('run-workflow', {
        body: { workflowId, graph }
      })
      if (error) throw error
      setResult(data)
      setStatus(data.success ? 'success' : 'error')
      setDuration(data.duration_ms)
    } catch (e) {
      setResult({ success: false, status: 'error', error: e.message })
      setStatus('error')
    }
  }

  return { runWorkflow, status, result, duration }
}
```

**Step 2.3 — Create `RunResultPanel.tsx`**

File: `studio/src/components/RunResultPanel.tsx`

Shows:
- Status chip: `Running...` (spinner) | `Success` (green) | `Failed` (red)
- Duration: `1.2s`
- Label: `"Ran via n8n"` or `"Simulated run"` — check `result.response?.simulated`
- Response body: collapsible JSON viewer
- Error message (on failure)
- Link to execution in `ExecutionHistory` page via `execution_id`

**Step 2.4 — Wire Run button in `WorkflowEditorPage.tsx`**

```typescript
const { runWorkflow, status: runStatus, result: runResult } = useWorkflowRun()

// Build WorkflowDefinition from current nodes/connections
const currentGraph: WorkflowDefinition = {
  name: workflowName,
  trigger: nodes.find(n => ['trigger','webhook','schedule'].includes(n.type))?.id ?? '',
  nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, title: n.title, config: n.config ?? {} })),
  edges: connections.map(c => ({ id: c.id, sourceId: c.from, sourcePort: c.fromPort, targetId: c.to, targetPort: c.toPort }))
}

const handleRun = useCallback(() => {
  runWorkflow(currentWorkflowId, currentGraph)
}, [currentWorkflowId, currentGraph, runWorkflow])
```

---

### Phase 3: Node Type Alignment

**Step 3.1 — Add new node types to `nodeConfig.ts`**

Add `gmail`, `slack`, `set`, `n8n-workflow` with config schemas following the same pattern as existing types.

For example, Gmail:
```typescript
gmail: {
  label: 'Gmail',
  icon: 'Mail',
  color: '#EA4335',
  sections: [
    {
      title: 'Action',
      fields: [
        { key: 'action', label: 'Operation', type: 'select', options: [
          { value: 'read', label: 'Read Emails' },
          { value: 'send', label: 'Send Email' },
          { value: 'list', label: 'List Emails' }
        ]},
        { key: 'credential', label: 'Credential', type: 'credentials' }
      ]
    }
  ]
}
```

**Step 3.2 — Add new types to `NodeType` union in `types/index.ts`**

```typescript
type NodeType =
  | 'trigger' | 'ai-agent' | 'openai-chat' | 'anthropic-chat'
  | 'memory' | 'http-tool' | 'code-tool' | 'custom-tool'
  | 'webhook' | 'schedule' | 'if' | 'merge'
  | 'image-gen' | 'gemini-chat' | 'gemini-embed' | 'gemini-vision'
  | 'gmail' | 'slack' | 'set' | 'n8n-workflow'   // NEW
```

**Step 3.3 — Add trigger enforcement**

In `WorkflowEditorPage.tsx` in the `handleAddNode` function:
```typescript
const TRIGGER_TYPES = ['trigger', 'webhook', 'schedule']

if (TRIGGER_TYPES.includes(newNodeType)) {
  const existingTrigger = nodes.find(n => TRIGGER_TYPES.includes(n.type))
  if (existingTrigger) {
    showError('A workflow can only have one trigger. Remove the existing trigger first.')
    return
  }
}
```

---

### Phase 4: WorkflowList — Open in Editor

**Step 4.1 — Update `WorkflowList.tsx`**

Add an "Open" button to each workflow row:
```typescript
import { useNavigate } from 'react-router-dom'
const navigate = useNavigate()

// In the row actions:
<Button onClick={() => navigate(`/workflow-editor?workflowId=${workflow.id}`)}>
  Open
</Button>
```

**Step 4.2 — Add route support in `App.tsx`**

The existing route `/workflow-editor` stays the same. The `?workflowId=` query param is picked up by the editor page on mount (Step 1.3 above). No route changes needed.

---

## 10. Environment Variables

```env
# In studio/supabase/.env or set via Supabase dashboard → Edge Function secrets
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/your-webhook-id
# If not set, run-workflow operates in mock/simulated mode — safe for dev
```

```env
# Already exists in my-rpg-game — not needed for studio edge functions
# But the run-workflow function also needs:
SUPABASE_URL=https://ktxdbeamrxhjtdattwts.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>  # for writing studio_executions
```

---

## 11. Gotchas and Edge Cases

### The Save Toast Lies Today
`showSuccess('Workflow saved')` fires even though nothing is saved. When you wire real save, keep the toast but only fire it on success. Add an error toast on failure.

### `nodes_data` and `connections_data` Are Typed as `Json | null` in the DB
When loading, cast explicitly: `data.nodes_data as NodeData[]`. Don't trust the auto-generated Supabase types here — they return `Json` which TypeScript treats as `any`. Add a runtime validation step or Zod schema.

### Port Height Inconsistency (Don't Fix Now)
`portRegistry.ts` defaults to `nodeHeight=80`; `canvasUtils.ts` uses `nodeHeight=100`. The snap zones may be slightly misaligned but it's visually acceptable. **Do not change this now** — it will require coordinated changes to both files and could break port hit detection. Log it and move on.

### Code Node Runs Arbitrary JS In the Browser
`useExecution.ts` executes Code node content via `new Function()`. This is not sandboxed despite the comment saying it is. Don't expose this to untrusted users. Not a blocker for this feature but worth flagging.

### `components/nodes/` Is Dead Code
Do not modify or reference files in `studio/src/components/nodes/`. They are not used by the live canvas. The canvas uses `CanvasNode.tsx` for all types generically. Touching these files will have zero effect on the running app.

### n8n Import Port Mapping Bug
In `n8nImporter.ts`, both `ai_languageModel` and `ai_tool` connection types map to `fromPort: 'tool', toPort: 'input'`. This is wrong for `ai_languageModel` — it connects AI model nodes (openai-chat, etc.) which only have an `input` port, not a `tool` port. Don't fix now — the importer works for most workflows. Log it.

### useUndoRedo Deep Clone Issue
`useUndoRedo` clones nodes with `nodes.map(n => ({...n}))` — a shallow spread. Nested config objects (e.g. `node.config.headers`) are reference-copied. If two history entries share a config object, mutating one mutates the other. In practice this is unlikely but possible. Don't fix now.

### Auth Is Disabled
`App.tsx` has the auth check commented out: `// if (!user) { return <Login />; }`. Supabase calls will work anonymously in dev mode but RLS policies may block writes if they require `auth.uid()`. When wiring save, check if `studio_workflows` RLS policy allows anon writes (it likely does — current policies are permissive for dev). If not, either enable the auth check or use the service role key in the edge function.

### n8n Webhook URL Must Be Active
The n8n webhook only responds when the workflow is active and deployed. In test/dev, use the test webhook URL (`/webhook-test/`) while the n8n editor is open. Production runs should use `/webhook/`. These are different URLs — the edge function should use an env var that points to the correct one per environment.

---

## 12. Database

No new tables needed. All required tables already exist in Supabase.

```sql
-- studio_workflows — already exists
-- Columns used: id, name, nodes_data (jsonb), connections_data (jsonb),
--               node_count, status, user_id, created_at, updated_at

-- studio_executions — already exists
-- Columns used: id, workflow_id, status, started_at, completed_at,
--               duration_ms, node_results (jsonb), error_message, user_id
```

**Verify these tables exist** before starting implementation. They are defined in the Supabase types but were not in `APPLY_TO_SUPABASE.sql` — they may have been created manually via the Supabase dashboard. Run `\d studio_workflows` in the SQL editor to confirm.

---

## 13. Sources

### Codebase — Files Read in Full
- `studio/src/pages/WorkflowEditorPage.tsx` — save handler, run handler, undo/redo integration
- `studio/src/hooks/useExecution.ts` — full execution logic, topological sort, per-node handlers
- `studio/src/hooks/useUndoRedo.ts` — state snapshot, history stack, reset method
- `studio/src/lib/nodeConfig.ts` — all node type definitions and config schemas
- `studio/src/lib/portRegistry.ts` — port types, connection validation, `getPortsForNodeType`
- `studio/src/lib/canvasUtils.ts` — port position math, node height constant
- `studio/src/lib/n8nImporter.ts` — n8n → Studio format converter
- `studio/src/components/ConfigPanel.tsx` — dynamic form rendering per node type
- `studio/src/components/ExecutionResultsPanel.tsx` — existing results panel (extend or replace)
- `studio/src/integrations/supabase/types.ts` — full DB type definitions including `studio_workflows`
- `studio/src/pages/WorkflowList.tsx` — existing list page with real Supabase query
- `studio/src/types/index.ts` — all TypeScript interfaces: NodeData, Connection, NodeConfig

### Architecture Docs
- `docs/DECOUPLED_ARCHITECTURE.md` — Edge Function proxy pattern; Studio never calls n8n directly
- `docs/WORKFLOW_RPG_SENIOR_DEV_BRIEF.md` — Object API, future engine migration path

### Cursor Brief
- PM brief: scope, success criteria, phasing, risks
- Lovable brief: task list, file checklist, acceptance criteria

---

## 14. Open Questions

1. **Should `run-workflow` write to `studio_executions` using the anon key or service role key?** Writing executions requires knowing the user ID for RLS. The anon key + JWT from the request header is cleaner and more secure. The service role key bypasses RLS but avoids passing auth context. Given auth is currently disabled in the Studio, service role is pragmatic for now — revisit when auth is re-enabled.

2. **What n8n workflow does the Studio "Run" button actually trigger?** Right now there's no n8n workflow that accepts an arbitrary graph and executes it. Does the user set up a specific n8n workflow first, then Studio calls it by webhook? Or does Studio send the graph and n8n's Execute Workflow node interprets it? Clarify with the team before building the edge function. For now, mock mode handles this until the n8n side is ready.

3. **Should saving auto-increment a version number?** n8n has workflow versioning. The current `studio_workflows` schema has no `version` column. For MVP, every save overwrites the current row. Add versioning later if needed.

4. **Trigger enforcement: what happens when an n8n-imported workflow has no trigger?** The importer could produce a graph with no trigger node. The enforcement logic should handle this gracefully — either add a default trigger or show a warning but allow it.

5. **Should `WorkflowList.tsx` become the entry point for the editor?** Currently the editor is accessible directly via route. Should it require opening a workflow from the list first (like n8n)? Or keep the current behavior where the editor starts with an empty canvas? For now: keep current behavior, add "Open" button to list. Decide UX later.

6. **Is `studio_executions.user_id` needed?** Auth is currently disabled. If service role key is used to write executions, `user_id` will be null. This is fine for dev but will break any user-scoped queries later. Consider passing the user's JWT in the edge function request and extracting `auth.uid()` from it.
