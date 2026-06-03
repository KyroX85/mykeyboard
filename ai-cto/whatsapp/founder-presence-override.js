const FORBIDDEN_FOUNDER_VISIBLE_PATTERNS = [
  /^Memory Sources Used\s*:/i,
  /^Route Confidence\s*:/i,
  /^Strategic Memory Used\s*:/i,
  /^Strategic memory\s*:/i,
  /^Intent\s*:/i,
  /^Route Reason\s*:/i,
  /^Dream Drift Alerts?\s*:/i,
  /^Internal Diagnostics?\s*:/i,
  /^Health\s*:/i,
  /^Momentum\s*:/i,
  /^Source\s*:\s*unknown/i,
  /^Reason\s*:\s*No verified metric source was loaded/i,
  /^Calculation\s*:\s*unknown/i,
  /^Current Founder Worldview\s*:/i,
  /^Current Founder Mission\s*:/i,
  /^Current Definition of Success\s*:/i,
  /^Current Definition of Failure\s*:/i,
  /^Worldview Confidence\s*:/i,
  /^Previous Vision\s*:/i,
  /^Vision Shift\s*:/i,
  /^Founder State\s*:/i,
  /^Advisor Mode\s*:/i,
  /^Reflection\s*:/i,
  /^Premortem\s*:/i,
  /^Contradiction\s*:/i,
  /^Route\s*:/i,
  /^Engine\s*:/i,
  /^Framework\s*:/i,
  /^Self[-\s]?check\s*:/i,
  /^Objective\s*:/i,
  /^Assumption\s*:/i,
  /^Concern\s*:/i,
  /^Decision\s*:/i,
  /^Desired outcome\s*:/i,
  /^Actual Question\s*:/i,
  /^Objective reconstruction\s*:/i,
  /^Founder objective\s*:/i,
  /^Founder objective I inferred\s*:/i,
  /^Intent confidence\s*:/i,
  /^Evidence used\s*:/i,
  /^Top relevant founder memories\s*:/i,
  /^Uncertainty \/ missing information\s*:/i,
  /^Useful follow-up\s*:/i,
  /^A smarter critic would/i,
  /^This could be wrong because/i,
  /^Confidence\s*:/i,
  /^type\s*:/i
];

const INTERNAL_SECTION_HEADER_PATTERNS = [
  /^Dream alignment\s*:/i,
  /^Contrarian read\s*:/i,
  /^Objective reconstruction\s*:/i,
  /^Evidence used\s*:/i,
  /^Top relevant founder memories\s*:/i,
  /^Uncertainty \/ missing information\s*:/i
];

const INLINE_FORBIDDEN_PATTERNS = [
  /\bMemory Sources Used\s*:[^\n]+/gi,
  /\bRoute Confidence\s*:[^\n]+/gi,
  /\bStrategic Memory Used\s*:[^\n]+/gi,
  /\bRoute Reason\s*:[^\n]+/gi,
  /\bDream Drift Alerts?\s*:[^\n]+/gi,
  /\bInternal Diagnostics?\s*:[^\n]+/gi
];

function enforceFounderPresenceOnRoute(route, context = {}) {
  if (!route || typeof route.response !== 'string') return route;
  const response = enforceFounderPresence(route.response, {
    suppressMetricProvenance: shouldSuppressMetricProvenance(route)
  });
  return {
    ...route,
    details: {
      ...(route.details || {}),
      founderPresenceOverride: true
    },
    response
  };
}

function enforceFounderPresence(response = '', options = {}) {
  const original = String(response || '');
  const withoutInline = INLINE_FORBIDDEN_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, ''),
    original
  );
  const lines = withoutInline
    .split(/\r?\n/)
    .map((line) => stripFrameworkLabel(line.trim()))
    .reduce((kept, line) => {
      const last = kept[kept.length - 1];
      const currentlySkippingSection = last && last.__skipInternalSection;
      if (!line) return kept;
      if (startsInternalSection(line)) {
        kept.push({ __skipInternalSection: true });
        return kept;
      }
      if (currentlySkippingSection && /^[-*]\s+/.test(line)) {
        return kept;
      }
      if (currentlySkippingSection) {
        kept.pop();
      }
      if (options.suppressMetricProvenance && isMetricProvenanceLine(line)) return kept;
      if (!isForbiddenFounderVisibleLine(line)) kept.push(line);
      return kept;
    }, [])
    .filter((line) => typeof line === 'string');

  const cleaned = collapseBlankLines(lines.join('\n'));
  return cleaned || 'I should answer you directly, not expose my internal routing.';
}

function stripFrameworkLabel(line = '') {
  return String(line || '')
    .replace(/^(Surface answer|Deeper answer|Uncomfortable answer|Hidden assumption|Strategic read|Advisor read)\s*:\s*/i, '')
    .replace(/^(Founder Brain|Agent Council|Execution Layer|CTO diagnostics)\s*:\s*/i, '')
    .replace(/^[^\w]*(CTO|CODER|REVIEWER|AUDITOR)\s*:\s*/i, '')
    .replace(/^[^\w]*(CTO|CODER|REVIEWER|AUDITOR)\s*$/i, '')
    .trim();
}

function isForbiddenFounderVisibleLine(line = '') {
  return FORBIDDEN_FOUNDER_VISIBLE_PATTERNS.some((pattern) => pattern.test(String(line || '').trim()));
}

function startsInternalSection(line = '') {
  return INTERNAL_SECTION_HEADER_PATTERNS.some((pattern) => pattern.test(String(line || '').trim()));
}

function isMetricProvenanceLine(line = '') {
  return /^(Source|Reason|Calculation)\s*:/i.test(String(line || '').trim());
}

function shouldSuppressMetricProvenance(route = {}) {
  return [
    'founder_objective_understanding',
    'human_status_check'
  ].includes(route.command || route.matchedRoute);
}

function collapseBlankLines(text = '') {
  return String(text || '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = {
  enforceFounderPresenceOnRoute,
  enforceFounderPresence,
  isForbiddenFounderVisibleLine,
  isMetricProvenanceLine,
  shouldSuppressMetricProvenance,
  startsInternalSection,
  stripFrameworkLabel
};
