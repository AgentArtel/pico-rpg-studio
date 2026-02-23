# Functional Implementation Plan
## Making Agent Artel Studio Actually Work

---

## Current State Analysis

### What's Built (UI Only)
- ✅ NPC Builder UI with form fields
- ✅ Workflow Canvas with nodes/connections
- ✅ Dashboard layout
- ✅ Database schemas
- ✅ Edge Functions for AI

### What's Missing (Functionality)
- ❌ Real-time sync between Studio and Game
- ❌ NPC actually spawning in game when created
- ❌ Workflow execution engine
- ❌ Player inventory management
- ❌ Quest builder
- ❌ Live event system
- ❌ Analytics working

---

## Phase 1: Core Game Integration (Week 1-2)

### 1.1 Real-Time NPC Sync

**Problem:** Game must reload map to see new NPCs
**Solution:** Supabase Realtime + hot reload

**Implementation:**

```typescript
// RPG-JS Game Server: src/server/realtime.ts
import { createClient } from '@supabase/supabase-js'

export class RealtimeContentSync {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  startListening() {
    this.supabase
      .channel('content_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'game', table: 'agent_configs' },
        (payload) => this.handleContentChange(payload)
      )
      .subscribe()
  }
  
  private handleContentChange(payload: any) {
    const { eventType, new: newRecord, old: oldRecord } = payload
    
    switch (eventType) {
      case 'INSERT':
        // Spawn new NPC immediately
        this.spawnNPC(newRecord)
        break
      case 'UPDATE':
        // Update existing NPC
        this.updateNPC(oldRecord.id, newRecord)
        break
      case 'DELETE':
        // Remove NPC
        this.despawnNPC(oldRecord.id)
        break
    }
  }
  
  private spawnNPC(config: any) {
    // Get the map
    const map = this.getMap(config.spawn.map)
    if (!map) return
    
    // Create dynamic event
    map.createDynamicEvent({
      x: config.spawn.x,
      y: config.spawn.y,
      event: this.createNPCEventClass(config)
    })
    
    console.log(`[Realtime] Spawned NPC: ${config.name}`)
  }
}
```

```typescript
// RPG-JS: Create dynamic NPC class from config
function createNPCEventClass(config: any) {
  @EventData({
    name: config.id,
    hitbox: { width: 32, height: 16 }
  })
  class DynamicNPC extends RpgEvent {
    private config = config
    
    onInit() {
      this.setGraphic(config.graphic)
      this.speed = Speed.Normal
      
      // Start idle behavior
      if (config.behavior.idleInterval > 0) {
        this.startIdleBehavior()
      }
    }
    
    async onAction(player: RpgPlayer) {
      if (config.behavior.greetOnProximity) {
        await this.greet(player)
      }
      
      // AI conversation
      await this.handleConversation(player)
    }
    
    private async handleConversation(player: RpgPlayer) {
      // Get conversation history
      const history = await this.getMemory(player.id)
      
      // Call AI
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          model: config.model.conversation,
          systemPrompt: config.personality,
          messages: history,
          skills: config.skills
        })
      })
      
      const result = await response.json()
      
      // Show response
      await player.showText(result.text, { talkWith: this })
      
      // Save to memory
      await this.saveMemory(player.id, 'assistant', result.text)
      
      // Execute any tool calls
      if (result.toolCalls) {
        for (const tool of result.toolCalls) {
          await this.executeTool(tool, player)
        }
      }
    }
  }
  
  return DynamicNPC
}
```

### 1.2 Working NPC Creation Flow

**Current:** Form submits but NPC doesn't appear in game
**Fixed:** Full end-to-end flow

```typescript
// Studio: src/pages/NPCs.tsx (update mutation)
const createMutation = useMutation({
  mutationFn: async (npc: AgentConfig) => {
    // 1. Save to database
    const { data, error } = await gameDb()
      .from('agent_configs')
      .insert({
        id: npc.id,
        name: npc.name,
        graphic: npc.graphic,
        personality: npc.personality,
        model: npc.model,
        skills: npc.skills,
        spawn: npc.spawn,
        behavior: npc.behavior,
        inventory: npc.inventory,
        enabled: npc.enabled
      })
      .select()
      .single()
    
    if (error) throw error
    
    // 2. Broadcast to game (immediate effect)
    await supabase.channel('content_changes').send({
      type: 'broadcast',
      event: 'npc_created',
      payload: data
    })
    
    return data
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['game-agent-configs'] })
    toast.success('NPC created and live in game!')
  }
})
```

