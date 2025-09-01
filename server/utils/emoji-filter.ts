/**
 * Production emoji filtering utility
 * Removes emoji characters from text content
 */
export function removeEmojis(text: string): string {
  return text
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // Remove emoji pairs
    .replace(/[\u2600-\u27BF]/g, '')                // Remove symbols
    .replace(/\s+/g, ' ')                           // Normalize whitespace
    .trim();
}