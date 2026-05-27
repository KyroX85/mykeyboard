# Product Learning Report

This pass adds local, aggregate-only product learning support. It does not change keyboard behavior, prediction, swipe scoring, layouts, telemetry upload, or Android hot paths.

## 1. Consistently Rising Friction

No live cache evidence has been collected yet. The new pipeline can classify rising friction from aggregate counters only:

- correction bursts
- swipe failure clusters
- edge-key miss frequency
- mode-switch frequency
- long-word swipe abandonment
- latency spikes
- frame hitch suspicion
- symbol hunting frequency
- repeated retry patterns

Until a local cache is populated from real aggregate snapshots, the correct state is: not enough evidence yet.

## 2. Trust Signals Improving

No trend can be claimed yet. Improvement requires repeated aggregate samples showing lower correction pressure, fewer swipe failure clusters, fewer latency spikes, or lower symbol hunting frequency.

## 3. Weak Evidence

Single isolated events remain low confidence. Weak assumptions decay automatically and are dropped from local memory once stale or unsupported.

## 4. Discarded Assumptions

The system rejects raw-content fields such as text, words, phrases, sentences, raw keystrokes, and swipe paths. Those fields are not stored in the product learning cache.

## 5. Repeatedly Successful UX Patterns

The local memory can preserve founder-approved improvements as short labels only. It does not store personal text or conversation content.

## 6. What The System Should Learn Next

The next useful evidence is real aggregate snapshots from:

- swipe success and failure clusters
- correction bursts after swipe attempts
- symbol-layer dependency
- edge-key miss frequency
- responsiveness spikes during mode switches

## 7. Low-Confidence Areas

- Whether swipe trust is improving over multi-day use
- Whether symbol hunting is rising after layout changes
- Whether edge-key confidence differs by device size
- Whether responsiveness spikes are frequent enough to affect perceived speed

## Protections

- Local-only cache: `local-product-learning-cache.json`
- Cache is ignored by git.
- Stores bounded aggregate counters only.
- No raw words, sentences, phrases, swipe paths, or key history.
- Learning loop is observe/rank/summarize/propose only.
- Unsafe autonomous hot-path mutation is blocked.

## Runtime Impact

No Android runtime impact from this pass. The added modules are Node-based local tooling and are not invoked from the IME hot path.

## Product-Learning Maturity Score

Updated score: 5.8/10.

Reason: the system can now sanitize aggregate signals, rank product-learning priorities, maintain bounded short-term product pattern memory, decay weak evidence, and block unsafe mutation proposals. It still needs real-device aggregate samples before it can produce strong product conclusions.