---

## Phase 2: Workflow Execution Engine (Week 2-3)

### 2.1 Workflow Runner

**Problem:** Canvas shows nodes but doesn't execute
**Solution:** Execution engine with status updates

```typescript
// Supabase Edge Function: execute-workflow
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const { workflowId, triggerData } = await req.json()
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  // Load workflow
  const { data: workflow } = await supabase
    .schema('studio')
    .from('workflows')
    .select('*')
    .eq('id', workflowId)
    .single()
  
  // Create execution record
  const { data: execution } = await supabase
    .schema('studio')
    .from('executions')
    .insert({
      workflow_id: workflowId,
      status: 'running',
      started_at: new Date().toISOString(),
      node_results: {}
    })
    .select()
    .single()
  
  // Execute workflow
  const engine = new WorkflowEngine(workflow.nodes_data, workflow.connections_data)
  
  try {
    const results = await engine.execute(triggerData, {
      onNodeStart: (nodeId) => {
        // Broadcast progress to Studio
        supabase.channel(`execution:${execution.id}`).send({
          type: 'broadcast',
          event: 'node_started',
          payload: { nodeId }
        })
      },
      onNodeComplete: (nodeId, result) => {
        supabase.channel(`execution:${execution.id}`).send({
          type: 'broadcast',
          event: 'node_completed',
          payload: { nodeId, result }
        })
      }
    })
    
    // Mark complete
    await supabase
      .schema('studio')
      .from('executions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        node_results: results
      })
      .eq('id', execution.id)
    
    return new Response(JSON.stringify({ success: true, results }))
  } catch (error) {
    await supabase
      .schema('studio')
      .from('executions')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error.message
      })
      .eq('id', execution.id)
    
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 })
  }
})

// Workflow Engine
class WorkflowEngine {
  constructor(private nodes: any[], private connections: any[]) {}
  
  async execute(inputData: any, callbacks: any) {
    const context = { input: inputData, results: {} }
    const executed = new Set()
    
    // Find trigger node
    const trigger = this.nodes.find(n => n.type === 'trigger')
    if (!trigger) throw new Error('No trigger node')
    
    // Execute from trigger
    await this.executeNode(trigger, context, executed, callbacks)
    
    return context.results
  }
  
  private async executeNode(node: any, context: any, executed: Set<string>, callbacks: any) {
    if (executed.has(node.id)) return
    executed.add(node.id)
    
    callbacks.onNodeStart(node.id)
    
    // Execute based on node type
    let result
    switch (node.type) {
      case 'ai-agent':
        result = await this.executeAIAgent(node, context)
        break
      case 'http-request':
        result = await this.executeHTTP(node, context)
        break
      case 'code':
        result = await this.executeCode(node, context)
        break
      default:
        result = { success: true }
    }
    
    context.results[node.id] = result
    callbacks.onNodeComplete(node.id, result)
    
    // Execute connected nodes
    const connections = this.connections.filter(c => c.from === node.id)
    for (const conn of connections) {
      const nextNode = this.nodes.find(n => n.id === conn.to)
      if (nextNode) {
        await this.executeNode(nextNode, context, executed, callbacks)
      }
    }
  }
  
  private async executeAIAgent(node: any, context: any) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: node.data.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: node.data.systemPrompt },
          { role: 'user', content: JSON.stringify(context.input) }
        ]
      })
    })
    
    const data = await response.json()
    return { 
      success: true, 
      output: data.choices[0].message.content,
      tokens: data.usage
    }
  }
}
```

### 2.2 Studio Execution UI

