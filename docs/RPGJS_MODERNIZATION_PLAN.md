# RPG-JS Modernization Plan

## Executive Summary

RPG-JS can be modernized across three major areas:
1. **Supabase Integration** - Replace custom server with managed backend
2. **AI Integration** - Add intelligent NPCs, procedural content, and dynamic storytelling
3. **Developer Experience** - Improve tooling, state management, and deployment

---

## 1. Supabase Integration

### Current Architecture
```
Client (PixiJS/Vue) ←→ Socket.io ←→ Express Server ←→ In-Memory State
```

### Proposed Architecture
```
Client (PixiJS/Vue) ←→ Supabase Realtime ←→ Edge Functions ←→ PostgreSQL
```

### Benefits
- **No server management** - Supabase handles scaling, uptime, security
- **Built-in auth** - OAuth, email, magic links out of the box
- **Persistent state** - Player data survives server restarts
- **Real-time sync** - PostgreSQL changes broadcast automatically
- **Row-level security** - Fine-grained access control

### Implementation

#### 1.1 Database Schema

```sql
-- Players table with RPG stats
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    
    -- Position
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    map_id TEXT DEFAULT 'spawn',
    
    -- Stats
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    hp INTEGER DEFAULT 100,
    max_hp INTEGER DEFAULT 100,
    mp INTEGER DEFAULT 50,
    max_mp INTEGER DEFAULT 50,
    
    -- Attributes
    strength INTEGER DEFAULT 10,
    dexterity INTEGER DEFAULT 10,
    intelligence INTEGER DEFAULT 10,
    agility INTEGER DEFAULT 10,
    
    -- Currency
    gold INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Player inventory
CREATE TABLE player_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    equipped BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Player skills
CREATE TABLE player_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(player_id, skill_id)
);

-- Quest progress
CREATE TABLE player_quests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    quest_id TEXT NOT NULL,
    status TEXT DEFAULT 'active', -- active, completed, failed
    objectives JSONB DEFAULT '{}',
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    UNIQUE(player_id, quest_id)
);

-- Game world state (dynamic events, server variables)
CREATE TABLE world_state (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat messages
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id),
    channel TEXT DEFAULT 'global',
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_quests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Players can view own data" ON players
    FOR SELECT USING (auth.uid() = user_id);
    
CREATE POLICY "Players can update own data" ON players
    FOR UPDATE USING (auth.uid() = user_id);
```

#### 1.2 Supabase Client Integration

```typescript
// client/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export const supabase = createClient<Database>(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Real-time player sync
export function subscribeToPlayer(playerId: string, callback: (player: any) => void) {
    return supabase
        .channel(`player:${playerId}`)
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'players', filter: `id=eq.${playerId}` },
            (payload) => callback(payload.new)
        )
        .subscribe()
}

// Real-time chat
export function subscribeToChat(channel: string, callback: (msg: any) => void) {
    return supabase
        .channel(`chat:${channel}`)
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'chat_messages' },
            (payload) => callback(payload.new)
        )
        .subscribe()
}
```

#### 1.3 Edge Functions for Game Logic

```typescript
// supabase/functions/move-player/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
    const { playerId, x, y, mapId } = await req.json()
    
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    // Validate move (collision detection, speed limits)
    const { data: player } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single()
    
    const distance = Math.sqrt(
        Math.pow(x - player.position_x, 2) + 
        Math.pow(y - player.position_y, 2)
    )
    
    // Max 3 tiles per move (anti-cheat)
    if (distance > 96) { // 3 * 32 pixels
        return new Response('Invalid move', { status: 400 })
    }
    
    // Update position
    const { data, error } = await supabase
        .from('players')
        .update({ 
            position_x: x, 
            position_y: y,
            map_id: mapId
        })
        .eq('id', playerId)
        .select()
        .single()
    
    if (error) return new Response(error.message, { status: 500 })
    
    // Broadcast to other players via realtime
    await supabase.channel(`map:${mapId}`).send({
        type: 'broadcast',
        event: 'player_moved',
        payload: { playerId, x, y }
    })
    
    return new Response(JSON.stringify(data))
})
```

