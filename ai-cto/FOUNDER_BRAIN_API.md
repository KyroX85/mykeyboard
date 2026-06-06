# Founder Brain API

The Founder Brain API is the single structured interface for founder-facing intelligence.

It wraps the existing WhatsApp founder reasoning stack and returns a machine-readable answer for:

- founder chat
- Jarvis-style voice surfaces
- future phone OS/action layers

It does not execute code directly. Execution requests are classified as `execution` and returned as structured reasoning.

## Endpoint

```text
POST /brain/question
```

## Authentication

Set this environment variable in Render before using the endpoint:

```text
BRAIN_API_TOKEN=<private-token>
```

Requests must include:

```text
Authorization: Bearer <private-token>
```

## Request

```json
{
  "question": "Bro what do you think I'm actually chasing?"
}
```

## Response

```json
{
  "type": "reflection",
  "summary": "...",
  "confidence": 0.87,
  "rawReasoning": "...",
  "voiceSummary": "...",
  "sources": ["founder_memory", "session_memory", "whatsapp_router"],
  "route": {
    "command": "founder_mind_reconstruction",
    "matchedRoute": "founder_mind_reconstruction",
    "intent": null
  }
}
```

## Types

- `reflection`
- `strategy`
- `product`
- `execution`
- `status`
- `unclear`

## Contract

- `summary` is compact text for chat UI.
- `rawReasoning` is the full founder-brain answer.
- `summary` is capped at roughly 50 words by the Strategic Compression Layer.
- `rawReasoning` is capped at roughly 500 words so deep reasoning remains available without flooding clients.
- `voiceSummary` is capped at roughly 15 words and is the only field Jarvis-style voice surfaces should speak.
- `confidence` is capped at `0.9` to avoid false certainty.
- `sources` lists the reasoning systems used.
- `compression` records the active word limits for reasoning, chat summary, and voice summary.
- Factual project or personal-state claims must pass `REALITY_AWARENESS_LAYER.md` and `HALLUCINATION_GUARD_LAYER.md`.
- If factual-state confidence is below `70%`, the response must say `INSUFFICIENT DATA` instead of using Founder Brain personality or philosophy.

## Factual-State Guard

Founder Brain may answer reflection, identity, vision, and strategy questions.

It must not answer factual-state questions from personality alone.

Examples that require evidence:

- What happened today?
- What is blocked?
- How is the Android app doing?
- How overloaded am I?
- Did I finish everything?

If evidence is missing:

```text
INSUFFICIENT DATA
```

## Safety

The endpoint requires `BRAIN_API_TOKEN`. Do not expose it publicly without auth.