```typescript
// Studio: src/hooks/useWorkflowExecution.ts
export function useWorkflowExecution(workflowId: string) {
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle')
  const [nodeStates, setNodeStates] = useState<Record<string, NodeState>>({})
  
  const execute = async (inputData: any) => {
    setStatus('running')
    
    // Start execution
    const response = await fetch('/api/execute-workflow', {
      method: 'POST',
      body: JSON.stringify({ workflowId, triggerData: inputData })
    })
    
    const { executionId } = await response.json()
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel(`execution:${executionId}`)
      .on('broadcast', { event: 'node_started' }, ({ payload }) => {
        setNodeStates(prev => ({
          ...prev,
          [payload.nodeId]: { status: 'running' }
        }))
      })
      .on('broadcast', { event: 'node_completed' }, ({ payload }) => {
        setNodeStates(prev => ({
          ...prev,
          [payload.nodeId]: { status: 'completed', result: payload.result }
        }))
      })
      .subscribe()
    
    // Poll for completion
    const checkStatus = setInterval(async () => {
      const { data } = await supabase
        .schema('studio')
        .from('executions')
        .select('status, error_message')
        .eq('id', executionId)
        .single()
      
      if (data?.status === 'completed' || data?.status === 'failed') {
        setStatus(data.status)
        clearInterval(checkStatus)
        channel.unsubscribe()
      }
    }, 1000)
  }
  
  return { execute, status, nodeStates }
}
```

---

## Phase 3: Player Management (Week 3-4)

### 3.1 Player Inventory System

```typescript
// Database: game.player_inventory
CREATE TABLE game.player_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES auth.users(id),
  item_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  equipped BOOLEAN DEFAULT FALSE,
  acquired_at TIMESTAMP DEFAULT NOW()
);

// Studio: src/pages/PlayerInventory.tsx
export function PlayerInventory() {
  const { data: players } = useQuery({
    queryKey: ['players'],
    queryFn: async () => {
      const { data } = await gameDb()
        .from('player_state')
        .select('*')
      return data
    }
  })
  
  const { data: items } = useQuery({
    queryKey: ['content-items'],
    queryFn: async () => {
      const { data } = await gameDb()
        .from('content_items')
        .select('*')
        .eq('published', true)
      return data
    }
  })
  
  const giveItemMutation = useMutation({
    mutationFn: async ({ playerId, itemId, quantity }: any) => {
      await gameDb()
        .from('player_inventory')
        .insert({ player_id: playerId, item_id: itemId, quantity })
    },
    onSuccess: () => toast.success('Item given to player')
  })
  
  return (
    <div>
      <h1>Player Inventory Management</h1>
      
      {players?.map(player => (
        <PlayerInventoryCard
          key={player.player_id}
          player={player}
          items={items}
          onGiveItem={(itemId, qty) => 
            giveItemMutation.mutate({ playerId: player.player_id, itemId, quantity: qty })
          }
        />
      ))}
    </div>
  )
}
```

### 3.2 Player State Viewer

```typescript
// Studio: Real-time player monitoring
export function PlayerMonitor() {
  const [onlinePlayers, setOnlinePlayers] = useState([])
  
  useEffect(() => {
    // Subscribe to player presence
    const channel = supabase.channel('online_players')
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnlinePlayers(Object.values(state))
      })
      .subscribe()
    
    // Subscribe to position updates
    supabase
      .channel('player_positions')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'game', table: 'player_state' },
        (payload) => {
          // Update player position on map
          updatePlayerMarker(payload.new)
        }
      )
      .subscribe()
    
    return () => channel.unsubscribe()
  }, [])
  
  return (
    <div className="player-monitor">
      <div className="stats">
        <StatCard title="Online Players" value={onlinePlayers.length} />
      </div>
      
      <div className="player-map">
        {/* Show map with player positions */}
        {onlinePlayers.map(player => (
          <PlayerMarker
            key={player.player_id}
            x={player.position.x}
            y={player.position.y}
            name={player.name}
          />
        ))}
      </div>
    </div>
  )
}
```

---

## Phase 4: Quest Builder (Week 4-5)

### 4.1 Quest System

```typescript
// Database: game.content_quests
CREATE TABLE game.content_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Requirements
  min_level INTEGER DEFAULT 1,
  prerequisites JSONB DEFAULT '[]',
  
  -- Objectives
  objectives JSONB NOT NULL, -- [{"type": "kill", "target": "slime", "count": 5}]
  
  -- Rewards
  reward_exp INTEGER DEFAULT 0,
  reward_gold INTEGER DEFAULT 0,
  reward_items JSONB DEFAULT '[]',
  
  -- Giver
  giver_npc_id TEXT REFERENCES game.agent_configs(id),
  
  -- State
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

// Studio: Quest Builder using workflow canvas
export function QuestBuilder() {
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  
  const saveQuest = async () => {
    const quest = {
      quest_id: questId,
      title: questTitle,
      description: questDescription,
      objectives: convertNodesToObjectives(nodes),
      giver_npc_id: selectedGiver,
      published: true
    }
    
    await gameDb()
      .from('content_quests')
      .insert(quest)
    
    toast.success('Quest published!')
  }
  
  return (
    <div className="quest-builder">
      <div className="toolbar">
        <button onClick={() => addNode('start')}>Start</button>
        <button onClick={() => addNode('objective')}>Objective</button>
        <button onClick={() => addNode('reward')}>Reward</button>
        <button onClick={saveQuest}>Publish Quest</button>
      </div>
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={setNodes}
        onEdgesChange={setEdges}
        onConnect={onConnect}
      />
    </div>
  )
}
```

