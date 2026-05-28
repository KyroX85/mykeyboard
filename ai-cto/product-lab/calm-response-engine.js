function calmProductResponse(lines = []) {
  return lines
    .filter((line) => line !== undefined && line !== null && String(line).trim() !== '')
    .join('\n');
}

function noLowInfoSpam(text = '') {
  return !/AMBIGUOUS INTENT DETECTED|NOISE \/ STRESS TEST DETECTED|Fix available|Reply FIX/i.test(text);
}

module.exports = {
  calmProductResponse,
  noLowInfoSpam
};
