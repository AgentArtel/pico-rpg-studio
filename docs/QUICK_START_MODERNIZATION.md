# Quick Start: Modernizing RPG-JS

## 🚀 Three Immediate Improvements You Can Make Today

---

## 1. Add AI-Powered NPC (5 minutes)

### Step 1: Install OpenAI
```bash
cd my-rpg-game
npm install openai
```

### Step 2: Create AI Client
```typescript
// main/ai/client.ts
import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY // Add to .env
})

export async function generateDialogue(params: {
    npcPersonality: string
    playerName: string
    context?: string
}) {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Very cheap!
        messages: [
            {
                role: 'system',
                content: `You are an RPG NPC. Personality: ${params.npcPersonality}. 
Keep responses under 150 characters. Be immersive and contextual.`
            },
            {
                role: 'user',
                content: `Player ${params.playerName} approaches. ${params.context || ''}`
            }
        ],
        max_tokens: 60
    })
    
    return response.choices[0].message.content
}
```

### Step 3: Create AI NPC
```typescript
// main/events/ai-wizard.ts
import { RpgEvent, EventData, RpgPlayer } from '@rpgjs/server'
import { generateDialogue } from '../ai/client'

@EventData({
    name: 'EV-AI-WIZARD',
    hitbox: { width: 32, height: 16 }
})
export default class AIWizardEvent extends RpgEvent {
    private personality = 'wise mysterious wizard who speaks in riddles'
    
    onInit() {
        this.setGraphic('wizard')
    }
    
    async onAction(player: RpgPlayer) {
        // Generate contextual dialogue
        const dialogue = await generateDialogue({
            npcPersonality: this.personality,
            playerName: player.name,
            context: player.getVariable('MET_WIZARD') 
                ? 'The player has met you before.' 
                : 'First meeting.'
        })
        
        await player.showText(dialogue!, { talkWith: this })
        
        // Remember interaction
        player.setVariable('MET_WIZARD', true)
    }
}
```

### Cost
- ~$0.001 per dialogue
- 1000 player interactions = $1

---

## 2. Add Supabase Auth (15 minutes)

### Step 1: Create Supabase Project
1. Go to https://supabase.com
2. Create new project
3. Get URL and anon key from Settings > API

### Step 2: Install SDK
```bash
npm install @supabase/supabase-js
```

### Step 3: Update Server
```typescript
// main/server.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default {
    async auth(engine, socket) {
        try {
            const token = socket.handshake.auth.token
            
            const { data: { user }, error } = await supabase
                .auth
                .getUser(token)
            
            if (error || !user) {
                console.log('Auth failed:', error)
                return null
            }
            
            console.log(`Player authenticated: ${user.email}`)
            
            return {
                id: user.id,
                email: user.email,
                name: user.user_metadata.name || 'Adventurer'
            }
        } catch (err) {
            console.error('Auth error:', err)
            return null
        }
    }
}
```

### Step 4: Update Player Hook
```typescript
// main/player.ts
const player: RpgPlayerHooks = {
    onConnected(player) {
        // Use authenticated user data
        player.name = player.name || 'Adventurer'
        console.log(`Welcome, ${player.name}!`)
    }
}
```

### Step 5: Add Environment Variables
```bash
# .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
OPENAI_API_KEY=sk-your-openai-key
```

---

## 3. Add Persistent Player Data (20 minutes)

### Step 1: Create Database Table
```sql
-- In Supabase SQL Editor
CREATE TABLE player_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Basic info
    name TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    
    -- Position
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    map_id TEXT DEFAULT 'spawn',
    
    -- Stats
    hp INTEGER DEFAULT 100,
    max_hp INTEGER DEFAULT 100,
    mp INTEGER DEFAULT 50,
    max_mp INTEGER DEFAULT 50,
    gold INTEGER DEFAULT 0,
    
    -- Attributes
    strength INTEGER DEFAULT 10,
    dexterity INTEGER DEFAULT 10,
    intelligence INTEGER DEFAULT 10,
    agility INTEGER DEFAULT 10,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE player_data ENABLE ROW LEVEL SECURITY;

-- Players can only access their own data
CREATE POLICY "Own data only" ON player_data
    FOR ALL USING (auth.uid() = user_id);
```

