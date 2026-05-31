# Aritenis AI CTO System Briefing

Generated: 2026-05-31
Canonical execution root: `C:\Users\ADMIN\AndroidStudioProjects\MyKeyboard\ai-cto`
Donor / founder-DNA root: `C:\Users\ADMIN\ai-cto`
Product served: Aritenis Android keyboard (`MyKeyboard` repository)

This briefing is grounded in the runtime code paths used by the nested CTO system inside the MyKeyboard repository. The standalone `C:\Users\ADMIN\ai-cto` folder is treated as founder-intelligence donor material, not the active Render/GitHub/WhatsApp execution root.

## 1. System Overview

The Aritenis AI CTO system is a local-first operational layer for the Aritenis Android keyboard. It watches repository health, answers founder questions over WhatsApp, dispatches GitHub Actions, stores founder/project memory, gates execution, and produces conservative product recommendations.

The system exists because the founder wants an always-available CTO-style assistant for a keyboard company while having limited daily supervision time. Its job is not to chase AI sophistication. Its job is to protect keyboard trust, keep the project direction coherent, and prepare Phase 2 differentiation around Explain and screenshot-powered understanding.

The product it serves is Aritenis: an Android keyboard whose Phase 1 foundation is typing trust, swipe trust, responsiveness, prediction quality, visual polish, sizing, symbols, and stability. Phase 2 is the Explain-first execution layer: helping users understand confusing content before typing or replying.

Current operational truth:

- Runtime-executed CTO: `MyKeyboard\ai-cto`
- WhatsApp server: `ai-cto\whatsapp-server.js`
- Canonical product repo: `KyroX85/mykeyboard`
- Main founder interface: WhatsApp through Twilio, with Meta WhatsApp fallback for outbound sends
- Remote execution: GitHub Actions workflows
- Hosting/webhook: Render or any public server pointing Twilio to `/twilio/whatsapp`

## 2. Architecture

High-level flow:

```text
Founder WhatsApp
-> Twilio webhook / Meta outbound fallback
-> Render Node server (`ai-cto/whatsapp-server.js`)
-> command router / memory / governance / model routing
-> GitHub Actions dispatch when needed
-> repo state, reports, screenshots, APK builds, or WhatsApp replies
```

Main components:

- `ai-cto/whatsapp-server.js`: Express server. Receives Twilio messages at `/twilio/whatsapp`, validates signatures, loads engineering state, routes the message, updates memory, may dispatch workflows, and sends replies.
- `ai-cto/whatsapp/command-router.js`: primary WhatsApp router. Handles preservation mode, founder memory, product lab screenshot requests, control-plane commands, Phase 2 dialogue, execution approvals, agent routing, low-information classification, and fallback replies.
- `ai-cto/whatsapp/whatsapp-provider.js`: outbound WhatsApp sender. Tries Twilio first, then Meta WhatsApp Business API if configured.
- `ai-cto/whatsapp/build-dispatcher.js`: dispatches GitHub workflows for APK builds and Product Lab screenshots.
- `ai-cto/whatsapp/product-lab-artifact-fetcher.js`: fetches latest Product Lab artifacts from GitHub, rejects unhealthy system-dialog screenshots, extracts PNGs, and exposes them through the Render server static path.
- `ai-cto/brain.js`: scans repo state, validation output, complexity findings, secret-like patterns, and writes `ENGINEERING_REPORT.md` plus `.brain_state.json`.
- `ai-cto/product-governance.js`: product safety/risk classifier for protected keyboard areas, roadmap alignment, trust scores, regression memory, autonomy posture, and validation gates.
- `ai-cto/product-metrics-ingest.js`: aggregate-only runtime metric ingestion. Rejects suspicious raw-content keys and archives only sanitized evidence.
- `ai-cto/founder-memory-layer.js`: loads canonical founder memory markdown files before reasoning.
- `ai-cto/reality-reconstruction-layer.js`: reconstructs project state from founder memory and project-state files instead of returning templates.
- `ai-cto/memory-policy-enforcer.js`: forces responses to declare memory sources and prevents false claims of full chat recall.
- `ai-cto/execution-schema-enforcer.js`: forces responses into deterministic schema types and blocks intent/output mismatch.

GitHub Actions roles:

