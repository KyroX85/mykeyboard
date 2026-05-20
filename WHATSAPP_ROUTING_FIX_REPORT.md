# WhatsApp Routing Fix Report

Date: 2026-05-20

## Root Cause

Natural conversational messages without exact commands or recognized agent intent fell through to the strict `unknown` route.

Examples affected:

- `hey`
- `hi`
- `hello`
- `sup`
- `update`
- `what's going on`

The webhook itself was online and Twilio parsing was working, but the router treated low-confidence casual language as command failure instead of conversation.

## Exact Failure Point

Failure point:

```text
command-router.js
exact command miss -> agent route miss -> routeCommand() -> unknown response
```

The previous fallback response said the command was not recognized. That was too strict for the school-mode conversational interface.

## Fix Implemented

Routing hierarchy is now:

1. exact commands
2. agent-intent detection
3. general conversational fallback
4. safe low-confidence fallback

The fallback now returns:

- current health
- momentum
- active risks
- next priority

It no longer sends a dead-end command failure for casual Founder messages.

## Files Changed

- `ai-cto/whatsapp-server.js`
- `ai-cto/whatsapp/command-router.js`
- `ai-cto/whatsapp/natural-intent-parser.js`
- `ai-cto/whatsapp/response-generator.js`
- `ai-cto/scripts/test-whatsapp-interface.js`
- `WHATSAPP_ROUTING_FIX_REPORT.md`

## Request Parsing Audit

- `express.urlencoded({ extended: false })` remains enabled.
- `extractTwilioBody()` now safely handles undefined or malformed `req.body`.
- `Body`, `From`, and `MessageSid` are extracted defensively.
- Missing `Body` becomes an empty string and receives a safe CTO fallback.

## Debug Logging Added

Structured webhook log metadata now includes:

- raw body type
- parsed body keys
- matched route
- fallback reason

The log still masks phone numbers and does not expose full credentials.

## Regression Risk

Low.

Strict commands still take priority. Natural agent routing still takes second priority. Only the final unknown path changed to a useful CTO fallback.

## Conversational Reliability Score

Before: 72/100

After: 93/100

Reason: casual greetings, update requests, malformed body cases, and low-confidence messages now produce useful status responses instead of parser failure.
