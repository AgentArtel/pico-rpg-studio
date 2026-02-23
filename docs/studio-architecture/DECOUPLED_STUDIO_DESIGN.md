# Decoupled Studio Architecture for RPG-JS

## Overview

Transform RPG-JS into a **headless game engine** where:
- **Studio** (Agent Artel Studio) = Content Management System
- **Game** = One of many possible clients
- **Database** = Single source of truth
- **API** = Communication layer

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DECOUPLED ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────────┐         ┌──────────────────┐                     │
│   │   AGENT ARTEL    │         │     RPG-JS       │                     │
│   │     STUDIO       │◄───────►│      GAME        │                     │
│   │  (React/Vue CMS) │   API   │  (Game Client)   │                     │
│   └────────┬─────────┘         └────────┬─────────┘                     │
│            │                            │                               │
│            │       ┌────────────────────┘                               │
│            │       │                                                   │
│            ▼       ▼                                                   │
│   ┌──────────────────────────────────────┐                             │
│   │           SUPABASE BACKEND           │                             │
│   │  ┌──────────┬──────────┬──────────┐  │                             │
│   │  │Database  │Realtime  │  Auth    │  │                             │
│   │  │(PostgreSQL)│  Sync  │ (OAuth)  │  │                             │
│   │  └──────────┴──────────┴──────────┘  │                             │
│   │  ┌──────────┬──────────┬──────────┐  │                             │
│   │  │  Edge   │ Storage  │  Vector  │  │                             │
│   │  │Functions│  (Assets)│   (AI)   │  │                             │
│   │  └──────────┴──────────┴──────────┘  │                             │
│   └──────────────────────────────────────┘                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Core Concept: Content as Data

Instead of hardcoding in TypeScript files, all game content lives in the database:

| Content Type | Before (Hardcoded) | After (Database) |
|--------------|-------------------|------------------|
| NPCs | `events/villager.ts` | `content_npcs` table |
| Items | `database/items/potion.ts` | `content_items` table |
| Quests | Code logic | `content_quests` table |
| Dialogue | Static strings | `content_dialogues` table |
| Maps | TMX files | `content_maps` + Storage |

The **Studio** creates/updates this content.  
The **Game** reads it at runtime.  
Both share the same Supabase database.

---

## Database Schema for Studio Integration

### Content Management Tables

