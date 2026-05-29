const assert = require('assert');
const path = require('path');

const {
  ALLOWED_BOUNDARY,
  FORBIDDEN_BOUNDARY,
  discoverPrivacySurfaces,
  enforcePrivacyBoundary,
  sharedPreferencesAudit
} = require('../canonical-privacy-registry');
const { unifyAuditContext } = require('../audit-context-unifier');
const { inspectDatasetVisibility } = require('../dataset-visibility-engine');
const { detectHiddenDataflowRisks } = require('../hidden-dataflow-detector');
const { detectOrphanTelemetry } = require('../orphan-telemetry-detector');
const { detectAuditBlindspots } = require('../audit-blindspot-engine');
const { resolveCrossContextReality } = require('../cross-context-reality-engine');
const { enforceCanonicalPrivacyBoundary } = require('../privacy-boundary-enforcer');
const { resolveCanonicalDataflowAuthority } = require('../canonical-dataflow-authority');
const { buildPrivacySurfaceMap } = require('../privacy-surface-mapper');

const root = path.resolve(__dirname, '..', '..');

const registry = discoverPrivacySurfaces({ root });
assert(ALLOWED_BOUNDARY.includes('aggregate metrics'));
assert(FORBIDDEN_BOUNDARY.includes('raw typed text'));
assert(registry.surfaces.some((surface) => surface.id === 'predictor-sharedpreferences'));
assert(registry.surfaces.some((surface) => surface.id === 'ai-cto-datasets'));
assert(registry.surfaces.some((surface) => surface.id === 'supabase-helper'));
assert(registry.auditConfidence.score > 50);

const dataset = inspectDatasetVisibility({ root });
assert(dataset.canonicalDatasetSurface);
assert.strictEqual(dataset.canonicalDatasetSurface.id, 'ai-cto-datasets');
assert.strictEqual(dataset.canonicalDatasetSurface.classification, 'DEAD');

const prefs = sharedPreferencesAudit({ root });
assert.strictEqual(prefs.stores[0].name, 'keyboard_predictions');
assert.strictEqual(prefs.stores[0].rawTypedWordsStored, true);
assert.strictEqual(prefs.backupExcluded, true);
assert(prefs.stores[0].deletion.includes('clearModel removes'));

const boundary = enforcePrivacyBoundary({ root });
assert.strictEqual(boundary.decision, 'HARDEN_BEFORE_PRIVACY_CLAIM');
assert(boundary.dangerous.some((surface) => surface.id === 'supabase-helper'));

const unified = unifyAuditContext({ root });
assert.strictEqual(unified.context, 'CANONICAL_AI_CTO_PRIVACY_CONTEXT');
assert(unified.surfaces.length >= 10);

const hidden = detectHiddenDataflowRisks({ root });
assert(Array.isArray(hidden.blindspots));

const orphan = detectOrphanTelemetry({ root });
assert(Array.isArray(orphan));

const blindspots = detectAuditBlindspots({ root });
assert(blindspots.auditConfidence.level);

const crossContext = resolveCrossContextReality({ root });
assert.strictEqual(crossContext.productChat, crossContext.ctoChat);
assert.strictEqual(crossContext.datasets, crossContext.reports);

const enforced = enforceCanonicalPrivacyBoundary({ root });
assert.strictEqual(enforced.decision, boundary.decision);

const authority = resolveCanonicalDataflowAuthority({ root });
assert(authority.authorities.privacyRegistry.includes('canonical-privacy-registry'));

const surfaceMap = buildPrivacySurfaceMap({ root });
assert(surfaceMap.some((surface) => surface.category === 'backup'));
assert(surfaceMap.some((surface) => surface.category === 'cloud'));

console.log('Canonical privacy boundary checks passed');
