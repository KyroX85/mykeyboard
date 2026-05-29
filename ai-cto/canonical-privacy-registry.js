const fs = require('fs');
const path = require('path');

const ALLOWED_BOUNDARY = Object.freeze([
  'aggregate metrics',
  'anonymous UX evidence',
  'scripted emulator screenshots',
  'retention pressure',
  'friction statistics'
]);

const FORBIDDEN_BOUNDARY = Object.freeze([
  'raw typed text',
  'personal sentences',
  'clipboard data',
  'user phrases',
  'recoverable swipe trails',
  'personally reconstructable telemetry'
]);

const CANONICAL_AUTHORITIES = Object.freeze({
  privacyRegistry: 'ai-cto/canonical-privacy-registry.js',
  dataflowAuthority: 'ai-cto/canonical-dataflow-authority.js',
  aggregateRuntimeSignals: 'app/src/main/java/com/example/mykeyboard/metrics/ProductSignalBridge.kt',
  aggregateEvidenceArchive: 'ai-cto/product-evidence-archive.json',
  runtimeMetricsSchema: 'app/src/main/java/com/example/mykeyboard/metrics/KeyboardMetrics.kt',
  localPredictorPersistence: 'app/src/main/java/com/example/mykeyboard/predictor/BasicPredictor.kt',
  whatsappBoundary: 'ai-cto/whatsapp-server.js',
  productLabBoundary: 'ai-cto/product-lab'
});

const SURFACE_DEFINITIONS = Object.freeze([
  {
    id: 'android-runtime-keyboard',
    patterns: ['app/src/main/java/com/example/mykeyboard/KeyboardService.kt'],
    category: 'runtime',
    authority: 'KeyboardService.kt',
    risk: 'ACTIVE_RISK',
    reason: 'Contains in-memory currentWord/contextWords and cloud-capable Supabase helper.'
  },
  {
    id: 'predictor-sharedpreferences',
    patterns: ['app/src/main/java/com/example/mykeyboard/predictor/BasicPredictor.kt'],
    category: 'sharedpreferences',
    authority: 'BasicPredictor.kt',
    risk: 'ACTIVE_RISK',
    reason: 'Stores learned raw word keys in app-private SharedPreferences JSON.'
  },
  {
    id: 'keyboard-prefs',
    patterns: ['app/src/main/java/com/example/mykeyboard/KeyboardService.kt'],
    category: 'sharedpreferences',
    authority: 'KeyboardService.kt',
    risk: 'THEORETICAL_RISK',
    reason: 'Stores user_id and recent emojis; not typed words, but backup/export surface exists.'
  },
  {
    id: 'runtime-aggregate-metrics',
    patterns: ['app/src/main/java/com/example/mykeyboard/metrics/KeyboardMetrics.kt'],
    category: 'metrics',
    authority: 'KeyboardMetrics.kt',
    risk: 'SAFE',
    reason: 'Usage snapshots are aggregate counters; accepted words are hashed before metric reporting.'
  },
  {
    id: 'local-product-ingestion',
    patterns: ['ai-cto/product-metrics-ingest.js', 'ai-cto/product-signal-pipeline.js'],
    category: 'ingestion',
    authority: 'product-metrics-ingest.js',
    risk: 'SAFE',
    reason: 'Rejects raw-content-shaped keys and archives sanitized aggregate evidence.'
  },
  {
    id: 'product-evidence-archive',
    patterns: ['ai-cto/product-evidence-archive.json'],
    category: 'archive',
    authority: 'product-governance.js',
    risk: 'SAFE',
    reason: 'Aggregate product evidence only.'
  },
  {
    id: 'ai-cto-datasets',
    patterns: ['ai-cto/datasets'],
    category: 'dataset',
    authority: 'canonical privacy registry',
    risk: 'DEAD',
    reason: 'Directory absent in current tracked working tree.'
  },
  {
    id: 'product-lab-screenshots',
    patterns: ['ai-cto/product-lab', '.github/workflows/product-lab-validation.yml'],
    category: 'screenshots',
    authority: 'product-lab',
    risk: 'THEORETICAL_RISK',
    reason: 'Scripted emulator screenshots are allowed; real-device screenshots could expose personal content.'
  },
  {
    id: 'github-actions-artifacts',
    patterns: ['.github/workflows'],
    category: 'artifacts',
    authority: 'GitHub Actions workflows',
    risk: 'THEORETICAL_RISK',
    reason: 'Artifact upload can preserve any generated file under uploaded paths.'
  },
  {
    id: 'whatsapp-operational-memory',
    patterns: ['ai-cto/whatsapp', 'ai-cto/founder-memory.json'],
    category: 'whatsapp',
    authority: 'whatsapp-server.js',
    risk: 'ACTIVE_RISK',
    reason: 'Founder operational messages are routed and remembered; no keyboard typed-text path found.'
  },
  {
    id: 'supabase-helper',
    patterns: ['app/src/main/java/com/example/mykeyboard/KeyboardService.kt', 'app/build.gradle.kts'],
    category: 'cloud',
    authority: 'KeyboardService.kt',
    risk: 'DANGEROUS',
    reason: 'Generic cloud-capable helper can serialize arbitrary data if called.'
  },
  {
    id: 'nvidia-cloud-agent',
    patterns: ['ai-cto/whatsapp/nvidia-nim-client.js'],
    category: 'cloud',
    authority: 'nvidia-nim-client.js',
    risk: 'ACTIVE_RISK',
    reason: 'Can send founder operational prompts to a cloud AI provider when configured.'
  },
  {
    id: 'backup-rules',
    patterns: ['app/src/main/res/xml/backup_rules.xml', 'app/src/main/res/xml/data_extraction_rules.xml'],
    category: 'backup',
    authority: 'Android backup rules',
    risk: 'THEORETICAL_RISK',
    reason: 'Backup/export policy determines whether app-private preferences can leave the device.'
  },
  {
    id: 'sqlite',
    patterns: ['*.db', '*.sqlite'],
    category: 'sqlite',
    authority: 'none found',
    risk: 'DEAD',
    reason: 'No SQLite/Room runtime path found.'
  }
]);