```sql
-- NPCs (content_npcs)
CREATE TABLE content_npcs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic info
    npc_id TEXT UNIQUE NOT NULL, -- 'village_elder', 'shopkeeper_01'
    name TEXT NOT NULL,
    description TEXT,
    
    -- Appearance
    sprite TEXT NOT NULL, -- 'wizard', 'merchant'
    avatar_url TEXT, -- For dialogue UI
    
    -- Position (can be multiple spawn points)
    spawn_locations JSONB DEFAULT '[{"map": "town", "x": 100, "y": 200}]',
    
    -- Behavior
    behavior_type TEXT DEFAULT 'static', -- static, wander, patrol
    movement_speed TEXT DEFAULT 'normal', -- slow, normal, fast
    
    -- AI Configuration
    ai_enabled BOOLEAN DEFAULT FALSE,
    ai_personality TEXT, -- 'friendly, helpful blacksmith'
    ai_model TEXT DEFAULT 'gpt-4o-mini',
    
    -- Shop (if applicable)
    shop_enabled BOOLEAN DEFAULT FALSE,
    shop_items JSONB, -- ['item_sword', 'item_potion']
    
    -- Metadata
    tags TEXT[], -- ['merchant', 'quest_giver']
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    published BOOLEAN DEFAULT FALSE
);

-- Items (content_items)
CREATE TABLE content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    item_id TEXT UNIQUE NOT NULL, -- 'health_potion', 'iron_sword'
    name TEXT NOT NULL,
    description TEXT,
    
    -- Type
    item_type TEXT NOT NULL, -- consumable, weapon, armor, key_item
    rarity TEXT DEFAULT 'common', -- common, rare, epic, legendary
    
    -- Stats
    hp_restore INTEGER DEFAULT 0,
    mp_restore INTEGER DEFAULT 0,
    attack_bonus INTEGER DEFAULT 0,
    defense_bonus INTEGER DEFAULT 0,
    
    -- Economy
    buy_price INTEGER DEFAULT 0,
    sell_price INTEGER DEFAULT 0,
    
    -- Visuals
    icon_url TEXT,
    sprite_url TEXT,
    
    -- Effects
    effects JSONB, -- [{"type": "heal", "amount": 50}]
    
    published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Quests (content_quests)
CREATE TABLE content_quests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    quest_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    
    -- Requirements
    min_level INTEGER DEFAULT 1,
    prerequisites JSONB, -- ['quest_001_completed']
    
    -- Objectives
    objectives JSONB NOT NULL, -- [
                              --   {"type": "kill", "target": "slime", "count": 5},
                              --   {"type": "collect", "item": "herb", "count": 3}
                              -- ]
    
    -- Rewards
    reward_exp INTEGER DEFAULT 0,
    reward_gold INTEGER DEFAULT 0,
    reward_items JSONB, -- ['item_sword_rare']
    
    -- Giver
    giver_npc_id TEXT REFERENCES content_npcs(npc_id),
    
    -- Dialogue
    start_dialogue_id UUID,
    complete_dialogue_id UUID,
    
    published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Dialogues (content_dialogues)
CREATE TABLE content_dialogues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    dialogue_id TEXT UNIQUE NOT NULL,
    npc_id TEXT REFERENCES content_npcs(npc_id),
    
    -- Dialogue tree
    nodes JSONB NOT NULL, -- {
                          --   "start": {
                          --     "text": "Hello!",
                          --     "choices": [
                          --       {"text": "Shop", "next": "shop", "action": "open_shop"},
                          --       {"text": "Bye", "next": "end"}
                          --     ]
                          --   }
                          -- }
    
    published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Maps (content_maps)
CREATE TABLE content_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    map_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    
    -- TMX file in Storage
    tmx_path TEXT,
    
    -- Tilesets
    tilesets JSONB, -- [{"name": "terrain", "path": "tilesets/terrain.tsx"}]
    
    -- Spawn points
    spawn_points JSONB, -- [{"name": "main", "x": 100, "y": 200}]
    
    -- Encounters
    random_encounters BOOLEAN DEFAULT FALSE,
    encounter_table JSONB, -- [{"enemy": "slime", "weight": 50, "level_range": [1,3]}]
    
    published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Live Events (scheduled events, double XP weekends, etc)
CREATE TABLE live_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    event_type TEXT NOT NULL, -- double_xp, rare_spawn, sale
    title TEXT NOT NULL,
    description TEXT,
    
    -- Schedule
    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP NOT NULL,
    
    -- Configuration
    config JSONB, -- {"multiplier": 2, "affected_maps": ["all"]}
    
    active BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Player Data Tables (Game Runtime)

```sql
-- Players (already exists from previous docs)
-- Player inventory references content_items
CREATE TABLE player_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    item_id TEXT REFERENCES content_items(item_id), -- Links to CMS
    quantity INTEGER DEFAULT 1,
    equipped BOOLEAN DEFAULT FALSE,
    acquired_at TIMESTAMP DEFAULT NOW()
);

-- Player quests
CREATE TABLE player_quests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    quest_id TEXT REFERENCES content_quests(quest_id),
    status TEXT DEFAULT 'active', -- active, completed, failed
    progress JSONB DEFAULT '{}', -- {"kills": 3, "collected": 1}
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Analytics (for studio dashboard)
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id),
    event_type TEXT NOT NULL, -- quest_complete, item_acquired, death
    event_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Layer Design

### REST API (for Studio)

