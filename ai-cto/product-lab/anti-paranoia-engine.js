function reduceParanoia({ response = '', productDiscussion = false } = {}) {
  if (!productDiscussion) {
    return { response, warningsRemoved: 0 };
  }
  let output = String(response || '');
  let warningsRemoved = 0;
  for (const pattern of [
    /NOISE \/ STRESS TEST DETECTED\.?\s*/gi,
    /LOW INFORMATION DETECTED\.?\s*/gi,
    /AMBIGUOUS INTENT DETECTED\.?\s*/gi,
    /suspicious intent detected\.?\s*/gi,
    /governance warning\.?\s*/gi
  ]) {
    const before = output;
    output = output.replace(pattern, '');
    if (before !== output) warningsRemoved += 1;
  }
  return {
    response: output.trim(),
    warningsRemoved
  };
}

module.exports = { reduceParanoia };
