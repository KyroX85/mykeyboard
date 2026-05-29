const assert = require('assert');

const {
  requestProductLabScreenshot
} = require('../whatsapp/build-dispatcher');
const { routeMessageWithAi } = require('../whatsapp/command-router');

(async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 204 };
  };
  const env = {
    GITHUB_ACTIONS_TOKEN: 'test-token',
    GITHUB_REPOSITORY: 'KyroX85/mykeyboard',
    GITHUB_PRODUCT_LAB_REF: 'main'
  };

  const dispatch = await requestProductLabScreenshot({ triggeredBy: 'whatsapp', fetchImpl }, env);
  assert.strictEqual(dispatch.status, 'QUEUED');
  assert.strictEqual(dispatch.workflow, 'product-lab-validation.yml');
  assert.strictEqual(dispatch.artifactName, 'product-lab-validation');
  assert(dispatch.runsUrl.includes('KyroX85/mykeyboard'));
  assert.strictEqual(calls.length, 1);
  assert(calls[0].url.includes('/actions/workflows/product-lab-validation.yml/dispatches'));
  assert.strictEqual(JSON.parse(calls[0].options.body).ref, 'main');

  const routed = await routeMessageWithAi('screenshot', {}, {}, { env, fetchImpl });
  assert.strictEqual(routed.command, 'product_lab_screenshot_workflow');
  assert.strictEqual(routed.matchedRoute, 'product_lab_screenshot_workflow');
  assert(routed.response.includes('Product Lab screenshot workflow queued'));
  assert(routed.response.includes('Artifact: product-lab-validation'));

  const missingConfig = await routeMessageWithAi('cloud screenshot', {}, {}, {
    env: {},
    fetchImpl
  });
  assert.strictEqual(missingConfig.command, 'product_lab_screenshot_workflow_config_required');
  assert(missingConfig.response.includes('GITHUB_ACTIONS_TOKEN'));

  console.log('Product Lab GitHub dispatch checks passed');
})();