```typescript
// Edge Functions

// GET /content/npcs
// List all NPCs with filtering
export async function listNPCs(req: Request) {
    const { search, tags, published } = req.query
    
    let query = supabase
        .from('content_npcs')
        .select('*')
    
    if (search) {
        query = query.ilike('name', `%${search}%`)
    }
    
    if (tags) {
        query = query.contains('tags', tags)
    }
    
    if (published !== undefined) {
        query = query.eq('published', published)
    }
    
    const { data, error } = await query
    return new Response(JSON.stringify(data))
}

// POST /content/npcs
// Create new NPC
export async function createNPC(req: Request) {
    const npc = await req.json()
    
    const { data, error } = await supabase
        .from('content_npcs')
        .insert(npc)
        .select()
        .single()
    
    // Broadcast to connected game clients
    await supabase.channel('content_updates')
        .send({
            type: 'broadcast',
            event: 'npc_created',
            payload: data
        })
    
    return new Response(JSON.stringify(data))
}

// PUT /content/npcs/:id
// Update NPC (triggers game update)
export async function updateNPC(req: Request) {
    const { id } = req.params
    const updates = await req.json()
    
    const { data, error } = await supabase
        .from('content_npcs')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    
    // Notify all game clients of change
    await supabase.channel('content_updates')
        .send({
            type: 'broadcast',
            event: 'npc_updated',
            payload: data
        })
    
    return new Response(JSON.stringify(data))
}

// POST /analytics/query
// Get analytics for studio dashboard
export async function queryAnalytics(req: Request) {
    const { metric, startDate, endDate } = await req.json()
    
    const { data, error } = await supabase.rpc('get_analytics', {
        p_metric: metric,
        p_start: startDate,
        p_end: endDate
    })
    
    return new Response(JSON.stringify(data))
}
```

### Real-time API (for Game)

```typescript
// Game client subscribes to content changes

class ContentLoader {
    private npcCache: Map<string, any> = new Map()
    private itemCache: Map<string, any> = new Map()
    
    async initialize() {
        // Load all published content
        await this.loadAllContent()
        
        // Subscribe to real-time updates
        this.subscribeToUpdates()
    }
    
    async loadAllContent() {
        // Load NPCs
        const { data: npcs } = await supabase
            .from('content_npcs')
            .select('*')
            .eq('published', true)
        
        npcs?.forEach(npc => this.npcCache.set(npc.npc_id, npc))
        
        // Load items
        const { data: items } = await supabase
            .from('content_items')
            .select('*')
            .eq('published', true)
        
        items?.forEach(item => this.itemCache.set(item.item_id, item))
    }
    
    subscribeToUpdates() {
        // Listen for new/updated content from Studio
        supabase
            .channel('content_updates')
            .on('broadcast', { event: 'npc_created' }, (payload) => {
                this.npcCache.set(payload.npc_id, payload)
                game.spawnNPC(payload) // Spawn in game immediately
            })
            .on('broadcast', { event: 'npc_updated' }, (payload) => {
                this.npcCache.set(payload.npc_id, payload)
                game.updateNPC(payload) // Update existing NPC
            })
            .subscribe()
    }
    
    getNPC(id: string) {
        return this.npcCache.get(id)
    }
    
    getItem(id: string) {
        return this.itemCache.get(id)
    }
}
```

---

## Studio (Agent Artel Studio) Features

### 1. Content Editor

```typescript
// Studio: NPC Editor Component
interface NPCEditorProps {
    npcId?: string // undefined = create new
}

export function NPCEditor({ npcId }: NPCEditorProps) {
    const [npc, setNPC] = useState<Partial<NPC>>({})
    const [isPublished, setIsPublished] = useState(false)
    
    // Load existing NPC
    useEffect(() => {
        if (npcId) {
            fetch(`/api/content/npcs/${npcId}`)
                .then(r => r.json())
                .then(data => {
                    setNPC(data)
                    setIsPublished(data.published)
                })
        }
    }, [npcId])
    
    const save = async (publish = false) => {
        const data = { ...npc, published: publish }
        
        const res = await fetch(`/api/content/npcs/${npcId || ''}`, {
            method: npcId ? 'PUT' : 'POST',
            body: JSON.stringify(data)
        })
        
        if (publish) {
            // Live preview - update game immediately
            toast.success('Published to game!')
        } else {
            toast.success('Saved as draft')
        }
    }
    
    return (
        <form>
            <input 
                value={npc.name}
                onChange={e => setNPC({...npc, name: e.target.value})}
                placeholder="NPC Name"
            />
            
            <textarea
                value={npc.description}
                onChange={e => setNPC({...npc, description: e.target.value})}
                placeholder="Description"
            />
            
            <select
                value={npc.behavior_type}
                onChange={e => setNPC({...npc, behavior_type: e.target.value})}
            >
                <option value="static">Static</option>
                <option value="wander">Wander</option>
                <option value="patrol">Patrol</option>
            </select>
            
            <label>
                <input
                    type="checkbox"
                    checked={npc.ai_enabled}
                    onChange={e => setNPC({...npc, ai_enabled: e.target.checked})}
                />
                Enable AI Dialogue
            </label>
            
            {npc.ai_enabled && (
                <textarea
                    value={npc.ai_personality}
                    onChange={e => setNPC({...npc, ai_personality: e.target.value})}
                    placeholder="AI Personality (e.g., 'grumpy blacksmith who hates tourists')"
                />
            )}
            
            <button type="button" onClick={() => save(false)}>
                Save Draft
            </button>
            <button type="button" onClick={() => save(true)} className="primary">
                Publish to Game
            </button>
        </form>
    )
}
```

