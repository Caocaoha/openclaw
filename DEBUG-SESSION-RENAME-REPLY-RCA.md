# Session Rename + Reply Bug - DEBUG LOGGING ACTIVATED

**Date:** 2026-04-08  
**Status:** Debug logging added to production branch `sidebar-2026.4.6`

---

## What Was Added

### Backend Logging (3 locations)

1. **`src/gateway/server-methods/chat.ts:1428-1437`**
   - Logs when `chat.send` is called
   - Logs: `rawSessionKey`, `messageLength`, `messagePrefix`, `timestamp`
   - Logs the resolved `sessionKey`, `label`, `sessionId`, `endedAt`

2. **`src/gateway/server-methods/sessions.ts:509-515`**
   - Logs when `sessions.list` returns data
   - Logs: count, keys, labels, sessionIds of all returned sessions

### Frontend Logging (2 locations)

3. **`ui/src/ui/views/chat.ts:1042-1050`**
   - Logs when Reply button is clicked
   - Logs: `replyKey`, `replyRole`, `replyText`, `currentSessionKey`

4. **`ui/src/ui/views/chat.ts:1204-1218`**
   - Logs when reply is actually sent
   - Logs: `replyKey`, `replyRole`, `currentSessionKey`, `messageLength`

---

## How to Reproduce the Issue

### Step 1: Rebuild
```bash
cd /home/caoha/.openclaw/workspace/openclaw-source
pnpm build
```

### Step 2: Restart Gateway
```bash
# Stop the running gateway (via app or manually)
# Then restart it via the app or:
pkill -9 -f openclaw-gateway || true
nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &
```

### Step 3: Check Browser Console & Server Logs

**Browser Developer Tools (F12):**
- Open DevTools → Console tab
- Look for `[DEBUG]` messages as you perform actions

**Server Logs:**
```bash
tail -f /tmp/openclaw-gateway.log | grep "\[DEBUG\]"
```

### Step 4: Reproduce User Action

1. **Create a new session** with some history
   - Send several messages to build up history

2. **Rename the session**
   - Click on session in sidebar
   - Edit the name/label

3. **Verify label is saved**
   - Check sidebar shows the new label
   - Run: `openclaw sessions list` (or check storage)

4. **Click Reply to a Message**
   - Scroll to an older message
   - Click the "Reply" button (speech bubble icon)
   - Watch browser console for `[DEBUG] Reply button clicked`

5. **Send the reply**
   - Type a response message
   - Press Enter or click Send
   - Watch browser console for `[DEBUG] Sending reply`
   - Watch server log for `[DEBUG] chat.send called`

6. **Observe the Result**
   - Does history stay intact?
   - Does the label remain?
   - Is it the same session or a new one?

---

## Expected Debug Output

### Browser Console (when Reply is clicked)
```
[DEBUG] Reply button clicked {
  replyKey: "agent:main:main:d4c4154e-e6a6-40d0-a31a-310fc85a9772"
  replyRole: "Assistant"
  replyText: "some truncated text..."
  currentSessionKey: "agent:main:main:d4c4154e-e6a6-40d0-a31a-310fc85a9772"
}
```

### Browser Console (when Reply is sent)
```
[DEBUG] Sending reply {
  replyKey: "agent:main:main:d4c4154e-e6a6-40d0-a31a-310fc85a9772"
  replyRole: "Assistant"
  currentSessionKey: "agent:main:main:d4c4154e-e6a6-40d0-a31a-310fc85a9772"
  messageLength: 45
}
```

### Server Log (when chat.send arrives)
```
[DEBUG] chat.send called {
  rawSessionKey: "agent:main:main:d4c4154e-e6a6-40d0-a31a-310fc85a9772"
  messageLength: 130
  messagePrefix: "[Replying to Assistant: \"some truncated..."
  timestamp: 1712606400000
}

[DEBUG] loadSessionEntry resolved {
  input: "agent:main:main:d4c4154e-e6a6-40d0-a31a-310fc85a9772"
  output: {
    key: "agent:main:main:d4c4154e-e6a6-40d0-a31a-310fc85a9772"
    label: "My renamed session"
    sessionId: "c348f50f-f405-465e-836f-06f8ad24dfe6"
    endedAt: null
  }
}
```

### Server Log (when sessions.list is called)
```
[DEBUG] sessions.list returning {
  count: 3
  keys: [
    "agent:main:main:d4c4154e-e6a6-40d0-a31a-310fc85a9772"
    "agent:main:main:0930fd25-1c46-4d48-aac7-ea31bc6fc275"
    "...034903ce-d66f-4454-850c-748680639965"
  ]
  labels: [
    "My renamed session"
    "Setup gmail"
    null
  ]
  sessionIds: [
    "c348f50f-f405-465e-836f-06f8ad24dfe6"
    "0930fd25-1c46-4d48-aac7-ea31bc6fc275"
    "034903ce-d66f-4454-850c-748680639965"
  ]
}
```

---

## Questions to Answer While Testing

| # | Question | Answer |
|---|----------|--------|
| 1 | After Reply is sent, does `currentSessionKey` in send log match the renamed session? | ✓ |
| 2 | Does `loadSessionEntry` find the session with correct label? | ✓ |
| 3 | After reply, does sidebar still show the label? | ✓ |
| 4 | After reply, does history still show old messages? | ✓ |
| 5 | Did you accidentally click "+" (new chat) button? | ✓ |
| 6 | When clicking Reply, was the session already an archived compound key? | ? |

---

## Next Steps After Testing

1. **Share the logs** from both browser console and server (`/tmp/openclaw-gateway.log`)
2. **Answer the 6 questions** above
3. **Describe what you observed** (history lost? label gone? same session or new one?)
4. **I will analyze** the logs to determine which scenario occurred (accidental /new vs reply-to-archived bug)

---

## Files Modified

- `src/gateway/server-methods/chat.ts` — Added logging at chat.send entry point
- `src/gateway/server-methods/sessions.ts` — Added logging at sessions.list
- `ui/src/ui/views/chat.ts` — Added logging at Reply button click and send

**To disable logging later:** Remove all `console.log("[DEBUG]"...` lines from these files.

---

_This debug session is focused on tracing the root cause of session rename + history reset bug._
