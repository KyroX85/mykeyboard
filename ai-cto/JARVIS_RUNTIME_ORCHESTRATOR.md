# Jarvis Runtime Orchestrator

Jarvis Runtime Orchestrator is the single runtime entry point for voice, phone, and future OS surfaces.

It connects existing systems without letting them speak independently.

```mermaid
flowchart TD
  A["Wake Word"] --> B["Jarvis Runtime Orchestrator"]
  B --> C["Founder Brain"]
  C --> D["Agent Council"]
  D --> E["Final Decision"]
  E --> F["Execution Layer"]
  F --> G["Response"]
  G --> H["Jarvis speaks voiceSummary only"]
```

## Runtime Contract

- Single entry point: `runJarvisRuntime(...)`
- Single HTTP path: `POST /jarvis/runtime`
- Founder Brain remains the decision engine.
- Agent Council reviews internally and never speaks directly to the founder.
- Execution Layer prepares actions only and requires confirmation.
- Jarvis response is always the Speech Layer's `voiceSummary`.

## Speech Contract

```mermaid
flowchart TD
  A["Founder Brain rawReasoning"] --> B["Compression Layer summary"]
  B --> C["Jarvis Speech Layer"]
  C --> D["voiceSummary only"]
```

- Hard speech cap: 15 words by default.
- Voice output must stay under 15 seconds.
- Framework labels, route diagnostics, health/momentum templates, task plans, and agent names are stripped.
- If a future brain or council returns longer text, Jarvis still speaks only the capped speech result.

## Response Shape

```json
{
  "runtime": "JARVIS_RUNTIME_ORCHESTRATOR_V1",
  "flow": [
    "wake_word",
    "jarvis_runtime",
    "founder_brain",
    "agent_council",
    "final_decision",
    "execution_layer",
    "response"
  ],
  "response": "Jarvis speaks this.",
  "spokenResponse": "Jarvis speaks this.",
  "voiceSummary": "Jarvis speaks this."
}
```

## Safety

This runtime does not make agents autonomous.

It only unifies routing:

- Founder Brain decides.
- Council reviews.
- Execution Layer gates action.
- Founder approval remains required before execution.
