# Phase 1 Database Setup - Final Instructions

## Current Status

✅ **Game Server Code**: Ready with Supabase integration  
✅ **Environment Variables**: Configured  
✅ **Real-time Sync**: Implemented  
⏳ **Database Tables**: Need to be created in Supabase

## Step 1: Create Tables in Supabase

### Option A: Via Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard
2. Select project: `ktxdbeamrxhjtdattwts`
3. Navigate to **SQL Editor** → **New Query**
4. Copy and paste the entire contents of `APPLY_TO_SUPABASE.sql`
5. Click **Run**

### Option B: Via Supabase CLI

```bash
# Link to the correct project
cd /Users/artelio/Desktop/kimi-rpg/my-rpg-game
npx supabase link --project-ref ktxdbeamrxhjtdattwts

# Push migrations
npx supabase db push
```

## Step 2: Verify Tables Exist

After running the SQL, verify in Supabase Dashboard:
- **Table Editor** should show:
  - `agent_configs`
  - `agent_memory`  
  - `player_state`
  - `npc_instances`
  - `sync_status`

## Step 3: Test Game Server

```bash
cd /Users/artelio/Desktop/kimi-rpg/my-rpg-game
npm run dev
```

Expected output:
```
[ContentSync] Loading all enabled NPCs...
[ContentSync] Loaded 2/2 NPCs
✓ Elara live
✓ Town Guard live
```

## Step 4: Test Real-time Sync

1. Open Studio at http://localhost:5173 (or deployed URL)
2. Create a new NPC with:
   - Name: "Test NPC"
   - Prompt: "You are a friendly test NPC"
   - Map: main
   - Position: x=300, y=300
3. Click **Save**
4. Within 2 seconds, the NPC should appear in the game!

## Architecture Summary

```
┌──────────────┐     WebSocket      ┌──────────────┐
│   Studio     │◄──────────────────►│   Supabase   │
│  (React)     │    Realtime        │   (DB)       │
└──────────────┘                    └──────┬───────┘
                                           │
                                    ┌──────┴───────┐
                                    │  Broadcast   │
                                    │   Channel    │
                                    └──────┬───────┘
                                           │
┌──────────────┐                    ┌──────▼───────┐
│   RPG-JS     │◄──────────────────►│   Supabase   │
│  Game Server │   Realtime Sub     │   Realtime   │
└──────────────┘                    └──────────────┘
```

## Troubleshooting

### Error: "Could not find the table"
- Tables not created yet → Run APPLY_TO_SUPABASE.sql
- Wrong project → Check SUPABASE_URL in .env

### Error: "Invalid schema"
- Fixed: Code now uses `public` schema (not `game`)

### NPCs not spawning
- Check `is_enabled = true` in agent_configs
- Check spawn_config mapId matches a valid map
- Check browser console for errors

## Next Steps (Phase 2)

Once this is working:
1. Add AI chat integration via Edge Function
2. Add token-based skill system
3. Add memory persistence
4. Deploy to production
