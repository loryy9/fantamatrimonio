/**
 * Robust clipboard copy helper compatible with iOS Safari, Android, and desktop browsers,
 * even when running on HTTP (e.g. local IP network testing on iPhone).
 *
 * @param {string} text - Text to copy to clipboard
 * @returns {Promise<boolean>} - Resolves to true if copied successfully, false otherwise
 */
export async function copyToClipboard(text) {
  if (!text && text !== '') return false;

  const str = String(text);

  // 1. Try modern navigator.clipboard if available (only in secure context or localhost)
  if (navigator?.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(str);
      return true;
    } catch {
      // Fall through to textarea fallback
    }
  }

  // 2. Fallback using temporary textarea + document.execCommand('copy')
  // This works universally on iOS Safari (even on HTTP / local IP)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = str;
    
    // Prevent iOS virtual keyboard & scrolling
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '-9999px';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.fontSize = '16px'; // Prevents iOS Safari zoom

    document.body.appendChild(textArea);

    // iOS Safari selection
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, str.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    return Boolean(successful);
  } catch (err) {
    console.error('Fallback clipboard copy failed:', err);
    return false;
  }
}