#### 1.4 Migration Strategy

```typescript
// @rpgjs/supabase-adapter

import { RpgModule, RpgServer } from '@rpgjs/server'
import { supabase } from './supabase'

@RpgModule<RpgServer>({
    hooks: {
        // Replace in-memory with Supabase
        playerConnected: async (player) => {
            const { data } = await supabase
                .from('players')
                .select('*')
                .eq('user_id', player.userId)
                .single()
            
            if (!data) {
                // Create new player
                await supabase.from('players').insert({
                    user_id: player.userId,
                    name: player.name
                })
            } else {
                // Restore saved state
                player.load(data)
            }
        },
        
        playerDisconnected: async (player) => {
            // Auto-save on disconnect
            await supabase.from('players')
                .update(player.serialize())
                .eq('id', player.id)
        },
        
        // Real-time sync every 30 seconds
        tick: async (player) => {
            await supabase.from('players')
                .update(player.serialize())
                .eq('id', player.id)
        }
    }
})
class SupabaseAdapter {}
```

---

## 2. AI Integration

### 2.1 AI-Driven NPCs with LLMs

```typescript
// modules/ai-npc/events/ai-villager.ts
import { RpgEvent, EventData, RpgPlayer } from '@rpgjs/server'
import { generateNPCResponse, generateQuest } from '../ai/openai'

interface NPCMemory {
    playerId: string
    interactions: number
    lastTopic: string
    relationship: number // -10 to +10
}

@EventData({
    name: 'EV-AI-VILLAGER-001',
    hitbox: { width: 32, height: 16 }
})
export default class AIVillagerEvent extends RpgEvent {
    private memories: Map<string, NPCMemory> = new Map()
    private personality = 'friendly_blacksmith'
    
    onInit() {
        this.setGraphic('blacksmith')
        // Load personality from database
    }
    
    async onAction(player: RpgPlayer) {
        const memory = this.getMemory(player.id)
        
        // Get AI-generated dialogue
        const response = await generateNPCResponse({
            personality: this.personality,
            playerName: player.name,
            memory: memory,
            context: this.getWorldContext(),
            prompt: player.getVariable('LAST_CHAT_INPUT') || 'greeting'
        })
        
        await player.showText(response.text, { talkWith: this })
        
        // Update memory
        memory.interactions++
        memory.lastTopic = response.topic
        memory.relationship += response.sentiment
        this.saveMemory(player.id, memory)
        
        // Maybe offer dynamic quest
        if (response.offerQuest && memory.interactions > 2) {
            const quest = await generateQuest({
                giver: this.personality,
                playerLevel: player.level,
                theme: response.topic
            })
            await this.offerQuest(player, quest)
        }
    }
}
```

#### OpenAI Integration

```typescript
// modules/ai-npc/ai/openai.ts
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function generateNPCResponse(params: {
    personality: string
    playerName: string
    memory: NPCMemory
    context: string
    prompt: string
}) {
    const systemPrompt = `
You are an RPG NPC. Personality: ${params.personality}.
Player: ${params.playerName} (Interactions: ${params.memory.interactions}, Relationship: ${params.memory.relationship})
Context: ${params.context}

Respond in JSON:
{
    "text": "dialogue text (max 150 chars)",
    "topic": "conversation topic",
    "sentiment": 1, // -1 to 1
    "offerQuest": false
}
`.trim()

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: params.prompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 200
    })
    
    return JSON.parse(completion.choices[0].message.content!)
}

export async function generateQuest(params: {
    giver: string
    playerLevel: number
    theme: string
}) {
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
            role: 'system',
            content: `
