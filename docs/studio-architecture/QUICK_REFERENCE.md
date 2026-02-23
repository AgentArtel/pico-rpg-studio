# Studio Architecture Quick Reference

## The Big Picture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         YOUR GAME ECOSYSTEM                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  STUDIO (React/Vue)          GAME (RPG-JS)          DATABASE        │
│  ┌───────────────┐          ┌───────────────┐      ┌───────────┐   │
│  │ Content Editor│          │ Game Client   │      │ Supabase  │   │
│  │ - Create NPCs │◄────────►│ - Play Game   │◄────►│ PostgreSQL│   │
│  │ - Edit Quests │   API    │ - Load Content│      │ Realtime  │   │
│  │ - Schedule    │          │ - Send Actions│      │ Storage   │   │
│  │   Events      │          └───────────────┘      └───────────┘   │
│  └───────────────┘                                                  │
│         │                                                            │
│         │  PUBLISH                                                   │
│         ▼                                                            │
│  ┌───────────────┐     Updates pushed instantly to all players       │
│  │  SAVE TO DB   │                                                  │
│  └───────────────┘                                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Principle

**Content lives in the database, not in code files.**

### Before (Traditional)
```typescript
// events/shopkeeper.ts - Hardcoded
export default class Shopkeeper extends RpgEvent {
    onInit() {
        this.setGraphic('merchant')
    }
    onAction(player) {
        player.showText('Welcome!')
    }
}
```

### After (Decoupled)
```typescript
// Database table content_npcs
// {
//   npc_id: 'shopkeeper',
//   name: 'Shopkeeper',
//   sprite: 'merchant',
//   dialogue: 'Welcome!',
//   shop_enabled: true,
//   shop_items: ['sword', 'potion']
// }

// Game loads dynamically
const npc = await contentLoader.getNPC('shopkeeper')
// Use npc data to create event
```

---

## Three Main Components

### 1. Studio (Content Management)

**What it is:** React/Vue web app (your Agent Artel Studio)

**Who uses it:** Game designers, writers, community managers

**What they do:**
- Create NPCs with drag-drop interface
- Write quests with visual flow builder
- Schedule live events (double XP, etc.)
- Monitor player activity in real-time
- Edit dialogue without touching code

**Key features:**
```typescript
// Studio component example
function NPCEditor() {
    const [npc, setNPC] = useState({})
    
    const publish = async () => {
        await fetch('/api/content/npcs', {
            method: 'POST',
            body: JSON.stringify(npc)
        })
        // Game updates instantly!
    }
    
    return (
        <form>
            <input value={npc.name} />
            <textarea value={npc.dialogue} />
            <button onClick={publish}>Publish to Game</button>
        </form>
    )
}
```

---

### 2. Game (RPG-JS Client)

**What it is:** The actual game players interact with

**How it works:**
1. Loads all content from Supabase on startup
2. Subscribes to real-time updates
3. When Studio publishes changes, game updates immediately
4. Sends player actions back to database

**Key code:**
```typescript
// main/content-loader.ts
export class ContentLoader {
    async initialize() {
        // Load all published content
        const { data: npcs } = await supabase
            .from('content_npcs')
            .select('*')
            .eq('published', true)
        
        // Cache locally
        npcs.forEach(npc => this.cache.set(npc.npc_id, npc))
        
        // Listen for Studio updates
        supabase
            .channel('content_updates')
            .on('broadcast', { event: 'npc_updated' }, (payload) => {
                // Update cache and in-game NPC
                this.updateNPC(payload)
            })
    }
}
```

---

### 3. Database (Supabase)

**What it is:** PostgreSQL + Realtime + Auth + Storage

**Tables:**

| Table | Purpose | Managed By |
|-------|---------|------------|
| `content_npcs` | NPC definitions | Studio |
| `content_items` | Items/weapons | Studio |
| `content_quests` | Quest data | Studio |
| `content_maps` | Map configurations | Studio |
| `players` | Player save data | Game |
| `player_inventory` | Player items | Game |
| `analytics_events` | Game metrics | Game (writes) / Studio (reads) |

**Row Level Security:**
```sql
-- Designers can edit content
CREATE POLICY "Designers can edit content" ON content_npcs
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles WHERE role = 'designer'
        )
    );

-- Players can only read published content
CREATE POLICY "Players read published" ON content_npcs
    FOR SELECT USING (published = true);
```

---

## Data Flow Examples

