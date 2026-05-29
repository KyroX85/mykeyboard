const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { buildDispatchConfig } = require('./build-dispatcher');
const { buildPublicScreenshotUrl } = require('../product-lab/whatsapp-screenshot-capture');

const PRODUCT_LAB_WORKFLOW = 'product-lab-validation.yml';
const PRODUCT_LAB_ARTIFACT = 'product-lab-validation';

async function fetchLatestProductLabScreenshot({
  root = process.cwd(),
  publicBaseUrl = '',
  env = process.env,
  fetchImpl = fetch
} = {}) {
  const config = buildDispatchConfig(env);
  if (!config.token) {
    return {
      status: 'CONFIG_REQUIRED',
      message: 'Set GITHUB_ACTIONS_TOKEN on Render to fetch Product Lab artifacts.'
    };
  }

  const workflow = env.GITHUB_PRODUCT_LAB_WORKFLOW || PRODUCT_LAB_WORKFLOW;
  const ref = env.GITHUB_PRODUCT_LAB_REF || config.ref;
  const latestRun = await fetchLatestRun({ config, workflow, ref, fetchImpl });
  if (!latestRun) {
    return {
      status: 'NO_RUN',
      message: 'No Product Lab workflow run found yet.'
    };
  }
  if (latestRun.status !== 'completed') {
    return {
      status: 'IN_PROGRESS',
      message: 'Product Lab workflow is still running.',
      runUrl: latestRun.html_url,
      runId: latestRun.id
    };
  }
  if (latestRun.conclusion !== 'success') {
    return {
      status: 'FAILED',
      message: `Product Lab workflow finished with ${latestRun.conclusion || 'unknown'} conclusion.`,
      runUrl: latestRun.html_url,
      runId: latestRun.id
    };
  }

  const artifact = await fetchProductLabArtifact({ config, runId: latestRun.id, fetchImpl });
  if (!artifact) {
    return {
      status: 'NO_ARTIFACT',
      message: 'Product Lab run succeeded, but product-lab-validation artifact was not found.',
      runUrl: latestRun.html_url,
      runId: latestRun.id
    };
  }

  const zip = await fetchArtifactZip({ config, archiveDownloadUrl: artifact.archive_download_url, fetchImpl });
  const screenshot = extractFirstPng(zip);
  if (!screenshot) {
    return {
      status: 'NO_SCREENSHOT',
      message: 'Product Lab artifact did not contain a screenshot PNG.',
      runUrl: latestRun.html_url,
      runId: latestRun.id
    };
  }

  const outputDir = path.join(root, 'artifacts', 'product-lab', 'screenshots');
  fs.mkdirSync(outputDir, { recursive: true });
  const fileName = `github-product-lab-${latestRun.id}.png`;
  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, screenshot.bytes);

  return {
    status: 'READY',
    message: 'Product Lab screenshot is ready.',
    runUrl: latestRun.html_url,
    runId: latestRun.id,
    fileName,
    filePath,
    publicUrl: buildPublicScreenshotUrl({ publicBaseUrl, fileName }),
    mediaUrls: publicBaseUrl ? [buildPublicScreenshotUrl({ publicBaseUrl, fileName })] : [],
    artifactName: artifact.name,
    screenshotPath: screenshot.name
  };
}

async function fetchLatestRun({ config, workflow, ref, fetchImpl }) {
  const url = `https://api.github.com/repos/${config.repository}/actions/workflows/${encodeURIComponent(workflow)}/runs?branch=${encodeURIComponent(ref)}&per_page=10`;
  const payload = await fetchGitHubJson({ config, url, fetchImpl });
  const runs = Array.isArray(payload.workflow_runs) ? payload.workflow_runs : [];
  return runs.find((run) => run.event === 'workflow_dispatch') || runs[0] || null;
}

async function fetchProductLabArtifact({ config, runId, fetchImpl }) {
  const url = `https://api.github.com/repos/${config.repository}/actions/runs/${encodeURIComponent(runId)}/artifacts`;
  const payload = await fetchGitHubJson({ config, url, fetchImpl });
  const artifacts = Array.isArray(payload.artifacts) ? payload.artifacts : [];
  return artifacts.find((artifact) => artifact.name === PRODUCT_LAB_ARTIFACT && !artifact.expired) || null;
}

