/**
 * Utility functions for text and name formatting
 */

/**
 * Capitalizes names and multi-word strings (e.g. "mario rossi" -> "Mario Rossi", "anna-maria" -> "Anna-Maria").
 * @param {string|null|undefined} str 
 * @returns {string}
 */
export function formatName(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      return word
        .split(/([-'])/)
        .map(part => (part === '-' || part === "'") ? part : (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ''))
        .join('');
    })
    .join(' ');
}