### Example 1: Designer Creates New NPC

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  Studio  │      │   API    │      │ Database │      │   Game   │
└────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                 │                 │
     │ 1. Fill form    │                 │                 │
     │    Name: "Bob"  │                 │                 │
     │    Sprite: "orc"│                 │                 │
     ▼                 │                 │                 │
     │ 2. Click Save   │                 │                 │
     │────────────────►│                 │                 │
     │                 │ 3. INSERT INTO  │                 │
     │                 │    content_npcs │                 │
     │                 │────────────────►│                 │
     │                 │                 │ 4. Broadcast    │
     │                 │                 │    "new_npc"    │
     │                 │                 │────────────────►│
     │                 │                 │                 │ 5. Spawn
     │                 │                 │                 │    Bob in
     │                 │                 │                 │    game!
```

**Time from click to live: < 1 second**

---

### Example 2: Player Completes Quest

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  Player  │      │   Game   │      │ Database │      │  Studio  │
│  Action  │      │  Client  │      │          │      │ Dashboard│
└────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                 │                 │
     │ 1. Kill 5th     │                 │                 │
     │    slime        │                 │                 │
     │────────────────►│                 │                 │
     │                 │ 2. Check quest  │                 │
     │                 │    progress     │                 │
     │                 │                 │                 │
     │                 │ 3. INSERT INTO  │                 │
     │                 │    analytics    │                 │
     │                 │────────────────►│                 │
     │                 │                 │ 4. Broadcast    │
     │                 │                 │    to Studio    │
     │                 │                 │────────────────►│
     │                 │                 │                 │ 5. Show
     │                 │                 │                 │    "Quest
     │                 │                 │                 │    Completed"
     │                 │                 │                 │    in dashboard
```

---

## API Endpoints

### Studio → Database (Management)

```typescript
// Content Management
GET    /api/content/npcs          // List all NPCs
POST   /api/content/npcs          // Create new NPC
PUT    /api/content/npcs/:id      // Update NPC
DELETE /api/content/npcs/:id      // Delete NPC

GET    /api/content/items         // List items
POST   /api/content/items         // Create item

GET    /api/content/quests        // List quests
POST   /api/content/quests        // Create quest

// Analytics
GET    /api/analytics/overview    // Player stats
GET    /api/analytics/retention   // Retention metrics
POST   /api/analytics/query       // Custom queries

// Live Events
GET    /api/events                // List events
POST   /api/events                // Create event
PUT    /api/events/:id/activate   // Activate event now
```

### Game → Database (Runtime)

```typescript
// Player Actions (via Supabase client)
await supabase.from('players').upsert(playerData)
await supabase.from('player_inventory').insert(item)
await supabase.from('player_quests').update(questProgress)

// Real-time subscriptions
supabase.channel('content_updates').subscribe()
supabase.channel('live_events').subscribe()
```

---

## Database Schema (Simplified)

```sql
-- Studio manages this
CREATE TABLE content_npcs (
    id UUID PRIMARY KEY,
    npc_id TEXT UNIQUE,        -- 'village_elder'
    name TEXT,
    sprite TEXT,               -- 'wizard'
    dialogue TEXT,
    ai_enabled BOOLEAN,
    ai_personality TEXT,
    shop_enabled BOOLEAN,
    shop_items JSONB,          -- ['item_001', 'item_002']
    published BOOLEAN,         -- Only published shows in game
    created_at TIMESTAMP
);

-- Game uses this
CREATE TABLE players (
    id UUID PRIMARY KEY,
    user_id UUID,              -- From Supabase Auth
    name TEXT,
    level INTEGER,
    exp INTEGER,
    position_x INTEGER,
    position_y INTEGER,
    map_id TEXT,
    hp INTEGER,
    mp INTEGER,
    gold INTEGER,
    last_login TIMESTAMP
);

-- Game writes, Studio reads
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY,
    player_id UUID,
    event_type TEXT,           -- 'quest_complete', 'death', 'purchase'
    event_data JSONB,          -- { quest_id: 'q001', reward: 100 }
    created_at TIMESTAMP
);
```

---

## Role-Based Access

| Role | Studio | Game | Database Access |
|------|--------|------|-----------------|
| **Designer** | Full access | Read-only test | Write content_* tables |
| **Player** | No access | Full gameplay | Read content_*, Write players |
| **Admin** | Full access | No access | All tables |
| **Community Manager** | Live events only | No access | Write live_events |

---

## Common Workflows

### Workflow: Create Quest

1. **Designer** opens Studio → Quest Builder
2. Clicks "New Quest"
3. Fills in:
   - Title: "Find the Lost Sword"
   - Objectives: ["Find sword", "Return to elder"]
   - Rewards: 100 gold, 50 XP
4. Clicks "Save Draft"
5. **Tester** plays game, verifies quest works
6. **Designer** clicks "Publish to Game"
7. **Players** can now accept quest immediately