### Step 2: Create Database Types
```typescript
// main/supabase/database.types.ts
export interface PlayerData {
    id: string
    user_id: string
    name: string
    level: number
    exp: number
    position_x: number
    position_y: number
    map_id: string
    hp: number
    max_hp: number
    mp: number
    max_mp: number
    gold: number
    strength: number
    dexterity: number
    intelligence: number
    agility: number
    created_at: string
    updated_at: string
}
```

### Step 3: Create Save/Load Functions
```typescript
// main/supabase/player-storage.ts
import { supabase } from './client'
import { RpgPlayer } from '@rpgjs/server'

export async function loadPlayerData(userId: string): Promise<PlayerData | null> {
    const { data, error } = await supabase
        .from('player_data')
        .select('*')
        .eq('user_id', userId)
        .single()
    
    if (error) {
        console.log('No existing data, creating new player')
        return null
    }
    
    return data
}

export async function savePlayerData(player: RpgPlayer) {
    const data = {
        user_id: player.id,
        name: player.name,
        level: player.level,
        exp: player.exp,
        position_x: player.position.x,
        position_y: player.position.y,
        map_id: player.getCurrentMap()?.id || 'spawn',
        hp: player.hp,
        max_hp: player.maxHp,
        mp: player.sp,
        max_mp: player.param.maxSp,
        gold: player.gold,
        strength: player.param.str,
        dexterity: player.param.dex,
        intelligence: player.param.int,
        agility: player.param.agi,
        updated_at: new Date().toISOString()
    }
    
    const { error } = await supabase
        .from('player_data')
        .upsert(data, { onConflict: 'user_id' })
    
    if (error) {
        console.error('Failed to save player:', error)
    } else {
        console.log(`Saved player ${player.name}`)
    }
}
```

### Step 4: Update Player Hook
```typescript
// main/player.ts
import { loadPlayerData, savePlayerData } from './supabase/player-storage'

const player: RpgPlayerHooks = {
    async onConnected(player) {
        // Load saved data
        const data = await loadPlayerData(player.id)
        
        if (data) {
            // Restore position
            player.position.x = data.position_x
            player.position.y = data.position_y
            
            // Restore stats
            player.level = data.level
            player.exp = data.exp
            player.hp = data.hp
            player.sp = data.mp
            player.gold = data.gold
            
            console.log(`Welcome back, ${data.name}!`)
        } else {
            // New player
            player.name = player.name || 'Adventurer'
            console.log(`Welcome, ${player.name}!`)
        }
    },
    
    // Auto-save every 30 seconds
    async onUpdate(player) {
        if (player.tick % 900 === 0) { // 30s at 30fps
            await savePlayerData(player)
        }
    },
    
    // Save on disconnect
    async onDisconnected(player) {
        await savePlayerData(player)
        console.log(`Goodbye, ${player.name}!`)
    }
}

export default player
```

---

## 🎉 Result

After these 3 improvements, your game has:

| Feature | Before | After |
|---------|--------|-------|
| **NPCs** | Static dialogue | AI-generated contextual responses |
| **Auth** | None or custom | Secure OAuth + email |
| **Persistence** | In-memory only | PostgreSQL with auto-save |
| **Hosting** | Self-managed | Cloud (Supabase) |

---

## 📁 Files Created

```
my-rpg-game/
├── main/
│   ├── ai/
│   │   └── client.ts          # OpenAI integration
│   ├── events/
│   │   └── ai-wizard.ts       # AI NPC example
│   ├── supabase/
│   │   ├── client.ts          # Supabase client
│   │   ├── database.types.ts  # TypeScript types
│   │   └── player-storage.ts  # Save/load functions
│   ├── server.ts              # Updated with auth
│   └── player.ts              # Updated with persistence
└── .env                       # Environment variables
```

---

## 🚀 Next Steps

1. **Test locally** - Make sure everything works
2. **Deploy to Vercel/Netlify** - Free hosting for client
3. **Use Supabase free tier** - 500MB database, 50K users
4. **Add more AI NPCs** - Each costs ~$0.001/interaction
5. **Add more persistence** - Inventory, quests, etc.

---

## 💡 Pro Tips

1. **Cache AI responses** - Save common responses to reduce API costs
2. **Batch saves** - Don't save every frame, use debouncing
3. **Use RLS** - Always enable Row Level Security
4. **Monitor usage** - Set up alerts for API quotas

---

**Questions?** Check `docs/RPGJS_MODERNIZATION_PLAN.md` for the full architecture.
