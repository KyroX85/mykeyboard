const assert = require('assert');
const {
  buildDispatchConfig,
  requestOtaBuild
} = require('../whatsapp/build-dispatcher');

const config = buildDispatchConfig({
  GITHUB_ACTIONS_TOKEN: 'token',
  GITHUB_REPOSITORY: 'KyroX85/mykeyboard',
  GITHUB_BUILD_WORKFLOW: 'build-and-distribute.yml',
  GITHUB_BUILD_REF: 'main'
});

assert.strictEqual(config.repository, 'KyroX85/mykeyboard');
assert.strictEqual(config.workflow, 'build-and-distribute.yml');
assert.strictEqual(config.ref, 'main');

requestOtaBuild({}, {}).then((result) => {
  assert.strictEqual(result.status, 'CONFIG_REQUIRED');
  console.log('Build dispatcher checks passed.');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