---

## Phase 5: Live Events (Week 5-6)

### 5.1 Event Scheduler

```typescript
// Database: game.live_events
CREATE TABLE game.live_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'double_xp', 'rare_spawn', 'sale'
  title TEXT NOT NULL,
  description TEXT,
  
  -- Schedule
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  
  -- Configuration
  config JSONB NOT NULL, -- {"multiplier": 2, "affected_maps": ["all"]}
  
  -- State
  active BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

// Edge Function: Event Scheduler (runs every minute)
Deno.cron('check-events', '* * * * *', async () => {
  const supabase = createClient(url, key)
  
  const now = new Date().toISOString()
  
  // Activate events that should start
  await supabase
    .schema('game')
    .from('live_events')
    .update({ active: true })
    .lte('starts_at', now)
    .gt('ends_at', now)
    .eq('active', false)
  
  // Deactivate expired events
  await supabase
    .schema('game')
    .from('live_events')
    .update({ active: false })
    .lt('ends_at', now)
    .eq('active', true)
  
  // Broadcast active events to game
  const { data: activeEvents } = await supabase
    .schema('game')
    .from('live_events')
    .select('*')
    .eq('active', true)
  
  await supabase.channel('live_events').send({
    type: 'broadcast',
    event: 'active_events',
    payload: activeEvents
  })
})
```

---

## Implementation Checklist

### Week 1-2: Core Integration
- [ ] Add realtime.ts to RPG-JS game server
- [ ] Implement spawnNPC/updateNPC/despawnNPC
- [ ] Wire up NPC creation to broadcast
- [ ] Test: Create NPC in Studio → appears in game immediately

### Week 2-3: Workflow Engine
- [ ] Create execute-workflow Edge Function
- [ ] Build WorkflowEngine class
- [ ] Add execution hooks to Studio
- [ ] Implement node type handlers (AI, HTTP, Code)
- [ ] Test: Run workflow → see execution progress

### Week 3-4: Player Management
- [ ] Create player_inventory table
- [ ] Build Player Inventory page in Studio
- [ ] Add Player Monitor with real-time positions
- [ ] Test: Give item to player → appears in game

### Week 4-5: Quest Builder
- [ ] Create content_quests table
- [ ] Build visual quest editor
- [ ] Link quests to NPCs
- [ ] Test: Create quest → assign to NPC → player can complete

### Week 5-6: Live Events
- [ ] Create live_events table
- [ ] Build event scheduler UI
- [ ] Implement cron job for activation
- [ ] Add in-game event banners
- [ ] Test: Schedule event → auto-activates → players see banner

---

## Testing Strategy

### Integration Tests
```typescript
// Test: NPC Creation Flow
describe('NPC Creation', () => {
  it('creates NPC in Studio and spawns in game', async () => {
    // 1. Create NPC in Studio
    const npc = await studio.createNPC({ name: 'Test NPC', ... })
    
    // 2. Wait for realtime sync
    await wait(1000)
    
    // 3. Check game has spawned NPC
    const gameNPC = await game.findNPC(npc.id)
    expect(gameNPC).toBeDefined()
    expect(gameNPC.name).toBe('Test NPC')
  })
})
```

### Manual Testing Checklist
- [ ] Create NPC → appears in game < 2 seconds
- [ ] Edit NPC → changes reflect in game
- [ ] Delete NPC → disappears from game
- [ ] Run workflow → execution shows progress
- [ ] Give player item → appears in inventory
- [ ] Create quest → NPC offers quest
- [ ] Schedule event → activates automatically

---

## Next Steps

1. **Start with Phase 1** (Real-time NPC sync) - highest impact
2. **Set up Supabase Realtime** in your game server
3. **Test the full flow** with one NPC
4. **Iterate** on each phase

Want me to implement any specific phase in detail?
