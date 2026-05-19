const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

const STATE_FILE = path.join(__dirname, '.watcher_state.json');
const STATE_VERSION = '1.1';
const IGNORE_PATHS = ['.git', 'node_modules', 'build', 'dist'];
const DEBOUNCE_MS = 300;
const MAX_TEST_TIME = 10 * 60 * 1000; // 10 minutes
const MAX_WATCHERS = 5000;

let state = {
  version: STATE_VERSION,
  command: 'npm test',
  approved: false,
  lastExitCode: null,
  lastRun: null,
  isRunning: false,
  pendingRun: false
};

const watchers = new Map();
let debounceTimer = null;

function log(msg) {
  console.log(`[watcher] ${msg}`);
}

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      if (data.version !== STATE_VERSION) throw new Error('Version mismatch');
      state = { ...state, ...data };
      if (state.isRunning) {
        log('Crash recovery: clearing stale execution lock.');
        state.isRunning = false;
        saveState();
      }
    } catch (e) {
      log('State recovery: initializing default state.');
      saveState();
    }
  }
}

function saveState() {
  try {
    const tmp = STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, STATE_FILE);
  } catch (e) {
    log(`Error saving state: ${e.message}`);
  }
}

function askApproval(callback) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(`[watcher] Allow running "${state.command}" on changes? (y/n/change): `, (answer) => {
    rl.close();
    const a = answer.toLowerCase().trim();
    if (a === 'y') {
      state.approved = true; saveState(); callback();
    } else if (a === 'change') {
      const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl2.question('[watcher] Enter new test command: ', (cmd) => {
        state.command = cmd.trim() || state.command;
        state.approved = true; rl2.close(); saveState(); callback();
      });
    } else {
      log('Permission denied. Exiting.'); process.exit(0);
    }
  });
}

function executeCommand() {
  if (state.isRunning) {
    state.pendingRun = true;
    saveState();
    return;
  }

  state.isRunning = true;
  state.pendingRun = false;
  saveState();
  log(`Running: ${state.command}`);

  const logStream = fs.createWriteStream('test_output.log');
  const child = spawn(state.command, { stdio: ['inherit', 'pipe', 'pipe'], shell: true, cwd: process.cwd() });

  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  const timeout = setTimeout(() => {
    if (state.isRunning) {
      log(`TIMEOUT: Process exceeded ${MAX_TEST_TIME / 60000}m. Killing...`);
      child.kill('SIGKILL');
    }
  }, MAX_TEST_TIME);

  child.on('close', (code) => {
    clearTimeout(timeout);
    logStream.end();
    state.isRunning = false;
    state.lastExitCode = code;
    state.lastRun = new Date().toISOString();
    saveState();
    log(`Finished with code ${code}.`);

    const brainPath = path.join(__dirname, 'brain.js');
    if (fs.existsSync(brainPath)) {
      spawn(`node ${brainPath}`, [code.toString()], { stdio: 'inherit', shell: true });
    }

    if (state.pendingRun) {
      log('Pending changes detected. Restarting...');
      executeCommand();
    } else {
      log('Waiting for changes...');
    }
  });

  child.on('error', (err) => {
    clearTimeout(timeout);
    logStream.end();
    state.isRunning = false;
    saveState();
    log(`Execution error: ${err.message}`);
  });
}

function shouldIgnore(filename) {
  if (!filename || filename === path.basename(STATE_FILE) || filename.endsWith('.tmp')) return true;
  const normalized = filename.replace(/\\/g, '/');
  return IGNORE_PATHS.some(p => normalized === p || normalized.startsWith(p + '/') || normalized.includes('/' + p + '/'));
}

function addWatcher(dir) {
  if (watchers.has(dir) || watchers.size >= MAX_WATCHERS) return;
  try {
    const w = fs.watch(dir, (event, filename) => {
      const fullPath = filename ? path.join(dir, filename) : null;
      if (fullPath && shouldIgnore(fullPath)) return;

      if (fullPath) {
        try {
          if (fs.statSync(fullPath).isDirectory()) scan(fullPath);
        } catch (e) {} // File might be gone
      }

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        log(`Change: ${filename || dir}`);
        executeCommand();
      }, DEBOUNCE_MS);
    });

    w.on('error', (err) => {
      watchers.delete(dir);
      w.close();
      if (err.code !== 'ENOENT' && err.code !== 'EPERM') {
        log(`Watcher error on ${dir}: ${err.message}`);
      }
    });

    watchers.set(dir, w);
  } catch (e) {}
}

function scan(dir) {
  if (shouldIgnore(dir)) return;
  addWatcher(dir);
  try {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      try {
        if (fs.statSync(full).isDirectory()) scan(full);
      } catch (e) {}
    }
  } catch (e) {}
}

function startWatching() {
  log(`Watching tree: ${process.cwd()}...`);
  scan(process.cwd());
  
  // Safety check for stale watchers or new dirs
  setInterval(() => {
    if (watchers.size < MAX_WATCHERS) scan(process.cwd());
  }, 30000);
}

const cleanup = () => {
  log('Shutting down...');
  for (const w of watchers.values()) w.close();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', (err) => {
  log(`Fatal error: ${err.message}`);
  cleanup();
});

loadState();
if (!state.approved) {
  askApproval(() => { executeCommand(); startWatching(); });
} else {
  log(`Auto-approved: ${state.command}`);
  executeCommand();
  startWatching();
}
