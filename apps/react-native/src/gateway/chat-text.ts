function getTextFromContentBlock(content: unknown): string | null {
  if (!content || typeof content !== 'object') {
    return null;
  }
  const candidate = content as Record<string, unknown>;

  if (candidate.type === 'text' && typeof candidate.text === 'string') {
    return candidate.text;
  }

  if (typeof candidate.text === 'string') {
    return candidate.text;
  }

  return null;
}

export function extractAssistantText(message: unknown): string | null {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const candidate = message as Record<string, unknown>;

  if (typeof candidate.text === 'string') {
    return candidate.text;
  }

  const content = candidate.content;
  if (!Array.isArray(content)) {
    return null;
  }

  const chunks = content
    .map(getTextFromContentBlock)
    .filter((chunk): chunk is string => typeof chunk === 'string' && chunk.length > 0);

  if (chunks.length === 0) {
    return null;
  }

  return chunks.join('');
}
