const fs = require('fs');
const path = require('path');

const FILE = 'product-instinct-memory.json';

function loadProductInstinctMemory(root = process.cwd()) {
  const file = path.join(root, FILE);
  if (!fs.existsSync(file)) return empty();
  try {
    return { ...empty(), ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return empty();
  }
}

function updateProductInstinctMemory({
  root = process.cwd(),
  event = '',
  outcome = '',
  avoid = ''
} = {}) {
  const memory = loadProductInstinctMemory(root);
  if (event && /improved|calm|trust|fatigue|comfort|symbol|thumb|typing/i.test(`${event} ${outcome}`)) {
    memory.principles = append(memory.principles, event);
  }
  if (avoid) memory.avoidPatterns = append(memory.avoidPatterns, avoid);
  memory.updatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(root, FILE), JSON.stringify(memory, null, 2));
  return memory;
}

function empty() {
  return {
    version: '1.0',
    updatedAt: null,
    principles: [],
    avoidPatterns: []
  };
}

function append(items, value) {
  return [...new Set([...(Array.isArray(items) ? items : []), String(value).slice(0, 180)])].slice(-80);
}

module.exports = {
  loadProductInstinctMemory,
  updateProductInstinctMemory
};
