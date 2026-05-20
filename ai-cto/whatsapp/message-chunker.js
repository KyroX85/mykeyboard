const DEFAULT_CHUNK_SIZE = 1400;

function chunkMessage(message, maxLength = DEFAULT_CHUNK_SIZE) {
  const text = String(message || '');
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf('\n', maxLength);
    if (splitAt < Math.floor(maxLength * 0.6)) splitAt = remaining.lastIndexOf(' ', maxLength);
    if (splitAt < Math.floor(maxLength * 0.6)) splitAt = maxLength;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks.map((chunk, index) => {
    if (chunks.length === 1) return chunk;
    return `Part ${index + 1}/${chunks.length}\n${chunk}`;
  });
}

module.exports = {
  chunkMessage,
  DEFAULT_CHUNK_SIZE
};
