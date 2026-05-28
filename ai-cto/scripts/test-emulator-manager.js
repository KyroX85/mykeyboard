const assert = require('assert');

const {
  DEFAULT_AVD_NAME,
  buildAdbReverseCommand,
  buildEmulatorStartArgs,
  buildEmulatorStatus,
  buildUxLabReadiness
} = require('../ux-lab/emulator-manager');

const startArgs = buildEmulatorStartArgs({ avdName: 'Pixel_6_Pro' });
assert(startArgs.includes('-avd'));
assert(startArgs.includes('Pixel_6_Pro'));
assert(startArgs.includes('-no-snapshot-save'));
assert(startArgs.includes('-no-boot-anim'));

const reverseCommand = buildAdbReverseCommand({ port: 3000 });
assert(reverseCommand.includes('reverse'));
assert(reverseCommand.includes('tcp:3000'));

const offline = buildEmulatorStatus({
  avds: [DEFAULT_AVD_NAME],
  devicesOutput: 'List of devices attached\n\n'
});
assert.strictEqual(offline.avdAvailable, true);
assert.strictEqual(offline.deviceConnected, false);
assert.strictEqual(offline.ready, false);

const adbOffline = buildEmulatorStatus({
  avds: [DEFAULT_AVD_NAME],
  devicesOutput: 'List of devices attached\nemulator-5554\toffline\n'
});
assert.strictEqual(adbOffline.deviceConnected, false);
assert.strictEqual(adbOffline.offlineDevices.length, 1);
assert.strictEqual(adbOffline.ready, false);

const online = buildEmulatorStatus({
  avds: [DEFAULT_AVD_NAME],
  devicesOutput: 'List of devices attached\nemulator-5554\tdevice\n'
});
assert.strictEqual(online.avdAvailable, true);
assert.strictEqual(online.deviceConnected, true);
assert.strictEqual(online.ready, true);

const readiness = buildUxLabReadiness(online);
assert.strictEqual(readiness.canRunUxLab, true);
assert(readiness.nextAction.includes('build latest APK'));

const missing = buildUxLabReadiness(offline);
assert.strictEqual(missing.canRunUxLab, false);
assert(missing.nextAction.includes('start emulator'));

const offlineReadiness = buildUxLabReadiness(adbOffline);
assert.strictEqual(offlineReadiness.canRunUxLab, false);
assert(offlineReadiness.nextAction.includes('restart emulator'));

console.log('Emulator manager passed');
