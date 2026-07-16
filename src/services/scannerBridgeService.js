// Communication avec le pont de scan local (scan-bridge/server.js).
// Le pont pilote le scanner physique via WIA (Windows) et expose une API sur localhost.
const BRIDGE_URL = 'http://localhost:3777';

const DEFAULT_SCANNER_KEY = 'archiveo.defaultScannerId';

export function getDefaultScannerId() {
  return localStorage.getItem(DEFAULT_SCANNER_KEY) || '';
}

export function setDefaultScannerId(deviceId) {
  if (deviceId) localStorage.setItem(DEFAULT_SCANNER_KEY, deviceId);
  else localStorage.removeItem(DEFAULT_SCANNER_KEY);
}

/**
 * Vérifie que le pont de scan est lancé (réponse instantanée, sans matériel).
 * @returns {Promise<{ok: boolean, version: string} | null>} null si le pont n'est pas lancé.
 */
export async function detectScannerBridge() {
  try {
    const res = await fetch(`${BRIDGE_URL}/health`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Liste les scanners WIA branchés (l'énumération peut prendre quelques secondes).
 * @returns {Promise<{deviceId: string, name: string}[]>}
 */
export async function listScanners() {
  const res = await fetch(`${BRIDGE_URL}/devices`, { signal: AbortSignal.timeout(35000) });
  if (!res.ok) throw new Error(`Énumération des scanners impossible (HTTP ${res.status})`);
  const data = await res.json();
  return data.devices || [];
}

/**
 * Liste les imprimantes installées sur la machine.
 * @returns {Promise<{name: string, driver: string, port: string, status: string, default: boolean}[]>}
 */
export async function listPrinters() {
  const res = await fetch(`${BRIDGE_URL}/printers`, { signal: AbortSignal.timeout(35000) });
  if (!res.ok) throw new Error(`Énumération des imprimantes impossible (HTTP ${res.status})`);
  const data = await res.json();
  return data.printers || [];
}

/**
 * Lance une numérisation réelle sur le scanner.
 * @returns {Promise<{image: string, mediaType: string, sizeKb: number, dimensions: string, deviceName: string}>}
 */
export async function scanWithBridge({ dpi = 300, colorMode = 'Couleur', deviceId = '', pageSize = 'A4' } = {}) {
  const res = await fetch(`${BRIDGE_URL}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dpi: Number(dpi), colorMode, deviceId, pageSize }),
    // un scan à plat peut prendre du temps (préchauffage de la lampe, haute résolution)
    signal: AbortSignal.timeout(180000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || `Échec du scan (HTTP ${res.status})`);
  }
  return data;
}
