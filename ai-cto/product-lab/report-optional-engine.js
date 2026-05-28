function shouldGenerateReport(message = '') {
  const text = String(message || '');
  const allowed = /\bgenerate report\b/i.test(text);
  return {
    allowed,
    reason: allowed
      ? 'founder explicitly requested report generation'
      : 'reports are optional and not generated from conversation'
  };
}

module.exports = { shouldGenerateReport };
