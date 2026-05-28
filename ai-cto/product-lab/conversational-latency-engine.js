function estimateConversationalLatency({ response = '', warnings = 0, reportSections = 0 } = {}) {
  const words = String(response || '').trim().split(/\s+/).filter(Boolean).length;
  const score = words + Number(warnings || 0) * 20 + Number(reportSections || 0) * 15;
  return {
    score,
    level: score <= 40 ? 'LIGHT' : score <= 90 ? 'MODERATE' : 'HEAVY',
    guidance: score <= 40 ? 'conversation remains lightweight' : 'response may feel operationally heavy'
  };
}

module.exports = { estimateConversationalLatency };
