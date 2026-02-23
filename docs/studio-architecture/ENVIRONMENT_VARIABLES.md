# Environment Variables Guide
## Decoupled Architecture (Secure API Keys)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         API KEY SECURITY MODEL                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  RPG-JS GAME SERVER          SUPABASE EDGE FUNCTIONS         AI APIs    │
│  (No API keys needed)        (API keys stored securely)      (OpenAI,  │
│                               ┌──────────────────┐           Gemini,   │
│  SUPABASE_ANON_KEY ────────►  │ npc-ai-chat      │  ──────►  Kimi)     │
│  (public, safe)               │ gemini-chat      │                     │
│                               │ kimi-chat        │                     │
│                               │ generate-image   │                     │
│                               └──────────────────┘                     │
│                                                                          │
│  API Keys: NONE               API Keys: OPENAI_API_KEY                 │
│                               GEMINI_API_KEY                            │
│                               KIMI_API_KEY                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Principle:** Game server NEVER holds API keys. All AI calls go through Supabase Edge Functions.

---

## Required Environment Variables

### RPG-JS Game Server (.env)

```bash
# Supabase Configuration (Public + Service Role)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...        # Safe to expose
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs... # Server only

# NO AI API KEYS NEEDED HERE!
# The game calls Supabase Edge Functions which handle AI APIs
```

**Note:** `SUPABASE_ANON_KEY` is public-safe. Service role key should only be on server.

---

### Supabase Edge Functions (Secrets)

Set these in Supabase Dashboard → Project Settings → Edge Functions Secrets:

```bash
# AI API Keys (Secure - never exposed to client)
OPENAI_API_KEY=sk-...
KIMI_API_KEY=...
GEMINI_API_KEY=...

# Supabase Service Key (for Edge Functions to access DB)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

**How to set:**
```bash
supabase secrets set OPENAI_API_KEY=sk-your-key
supabase secrets set KIMI_API_KEY=your-kimi-key
supabase secrets set GEMINI_API_KEY=your-gemini-key
```

---

### Studio React App (.env)

```bash
# Supabase Configuration (Public)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...  # Safe, public key

# NO AI API KEYS HERE!
# Studio also calls Edge Functions for AI
```

---

## Where AI Calls Happen

### Before (Direct API Calls - BAD)
```
Game Server → OpenAI API (needs OPENAI_API_KEY in .env)
```

### After (Edge Function Proxy - GOOD)
```
Game Server → Supabase Edge Function → OpenAI API
  (anon key)     (has OPENAI_API_KEY secret)
```

---

## Setup Checklist

### 1. Supabase Project

- [ ] Create Supabase project
- [ ] Enable Realtime (Database → Replication)
- [ ] Create `game` schema
- [ ] Run migrations for `agent_configs`, `agent_memory`, `player_state`

### 2. Edge Functions

- [ ] Deploy `npc-ai-chat` Edge Function
- [ ] Set secrets: `OPENAI_API_KEY`, `KIMI_API_KEY`, `GEMINI_API_KEY`
- [ ] Test Edge Function directly:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/npc-ai-chat \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "npcId": "test",
    "playerId": "test",
    "playerName": "Test",
    "message": "Hello!",
    "config": {
      "name": "Test NPC",
      "personality": "You are friendly.",
      "model": {"conversation": "gpt-4o-mini"},
      "skills": ["say"]
    },
    "history": []
  }'
```

### 3. Game Server

- [ ] Set `SUPABASE_URL` (same as Studio)
- [ ] Set `SUPABASE_ANON_KEY` (public key)
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` (server only)
- [ ] NO AI API KEYS needed

### 4. Studio

- [ ] Set `VITE_SUPABASE_URL`
- [ ] Set `VITE_SUPABASE_ANON_KEY`
- [ ] NO AI API KEYS needed

---

## Security Benefits

| Approach | API Key Location | Risk |
|----------|-----------------|------|
| **Direct** (Bad) | Game server .env | Key exposed if server compromised |
| **Edge Function** (Good) | Supabase secrets | Key never leaves Supabase |

**Additional benefits:**
- Rotate API keys in one place (Supabase)
- Rate limiting at Supabase level
- Audit logs for AI usage
- Can change AI provider without updating game

---

## Testing

### Test Edge Function
```bash
# Get anon key from Supabase Dashboard → API
ANON_KEY="your-anon-key"

# Test AI chat
curl -X POST https://your-project.supabase.co/functions/v1/npc-ai-chat \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "npcId": "merchant",
    "playerId": "player123",
    "playerName": "Alice",
    "message": "What do you sell?",
    "config": {
      "name": "Merchant",
      "personality": "You are a friendly shopkeeper.",
      "model": {"conversation": "gpt-4o-mini"},
      "skills": ["say"]
    },
    "history": []
  }'
```

**Expected response:**
```json
{
  "text": "I sell potions and weapons! Would you like to see my wares?",
  "tokens": { "prompt": 50, "completion": 20, "total": 70 }
}
```

---

## Troubleshooting

### Issue: "OPENAI_API_KEY not configured"
**Fix:** Set the secret in Supabase:
```bash
supabase secrets set OPENAI_API_KEY=sk-your-key
```

### Issue: "Edge Function not found"
**Fix:** Deploy the Edge Function:
```bash
cd studio
supabase functions deploy npc-ai-chat
```

### Issue: "Authorization failed"
**Fix:** Check that you're using the ANON key (not service role) from client

### Issue: "CORS error"
**Fix:** Edge Function has CORS headers configured - check the function code

---

## Summary

| Component | Needs API Keys? | Keys Needed |
|-----------|----------------|-------------|
| **Game Server** | ❌ NO | Just Supabase URL + keys |
| **Studio** | ❌ NO | Just Supabase URL + anon key |
| **Supabase Edge Functions** | ✅ YES | OPENAI_API_KEY, KIMI_API_KEY, GEMINI_API_KEY |

**All AI calls flow through Supabase Edge Functions, keeping API keys secure!**
