// Copy and paste that also work where the Clipboard API is missing: a phone on the PC's Wi-Fi address (plain http)
// has no navigator.clipboard, so copying falls back to a hidden text box and the old copy command.

/** Copies text. Returns false when the browser refused both ways (the page then shows the text to copy by hand). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the old way.
  }
  try {
    const box = document.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.style.position = 'fixed';
    box.style.top = '0';
    box.style.left = '0';
    box.style.opacity = '0';
    box.style.fontSize = '16px'; // iOS zooms into smaller fields
    document.body.appendChild(box);
    box.focus();
    box.select();
    box.setSelectionRange(0, text.length); // iOS needs an explicit range
    const ok = document.execCommand('copy');
    box.remove();
    return ok;
  } catch {
    return false;
  }
}

/** True when the page may read the clipboard (https or localhost); elsewhere the person pastes into a box. */
export const canReadClipboard = () => typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.readText) && typeof window !== 'undefined' && window.isSecureContext;

/** The clipboard's text, or null when the browser does not allow it here. */
export async function readText(): Promise<string | null> {
  if (!canReadClipboard()) return null;
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}
