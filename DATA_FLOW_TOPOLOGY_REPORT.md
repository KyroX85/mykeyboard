# DATA_FLOW_TOPOLOGY_REPORT

Generated: 2026-05-29

## WHAT WAS VERIFIED

Traced keyboard runtime -> metrics -> local signal bridge -> ingestion -> product evidence archive -> reports -> WhatsApp/GitHub Actions/Product Lab paths.

## DATA FLOW MAP

| Stage | Data | Destination | Classification |
|---|---|---|---|
| `KeyboardService.currentWord` | Raw current word buffer | RAM, predictor/autocorrect/learning | ACTIVE RISK local only |
| `BasicPredictor.learnWord()` / `learnAcceptedSuggestion()` | Normalized raw words and bigrams | In-memory maps | ACTIVE RISK local only |
| `BasicPredictor.saveModel()` | JSON with raw word keys/counts | App-private SharedPreferences | ACTIVE RISK local persistence |
| `KeyboardMetrics.recordSuggestionAccepted()` | Accepted word | Hashed `wordKey` via FNV-style privacy key | VERIFIED SAFE for metrics |
| `KeyboardUsageSnapshot` | Counts/rates/durations/zones | ProductSignalBridge | VERIFIED SAFE aggregate |
| `ProductSignalBridge` | Aggregate JSON only | `10.0.2.2` / `localhost` metrics ingest | VERIFIED SAFE content, network boundary |
| `product-metrics-ingest.js` | Sanitized aggregate evidence | `ai-cto/product-evidence-archive.json` | VERIFIED SAFE aggregate |
| Supabase helper | Arbitrary `dataPairs` if called | `/rest/v1/typing_logs` | THEORETICAL RISK |
| GitHub Actions | Reports/APKs/screenshots/logs | Workflow artifacts | THEORETICAL RISK |
| WhatsApp | Founder commands/summaries | Twilio/Meta + local memory/logs | ACTIVE RISK for founder messages |

## WHAT REMAINS THEORETICAL

- A future caller could pass raw text into `logEvent()`.
- Product Lab screenshots could expose personal content if run outside scripted emulator sessions.
- Historical artifacts and external provider logs are outside local verification.

## ACTIVE RISKS

- Local predictor SharedPreferences contain raw learned words.
- WhatsApp stores/routes founder operational messages.

## DEAD CODE RISKS

- Dormant Supabase upload helper remains cloud-capable.
- Archive-named legacy folders are absent now, but previous external copies are unverified.

## DATA LEAK POSSIBILITY

No verified path sends keyboard raw typed text to Supabase, WhatsApp, Firebase, or GitHub Actions from current source.

## UNVERIFIED PATHS

- Supabase table history.
- Render logs.
- Historical GitHub Actions artifacts.
- Android backup/export behavior.

## PROOF OF SAFETY

- `ProductSignalBridge` only serializes aggregate counters.
- Ingestion rejects raw/text/word/phrase/sentence/keystroke/input/message/path-shaped keys.
- Evidence archive allowlist stores only numeric product metrics.
- No SQLite path exists in the keyboard runtime.

## RECOMMENDED HARDENING

1. Kill or strictly allowlist Supabase runtime logging.
2. Document local predictor word persistence in privacy language.
3. Add screenshot artifact retention controls.
4. Add network-payload tests for future Android changes.

## RISK SEVERITY

MEDIUM.

## TRUST IMPACT

The operational data flow is mostly aggregate, but local predictor storage and the dormant cloud helper are the privacy trust constraints.
