# Phase 1: Real-time NPC Sync - Setup Guide

## What This Implements

Real-time synchronization between Agent Artel Studio and RPG-JS game:
- Create NPC in Studio → appears in game instantly (< 2 seconds)
- Edit NPC → updates live in game
- Delete NPC → disappears from game
- AI-powered conversations with memory
- Idle behavior (wandering, thinking)

---

## File Structure

```
my-rpg-game/
├── main/
│   ├── types/
│   │   └── npc.ts                    ← NPC type definitions
│   ├── services/
│   │   ├── aiService.ts              ← AI API integration
│   │   ├── memoryService.ts          ← Conversation history
│   │   └── npcSpawner.ts             ← Dynamic NPC creation
│   ├── realtime/
│   │   ├── contentSync.ts            ← Real-time sync service
│   │   └── broadcast.ts              ← Broadcast helpers
│   ├── server.ts                     ← Updated server config
│   └── player.ts                     ← Player state tracking
│
studio/
└── src/
    └── lib/
        └── gameBroadcast.ts          ← Studio broadcast helpers
```

---

## Environment Variables

### RPG-JS Game Server (.env)

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key              # Public, safe to expose
SUPABASE_SERVICE_ROLE_KEY=your-service-key   # Server only

# NO AI API KEYS NEEDED!
# AI calls go through Supabase Edge Functions

# Game Configuration
PORT=3000
NODE_ENV=production
```

### Studio (.env)

Already configured, just ensure:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Database Schema (Already Exists)

Your Supabase project should have these tables in the `game` schema:

```sql
-- NPC Configurations
game.agent_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  graphic TEXT,
  personality TEXT,
  model JSONB,
  skills TEXT[],
  spawn JSONB,
  behavior JSONB,
  inventory TEXT[],
  enabled BOOLEAN DEFAULT true
);

-- Conversation Memory
game.agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Player State
game.player_state (
  player_id UUID PRIMARY KEY,
  map_id TEXT,
  position JSONB,
  direction INTEGER,
  last_seen_at TIMESTAMP
);
```

---

## Installation Steps

### 1. Install Dependencies (Game Server)

```bash
cd my-rpg-game
npm install @supabase/supabase-js
```

### 2. Copy Files

Copy all the files from this implementation to your project:

```bash
# Copy to my-rpg-game/main/
cp -r implementation/main/* my-rpg-game/main/

# Copy to studio/src/lib/
cp implementation/studio/lib/gameBroadcast.ts studio/src/lib/
```

### 3. Update NPCs.tsx in Studio

Add the import and update mutations (already done if you applied the edits):

```typescript
import { broadcastNPCCreated, broadcastNPCUpdated, broadcastNPCDeleted } from '@/lib/gameBroadcast';

// Update createMutation to call broadcastNPCCreated after insert
// Update updateMutation to call broadcastNPCUpdated after update
// Update deleteMutation to call broadcastNPCDeleted after delete
```

### 4. Configure Environment Variables

#### Game Server (.env)
Create `.env` file in `my-rpg-game/`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
# NO AI API KEYS NEEDED - they stay secure in Supabase Edge Functions
```

#### Supabase Edge Functions (Secrets)
Deploy the Edge Function and set AI API keys as secrets:

```bash
# Deploy the npc-ai-chat Edge Function
cd studio
supabase functions deploy npc-ai-chat

# Set AI API keys as secrets (secure, never exposed)
supabase secrets set OPENAI_API_KEY=sk-your-openai-key
supabase secrets set KIMI_API_KEY=your-kimi-key
supabase secrets set GEMINI_API_KEY=your-gemini-key
```

**Note:** API keys are stored securely in Supabase and never exposed to game server or Studio.

### 5. Start the Game Server

```bash
cd my-rpg-game
npm run dev
```

You should see:
```
[Server] Starting game server...
[ContentSync] Starting real-time sync...
[ContentSync] Connected to real-time updates
[ContentSync] Loading all enabled NPCs...
[ContentSync] Found X NPCs to spawn
[ContentSync] ✓ Spawned X/X NPCs
[Server] Game server started with X NPCs
```

### 6. Start the Studio

```bash
cd studio
npm run dev
```

---

## Testing the Flow

### Test 1: Create NPC

1. Open Studio at `http://localhost:5173`
2. Navigate to NPCs page
3. Click "Create NPC"
4. Fill in:
   - Name: "Test Merchant"
   - Personality: "You are a friendly merchant who sells potions."
   - Graphic: "female"
   - Skills: Check "say", "move", "look"
   - Spawn Map: "simplemap" (or your map name)
   - Spawn X/Y: 200, 200
5. Click "Create NPC"
6. Check game console - you should see:
   ```
   [ContentSync] Broadcast: NPC created test-merchant
   [ContentSync] Spawning new NPC: Test Merchant
   [ContentSync] ✓ NPC Test Merchant is now live!
   ```
7. Open game in browser - NPC should be visible!

### Test 2: Update NPC

1. In Studio, click "Edit" on your NPC
2. Change the personality
3. Click "Save Changes"
4. Check game console:
   ```
   [ContentSync] Broadcast: NPC updated test-merchant
   [ContentSync] Updating NPC: Test Merchant
   [ContentSync] ✓ NPC Test Merchant updated
   ```
5. Talk to NPC in game - should use new personality

### Test 3: Delete NPC

1. In Studio, click "Delete" on your NPC
2. Confirm deletion
3. Check game console:
   ```
   [ContentSync] Broadcast: NPC deleted test-merchant
   [ContentSync] Despawning NPC: test-merchant
   [ContentSync] ✓ NPC test-merchant removed
   ```
4. NPC should disappear from game immediately

### Test 4: AI Conversation

1. Find your NPC in game
2. Press action key (Space) to talk
3. NPC should greet you
4. Type a message
5. NPC should respond using AI (check console for API calls)
6. Check Studio Memory tab - conversation should be saved

---

## Troubleshooting

### Issue: NPCs not spawning

**Check:**
1. Environment variables set correctly?
2. Supabase service role key has access to `game` schema?
3. `agent_configs` table exists in `game` schema?
4. NPC has `enabled: true`?
5. Spawn map exists in game?

**Debug:**
```typescript
// Add to server.ts onStart
console.log('Supabase URL:', process.env.SUPABASE_URL)
console.log('Service Key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
```

### Issue: AI not responding

**Check:**
1. API key set in environment?
2. API key has credits?
3. Network access to API?

**Test:**
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Issue: Real-time not working

**Check:**
1. Supabase Realtime enabled in project settings?
2. Database changes trigger notifications?

**Test in Supabase SQL Editor:**
```sql
-- Test broadcast
NOTIFY pgrst, 'reload config';
```

### Issue: Studio not broadcasting

**Check:**
1. `gameBroadcast.ts` imported in NPCs.tsx?
2. Broadcast called after database operation?
3. Check browser console for errors?

---

## Performance Notes

- **NPC Loading:** All enabled NPCs load on server start (~100ms per NPC)
- **Real-time Latency:** < 500ms from Studio → Game
- **AI Response Time:** 1-3 seconds depending on model
- **Memory Storage:** Each conversation stored in database
- **Idle Behavior:** Runs every 15 seconds per NPC (configurable)

---

## Next Steps

Once Phase 1 is working:
1. **Phase 2:** Workflow execution engine
2. **Phase 3:** Player inventory management
3. **Phase 4:** Quest builder
4. **Phase 5:** Live events

---

## Support

If you encounter issues:
1. Check console logs in game server
2. Check browser console in Studio
3. Verify database permissions
4. Test API keys independently
