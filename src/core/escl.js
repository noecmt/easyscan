/**
 * Module eSCL/AirScan pour scanner réseau
 * Support HP ENVY Inspire 7200e et autres scanners compatibles
 */

/**
 * Construit le XML pour créer un job de scan eSCL
 */
export function buildScanJobXML(settings) {
  const {
    dpi = 300,
    colorMode = 'RGB24',
    format = 'jpeg',
    width = 2480,
    height = 3508,
    inputSource = 'Platen',
    omitRegion = false
  } = settings;

  const intent = colorMode === 'Grayscale8' || colorMode === 'BlackAndWhite1' ? 'Document' : 'Photo';
  const outputFormat = format === 'png' ? 'image/png' : (format === 'pdf' ? 'application/pdf' : 'image/jpeg');

  let body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<scan:ScanSettings xmlns:scan="http://schemas.hp.com/imaging/escl/2011/05/03" xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">` +
    `<pwg:Version>2.63</pwg:Version>` +
    `<scan:Intent>${intent}</scan:Intent>` +
    `<scan:InputSource>${inputSource}</scan:InputSource>` +
    `<pwg:DocumentFormat>${outputFormat}</pwg:DocumentFormat>` +
    `<scan:ColorMode>${colorMode}</scan:ColorMode>` +
    `<scan:XResolution>${dpi}</scan:XResolution>` +
    `<scan:YResolution>${dpi}</scan:YResolution>`;
    
  if (!omitRegion && width && height) {
    body += `<scan:ScanRegions>` +
      `<scan:ScanRegion>` +
      `<scan:Width>${width}</scan:Width>` +
      `<scan:Height>${height}</scan:Height>` +
      `<scan:XOffset>0</scan:XOffset>` +
      `<scan:YOffset>0</scan:YOffset>` +
      `</scan:ScanRegion>` +
      `</scan:ScanRegions>`;
  }
  
  body += `</scan:ScanSettings>`;
  return body;
}

/**
 * Récupère les capacités du scanner
 */
export async function getCapabilities(baseUrl) {
  const url = normalizeBase(baseUrl) + '/eSCL/ScannerCapabilities';
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return null;
    const xml = await res.text();
    return parseCapabilities(xml);
  } catch {
    return null;
  }
}

/**
 * Ajuste les paramètres selon les capacités du scanner
 */
export function adjustSettingsForCapabilities(settings, capabilities) {
  const s = { ...settings };
  
  if (!capabilities) return s;
  
  // Résolution
  if (capabilities.resolutions && capabilities.resolutions.length) {
    const target = s.dpi || 300;
    let best = capabilities.resolutions[0];
    let bestDiff = Math.abs(best - target);
    for (const r of capabilities.resolutions) {
      const diff = Math.abs(r - target);
      if (diff < bestDiff) { 
        best = r; 
        bestDiff = diff; 
      }
    }
    s.dpi = best;
  }
  
  // Format
  if (capabilities.formats) {
    const desired = formatToMime(s.format);
    if (!capabilities.formats.includes(desired)) {
      const preferred = ['image/jpeg', 'image/png', 'application/pdf'];
      const pick = preferred.find(p => capabilities.formats.includes(p)) || capabilities.formats[0];
      s.format = mimeToFormat(pick);
    }
  }
  
  // Mode couleur - mapping HP spécifique
  if (capabilities.colorModes) {
    const mapping = { 'Color': 'RGB24', 'Grayscale': 'Grayscale8' };
    const desired = mapping[s.colorMode] || s.colorMode;
    if (!capabilities.colorModes.includes(desired)) {
      if (capabilities.colorModes.includes('RGB24')) s.colorMode = 'RGB24';
      else if (capabilities.colorModes.includes('Grayscale8')) s.colorMode = 'Grayscale8';
      else if (capabilities.colorModes.includes('BlackAndWhite1')) s.colorMode = 'BlackAndWhite1';
    } else {
      s.colorMode = desired;
    }
  }
  
  // Zone maximum
  if (capabilities.maxWidth && capabilities.maxHeight) {
    s.width = capabilities.maxWidth;
    s.height = capabilities.maxHeight;
  }
  
  return s;
}

/**
 * Vérifie la connectivité avec le scanner
 */