- `.github/workflows/product-lab-validation.yml`: scheduled/manual emulator Product Lab. Builds APK, boots emulator, installs keyboard, starts ProductLab activity, captures screenshot and UI XML, generates reports, uploads `product-lab-validation` artifact.
- `.github/workflows/build-and-distribute.yml`: builds debug APK and distributes through Firebase App Distribution when gated conditions pass. Also sends WhatsApp notification if secrets are configured.
- `.github/workflows/engineering-maintenance.yml`: scheduled maintenance brain run, Android validation, AI execution bridge, founder email report, WhatsApp school-mode report, PR creation for generated report/memory, and low-risk autofix PR flow.
- `.github/workflows/phase2-daily-agent.yml`: scheduled/manual Phase 2 daily mission report generator. Creates PR instead of directly mutating product code.
- `.github/workflows/render-keepalive.yml`: keeps Render service warm.
- `.github/workflows/android.yml`: Android CI workflow.

Render webhook role:

- Hosts `npm run cto:whatsapp` -> `node ai-cto/whatsapp-server.js`.
- Public URL must be configured in Twilio sandbox/WhatsApp webhook as `https://<render-domain>/twilio/whatsapp`.
- Required production variables include Twilio credentials, founder number, GitHub token(s), and optional NVIDIA/Meta keys.

Founder interaction model:

- Normal conversation should stay conversational.
- Explicit execution words (`FIX`, `EXECUTE`, `IMPLEMENT`, `COMMIT`, `BUILD`, `RUN PRODUCT LAB`) activate task/workflow paths.
- Product Lab requests like `capture screenshot` queue GitHub Actions, then the server attempts to send the latest artifact screenshot automatically or on `latest screenshot`.
- Preservation mode blocks mutation and commits while allowing analysis/reports/scans/proposals.

## 3. Agents

The system has named agent personas plus control-plane/council modules.

### CTO / Chief Agent

Role: roadmap keeper, founder-facing lead, product steward, router of intent.

Responsibilities:

- Understand founder intent.
- Keep Phase 1 foundation protected.
- Prioritize Phase 2 Explain/product leverage.
- Avoid accidental execution from conversation.
- Generate concise founder updates.

Tone: calm, strategic, decisive, professional English.

Can do:

- Answer product/roadmap questions.
- Route commands.
- Dispatch safe workflows.
- Produce proposals and status summaries.

Cannot do:

- Directly rewrite protected keyboard files without evidence and approval.
- Claim full memory unless loaded.
- Treat conversation as execution.

### Coder

Role: implementation worker.

Responsibilities:

- Execute one bounded task when approved.
- Use low-risk deterministic fixes or AI-generated patches only through execution bridge.
- Return execution logs and validation status.

Tone: technical, focused, practical.

Can do:

- Apply low-risk fixes inside diff limits.
- Create deterministic test files in safe scopes.
- Commit/push only through guarded paths when configured.

Cannot do:

- Plan broad strategy.
- Execute medium/high risk changes directly.
- Touch forbidden privacy/database/secret paths.
- Rewrite hot-path keyboard files from chat.

### Reviewer

Role: quality/regression gate.

Responsibilities:

- Verify fixes.
- Identify regression risk.
- Block unsafe or unverified changes.
- Require validation evidence.

Tone: careful, thorough, cautious.

Can do:

- Reject AI fixes that change unrelated behavior.
- Require staging/approval.
- Summarize validation state.

Cannot do:

- Approve high-risk product changes alone.
- Treat report generation as product improvement.

### Auditor

Role: safety and governance monitor.

Responsibilities:

- Watch for dangerous paths, privacy risks, governance bypasses, and integrity failures.
- Block mutation during preservation mode.
- Track active risks and unsafe scope.

Tone: serious, alert, no-nonsense.

Can do:

- Flag privacy/security/data risk.
- Detect contradictory execution behavior.
- Enforce safety posture.

Cannot do:

- Weaken governance to increase autonomy.
- Approve unsafe execution.

### Council / Control Plane Agents

Implemented under `ai-cto/orchestration`.

- `agent-control-plane.js`: exposes agent board, roadmap/control status, proposal judgment, council review, and Codex-style loop commands.
- `nvidia-council-engine.js`: when multiple NVIDIA keys are configured, asks multiple model roles to independently judge a proposal and challenge each other. Roles include CTO/Roadmap, Product Judgment, Engineering Risk, and Critic/Governance.
- `codex-style-agent-system.js`: implements a long-horizon loop structure: Chief -> Planner -> Executor -> Verifier, with verifier-driven replanning.

These systems are proposal/reasoning layers. They should not mutate product code automatically.

## 4. AI Models

Model client: `ai-cto/whatsapp/nvidia-nim-client.js`

Base endpoint:

- `https://integrate.api.nvidia.com/v1`

