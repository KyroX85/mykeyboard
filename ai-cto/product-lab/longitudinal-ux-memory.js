const fs = require('fs');
const path = require('path');

const FILE = 'longitudinal-ux-memory.json';

function loadLongitudinalUxMemory(root = process.cwd()) {
  const file = path.join(root, FILE);
  if (!fs.existsSync(file)) return empty();
  try {
    return { ...empty(), ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return empty();
  }
}

function updateLongitudinalUxMemory({ root = process.cwd(), observation = '', confidence = 'LOW', outcome = '' } = {}) {
  const memory = loadLongitudinalUxMemory(root);
  if (observation) {
    memory.observations.unshift({
      observation: String(observation).slice(0, 180),
      confidence,
      outcome: String(outcome || '').slice(0, 180),
      recordedAt: new Date().toISOString()
    });
  }
  memory.observations = memory.observations.slice(0, 100);
  memory.updatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(root, FILE), JSON.stringify(memory, null, 2));
  return memory;
}

function empty() {
  return {
    version: '1.0',
    updatedAt: null,
    observations: []
  };
}

module.exports = {
  loadLongitudinalUxMemory,
  updateLongitudinalUxMemory
};
