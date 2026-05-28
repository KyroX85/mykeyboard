const fs = require('fs');
const path = require('path');

const FILE = 'product-instinct-memory-v2.json';

function loadProductInstinctMemoryV2(root = process.cwd()) {
  const file = path.join(root, FILE);
  if (!fs.existsSync(file)) return empty();
  try {
    return { ...empty(), ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return empty();
  }
}

function updateProductInstinctMemoryV2({
  root = process.cwd(),
  founderPreference = '',
  rejectedPattern = '',
  survivedFix = '',
  subtleDiscomfort = '',
  fatigueIncrease = '',
  rhythmImprovement = ''
} = {}) {
  const memory = loadProductInstinctMemoryV2(root);
  memory.founderPreferences = append(memory.founderPreferences, founderPreference);
  memory.rejectedPatterns = append(memory.rejectedPatterns, rejectedPattern);
  memory.survivedFixes = append(memory.survivedFixes, survivedFix);
  memory.subtleDiscomforts = append(memory.subtleDiscomforts, subtleDiscomfort);
  memory.fatigueIncreases = append(memory.fatigueIncreases, fatigueIncrease);
  memory.rhythmImprovements = append(memory.rhythmImprovements, rhythmImprovement);
  memory.updatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(root, FILE), JSON.stringify(memory, null, 2));
  return memory;
}

function empty() {
  return {
    version: '2.0',
    updatedAt: null,
    founderPreferences: [],
    rejectedPatterns: [],
    survivedFixes: [],
    subtleDiscomforts: [],
    fatigueIncreases: [],
    rhythmImprovements: []
  };
}

function append(items, value) {
  if (!value) return Array.isArray(items) ? items : [];
  return [...new Set([...(Array.isArray(items) ? items : []), String(value).slice(0, 180)])].slice(-120);
}

module.exports = {
  loadProductInstinctMemoryV2,
  updateProductInstinctMemoryV2
};