Configured model assignments:

- Conversation Brain: `meta/llama-3.3-70b-instruct`
  - Env: `NVIDIA_LLAMA_API_KEY`
  - Used for founder conversation, risk review, verification, and council/product reasoning.
- Code Brain: `deepseek-ai/deepseek-v4-flash`
  - Env: `NVIDIA_DEEPSEEK_API_KEY`
  - Used for code-fix generation in the AI execution bridge.
- Fallback Code Brain: `qwen/qwen3-coder-480b-a35b-instruct`
  - Env: `NVIDIA_QWEN_CODER_API_KEY`
  - Used as fallback code brain and critic/governance council role.

Caps and limits visible in code:

- `MAX_LLAMA_CALLS_PER_DAY = 100` in `ai-whatsapp-responder.js` and `ai-execution-bridge.js`.
- `MAX_DEEPSEEK_FIXES_PER_DAY = 20` in `ai-execution-bridge.js`.
- Llama WhatsApp response timeout default: `LLAMA_RESPONSE_TIMEOUT_MS = 8000`.
- Execution engine deterministic auto-fix cap: `MAX_AUTO_FIXES_PER_DAY = 10`.

The model prompt explicitly says:

- Aritenis is an Android keyboard with protected typing foundation and Explain-first layer.
- Do exactly the founder task.
- Do not create unnecessary refactors.
- Never touch secrets/privacy/database/key files.
- Stop if a patch would touch more than 3 files.

## 5. Execution Capabilities

The system can execute some work, but execution is intentionally narrow.

Autonomous / low-risk capabilities:

- Generate and update reports/state files.
- Normalize safe text formatting in non-protected scopes.
- Run scans and validation.
- Dispatch GitHub workflows for APK build or Product Lab screenshot.
- Create PRs through GitHub Actions for generated reports/memory/safe maintenance.
- Apply deterministic low-risk file templates for test-file style requests when safe.
- Delete deterministic test files only in tightly scoped conditions.

Risk classification:

- LOW: documentation, formatting, whitespace, comments, deterministic test-file scaffolding in safe paths.
- MEDIUM: logic, dependencies, Kotlin/Java behavior, protected product-adjacent code, predictor/swipe/keyboard behavior.
- HIGH: privacy, database, secrets, auth, telemetry, architecture, network, forbidden files, large diffs, product hot-path rewrites.

Requires founder approval or staging:

- Protected keyboard files: `KeyboardService.kt`, swipe resolver/tracker/trail, `BasicPredictor.kt`, metrics, haptics, sizing, symbols, keyboard layouts/drawables.
- Any rewrite/refactor touching behavior.
- Medium-risk AI-generated fixes.
- Large patches, multi-file patches, or architecture changes.
- Anything with uncertain privacy/runtime impact.

Permanently blocked / forbidden direct scope:

- `google-services.json`
- privacy paths
- database/schema/migration paths
- secret/key/token files
- hidden telemetry or raw data collection
- auto-send behavior
- raw typing or screenshot retention
- autonomous mutation during `PRESERVATION_ONLY`

Hard guardrails:

- Existing-file direct diff limit: max 3 files, max 50 changed lines.
- New-file content hard limit: max 200 lines in diff limit function, 4000 chars for deterministic new file content.
- Git path resolution rejects paths outside repo.
- Validation is required; failed validation triggers rollback from checkpoints.
- `product-governance.js` blocks protected product direct execution.
- `execution-schema-enforcer.js` prevents answer/type mismatch before WhatsApp response delivery.

## 6. Memory System

Memory has multiple layers.

### Founder memory files

Loaded by `founder-memory-layer.js`:

- `FOUNDER_VISION.md`
- `PROJECT_STATE.md`
- `CURRENT_STAGE.md`
- `REJECTED_DIRECTIONS.md`
- `ACTIVE_HYPOTHESES.md`

These files are founder-priority memory and should override conversation history. The `memory audit` command should reconstruct state from these files and say when founder context confidence is insufficient.

### Runtime founder memory JSON

File: `ai-cto/founder-memory.json`

Stores:

- founder preferences
- product context
- decision history
- vision command history
- milestones
- learned preferences
- conversation summaries

It can be read/written locally and optionally persisted to GitHub via Contents API when `GITHUB_TOKEN` is configured.

### WhatsApp session memory

File: `ai-cto/.whatsapp_memory.json`

Stores recent conversational state for roughly 30 days:

- last focus/topic
- active tasks
- current frustration
- unresolved concern
- recent messages
- semantic founder state
- product priorities
- operational intelligence