Generate an RPG quest. Return JSON:
{
    "title": "quest name",
    "description": "what to do",
    "objectives": ["step 1", "step 2"],
    "rewardGold": 100,
    "rewardExp": 50,
    "difficulty": "easy"
}
Theme: ${params.theme}, Player Level: ${params.playerLevel}
`.trim()
        }],
        response_format: { type: 'json_object' }
    })
    
    return JSON.parse(completion.choices[0].message.content!)
}
```

### 2.2 Procedural Content Generation

```typescript
// modules/procedural-content/generators/dungeon.ts
import { generateWithAI } from '../ai/gemini'

export async function generateDungeon(params: {
    theme: string
    difficulty: number
    size: 'small' | 'medium' | 'large'
}) {
    const prompt = `
Generate a dungeon for an RPG. Theme: ${params.theme}, Difficulty: ${params.difficulty}/10.

Return Tiled-compatible JSON:
{
    "name": "dungeon name",
    "layers": [...],
    "tilesets": [...],
    "events": [
        { "type": "enemy", "x": 10, "y": 5, "enemyType": "goblin" }
    ],
    "loot": [...]
}
`.trim()

    const dungeon = await generateWithAI(prompt)
    
    // Save to Supabase Storage
    await supabase.storage
        .from('generated-maps')
        .upload(`dungeons/${Date.now()}.json`, JSON.stringify(dungeon))
    
    return dungeon
}
```

### 2.3 Smart Enemy AI

```typescript
// modules/smart-ai/enemies/tactical-enemy.ts
import { RpgEvent, EventData, RpgPlayer } from '@rpgjs/server'

interface AIState {
    health: number
    allies: string[]
    enemies: string[]
    lastAction: string
}

@EventData({ name: 'EV-TACTICAL-ORC' })
export default class TacticalOrcEvent extends RpgEvent {
    private ai: BehaviorTree
    
    onInit() {
        this.ai = new BehaviorTree([
            // Priority: Heal if low HP and has potion
            {
                condition: () => this.hp < 30 && this.hasItem('potion'),
                action: () => this.useItem('potion')
            },
            // Call for help if outnumbered
            {
                condition: () => this.isOutnumbered(),
                action: () => this.callForHelp()
            },
            // Attack weakest enemy
            {
                condition: () => true,
                action: () => this.attackWeakestEnemy()
            }
        ])
    }
    
    onBattleTick() {
        this.ai.evaluate()
    }
    
    private isOutnumbered(): boolean {
        const allies = this.getNearbyAllies(100)
        const enemies = this.getNearbyEnemies(100)
        return enemies.length > allies.length + 1
    }
    
    private attackWeakestEnemy() {
        const enemies = this.getNearbyEnemies(100)
        const weakest = enemies.sort((a, b) => a.hp - b.hp)[0]
        if (weakest) {
            this.useSkill('attack', weakest)
        }
    }
}
```

---

## 3. Developer Experience Improvements

### 3.1 Hot Module Reloading

```typescript
// @rpgjs/dev-tools

import { watch } from 'chokidar'
import { WebSocketServer } from 'ws'

export function enableHMR(server: any) {
    const wss = new WebSocketServer({ server })
    
    watch('./main/**/*.ts').on('change', (path) => {
        console.log(`[HMR] ${path} changed`)
        wss.clients.forEach(client => {
            client.send(JSON.stringify({
                type: 'hmr',
                module: path
            }))
        })
    })
}

// Client-side
if (import.meta.hot) {
    import.meta.hot.on('hmr', (data) => {
        if (data.module.includes('events/')) {
            // Reload events without full page refresh
            game.reloadEvents()
        }
    })
}
```

### 3.2 Visual Editor

```typescript
// @rpgjs/editor (Electron app)

import { BrowserWindow, app } from 'electron'
import { createServer } from 'vite'

async function createEditor() {
    const vite = await createServer({
        root: './editor-ui',
        server: { middlewareMode: true }
    })
    
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })
    
    // Load editor UI
    win.loadURL('http://localhost:5173/editor')
    
    // Watch game files
    const watcher = chokidar.watch('./main/**/*')
    watcher.on('change', () => {
        win.webContents.send('files-changed')
    })
}
```

