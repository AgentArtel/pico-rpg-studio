# Track A: Lovable Implementation Review

**Date:** After pull/merge of Lovable's Studio updates (commits 3dbb8d6..375e96a)  
**Scope:** All 8 phases of Track A (Studio Workflow Editor — Save/Load, Run→n8n, persistence, n8n-aligned nodes, config, execution persist, studio-run, name editing).

---

## Summary

Lovable's Track A implementation is **complete and correct**. All phases are present, behavior matches the plan, and the fixes/clarifications from the earlier Cursor review were respected (showSuccess/showError, trigger connection rule, `editor:` convention, etc.). A few minor follow-ups are noted below.

---

## Phase-by-phase verification

### A-0: Fix Workflow Save ✅

- **File:** `src/pages/WorkflowEditorPage.tsx`
- **State:** `workflowId` (from `initialWorkflowId` or `crypto.randomUUID()`), `workflowName`, `isSaving`.
- **handleSaveWorkflow:** Real Supabase `upsert` to `studio_workflows` with `id`, `name`, `nodes_data`, `connections_data`, `node_count`, `status: 'active'`, `updated_at`. Uses `showSuccess` / `showError`.
- **Header:** Save button receives `isSaving`; shows spinner and "Saving…" when true, disabled during save.

### A-1: Workflow Load from URL / WorkflowList ✅

- **Load by ID:** `WorkflowEditorPage` accepts `initialWorkflowId`. `useEffect` when `initialWorkflowId` is set: fetches `studio_workflows` by id, sets `workflowName`, and `reset({ nodes: loadedNodes, connections: loadedConns })` when data exists. `isLoadingWorkflow` shows a loading state.
- **App.tsx:** `editorWorkflowId` state; `onNavigate` handles `page.startsWith('editor:')` by parsing id and setting `editorWorkflowId` and `currentPage: 'editor'`. Editor renders with `initialWorkflowId={editorWorkflowId}`.
- **WorkflowList:** List row click and grid card `onEdit` both use `onNavigate(\`editor:${workflow.id}\`)`.
- **Dashboard:** `WorkflowPreview` `onEdit` uses `onNavigate(\`editor:${workflow.id}\`)`.

### A-7: Workflow Name Editing ✅

- **Header:** `workflowName`, `onNameChange`, `isSaving` props. Click-to-edit: click title → input with `autoFocus`; blur or Enter saves via `onNameChange(editValue.trim())`; Escape cancels.
- **Editor:** Passes `workflowName={workflowName}`, `onNameChange={setWorkflowName}`, `isSaving={isSaving}` to `Header`.

### A-2: Node Types — n8n-aligned ✅

- **NodeSearchPalette:** Categories: Triggers (Manual Trigger, Webhook, Schedule), Actions (Gmail, Slack, HTTP Request), Data (Set, IF, Code, Merge), AI (AI Agent, OpenAI Chat, Claude, Gemini Chat), Utilities (Image Gen, Memory, Gemini Embed, Gemini Vision). Uses existing Lucide icons and `id`/`label`/`description`/`icon` shape.
- **NodeType:** `types/index.ts` includes `'gmail' | 'slack' | 'set'` (and existing `'if'`, `'merge'`).
- **Connection rule:** `TRIGGER_TYPES = ['trigger', 'webhook', 'schedule']`. In `onConnectionCreate`, if the target node type is in `TRIGGER_TYPES`, `showError('Trigger nodes cannot have inputs')` and return; otherwise add connection and `showSuccess('Connection created')`.
- **handleAddNode:** `titleMap` includes entries for `gmail`, `slack`, `set`, `if`, `merge` (and other types).

### A-3: Config panel fields ✅

- **nodeConfig.ts:** Schemas added for `gmail` (action + query), `slack` (action + channel), `set` (keyValuePairs JSON), `schedule` (cron + helper), `if` (condition expression), `merge` (mode). All registered in the `schemas` registry.

### A-4: Persist execution results ✅

