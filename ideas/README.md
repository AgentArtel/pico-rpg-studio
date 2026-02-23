# Ideas

This folder contains researched, self-contained handoff packets for features and architectural changes. Each idea should be thorough enough that any developer can pick it up and implement it without needing to ask follow-up questions about the approach.

---

## Rules

### Research Standards

1. **Ground everything in official documentation.** If you reference an API, link to the official docs page. If you claim a feature exists, prove it with a doc link or a verified code reference. No "I think it works like this."

2. **Read files completely before citing them.** If you reference a source file, config, or doc — read the entire file first. Do not skim the first 20 lines and assume the rest. Partial reads lead to wrong conclusions that waste implementation time.

3. **Verify claims against the actual codebase.** Before writing "this function does X," read the function. Before writing "this table has column Y," check the schema. Before writing "this endpoint returns Z," read the handler code or test it.

4. **Distinguish between confirmed facts and assumptions.** If something is verified, state it plainly. If something is an assumption or best guess, mark it explicitly — e.g., "**Assumption:** the Set node v2 uses the `assignments` structure (verify against your n8n version)."

5. **Include version context.** APIs change. If your research applies to a specific version of a tool (n8n v1.119+, RPG-JS v4.3.0, Supabase JS v2.95), say so. Flag known version-specific bugs or breaking changes.

6. **Link all sources.** Every claim backed by external research must have a link. Group sources into: Official Docs, Community/Forums, GitHub Issues. A handoff with no sources section is incomplete.

### Writing Standards

7. **One idea per file.** Don't bundle multiple unrelated ideas. If ideas are related, link between them.

8. **Use the template.** Every idea follows `TEMPLATE.md`. Don't skip sections — if a section doesn't apply, write "N/A" with a brief reason.

9. **Write for a developer who has zero context.** Explain what exists today, what changes, and why. Don't assume the reader sat in on the conversation where the idea came up.

10. **Pseudocode over prose for implementation.** When describing how something should work, write pseudocode or concrete code samples. "The service should fetch workflows and parse them" is useless. Show the data structures, the function signatures, the parsing logic.

11. **Document the response contracts.** If two systems talk to each other, define the exact request and response shapes with field-by-field tables. This is the most important part of any integration idea.

12. **Name the files that need to change.** List every file that will be created, modified, or deprecated. A developer should be able to `grep` for these paths and start working.

### Quality Gates

13. **Every idea must have open questions.** If there are zero open questions, you didn't think hard enough. Flag the things you're unsure about so the implementer knows where to apply judgment.

14. **Every idea must have gotchas.** What could go wrong? What are the edge cases? What are the known bugs in the tools you're depending on? If you skip this section, the implementer will discover them the hard way.

15. **Don't propose what you can't explain.** If you can't write the pseudocode for it, you don't understand it well enough to hand it off. Do more research or narrow the scope.

---

## File Naming

```
<short-kebab-description>-handoff.md
```

Examples:
- `n8n-npc-spawner-handoff.md`
- `supabase-realtime-sync-handoff.md`
- `quest-builder-mvp-handoff.md`

---

## Statuses

Use these in the front matter of each idea:

| Status | Meaning |
|--------|---------|
| `Research in progress` | Still gathering information, not ready for implementation |
| `Research complete. Ready for implementation.` | Fully researched, can be picked up |
| `In progress` | Someone is actively implementing this |
| `Implemented` | Done — link to the PR or commit |
| `Parked` | Deprioritized, may revisit later |
| `Superseded` | Replaced by a newer idea — link to it |

---

## Template

See `TEMPLATE.md` for the required structure. Copy it when starting a new idea.
