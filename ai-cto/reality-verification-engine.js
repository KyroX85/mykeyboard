const fs = require('fs');
const path = require('path');

function verifyReality(checks = {}) {
  const results = [];
  results.push(check('file existence', existsAll(checks.files || []), 'some required files are missing'));
  results.push(check('import validity', checks.importsValid === true, 'imports not verified'));
  results.push(check('runtime accessibility', checks.runtimeAccessible === true, 'runtime not verified'));
  results.push(check('build success', checks.buildPassed === true, 'build not verified'));
  results.push(check('execution success', checks.executionPassed === true, 'execution not verified'));
  results.push(check('report freshness', checks.reportFresh === true, 'report may be stale'));
  results.push(check('governance activation', checks.governanceActive === true, 'governance not active'));
  return {
    verified: results.every((r) => r.passed),
    checks: results
  };
}

function check(name, passed, failMessage) {
  return { name, passed: Boolean(passed), failMessage: passed ? null : failMessage };
}

function existsAll(files) {
  return files.every((file) => fs.existsSync(path.resolve(file)));
}

module.exports = { verifyReality };