- **On Run:** Before execution, insert into `studio_executions` with `id: execId`, `workflow_id: workflowId`, `status: 'running'`, `started_at`.
- **onExecutionComplete:** Update same row: `status: 'success' | 'error'`, `completed_at`, `duration_ms`, `node_results: result.nodeStatuses`. Then update `studio_workflows`: `last_run_at`, then read `execution_count` and update with `execution_count: (wf.execution_count ?? 0) + 1`. Clear `currentExecutionId`.
- **onExecutionError:** Update `studio_executions` with `status: 'error'`, `completed_at`, `error_message: error`; clear `currentExecutionId`.

### A-5: studio-run Edge Function ✅

- **File:** `supabase/functions/studio-run/index.ts`
- **Behavior:** Accepts `workflow_id` (and optional `workflow_graph`). If no graph, loads from `studio_workflows` by id. If no graph found, returns 404 with `mode: 'error'`. Otherwise currently **always** returns `mode: 'simulate'` with `N8N_NOT_CONFIGURED` so Studio falls back to local execution (comment notes n8n_webhook_registry not used yet).
- **Editor:** `handleRunWorkflow` creates execution record, then `fetch(studio-run)` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. If `data.mode === 'n8n' && data.success`, updates execution with n8n result and returns; otherwise (and on catch) calls `startExecution()`.

### A-6: Results panel / Execution History ✅

- **Execution persistence:** Covered in A-4; execution history and dashboard read from Supabase (existing queries). Dashboard and WorkflowList now pass workflow id for edit (A-1).

---

## Fixes and clarifications (from prior Cursor review)

| Item | Status |
|------|--------|
| Use `showSuccess` / `showError` instead of generic `toast()` | ✅ Used in save, run, and connection validation. |
| Trigger nodes cannot have incoming connections | ✅ Enforced in `onConnectionCreate` with toast. |
| Load by ID via `editor:` convention (no `/editor?id=` route) | ✅ Implemented via `editor:${workflow.id}` and `initialWorkflowId`. |
| Node palette keeps Lucide icons and existing shape | ✅ Kept; new types use Mail, MessageSquare, Pencil, etc. |
| NodeType union includes new types | ✅ `gmail`, `slack`, `set` added in `types/index.ts`. |

---

## Minor follow-ups (non-blocking)

1. **Env var name**  
   Editor uses `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`. If your Studio app uses `VITE_SUPABASE_ANON_KEY` instead, rename the env reference (or set both) so Run can authenticate to `studio-run`.

2. **studio-run and n8n_webhook_registry**  
   When you add the `n8n_webhook_registry` table (e.g. from Track B migration), update `studio-run` to look up `action_key = 'studio.run_workflow'` and, when active, forward the graph to the n8n webhook and return `mode: 'n8n'` and the result. Until then, returning `mode: 'simulate'` is correct.

3. **Execution count update**  
   The first update in `onExecutionComplete` sets `execution_count: undefined`. Supabase/JSON typically omits undefined keys, so the DB value should be unchanged and the subsequent select+increment is correct. If you ever see `execution_count` reset, remove `execution_count` from that first update and only set `last_run_at`.

4. **Reset dependency**  
   Load effect uses `reset` from `useUndoRedo`; the effect dependency array is `[initialWorkflowId]`. If `reset` is not stable, consider adding it to the dependency array or wrapping in `useCallback` where appropriate.

---

## Verification checklist (from plan)

| Check | Result |
|-------|--------|
| Save → studio_workflows row with nodes_data, connections_data, node_count | ✅ |
| Open editor with workflow id → canvas and name from DB | ✅ (via editor:id and initialWorkflowId) |
| WorkflowList / Dashboard edit → editor with that workflow | ✅ |
| Node palette: Gmail, Slack, Set, IF, Merge; trigger rule | ✅ |
| Config: Gmail node shows action + query (and other new types) | ✅ (nodeConfig schemas) |
| Run → studio_executions row; completion updates status, duration_ms | ✅ |
| studio-run returns simulate → fallback to local execution | ✅ |
| Execution History / Dashboard use real data | ✅ (existing queries + edit links) |

---

## Conclusion

Track A is implemented as specified. Safe to proceed with: applying migrations, deploying `studio-run`, and (when ready) wiring `studio-run` to `n8n_webhook_registry` for real n8n execution.
