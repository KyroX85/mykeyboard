const DEFAULT_WORKFLOW = 'build-and-distribute.yml';
const PRODUCT_LAB_WORKFLOW = 'product-lab-validation.yml';

function buildDispatchConfig(env = process.env) {
  return {
    token: env.GITHUB_ACTIONS_TOKEN || env.GITHUB_TOKEN || '',
    repository: env.GITHUB_REPOSITORY || '',
    workflow: env.GITHUB_BUILD_WORKFLOW || DEFAULT_WORKFLOW,
    ref: env.GITHUB_BUILD_REF || 'main'
  };
}

async function requestOtaBuild({ triggeredBy = 'whatsapp' } = {}, env = process.env) {
  const config = buildDispatchConfig(env);
  return requestWorkflowDispatch({
    workflow: config.workflow,
    ref: config.ref,
    inputs: {
      triggered_by: triggeredBy,
      force: 'true'
    },
    successMessage: 'Firebase OTA build workflow queued.',
    userAgent: 'aritenis-whatsapp-build-dispatcher'
  }, env);
}

async function requestProductLabScreenshot({ triggeredBy = 'whatsapp', fetchImpl = fetch } = {}, env = process.env) {
  const config = buildDispatchConfig(env);
  const workflow = env.GITHUB_PRODUCT_LAB_WORKFLOW || PRODUCT_LAB_WORKFLOW;
  const result = await requestWorkflowDispatch({
    workflow,
    ref: env.GITHUB_PRODUCT_LAB_REF || config.ref,
    inputs: {},
    successMessage: 'Product Lab screenshot workflow queued.',
    userAgent: 'aritenis-whatsapp-product-lab-dispatcher',
    fetchImpl
  }, env);
  if (result.status !== 'QUEUED') return result;
  return {
    ...result,
    workflow,
    workflowUrl: `https://github.com/${config.repository}/actions/workflows/${workflow}`,
    runsUrl: `https://github.com/${config.repository}/actions/workflows/${workflow}?query=branch%3A${encodeURIComponent(env.GITHUB_PRODUCT_LAB_REF || config.ref)}`,
    artifactName: 'product-lab-validation',
    triggeredBy
  };
}

async function requestWorkflowDispatch({
  workflow = DEFAULT_WORKFLOW,
  ref = 'main',
  inputs = {},
  successMessage = 'GitHub workflow queued.',
  userAgent = 'aritenis-whatsapp-dispatcher',
  fetchImpl = fetch
} = {}, env = process.env) {
  const config = buildDispatchConfig(env);
  if (!config.token || !config.repository) {
    return {
      status: 'CONFIG_REQUIRED',
      message: 'Set GITHUB_ACTIONS_TOKEN and GITHUB_REPOSITORY to enable WhatsApp workflow dispatch.'
    };
  }

  const response = await fetchImpl(
    `https://api.github.com/repos/${config.repository}/actions/workflows/${workflow}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': userAgent
      },
      body: JSON.stringify({
        ref,
        inputs
      })
    }
  );

  if (!response.ok) {
    return {
      status: 'FAILED',
      message: `GitHub workflow dispatch failed with HTTP ${response.status}.`
    };
  }

  return {
    status: 'QUEUED',
    message: successMessage
  };
}

module.exports = {
  buildDispatchConfig,
  requestOtaBuild,
  requestProductLabScreenshot,
  requestWorkflowDispatch
};
