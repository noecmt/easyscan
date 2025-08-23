/**
 * Service Worker pour l'extension Easy Scan
 */

import { createScanJob, fetchScannedImage, getCapabilities, adjustSettingsForCapabilities, checkConnectivity, buildScanJobXML, warmUpScanner } from './core/escl.js';
import { discoverScanners, buildCandidateIPs } from './core/discovery.js';

let lastScan = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const { type, payload } = msg;
  
  (async () => {
    try {
      switch (type) {
        case 'START_SCAN': {
          const { printerUrl, settings } = payload;
          
          // Warm-up du scanner pour éviter les erreurs 403
          console.log('🔥 Warm-up du scanner...');
          await warmUpScanner(printerUrl);
          
          const capabilities = await getCapabilities(printerUrl);
          const adjusted = adjustSettingsForCapabilities(settings, capabilities);
          const jobInfo = await createScanJob(printerUrl, adjusted);
          const image = await fetchScannedImage(printerUrl, jobInfo, adjusted.format);
          
          console.log('Image fetched:', {
            mimeType: image.mimeType,
            dataUrlLength: image.dataUrl?.length,
            dataUrlStart: image.dataUrl?.substring(0, 50)
          });
          
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
          const { subnet, start = 1, end = 50 } = payload || {};
          const candidates = buildCandidateIPs(subnet, start, end);
          const discovered = await discoverScanners(candidates);
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
      console.error('[SCAN ERROR]', e);
      sendResponse({ ok: false, error: e.message });
    }
  })();
  
  return true; // async response
});