### 2. Live Dashboard

```typescript
// Studio: Real-time game monitoring
export function LiveDashboard() {
    const [onlinePlayers, setOnlinePlayers] = useState(0)
    const [recentEvents, setRecentEvents] = useState([])
    
    useEffect(() => {
        // Subscribe to player presence
        const channel = supabase.channel('online_players')
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState()
                setOnlinePlayers(Object.keys(state).length)
            })
            .subscribe()
        
        // Subscribe to analytics
        supabase
            .channel('analytics')
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'analytics_events' },
                (payload) => {
                    setRecentEvents(prev => [payload.new, ...prev].slice(0, 10))
                }
            )
            .subscribe()
        
        return () => { channel.unsubscribe() }
    }, [])
    
    return (
        <div className="dashboard">
            <div className="stat-card">
                <h3>Online Players</h3>
                <div className="stat-value">{onlinePlayers}</div>
            </div>
            
            <div className="recent-events">
                <h3>Live Events</h3>
                {recentEvents.map(event => (
                    <div key={event.id} className="event-item">
                        <span className="event-type">{event.event_type}</span>
                        <span className="event-time">
                            {new Date(event.created_at).toLocaleTimeString()}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
```

### 3. Quest Builder (Visual)

```typescript
// Studio: Visual quest builder
export function QuestBuilder() {
    const [nodes, setNodes] = useState([])
    const [edges, setEdges] = useState([])
    
    const onConnect = (params) => setEdges([...edges, params])
    
    const addNode = (type: string) => {
        const node = {
            id: `node_${nodes.length}`,
            type,
            position: { x: 100, y: 100 },
            data: { label: type }
        }
        setNodes([...nodes, node])
    }
    
    const saveQuest = async () => {
        const quest = convertFlowToQuest(nodes, edges)
        
        await fetch('/api/content/quests', {
            method: 'POST',
            body: JSON.stringify(quest)
        })
    }
    
    return (
        <div className="quest-builder">
            <div className="toolbar">
                <button onClick={() => addNode('start')}>Start</button>
                <button onClick={() => addNode('objective')}>Objective</button>
                <button onClick={() => addNode('reward')}>Reward</button>
                <button onClick={saveQuest} className="primary">
                    Save Quest
                </button>
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

## Game (RPG-JS) Integration

### Runtime Content Loading

```typescript
// main/content-loader.ts
import { supabase } from './supabase/client'

export class RuntimeContentLoader {
    private cache = new Map<string, any>()
    
    async initialize() {
        // Load all published content on startup
        await this.loadNPCs()
        await this.loadItems()
        await this.loadQuests()
        
        // Subscribe to live updates
        this.subscribeToContentUpdates()
    }
    
    async loadNPCs() {
        const { data } = await supabase
            .from('content_npcs')
            .select('*')
            .eq('published', true)
        
        data?.forEach(npc => {
            this.cache.set(`npc:${npc.npc_id}`, npc)
        })
    }
    
    subscribeToContentUpdates() {
        // Listen for content changes from Studio
        supabase
            .channel('content_broadcast')
            .on('broadcast', { event: 'content_updated' }, ({ payload }) => {
                const { type, id, data } = payload
                
                // Update cache
                this.cache.set(`${type}:${id}`, data)
                
                // Notify game systems
                if (type === 'npc') {
                    game.eventManager.updateEvent(id, data)
                } else if (type === 'item') {
                    game.database.updateItem(id, data)
                }
            })
            .subscribe()
    }
    
    getNPC(npcId: string) {
        return this.cache.get(`npc:${npcId}`)
    }
    
    getItem(itemId: string) {
        return this.cache.get(`item:${itemId}`)
    }
}
```

### Dynamic Event Creation

```typescript
// main/events/dynamic-npc.ts
import { RpgEvent, EventData, RpgPlayer } from '@rpgjs/server'
import { contentLoader } from '../content-loader'

