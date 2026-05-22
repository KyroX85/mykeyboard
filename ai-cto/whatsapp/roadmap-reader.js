const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ROADMAP_FILE = path.join(ROOT, 'ai-cto', 'AGENT_ROADMAP.md');
const VISION_FILE = path.join(ROOT, 'ai-cto', 'VISION_NORTH_STAR.md');

function readRoadmap() {
  try {
    const text = fs.existsSync(ROADMAP_FILE) ? fs.readFileSync(ROADMAP_FILE, 'utf8') : '';
    const vision = fs.existsSync(VISION_FILE) ? fs.readFileSync(VISION_FILE, 'utf8') : '';
    return {
      text,
      vision,
      northStar: firstMatch(text, /^NORTH STAR:\s*([\s\S]*?)(?=\n\nPHASE 1)/m) || 'Aritenis north star not loaded.',
      currentPhase: firstMatch(text, /PHASE 1[\s\S]*?(?=\n\nPHASE 2)/m) || 'Phase 1 stabilization not loaded.',
      rules: firstMatch(text, /AGENT RULES[\s\S]*$/m) || ''
    };
  } catch {
    return {
      text: '',
      vision: '',
      northStar: 'Aritenis north star not loaded.',
      currentPhase: 'Phase 1 stabilization not loaded.',
      rules: ''
    };
  }
}

function firstMatch(text, regex) {
  const match = String(text || '').match(regex);
  return match ? (match[1] || match[0]).trim() : null;
}

module.exports = {
  ROADMAP_FILE,
  VISION_FILE,
  readRoadmap
};
