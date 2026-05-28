const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_AVD_NAME = 'Aritenis_UX_Lab';
const DEFAULT_PORT = 3000;

function androidSdkRoot() {
  return process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk');
}

function emulatorExe(sdkRoot = androidSdkRoot()) {
  return path.join(sdkRoot, 'emulator', process.platform === 'win32' ? 'emulator.exe' : 'emulator');
}

function adbExe(sdkRoot = androidSdkRoot()) {
  return path.join(sdkRoot, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
}

function buildEmulatorStartArgs({
  avdName = DEFAULT_AVD_NAME,
  headless = true,
  coldBoot = false
} = {}) {
  const args = [
    '-avd',
    avdName,
    '-no-snapshot-save',
    '-no-boot-anim'
  ];
  if (headless) args.push('-no-window');
  if (coldBoot) args.push('-no-snapshot-load');
  return args;
}

function buildAdbReverseCommand({ port = DEFAULT_PORT } = {}) {
  return ['reverse', `tcp:${port}`, `tcp:${port}`];
}

function listAvds({ sdkRoot = androidSdkRoot() } = {}) {
  const exe = emulatorExe(sdkRoot);
  if (!fs.existsSync(exe)) return [];
  return execFileSync(exe, ['-list-avds'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function adbDevices({ sdkRoot = androidSdkRoot() } = {}) {
  const exe = adbExe(sdkRoot);
  if (!fs.existsSync(exe)) return '';
  return execFileSync(exe, ['devices'], { encoding: 'utf8' });
}

function buildEmulatorStatus({
  avds = [],
  devicesOutput = '',
  avdName = DEFAULT_AVD_NAME
} = {}) {
  const connectedDevices = String(devicesOutput)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /\tdevice$/.test(line));
  const offlineDevices = String(devicesOutput)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /\toffline$/.test(line));
  const emulatorDevices = connectedDevices.filter((line) => line.startsWith('emulator-'));
  const avdAvailable = avds.includes(avdName);
  const deviceConnected = emulatorDevices.length > 0;

  return {
    avdName,
    avdAvailable,
    deviceConnected,
    connectedDevices,
    offlineDevices,
    ready: avdAvailable && deviceConnected
  };
}

function status(options = {}) {
  return buildEmulatorStatus({
    avds: listAvds(options),
    devicesOutput: adbDevices(options),
    avdName: options.avdName || DEFAULT_AVD_NAME
  });
}

function buildUxLabReadiness(emulatorStatus) {
  if (!emulatorStatus.avdAvailable) {
    return {
      canRunUxLab: false,
      nextAction: `create or install AVD ${emulatorStatus.avdName}`
    };
  }
  if (!emulatorStatus.deviceConnected) {
    if (Array.isArray(emulatorStatus.offlineDevices) && emulatorStatus.offlineDevices.length > 0) {
      return {
        canRunUxLab: false,
        nextAction: `restart emulator ${emulatorStatus.avdName}; ADB currently reports offline`
      };
    }
    return {
      canRunUxLab: false,
      nextAction: `start emulator ${emulatorStatus.avdName}`
    };
  }
  return {
    canRunUxLab: true,
    nextAction: 'build latest APK, install it, enable Aritenis IME, capture screenshot'
  };
}

function start({
  sdkRoot = androidSdkRoot(),
  avdName = DEFAULT_AVD_NAME,
  headless = true,
  coldBoot = true
} = {}) {
  const exe = emulatorExe(sdkRoot);
  if (!fs.existsSync(exe)) throw new Error(`Missing emulator executable: ${exe}`);
  const child = spawn(exe, buildEmulatorStartArgs({ avdName, headless, coldBoot }), {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();
  return {
    started: true,
    pid: child.pid,
    avdName,
    headless
  };
}

function stop({ sdkRoot = androidSdkRoot() } = {}) {
  const exe = adbExe(sdkRoot);
  if (!fs.existsSync(exe)) throw new Error(`Missing adb executable: ${exe}`);
  execFileSync(exe, ['emu', 'kill'], { stdio: 'pipe' });
  return { stopped: true };
}

function reversePort({
  sdkRoot = androidSdkRoot(),
  port = DEFAULT_PORT
} = {}) {
  const exe = adbExe(sdkRoot);
  if (!fs.existsSync(exe)) throw new Error(`Missing adb executable: ${exe}`);
  execFileSync(exe, buildAdbReverseCommand({ port }), { stdio: 'pipe' });
  return { reversed: true, port };
}

function waitForDevice({
  sdkRoot = androidSdkRoot(),
  timeoutMs = 120000
} = {}) {
  const exe = adbExe(sdkRoot);
  if (!fs.existsSync(exe)) throw new Error(`Missing adb executable: ${exe}`);
  execFileSync(exe, ['wait-for-device'], { timeout: timeoutMs, stdio: 'pipe' });
  return status({ sdkRoot });
}

module.exports = {
  DEFAULT_AVD_NAME,
  adbDevices,
  adbExe,
  androidSdkRoot,
  buildAdbReverseCommand,
  buildEmulatorStartArgs,
  buildEmulatorStatus,
  buildUxLabReadiness,
  emulatorExe,
  listAvds,
  reversePort,
  start,
  status,
  stop,
  waitForDevice
};
