# Handoff Packet: [Title]

> **Status:** Research in progress | Research complete. Ready for implementation. | In progress | Implemented | Parked | Superseded
> **Created:** YYYY-MM-DD
> **Context:** One sentence on what prompted this idea and where it fits in the bigger picture.

---

## 1. The Idea

A clear, concise description of what this is. Two to three sentences max. A developer should read this and immediately know what they're building.

---

## 2. Why This Matters

What problem does this solve? What does it unlock? Why now instead of later? Bullet points.

- ...
- ...

---

## 3. Architecture

ASCII diagram showing the data/control flow. Every system involved, every arrow labeled.

```
Component A
    │
    ▼
Component B → Component C
    │
    ▼
Component D
```

---

## 4. How It Works Today (Before)

Describe the current behavior. Reference exact file paths and line numbers. Read the files — don't guess.

If this is a greenfield idea with no "before," write "N/A — new feature" and briefly describe what exists in the area.

---

## 5. How It Should Work (After)

Step-by-step flow of the new behavior. Be specific about:
- What triggers the flow
- What calls what
- What data is passed at each step
- What the end result looks like to the user/player

---

## 6. API / Data Contracts

Define the exact shapes of data exchanged between systems. This is the most critical section.

### Request

```json
{
  "field": "type — description"
}
```

### Response (Success)

```json
{
  "field": "type — description"
}
```

### Response (Error)

```json
{
  "field": "type — description"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| ... | ... | ... | ... |

---

## 7. Implementation Plan

Numbered steps. For each step:
- What file(s) to create or modify (full paths)
- What the code does (pseudocode or concrete samples)
- Any dependencies on previous steps

### Step 1: ...

Location: `path/to/file.ts`

```typescript
// Pseudocode or concrete implementation
```

### Step 2: ...

...

### Step N: Environment / Config Changes

```env
NEW_VAR=description
```

---

## 8. Database Changes

Any new tables, columns, or migrations. Include the full SQL.

```sql
CREATE TABLE IF NOT EXISTS ...
```

If no database changes: "N/A — no schema changes."

---

## 9. What Changes in Existing Code

| File | Change | Breaking? |
|------|--------|-----------|
| `path/to/file.ts` | Description of change | Yes/No |

---

## 10. What Stays the Same

Explicitly list what is NOT changing. This prevents scope creep and reassures the implementer.

- ...
- ...

---

## 11. Gotchas and Edge Cases

Known bugs, version-specific quirks, timing issues, failure modes. If you skip this section, the implementer will find them the hard way.

### Gotcha Name
Description. How to work around it.

---

## 12. Sources

### Official Documentation
- [Name](URL)

### Community / Forums
- [Name](URL)

### GitHub Issues
- [Name](URL)

### Codebase References
- `path/to/file.ts` — what was referenced and why

---

## 13. Open Questions

Numbered list of things that are unresolved. The implementer should review these before starting.

1. **Question?** Context on why it matters and what the options are.
2. ...