async function fetchArtifactZip({ config, archiveDownloadUrl, fetchImpl }) {
  const response = await fetchImpl(archiveDownloadUrl, {
    headers: githubHeaders(config)
  });
  if (!response.ok) {
    throw new Error(`Artifact download failed with HTTP ${response.status}.`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function fetchGitHubJson({ config, url, fetchImpl }) {
  const response = await fetchImpl(url, {
    headers: githubHeaders(config)
  });
  if (!response.ok) {
    throw new Error(`GitHub API request failed with HTTP ${response.status}.`);
  }
  return response.json();
}

function githubHeaders(config) {
  return {
    Authorization: `Bearer ${config.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'aritenis-product-lab-artifact-fetcher'
  };
}

function extractFirstPng(zipBuffer) {
  const centralDirectoryPng = extractFirstPngFromCentralDirectory(zipBuffer);
  if (centralDirectoryPng) return centralDirectoryPng;

  let offset = 0;
  while (offset + 30 <= zipBuffer.length) {
    const signature = zipBuffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) break;

    const method = zipBuffer.readUInt16LE(offset + 8);
    const compressedSize = zipBuffer.readUInt32LE(offset + 18);
    const fileNameLength = zipBuffer.readUInt16LE(offset + 26);
    const extraLength = zipBuffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + fileNameLength;
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;
    const name = zipBuffer.slice(nameStart, nameEnd).toString('utf8');
    const compressed = zipBuffer.slice(dataStart, dataEnd);

    if (name.toLowerCase().endsWith('.png')) {
      const bytes = method === 0
        ? compressed
        : method === 8
          ? zlib.inflateRawSync(compressed)
          : null;
      if (bytes) return { name, bytes };
    }

    offset = dataEnd;
  }
  return null;
}

function extractFirstPngFromCentralDirectory(zipBuffer) {
  const endOffset = findEndOfCentralDirectory(zipBuffer);
  if (endOffset < 0) return null;

  const centralDirectorySize = zipBuffer.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = zipBuffer.readUInt32LE(endOffset + 16);
  let offset = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;

  while (offset + 46 <= end && offset + 46 <= zipBuffer.length) {
    const signature = zipBuffer.readUInt32LE(offset);
    if (signature !== 0x02014b50) break;

    const method = zipBuffer.readUInt16LE(offset + 10);
    const compressedSize = zipBuffer.readUInt32LE(offset + 20);
    const fileNameLength = zipBuffer.readUInt16LE(offset + 28);
    const extraLength = zipBuffer.readUInt16LE(offset + 30);
    const commentLength = zipBuffer.readUInt16LE(offset + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    const name = zipBuffer.slice(nameStart, nameEnd).toString('utf8');

    if (name.toLowerCase().endsWith('.png')) {
      const bytes = readLocalFileBytes(zipBuffer, {
        method,
        compressedSize,
        localHeaderOffset
      });
      if (bytes) return { name, bytes };
    }

    offset = nameEnd + extraLength + commentLength;
  }

  return null;
}

function readLocalFileBytes(zipBuffer, { method, compressedSize, localHeaderOffset }) {
  if (localHeaderOffset + 30 > zipBuffer.length) return null;
  if (zipBuffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) return null;
  const fileNameLength = zipBuffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = zipBuffer.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + compressedSize;
  if (dataEnd > zipBuffer.length) return null;
  const compressed = zipBuffer.slice(dataStart, dataEnd);
  if (method === 0) return compressed;
  if (method === 8) return zlib.inflateRawSync(compressed);
  return null;
}

function findEndOfCentralDirectory(zipBuffer) {
  const minOffset = Math.max(0, zipBuffer.length - 65557);
  for (let offset = zipBuffer.length - 22; offset >= minOffset; offset -= 1) {
    if (zipBuffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

module.exports = {
  PRODUCT_LAB_ARTIFACT,
  PRODUCT_LAB_WORKFLOW,
  extractFirstPng,
  fetchLatestProductLabScreenshot
};