function discoverPrivacySurfaces({ root = process.cwd() } = {}) {
  const allFiles = listFiles(root);
  const surfaces = SURFACE_DEFINITIONS.map((definition) => {
    const matches = matchPatterns(root, allFiles, definition.patterns);
    const visible = matches.length > 0;
    return {
      ...definition,
      visible,
      matchedPaths: matches.map((file) => normalizePath(path.relative(root, file))),
      classification: visible ? definition.risk : missingClassification(definition),
      visibilityConfidence: visible ? 'HIGH' : definition.risk === 'DEAD' ? 'MEDIUM' : 'LOW'
    };
  });

  const hidden = detectHiddenDataflows({ root, allFiles, surfaces });
  const auditConfidence = computeAuditConfidence(surfaces, hidden);

  return {
    generatedAt: new Date().toISOString(),
    root,
    allowedBoundary: ALLOWED_BOUNDARY,
    forbiddenBoundary: FORBIDDEN_BOUNDARY,
    canonicalAuthorities: CANONICAL_AUTHORITIES,
    surfaces,
    hidden,
    auditConfidence
  };
}

function enforcePrivacyBoundary({ root = process.cwd() } = {}) {
  const registry = discoverPrivacySurfaces({ root });
  const dangerous = registry.surfaces.filter((surface) =>
    ['DANGEROUS', 'ACTIVE_RISK'].includes(surface.classification)
  );
  const orphanTelemetry = registry.hidden.orphanTelemetry;
  const blindspots = registry.hidden.blindspots;
  return {
    allowedBoundary: ALLOWED_BOUNDARY,
    forbiddenBoundary: FORBIDDEN_BOUNDARY,
    decision: dangerous.some((surface) => surface.id === 'supabase-helper') ? 'HARDEN_BEFORE_PRIVACY_CLAIM' : 'ALLOW_AUDIT_ONLY',
    dangerous,
    orphanTelemetry,
    blindspots,
    auditConfidence: registry.auditConfidence,
    canonicalAuthorities: registry.canonicalAuthorities
  };
}

function mapPrivacySurface({ root = process.cwd() } = {}) {
  const registry = discoverPrivacySurfaces({ root });
  return registry.surfaces.map((surface) => ({
    id: surface.id,
    category: surface.category,
    classification: surface.classification,
    authority: surface.authority,
    matchedPaths: surface.matchedPaths,
    reason: surface.reason
  }));
}

function detectHiddenDataflows({ root = process.cwd(), allFiles = listFiles(root), surfaces = [] } = {}) {
  const relativeFiles = allFiles.map((file) => normalizePath(path.relative(root, file)));
  const datasetLike = relativeFiles.filter((file) => /(^|\/)(datasets?|collected_data|dataset-sync|exports?)(\/|\.|$)/i.test(file));
  const telemetryLike = relativeFiles.filter((file) => /(telemetry|analytics|crashlytics|upload|sync|export|supabase|firebase)/i.test(file));
  const persistenceLike = relativeFiles.filter((file) => /(memory|archive|report|log|\.json$|\.db$|\.sqlite$)/i.test(file));
  const knownMatches = new Set(surfaces.flatMap((surface) => surface.matchedPaths || []));
  const orphanTelemetry = telemetryLike.filter((file) => !knownMatches.has(file));
  const blindspots = [];

  if (!relativeFiles.some((file) => file === 'ai-cto/datasets' || file.startsWith('ai-cto/datasets/'))) {
    blindspots.push('ai-cto/datasets directory is absent; dataset visibility is verified as absent in this checkout, not globally absent.');
  }
  if (relativeFiles.some((file) => file.startsWith('.ai-pipeline/reports/'))) {
    blindspots.push('.ai-pipeline/reports exists locally and is ignored; generated artifacts can be invisible to source-only audits.');
  }
  if (!relativeFiles.some((file) => file.includes('data_extraction_rules.xml'))) {
    blindspots.push('Android data extraction rules not found.');
  }

  return {
    datasetLike,
    telemetryLike,
    persistenceLike,
    orphanTelemetry,
    blindspots
  };
}

