const DEFAULT_WORKFLOW = 'build-and-distribute.yml';

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
  if (!config.token || !config.repository) {
    return {
      status: 'CONFIG_REQUIRED',
      message: 'Set GITHUB_ACTIONS_TOKEN and GITHUB_REPOSITORY to enable WhatsApp build dispatch.'
    };
  }

  const response = await fetch(
    `https://api.github.com/repos/${config.repository}/actions/workflows/${config.workflow}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'aritenis-whatsapp-build-dispatcher'
      },
      body: JSON.stringify({
        ref: config.ref,
        inputs: {
          triggered_by: triggeredBy,
          force: 'true'
        }
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
    message: 'Firebase OTA build workflow queued.'
  };
}

module.exports = {
  buildDispatchConfig,
  requestOtaBuild
};