export async function checkConnectivity(baseUrl) {
  try {
    const caps = await getCapabilities(baseUrl);
    if (caps) {
      return { ok: true, message: 'Scanner accessible', capabilities: caps };
    } else {
      throw new Error('Scanner non accessible');
    }
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

/**
 * "Réveille" le scanner en faisant un appel de warm-up
 */
export async function warmUpScanner(baseUrl) {
  try {
    // Appel simple pour réveiller le scanner
    await getCapabilities(baseUrl);
    
    // Petite pause pour laisser le scanner se préparer
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Crée un job de scan et récupère l'information avec retry automatique
 */
export async function createScanJob(baseUrl, settings) {
  const url = normalizeBase(baseUrl) + '/eSCL/ScanJobs';
  const xml = buildScanJobXML(settings);
  
  // Tentative avec retry pour gérer les erreurs 403/409
  const maxRetries = 3;
  const retryDelay = 2000; // 2 secondes
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: xml
      });
      
      if (res.ok) {
        const location = res.headers.get('Location');
        if (!location) throw new Error('Pas d\'URL de job retournée');
        
        return { 
          ok: true, 
          jobUrl: location,
          variantUsed: settings, 
          tried: [`attempt_${attempt}`] 
        };
      }
      
      // Gérer les erreurs spécifiques
      if (res.status === 403) {
        if (attempt === maxRetries) {
          throw new Error('Scanner occupé ou indisponible. Essayez dans quelques instants.');
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      if (res.status === 409) {
        if (attempt === maxRetries) {
          throw new Error('Conflit de ressource. Un autre scan est en cours.');
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      // Autres erreurs
      throw new Error(`Erreur de création du job (${res.status})`);
      
    } catch (e) {
      if (attempt === maxRetries) {
        throw new Error(e.message);
      }
      
      if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      // Si ce n'est pas une erreur de retry, la relancer immédiatement
      throw e;
    }
  }
}

/**
 * Récupère l'image scannée après création du job
 */
export async function fetchScannedImage(baseUrl, jobInfo, format) {
  const docUrl = jobInfo.jobUrl + '/NextDocument';
  
  // Attendre que le scan soit terminé avant d'essayer de récupérer l'image
  await waitForScanCompletion(baseUrl, jobInfo.jobUrl);
  
  const res = await fetch(docUrl, { method: 'GET' });
  
  if (!res.ok) {
    // Si 410, le job a expiré - donner des détails utiles
    if (res.status === 410) {
      throw new Error('Le job de scan a expiré. Le scanner a peut-être pris trop de temps ou s\'est mis en veille.');
    }
    
    throw new Error('Récupération image échouée: ' + res.status);
  }
  
  const blob = await res.blob();
  const mimeType = blob.type || (format === 'png' ? 'image/png' : (format === 'pdf' ? 'application/pdf' : 'image/jpeg'));
  const dataUrl = await blobToDataUrl(blob);
  const arrayBuffer = await blob.arrayBuffer();
  return { mimeType, dataUrl, bytes: new Uint8Array(arrayBuffer) };
}

/**
 * Attend que le scan soit terminé en vérifiant le statut du job
 */
async function waitForScanCompletion(baseUrl, jobUrl) {
  const maxWaitTime = 30000; // 30 secondes max
  const checkInterval = 1000; // Vérifier chaque seconde
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      // Vérifier le statut du job
      const statusRes = await fetch(jobUrl, { method: 'GET' });
      
      if (!statusRes.ok) {
        break;
      }
      
      const statusXml = await statusRes.text();
      
      // Chercher l'état du job dans le XML
      const stateMatch = statusXml.match(/<scan:JobState>([^<]+)<\/scan:JobState>/);
      const state = stateMatch ? stateMatch[1] : null;
      
      if (state === 'Completed') {
        return;
      }
      
      if (state === 'Aborted' || state === 'Canceled') {
        throw new Error('Le scan a été annulé par le scanner');
      }
      
      // Si en cours, attendre un peu plus
      if (state === 'Processing' || state === 'Pending') {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        continue;
      }
      
      // État inconnu, attendre un peu et continuer
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
    } catch (e) {
      // En cas d'erreur, attendre un délai fixe et continuer
      await new Promise(resolve => setTimeout(resolve, 3000));
      break;
    }
  }
}

// ---- Fonctions utilitaires ----

function normalizeBase(baseUrl) {
  return baseUrl.replace(/\/+$/, '');
}

function parseCapabilities(xml) {
  const caps = {};
  
  // Résolutions
  const resMatches = [...xml.matchAll(/<scan:(?:XResolution|YResolution)>(\d+)</g)];
  const nums = resMatches.map(m => parseInt(m[1], 10));
  if (nums.length) caps.resolutions = [...new Set(nums)].sort((a,b) => a-b);
  
  // Formats
  const fmtMatches = [...xml.matchAll(/<scan:DocumentFormat>([^<]+)</g)];
  if (fmtMatches.length) caps.formats = [...new Set(fmtMatches.map(m => m[1].trim()))];
  
  // Modes couleur
  const colorMatches = [...xml.matchAll(/<scan:ColorMode>([^<]+)</g)];
  if (colorMatches.length) caps.colorModes = [...new Set(colorMatches.map(m => m[1].trim()))];
  
  // Dimensions maximales
  const widthMatch = xml.match(/<scan:MaxWidth>(\d+)</);
  const heightMatch = xml.match(/<scan:MaxHeight>(\d+)</);
  if (widthMatch) caps.maxWidth = parseInt(widthMatch[1], 10);
  if (heightMatch) caps.maxHeight = parseInt(heightMatch[1], 10);
  
  return caps;
}

function formatToMime(format) {
  return format === 'png' ? 'image/png' : (format === 'pdf' ? 'application/pdf' : 'image/jpeg');
}

function mimeToFormat(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'application/pdf') return 'pdf';
  return 'jpeg';
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