Corrupt JSON is copied to a `.corrupt-<timestamp>` backup and replaced with a recovery object.

### Brain/execution memory

- `ai-cto/.brain_state.json`: health score, momentum, unresolved issues, trend history, recurring failures, file instability.
- `ai-cto/tasks.json`: persistent task list and ownership.
- `ai-cto/agent-action-log.json`: action log for agent responses/execution/model calls.
- `ai-cto/vision-commands-log.json`: vision command plans, approvals, and outcomes.
- `ai-cto/execution-log.json`: safe execution plan states.
- `ai-cto/product-regression-memory.json`, `product-wisdom-memory.json`, `product-evidence-archive.json`, `agent-trust-score.json`: product governance/trust memory.

Persistence across Render redeploys:

- Files in the Render container are not inherently durable unless committed or externalized.
- Founder memory can be committed/pushed or written through GitHub API when tokens are configured.
- GitHub Actions artifacts persist according to GitHub artifact retention, not Render disk.
- WhatsApp transient runtime files on Render can be lost on redeploy unless persisted back to GitHub.

## 7. WhatsApp Commands

Exact command aliases in `command-router.js` include:

- `status`, `cto status`, `health`, `score`
- `latest risks`, `risks`, `risk`
- `momentum`
- `what changed`, `changed`, `changes`, `latest fixes`, `fixes`
- `unresolved`, `pending issues`, `issues`, `pending`
- `pending approvals`, `approvals`
- `next priorities`, `priority`
- `keyboard health`, `keyboard`
- `cto summary`, `weekly summary`
- `school mode`
- `scan now`, `fresh scan`, `live scan`
- `build now`, `ota build`, `new apk`
- `fix limit`
- `execution status`, `execution history`
- `memory`
- `what did we discuss last week`
- `last thing you fixed`
- `help`
- `focus <topic>`

Important product/vision commands:

- `memory audit`: founder/project-state reconstruction.
- `capture screenshot`: dispatch Product Lab workflow and attempt automatic screenshot delivery.
- `latest screenshot`: fetch and send latest Product Lab screenshot artifact.
- `agent board`, `agent roster`, `control plane`: control-plane status/roster.
- `council: <proposal>` / `model council: <proposal>`: deterministic or NVIDIA council review.
- `codex loop: <goal>`: Codex-style planning/execution/verifier simulation.
- `enter preservation mode`: switch to preservation-only governance.
- `disable preservation mode`: return to normal active mode.

Vision command approval flow:

- `vision-command-manager.js` classifies commands, creates plans, and produces `APPROVE-<token>` commands.
- Product-protected improvement requests become options/proposals, not direct edits.
- Execution result is remembered in founder memory and action logs.

Group chat simulation:

- The WhatsApp response builder can emit CTO, CODER, REVIEWER, and AUDITOR lines in one reply.
- This is simulated team communication, not separate persistent processes unless model council/agent council is explicitly invoked.

## 8. Roadmap Awareness

Current roadmap state in code and memory is mixed but converging:

- Founder memory says: `Phase 2 preparation / early Phase 2`.
- Runtime roadmap lock fallback still contains `Phase 1 - Stabilization` language in `product-governance.js` defaults.
- The active company direction from founder memory is: Phase 1 foundation is protected; Phase 2 Explain is the active wedge.

Practical interpretation:

- Phase 1 is protected foundation.
- Phase 2 is active for discussion, product lab, design, and Explain-oriented proposals.
- Any Phase 2 implementation must not degrade typing latency, swipe trust, prediction trust, or keyboard stability.

North star:

- Aritenis should become a trusted Android keyboard that helps users understand confusing content before they type or reply.
- Phase 2 differentiator is Explain, not better prediction/swipe/themes.

Allowed during current stage:

- Conversation, strategy, product reasoning.
- Screenshot/product lab evidence collection.
- Explain workflow design.
- Conservative proposals.
- GitHub Actions validation.
- Founder-memory and routing consistency fixes.

Not allowed without strong evidence/approval:

- Hot-path keyboard edits.
- Predictor/swipe/sizing rewrites.
- Automatic app actions or sending.
- Cloud telemetry or raw content storage.
- Architecture vanity or multi-agent complexity for its own sake.

## 9. Known Limitations

Known limitations from code and recent runtime behavior:

