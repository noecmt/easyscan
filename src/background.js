/**
 * Service Worker pour l'extension Easy Scan
 */

import { createScanJob, fetchScannedImage, getCapabilities, adjustSettingsForCapabilities, checkConnectivity, buildScanJobXML, warmUpScanner } from './core/escl.js';
import { discoverScanners } from './core/discovery';

let lastScan = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const { type, payload } = msg;
  
  (async () => {
    try {
      switch (type) {
        case 'START_SCAN': {
          const { printerUrl, settings } = payload;
          
          // Warm-up du scanner pour éviter les erreurs 403
          await warmUpScanner(printerUrl);
          
          const capabilities = await getCapabilities(printerUrl);
          const adjusted = adjustSettingsForCapabilities(settings, capabilities);
          const jobInfo = await createScanJob(printerUrl, adjusted);
          const image = await fetchScannedImage(printerUrl, jobInfo, adjusted.format);
          
          lastScan = image;
          sendResponse({ 
            ok: true, 
            adjusted, 
            variantUsed: jobInfo.variantUsed, 
            tried: jobInfo.tried, 
            image: { 
              mimeType: image.mimeType, 
              dataUrl: image.dataUrl 
            } 
          });
          break;
        }
        
        case 'DISCOVER_SCANNERS': {
          const { scannerIp, subnetHint } = payload || {};
          const knownIps = scannerIp ? [scannerIp.replace(/^https?:\/\//, '')] : [];
          const discovered = await discoverScanners({
            knownIps,
            ...(subnetHint ? { subnets: [subnetHint] } : {}),
          });
          sendResponse({ ok: true, scanners: discovered });
          break;
        }
        
        case 'CONNECTIVITY_TEST': {
          const { printerUrl } = payload;
          const test = await fetch(printerUrl.replace(/\/$/, '') + '/eSCL/ScannerStatus', { method: 'GET' });
          const alt = await fetch(printerUrl.replace(/\/$/, '') + '/AirScan/ScannerStatus', { method: 'GET' }).catch(() => null);
          sendResponse({ ok: true, primary: test.status, alt: alt ? alt.status : null });
          break;
        }
        
        case 'DEBUG_XML': {
          const { printerUrl, settings } = payload;
          const xml = buildScanJobXML(settings);
          sendResponse({ ok: true, xml: xml });
          break;
        }
        
        case 'GET_LAST_SCAN': {
          sendResponse({ 
            ok: true, 
            image: lastScan ? { 
              mimeType: lastScan.mimeType, 
              dataUrl: lastScan.dataUrl 
            } : null 
          });
          break;
        }
        
        case 'COPY_LAST_SCAN': {
          if (!lastScan) throw new Error('Aucun scan disponible');
          sendResponse({ 
            ok: true, 
            image: { 
              mimeType: lastScan.mimeType, 
              dataUrl: lastScan.dataUrl 
            } 
          });
          break;
        }
        
        default:
          sendResponse({ ok: false, error: 'Type de message inconnu' });
      }
    } catch (e) {
      // Gestion spécialisée des erreurs
      let userMessage = e.message;
      
      if (e.message.includes('410')) {
        userMessage = 'Le scanner a annulé le job. Vérifiez que le scanner est prêt et réessayez.';
      } else if (e.message.includes('403')) {
        userMessage = 'Scanner occupé. Attendez quelques secondes et réessayez.';
      } else if (e.message.includes('409')) {
        userMessage = 'Un autre scan est en cours. Attendez la fin et réessayez.';
      } else if (e.message.includes('Failed to fetch')) {
        userMessage = 'Impossible de joindre le scanner. Vérifiez l\'adresse IP.';
      }
      
      sendResponse({ ok: false, error: userMessage });
    }
  })();
  
  return true; // async response
});