function sharedPreferencesAudit({ root = process.cwd() } = {}) {
  const predictor = readFile(root, 'app/src/main/java/com/example/mykeyboard/predictor/BasicPredictor.kt');
  const service = readFile(root, 'app/src/main/java/com/example/mykeyboard/KeyboardService.kt');
  const backup = readFile(root, 'app/src/main/res/xml/backup_rules.xml');
  const extraction = readFile(root, 'app/src/main/res/xml/data_extraction_rules.xml');
  return {
    stores: [
      {
        name: 'keyboard_predictions',
        exactData: ['predictor_model_v2 JSON', 'bigram_model legacy JSON', 'word_count'],
        rawTypedWordsStored: /snapshotFlatJson|snapshotNestedJson|learnWord|learnAcceptedSuggestion/.test(predictor),
        maxSize: 'MAX_PERSISTED_MODEL_CHARS=120000, MAX_MODEL_SIZE=1500, MAX_ROW_SIZE=64',
        retention: 'Until clearModel(), app data clear, uninstall, or model corruption clear.',
        deletion: /fun clearModel\(\)[\s\S]*remove\(PREFS_MODEL_KEY\)[\s\S]*remove\(PREFS_BIGRAM_KEY\)/.test(predictor)
          ? 'clearModel removes active and legacy model keys.'
          : 'UNVERIFIED'
      },
      {
        name: 'keyboard_prefs',
        exactData: ['emoji_recents_v1', 'user_id'],
        rawTypedWordsStored: false,
        maxSize: 'recent emoji list capped at 40; user_id is one UUID',
        retention: 'Until app data clear/uninstall or explicit future reset.',
        deletion: 'No explicit full deletion helper found.'
      }
    ],
    backupExcluded: backup.includes('path="keyboard_predictions.xml"') &&
      backup.includes('path="keyboard_prefs.xml"') &&
      extraction.includes('path="keyboard_predictions.xml"') &&
      extraction.includes('path="keyboard_prefs.xml"'),
    exportLeakRisk: 'Device backup/export was a theoretical risk unless these sharedpref files are excluded.'
  };
}

function computeAuditConfidence(surfaces, hidden) {
  const visibleCount = surfaces.filter((surface) => surface.visible || surface.classification === 'DEAD').length;
  const total = surfaces.length || 1;
  const score = Math.max(0, Math.min(100, Math.round((visibleCount / total) * 100) - hidden.blindspots.length * 7));
  return {
    score,
    level: score >= 85 ? 'HIGH' : score >= 65 ? 'MEDIUM' : 'LOW',
    reason: `${visibleCount}/${total} canonical surfaces resolved; ${hidden.blindspots.length} blindspot(s) remain.`
  };
}

function matchPatterns(root, allFiles, patterns) {
  const matches = [];
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\./g, '\\.').replace(/\*/g, '.*'), 'i');
      matches.push(...allFiles.filter((file) => regex.test(normalizePath(path.relative(root, file)))));
      continue;
    }
    const full = path.join(root, pattern);
    if (fs.existsSync(full)) {
      matches.push(full);
      continue;
    }
    matches.push(...allFiles.filter((file) => normalizePath(path.relative(root, file)).startsWith(normalizePath(pattern).replace(/\/$/, ''))));
  }
  return [...new Set(matches)];
}

function missingClassification(definition) {
  if (definition.risk === 'DEAD') return 'DEAD';
  return 'UNVERIFIED';
}

function listFiles(root) {
  const ignored = new Set(['.git', 'node_modules', '.gradle']);
  const output = [];
  walk(root);
  return output;

  function walk(dir) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        output.push(full);
      }
    }
  }
}

function readFile(root, relativePath) {
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
  } catch {
    return '';
  }
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

module.exports = {
  ALLOWED_BOUNDARY,
  FORBIDDEN_BOUNDARY,
  CANONICAL_AUTHORITIES,
  SURFACE_DEFINITIONS,
  discoverPrivacySurfaces,
  enforcePrivacyBoundary,
  mapPrivacySurface,
  detectHiddenDataflows,
  sharedPreferencesAudit
};
