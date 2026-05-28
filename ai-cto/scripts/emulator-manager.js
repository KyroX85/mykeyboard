const {
  buildUxLabReadiness,
  reversePort,
  start,
  status,
  stop,
  waitForDevice
} = require('../ux-lab/emulator-manager');

const command = process.argv[2] || 'status';

async function main() {
  if (command === 'status') {
    print({ status: status(), readiness: buildUxLabReadiness(status()) });
    return;
  }
  if (command === 'start') {
    const started = start();
    const connected = waitForDevice({ timeoutMs: 180000 });
    const reverse = reversePort({ port: 3000 });
    print({ started, connected, reverse, readiness: buildUxLabReadiness(connected) });
    return;
  }
  if (command === 'ensure') {
    const current = status();
    if (current.ready) {
      print({ status: current, readiness: buildUxLabReadiness(current), action: 'already_ready' });
      return;
    }
    const started = start();
    const connected = waitForDevice({ timeoutMs: 180000 });
    const reverse = reversePort({ port: 3000 });
    print({ started, connected, reverse, readiness: buildUxLabReadiness(connected), action: 'started' });
    return;
  }
  if (command === 'stop') {
    print(stop());
    return;
  }
  throw new Error(`Unknown emulator-manager command: ${command}`);
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
