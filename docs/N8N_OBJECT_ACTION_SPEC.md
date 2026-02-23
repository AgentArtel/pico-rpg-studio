# n8n Object-Action Webhook Spec (≤5k handoff)

One webhook handles all actions. Branch on body.object_type and body.action.

**1. REQUEST** (POST JSON)
- object_type: "mailbox" | "desk"
- action: "fetch_emails" | "send_email" | "process_mail" | "check_desk"
- player_id: uuid, inputs: {}, workflow_run_id, timestamp

**2. BRANCHES**
- mailbox + fetch_emails: Fetch Gmail, count messages. Respond with inventory_delta.add [{ type: "email", count: N }]. Do not return raw message list.
- mailbox + send_email (future): Placeholder. Accept inputs (to, subject, body). Respond success + message + optional inventory_delta (e.g. remove draft-email).
- desk + process_mail: Process mail; respond with inventory_delta remove/add and message.
- desk + check_desk: Respond success + message only (e.g. "You have 13 letters.").

**3. RESPONSE** (exact shape; game ignores else)
Success: { "success": true, "message": "...", "inventory_delta": { "add": [{ "type": "email"|"tagged-email"|"summary"|"draft-email", "count": N }], "remove": [...] } }
Error: { "success": false, "error": { "code": "...", "message": "...", "retryable": false } }
Types: email, tagged-email, summary, draft-email. Omit or [] for no change.

**4. AI SUMMARY**
Single webhook: read body.object_type and body.action. (1) mailbox+fetch_emails → Gmail, count, return success + message + inventory_delta.add email count. (2) mailbox+send_email → placeholder branch, return success + message + optional inventory_delta. (3) desk+process_mail → process, return inventory_delta remove/add + message. (4) desk+check_desk → return success + message. All responses JSON only; success/message/inventory_delta shape above.