- Product Lab screenshots can capture Android system dialogs such as `System UI isn't responding`; artifact fetcher now rejects screenshots when UI XML shows those dialog patterns, but workflow reliability still needs improvement.
- `ai-cto/.brain_state.json` is stale relative to current founder roadmap; latest `lastAnalysis` in the inspected file is `2026-05-22T08:33:50.027Z`.
- `validation-results.json` was missing during inspection, so validation state may be unavailable to WhatsApp state reader.
- `natural-response-builder.js` is large (>500 lines) and is repeatedly flagged as complexity risk.
- Some roadmap sources still mention Phase 1 stabilization while founder memory says Phase 2 is active. This can create response inconsistency if a route uses old roadmap fallback instead of founder memory.
- The system has many hardening/transplant/convergence engines. Many are small reasoning/report modules, but the large number of files increases cognitive load and split-brain risk.
- WhatsApp conversation can still feel schema/template-heavy because `memory-policy-enforcer` and `execution-schema-enforcer` prepend deterministic fields to all route outputs.
- Render disk is not a reliable long-term store unless state is committed or pushed to GitHub.
- NVIDIA/Meta/Twilio/GitHub behavior depends entirely on environment variables being present and valid.
- The agents are not equivalent to Codex. They are narrower, rule-bound systems with model calls, memory files, and workflow dispatch, but no full IDE-level contextual execution loop.

Attempted and partially repaired failure modes:

- Nonsense prompts triggering FIX loops.
- Conversation being routed to execution.
- Preservation mode being conversational only.
- Screenshot commands only sending GitHub links instead of media.
- Agents returning template roadmap blocks instead of answering the actual question.
- Missing founder context across deployed agents.
- Claims of full memory without loaded memory sources.

Needs founder attention:

- Confirm final Phase 2 killer feature and first demo.
- Decide how much schema text is acceptable in WhatsApp replies.
- Resolve Product Lab emulator/System UI stability.
- Review whether Phase 1 roadmap-lock files should be updated to Phase 2 foundation-protected wording.
- Decide whether to keep or retire donor standalone `C:\Users\ADMIN\ai-cto` after verified founder-DNA absorption.

## 10. Current Health

Latest inspected brain state:

- Health score: `65/100`
- Momentum: `STALLED`
- Last analysis: `2026-05-22T08:33:50.027Z`
- Scan mode: `LIVE_REPO_SCAN`
- Hardcoded secret count: `0`

Active unresolved issues in `.brain_state.json`:

1. `ai-cto/whatsapp/natural-response-builder.js` is too large (>500 lines).
2. `app/src/main/java/com/example/mykeyboard/KeyboardService.kt` is too large (>500 lines).
3. `app/src/main/java/com/example/mykeyboard/MainActivity.kt` is too large (>500 lines).
4. `app/src/main/java/com/example/mykeyboard/metrics/KeyboardMetrics.kt` is too large (>500 lines).
5. `app/src/main/java/com/example/mykeyboard/predictor/BasicPredictor.kt` is too large (>500 lines).
6. `app/src/main/java/com/example/mykeyboard/swipe/SwipeWordResolver.kt` is too large (>500 lines).
7. `app/src/test/java/com/example/mykeyboard/InputReplayFailureInjectionTest.kt` is too large (>500 lines).

Open tasks in `tasks.json`:

- `TASK-0001`: Audit hardcoded secret finding in `BasicPredictor.kt` (legacy seeded task; current brain state hardcoded secret count is 0).
- `TASK-0002`: Review unsafe try block finding in `chaos_test.js`.
- `TASK-0003`: Plan low-risk decomposition review for `KeyboardService.kt`.

Pending items:

- Refresh brain state with current code and roadmap.
- Repair or stabilize Product Lab screenshot capture so screenshots show the keyboard, not Android error dialogs.
- Reduce WhatsApp response templating while preserving deterministic safety.
- Align all runtime roadmap readers with founder memory: Phase 1 protected foundation, Phase 2 Explain active.

## Briefing Summary

Aritenis CTO is a governed WhatsApp/GitHub/Render agent system for managing an Android keyboard product. It can answer founder questions, dispatch builds and Product Lab runs, store founder/project memory, scan repo health, and apply very limited low-risk fixes. Its strongest current value is operational continuity and safety. Its weakest current area is conversational/product judgment consistency under WhatsApp, especially when multiple memory/roadmap layers disagree.

The canonical system to brief or modify is `C:\Users\ADMIN\AndroidStudioProjects\MyKeyboard\ai-cto`. The standalone `C:\Users\ADMIN\ai-cto` should be treated as founder-DNA donor material unless explicitly promoted through a controlled transplant process.
