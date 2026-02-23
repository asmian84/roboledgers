export function getStatementFile(fileId: string): Blob | null {
  // Prefer live in-memory storage (browser runtime)
  try {
    if (window?.RoboLedger?.Ledger?.getFile) {
      const b = window.RoboLedger.Ledger.getFile(fileId);
      if (b) return b;
    }
  } catch (e) {
    // ignore and fallback to localStorage
  }

  const clientId = (window as any).UI_STATE?.activeClientId;
  const storageKey = clientId ? `roboledger_files_${clientId}` : 'roboledger_files';
  const _SS = (window as any).StorageService;
  const stored = _SS ? _SS.get(storageKey) : localStorage.getItem(storageKey);
  if (!stored) return null;

  try {
    const files = JSON.parse(stored);
    const dataUrl = files[fileId];
    if (!dataUrl) return null;

    const base64 = dataUrl.split(',')[1];
    const byteString = atob(base64);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uintArray = new Uint8Array(arrayBuffer);

    for (let i = 0; i < byteString.length; i++) {
      uintArray[i] = byteString.charCodeAt(i);
    }

    return new Blob([arrayBuffer], { type: 'application/pdf' });
  } catch (err) {
    console.warn('[FILES] Failed to read stored file', err);
    return null;
  }
}
