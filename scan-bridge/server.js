// ArchivÉo Scan Bridge — pont local entre le navigateur et le scanner (WIA / Windows).
// Lancement : npm run scan-bridge   (ou : node scan-bridge/server.js)
// API : GET /health · GET /devices · POST /scan { dpi, colorMode, deviceId }
import http from 'node:http';
import { execFile } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const PORT = 3777;
const DIR = path.dirname(fileURLToPath(import.meta.url));

const COLOR_MAP = {
  'Couleur': 1,
  'Niveaux de gris': 2,
  'Noir et blanc': 4,
};

function runPowerShell(scriptFile, args = [], timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(DIR, scriptFile), ...args],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err && !stdout) return reject(new Error(stderr || err.message));
        resolve(stdout.trim());
      },
    );
  });
}

// Cache court pour éviter de relancer l'énumération WIA à chaque requête
const cache = { devices: null, devicesAt: 0, printers: null, printersAt: 0 };
const CACHE_MS = 10000;

async function listDevices() {
  if (cache.devices && Date.now() - cache.devicesAt < CACHE_MS) return cache.devices;
  try {
    const out = await runPowerShell('devices.ps1', [], 30000);
    const parsed = JSON.parse(out || '[]');
    cache.devices = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    cache.devices = [];
  }
  cache.devicesAt = Date.now();
  return cache.devices;
}

async function listPrinters() {
  if (cache.printers && Date.now() - cache.printersAt < CACHE_MS) return cache.printers;
  try {
    const out = await runPowerShell('printers.ps1', [], 30000);
    const parsed = JSON.parse(out || '[]');
    cache.printers = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    cache.printers = [];
  }
  cache.printersAt = Date.now();
  return cache.printers;
}

async function scan({ dpi = 300, colorMode = 'Couleur', deviceId = '', pageSize = 'A4' }) {
  const outBase = path.join(os.tmpdir(), `archiveo-scan-${Date.now()}`);
  const color = COLOR_MAP[colorMode] ?? 1;
  const args = ['-DPI', String(dpi), '-Color', String(color), '-OutBase', outBase, '-PageSize', pageSize];
  if (deviceId) args.push('-DeviceId', deviceId);

  // Un lot ADF de plusieurs pages peut etre long : delai genereux
  const out = await runPowerShell('scan.ps1', args, 600000);
  const line = out.split(/\r?\n/).filter(Boolean).pop() || '';

  if (!line.startsWith('OK|')) {
    const parts = line.split('|');
    throw new Error(parts[2] || parts[1] || 'Échec de la numérisation');
  }

  const [, deviceName, countStr, filesJoined] = line.split('|');
  const filePaths = (filesJoined || '').split(';').filter(Boolean);

  const pages = [];
  let totalBytes = 0;
  for (const fp of filePaths) {
    const buffer = await readFile(fp);
    totalBytes += buffer.length;
    pages.push({
      image: `data:image/jpeg;base64,${buffer.toString('base64')}`,
      sizeKb: Math.round(buffer.length / 1024),
    });
    await rm(fp, { force: true });
  }

  return {
    // compatibilité : `image` = première page
    image: pages[0]?.image,
    pages,
    pageCount: Number(countStr) || pages.length,
    mediaType: 'image/jpeg',
    sizeKb: Math.round(totalBytes / 1024),
    deviceName,
    dpi,
    colorMode,
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  try {
    if (req.method === 'GET' && req.url === '/health') {
      // Réponse immédiate, sans énumération matérielle (le frontend a un délai court ici)
      return sendJson(res, 200, { ok: true, bridge: 'archiveo-scan-bridge', version: '1.1.0' });
    }

    if (req.method === 'GET' && req.url === '/devices') {
      const devices = await listDevices();
      return sendJson(res, 200, { ok: true, devices });
    }

    if (req.method === 'GET' && req.url === '/printers') {
      const printers = await listPrinters();
      return sendJson(res, 200, { ok: true, printers });
    }

    if (req.method === 'POST' && req.url === '/scan') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const params = body ? JSON.parse(body) : {};
      console.log(`[scan] démarrage · ${params.dpi || 300} DPI · ${params.colorMode || 'Couleur'}`);
      const result = await scan(params);
      console.log(`[scan] OK · ${result.deviceName} · ${result.pageCount} page(s) · ${result.sizeKb} Ko`);
      return sendJson(res, 200, result);
    }

    return sendJson(res, 404, { error: 'Route inconnue' });
  } catch (err) {
    console.error('[erreur]', err.message);
    return sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ArchivÉo Scan Bridge démarré sur http://localhost:${PORT}`);
  console.log('En attente de requêtes de la page Scan Direct…');
  listDevices().then(devices => {
    if (devices.length === 0) {
      console.log('⚠ Aucun scanner WIA détecté pour le moment. Branchez/allumez le scanner puis rafraîchissez la page.');
    } else {
      console.log(`Scanner(s) détecté(s) : ${devices.map(d => d.name).join(', ')}`);
    }
  });
});
