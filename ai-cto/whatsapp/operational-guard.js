const DEFAULT_RATE_WINDOW_MS = 60_000;
const DEFAULT_RATE_MAX = 12;
const DEFAULT_COOLDOWN_MS = 3_000;
const DEFAULT_REPLAY_WINDOW_MS = 10 * 60_000;
const DEFAULT_ABUSE_WINDOW_MS = 15 * 60_000;
const DEFAULT_ABUSE_MAX = 8;

function createOperationalGuard(options = {}) {
  const rateWindowMs = Number(options.rateWindowMs || process.env.WHATSAPP_RATE_LIMIT_WINDOW_MS || DEFAULT_RATE_WINDOW_MS);
  const rateMax = Number(options.rateMax || process.env.WHATSAPP_RATE_LIMIT_MAX || DEFAULT_RATE_MAX);
  const commandCooldownMs = Number(options.commandCooldownMs || process.env.WHATSAPP_COMMAND_COOLDOWN_MS || DEFAULT_COOLDOWN_MS);
  const replayWindowMs = Number(options.replayWindowMs || process.env.WHATSAPP_REPLAY_WINDOW_MS || DEFAULT_REPLAY_WINDOW_MS);
  const abuseWindowMs = Number(options.abuseWindowMs || process.env.WHATSAPP_ABUSE_WINDOW_MS || DEFAULT_ABUSE_WINDOW_MS);
  const abuseMax = Number(options.abuseMax || process.env.WHATSAPP_ABUSE_MAX || DEFAULT_ABUSE_MAX);

  const rateBuckets = new Map();
  const commandBuckets = new Map();
  const replayCache = new Map();
  const abuseBuckets = new Map();

  function pruneMap(map, now, ttl) {
    for (const [key, value] of map.entries()) {
      const latest = Array.isArray(value) ? value[value.length - 1] : value;
      if (!latest || now - latest > ttl) map.delete(key);
    }
  }

  function checkRateLimit(sender) {
    const key = sender || 'unknown';
    const now = Date.now();
    const bucket = (rateBuckets.get(key) || []).filter((timestamp) => now - timestamp < rateWindowMs);
    bucket.push(now);
    rateBuckets.set(key, bucket);
    pruneMap(rateBuckets, now, rateWindowMs);
    return {
      limited: bucket.length > rateMax,
      count: bucket.length,
      retryAfterMs: rateWindowMs
    };
  }

  function checkCommandCooldown(sender, command) {
    const key = `${sender || 'unknown'}:${command || 'unknown'}`;
    const now = Date.now();
    const last = commandBuckets.get(key);
    commandBuckets.set(key, now);
    pruneMap(commandBuckets, now, commandCooldownMs * 4);
    return {
      coolingDown: Boolean(last && now - last < commandCooldownMs),
      retryAfterMs: last ? Math.max(0, commandCooldownMs - (now - last)) : 0
    };
  }

  function checkReplay(messageSid) {
    const sid = String(messageSid || '').trim();
    if (!sid) return { replayed: false };
    const now = Date.now();
    pruneMap(replayCache, now, replayWindowMs);
    if (replayCache.has(sid)) return { replayed: true };
    replayCache.set(sid, now);
    return { replayed: false };
  }

  function recordAbuse(sender, reason) {
    const key = sender || 'unknown';
    const now = Date.now();
    const bucket = (abuseBuckets.get(key) || []).filter((item) => now - item.at < abuseWindowMs);
    bucket.push({ at: now, reason });
    abuseBuckets.set(key, bucket);
    pruneMap(abuseBuckets, now, abuseWindowMs);
    return {
      blocked: bucket.length > abuseMax,
      count: bucket.length
    };
  }

  function isAbusive(sender) {
    const now = Date.now();
    const bucket = (abuseBuckets.get(sender || 'unknown') || []).filter((item) => now - item.at < abuseWindowMs);
    return bucket.length > abuseMax;
  }

  return {
    checkRateLimit,
    checkCommandCooldown,
    checkReplay,
    recordAbuse,
    isAbusive,
    settings: {
      rateWindowMs,
      rateMax,
      commandCooldownMs,
      replayWindowMs,
      abuseWindowMs,
      abuseMax
    }
  };
}

module.exports = {
  createOperationalGuard
};
