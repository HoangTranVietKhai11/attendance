/**
 * Copy text to the clipboard.
 *
 * `navigator.clipboard` only exists in a secure context (HTTPS or localhost), while
 * employees mostly open the check-in page over plain HTTP on the company LAN, so we
 * fall back to a hidden <textarea> + execCommand('copy') when needed.
 */
export async function copyText(value: string): Promise<boolean> {
  if (!value) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Permission denied / clipboard busy — fall through to the legacy path.
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