// This event class loads its configuration from the database
@EventData({ name: 'EV-DYNAMIC' })
export default class DynamicNPCEvent extends RpgEvent {
    private config: any
    
    async onInit() {
        // Load configuration from Studio-managed content
        this.config = contentLoader.getNPC(this.name.replace('EV-', ''))
        
        if (this.config) {
            this.setGraphic(this.config.sprite)
            
            if (this.config.ai_enabled) {
                this.initializeAI()
            }
        }
    }
    
    async onAction(player: RpgPlayer) {
        if (!this.config) return
        
        if (this.config.ai_enabled) {
            // Generate AI response
            const response = await this.generateAIResponse(player)
            await player.showText(response, { talkWith: this })
        } else if (this.config.shop_enabled) {
            // Open shop
            player.gui('shop').open({
                items: this.config.shop_items
            })
        } else {
            // Static dialogue
            const dialogue = contentLoader.getDialogue(this.config.dialogue_id)
            await this.playDialogue(player, dialogue)
        }
    }
    
    private async generateAIResponse(player: RpgPlayer): Promise<string> {
        // Call Edge Function for AI generation
        const { data } = await supabase.functions.invoke('generate-npc-dialogue', {
            body: {
                personality: this.config.ai_personality,
                playerName: player.name,
                context: await this.getPlayerContext(player)
            }
        })
        
        return data.response
    }
}
```

---

## Workflow Examples

### Workflow 1: Create and Deploy New NPC

1. **Designer opens Studio**
   - Navigates to NPC Editor
   - Creates new NPC "Mysterious Merchant"
   - Sets sprite, adds AI personality
   - Clicks "Save Draft"

2. **Tester reviews in Game**
   - Game shows NPC in staging area
   - Tester verifies behavior
   - Approves for production

3. **Designer publishes**
   - Clicks "Publish to Game"
   - API updates database
   - Broadcasts to all game servers
   - NPC appears live instantly

### Workflow 2: Live Event Management

1. **Community Manager schedules event**
   - Studio > Live Events
   - Creates "Double XP Weekend"
   - Sets dates: Friday 6PM - Sunday 11:59PM
   - Configures: 2x EXP, 1.5x Gold

2. **Event goes live automatically**
   - Edge Function activates at scheduled time
   - Game clients receive broadcast
   - Players see "Double XP Active!" banner

3. **Monitor in real-time**
   - Studio dashboard shows player engagement
   - Tracks XP gained during event
   - Adjusts parameters if needed

### Workflow 3: Hotfix Without Deployment

1. **Bug reported**: "Shopkeeper sells wrong item"

2. **Developer fixes in Studio**
   - Opens NPC Editor
   - Changes shop_items array
   - Publishes fix

3. **Game updates instantly**
   - No server restart needed
   - No client update needed
   - Fix live in < 1 second

---

## Implementation Phases

### Phase 1: Basic Integration (2-3 weeks)
- [ ] Set up Supabase project
- [ ] Create content tables
- [ ] Build basic Studio UI (NPC/Item CRUD)
- [ ] Game loads content from API
- [ ] Manual publish workflow

### Phase 2: Real-time Sync (1-2 weeks)
- [ ] Add Supabase Realtime subscriptions
- [ ] Live content updates
- [ ] Presence tracking (online players)
- [ ] Analytics collection

### Phase 3: Advanced Features (2-3 weeks)
- [ ] Visual quest builder
- [ ] AI-powered NPCs
- [ ] Live event scheduling
- [ ] Analytics dashboard

### Phase 4: Polish (1 week)
- [ ] Role-based access (designer, admin, viewer)
- [ ] Content versioning
- [ ] Staging/production environments
- [ ] Documentation

---

## Benefits of This Architecture

| Stakeholder | Benefit |
|-------------|---------|
| **Developers** | No deploys needed for content changes |
| **Designers** | Visual tools, no coding required |
| **Players** | Always fresh content, live events |
| **Operators** | Real-time monitoring, instant fixes |
| **Business** | Faster iteration, lower dev costs |

---

This architecture transforms RPG-JS from a code-heavy framework into a **live service platform** where content creators can build without engineers!