### 3.3 Type-Safe Database

```typescript
// Using Drizzle ORM with Supabase

import { pgTable, uuid, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core'

export const players = pgTable('players', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => auth.users.id),
    name: text('name').notNull(),
    level: integer('level').default(1),
    stats: jsonb('stats').$type<{
        strength: number
        dexterity: number
        intelligence: number
    }>().default({ strength: 10, dexterity: 10, intelligence: 10 })
})

// Type-safe queries
const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
    with: {
        items: true,
        skills: true
    }
})
```

---

## 4. Implementation Roadmap

### Phase 1: Foundation (4-6 weeks)
- [ ] Create `@rpgjs/supabase` adapter package
- [ ] Design database schema
- [ ] Implement basic CRUD operations
- [ ] Migrate authentication to Supabase Auth
- [ ] Add real-time sync

### Phase 2: AI Features (3-4 weeks)
- [ ] Create `@rpgjs/ai` package with OpenAI/Gemini integration
- [ ] Build AI NPC system
- [ ] Implement procedural quest generation
- [ ] Add smart enemy AI

### Phase 3: DX Improvements (2-3 weeks)
- [ ] HMR for game modules
- [ ] Better error messages
- [ ] CLI scaffolding tools
- [ ] Visual event editor prototype

### Phase 4: Advanced Features (4-6 weeks)
- [ ] Procedural dungeon generation
- [ ] AI game master for MMORPG
- [ ] Automated testing tools
- [ ] Performance optimizations

---

## 5. Quick Wins (Can Implement Now)

### 5.1 Add AI to Existing NPCs

```typescript
// main/events/ai-enhanced-villager.ts
import { openai } from '../ai/client'

async onAction(player: RpgPlayer) {
    const context = `
Player: ${player.name}, Level ${player.level}
Gold: ${player.gold}
Known for: ${player.getVariable('REPUTATION') || 'unknown'}
    `.trim()
    
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
            role: 'system',
            content: `You are a wise village elder. Context: ${context}`
        }, {
            role: 'user',
            content: 'The player approaches you. What do you say?'
        }],
        max_tokens: 100
    })
    
    await player.showText(response.choices[0].message.content!)
}
```

### 5.2 Supabase Auth Integration

```typescript
// main/server.ts
import { createClient } from '@supabase/supabase-js'

export default {
    async auth(engine, socket) {
        const token = socket.handshake.auth.token
        
        const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_ANON_KEY!
        )
        
        const { data: { user }, error } = await supabase.auth.getUser(token)
        
        if (error || !user) {
            throw new Error('Invalid token')
        }
        
        return {
            id: user.id,
            email: user.email
        }
    }
}
```

### 5.3 Auto-Save to Supabase

```typescript
// main/player.ts
import { supabase } from '../supabase/client'

const player: RpgPlayerHooks = {
    onConnected(player) {
        // Load from Supabase
        supabase.from('players')
            .select('*')
            .eq('id', player.id)
            .single()
            .then(({ data }) => {
                if (data) player.load(data)
            })
    },
    
    // Auto-save every 30 seconds
    async onUpdate(player) {
        if (player.tick % 900 === 0) { // 30s at 30fps
            await supabase.from('players')
                .upsert(player.serialize())
        }
    }
}
```

---

## Conclusion

The modernization plan transforms RPG-JS from a self-hosted framework into a cloud-native, AI-enhanced game platform while maintaining backward compatibility.

**Key Benefits:**
- Zero server management with Supabase
- Persistent player data
- AI-driven dynamic content
- Better developer experience
- Scalable multiplayer

**Estimated Timeline:** 3-4 months for full implementation