### Workflow: Hotfix Broken Shop

1. **Player** reports: "Shop sells wrong item"
2. **Developer** opens Studio → NPC Editor
3. Finds shopkeeper NPC
4. Changes `shop_items` from `['sword']` to `['sword', 'potion']`
5. Clicks "Publish"
6. **Game** updates instantly
7. **Players** see correct items without app update

### Workflow: Live Event

1. **Community Manager** opens Studio → Events
2. Creates "Double XP Weekend"
3. Sets: 2x XP, 1.5x gold, active Fri 6PM - Sun 11:59PM
4. Schedules event
5. **Friday 6PM:** Event auto-activates
6. **Game** shows banner: "Double XP Active!"
7. **Studio** dashboard shows player engagement spike

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| **Studio Frontend** | React/Vue + Tailwind |
| **Studio Backend** | Supabase Edge Functions |
| **Game Client** | RPG-JS (PixiJS + Vue) |
| **Database** | PostgreSQL (Supabase) |
| **Real-time** | Supabase Realtime |
| **Auth** | Supabase Auth |
| **Storage** | Supabase Storage |
| **AI** | OpenAI GPT-4o-mini |

---

## File Structure

```
project/
├── studio/                    # Agent Artel Studio
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── NPCEditor.tsx
│   │   │   ├── QuestBuilder.tsx
│   │   │   └── Dashboard.tsx
│   │   ├── api/              # API clients
│   │   └── supabase/         # Supabase client
│   └── package.json
│
├── game/                      # RPG-JS Game
│   ├── main/
│   │   ├── content-loader.ts # Loads from Supabase
│   │   ├── events/
│   │   │   └── dynamic-npc.ts
│   │   └── supabase/         # Supabase client
│   └── package.json
│
└── supabase/                  # Database
    ├── migrations/
    │   ├── 001_content_tables.sql
    │   └── 002_player_tables.sql
    └── functions/
        ├── content-api/       # REST API
        └── ai-dialogue/       # AI generation
```

---

## Getting Started (Minimal Setup)

### Step 1: Database (5 min)
```sql
-- In Supabase SQL Editor
CREATE TABLE content_npcs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    npc_id TEXT UNIQUE,
    name TEXT,
    sprite TEXT DEFAULT 'male',
    dialogue TEXT,
    published BOOLEAN DEFAULT false
);

-- Add test NPC
INSERT INTO content_npcs (npc_id, name, dialogue, published)
VALUES ('test_npc', 'Test NPC', 'Hello from Studio!', true);
```

### Step 2: Game (10 min)
```typescript
// main/content-loader.ts
export async function loadContent() {
    const { data } = await supabase
        .from('content_npcs')
        .select('*')
        .eq('published', true)
    
    return data
}

// main/events/dynamic-npc.ts
export default class DynamicNPC extends RpgEvent {
    async onInit() {
        const npcs = await loadContent()
        const config = npcs.find(n => n.npc_id === 'test_npc')
        
        if (config) {
            this.setGraphic(config.sprite)
        }
    }
    
    async onAction(player: RpgPlayer) {
        const npcs = await loadContent()
        const config = npcs.find(n => n.npc_id === 'test_npc')
        
        if (config) {
            await player.showText(config.dialogue)
        }
    }
}
```

### Step 3: Studio (10 min)
```typescript
// Studio component
export function ContentEditor() {
    const [npcs, setNPCs] = useState([])
    const [editing, setEditing] = useState({})
    
    useEffect(() => {
        fetch('/api/content/npcs')
            .then(r => r.json())
            .then(setNPCs)
    }, [])
    
    const save = async () => {
        await fetch('/api/content/npcs', {
            method: 'POST',
            body: JSON.stringify(editing)
        })
        alert('Published to game!')
    }
    
    return (
        <div>
            {npcs.map(npc => (
                <div key={npc.id}>
                    <input 
                        value={editing.dialogue || npc.dialogue}
                        onChange={e => setEditing({...editing, dialogue: e.target.value})}
                    />
                    <button onClick={save}>Publish</button>
                </div>
            ))}
        </div>
    )
}
```

---

## Next Steps

1. **Read full architecture:** `DECOUPLED_STUDIO_DESIGN.md`
2. **Set up Supabase project**
3. **Create first content table**
4. **Build minimal Studio UI**
5. **Connect Game to load from API**
6. **Add real-time updates**

---

## Key Benefits

| For | Benefit |
|-----|---------|
| **Developers** | No deploys for content changes |
| **Designers** | Visual tools, iterate instantly |
| **Players** | Fresh content, live events |
| **Business** | Faster updates, lower costs |

---

**Questions?** See the full architecture document for detailed code examples!
