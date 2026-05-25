const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const outDir = path.join(root, 'ai-cto');
const logFile = path.join(root, 'test_output.log');
const resultsFile = path.join(outDir, 'validation-results.json');

const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const tasks = [':app:testDebugUnitTest', ':app:assembleDebug', ':app:lintDebug'];
const windowsJavaHomeFallback = 'C:\\Program Files\\Android\\Android Studio\\jbr';

function ensureOutDir() {
  fs.mkdirSync(outDir, { recursive: true });
}

function parseFindings(output, task) {
  const findings = [];
  const lines = output.split(/\r?\n/);
  const patterns = [
    /\bFAILED\b/i,
    /\bFAILURE:/i,
    /\bExecution failed for task\b/i,
    /\bCompilation error\b/i,
    /\berror:/i,
    /\bLint found\b/i,
    /\bException\b/i
  ];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (!patterns.some(pattern => pattern.test(trimmed))) return;

    const fileMatch = trimmed.match(/([\w./\\-]+\.(kt|java|xml|gradle|kts))/i);
    findings.push({
      type: task.includes('lint') ? 'LINT' : 'BUILD_VALIDATION',
      impact: task.includes('assemble') ? 'CRITICAL' : 'HIGH',
      task,
      message: trimmed.slice(0, 300),
      file: fileMatch ? fileMatch[1].replace(/\\/g, '/') : null,
      line: index + 1,
      source: 'ANDROID_VALIDATION'
    });
  });

  return findings;
}

function runTask(task) {
  const startedAt = new Date().toISOString();
  const start = Date.now();
  const env = { ...process.env };
  if (process.platform === 'win32' && !env.JAVA_HOME && fs.existsSync(windowsJavaHomeFallback)) {
    env.JAVA_HOME = windowsJavaHomeFallback;
    env.PATH = `${path.join(windowsJavaHomeFallback, 'bin')}${path.delimiter}${env.PATH || ''}`;
  }
  const result = spawnSync(gradle, [task, '--no-daemon', '--stacktrace'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env
  });

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const output = `${stdout}\n${stderr}`;

  return {
    task,
    command: `${gradle} ${task} --no-daemon --stacktrace`,
    status: result.status === 0 ? 'passed' : 'failed',
    exitCode: result.status,
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    findings: result.status === 0 ? [] : parseFindings(output, task),
    output
  };
}

function main() {
  ensureOutDir();
  const results = tasks.map(runTask);
  const allFindings = results.flatMap(result => result.findings);
  const payload = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    validation: results.map(({ output, ...rest }) => rest),
    findings: allFindings
  };

  const combinedLog = results.map(result => {
    return [
      `===== ${result.command} =====`,
      `status=${result.status} exitCode=${result.exitCode} durationMs=${result.durationMs}`,
      result.output
    ].join('\n');
  }).join('\n\n');

  fs.writeFileSync(logFile, combinedLog);
  fs.writeFileSync(resultsFile, JSON.stringify(payload, null, 2));

  const failed = results.filter(result => result.status !== 'passed').length;
  console.log(`[cto-validation] completed ${tasks.length} tasks; failed=${failed}; findings=${allFindings.length}`);
}

main();
