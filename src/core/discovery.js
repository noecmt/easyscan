/**
 * Module de découverte de scanners réseau
 */

/**
 * Découvre les scanners sur le réseau
 */
export async function discoverScanners(candidates) {
  const discovered = [];
  const batchSize = 20; // Augmenté encore pour plus de rapidité
  
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const promises = batch.map(async (ip) => {
      try {
        const baseUrl = `http://${ip}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 800); // Timeout encore plus réduit
        
        const res = await fetch(`${baseUrl}/eSCL/ScannerStatus`, {
          method: 'GET',
          signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (res.ok) {
          const name = await getScannerName(baseUrl);
          return { ip, url: baseUrl, name: name || 'Scanner eSCL' };
        }
      } catch (e) {
        // Ignore les erreurs de réseau
      }
      return null;
    });
    
    const results = await Promise.all(promises);
    const foundInBatch = results.filter(r => r !== null);
    discovered.push(...foundInBatch);
    
    // Arrêt anticipé si on trouve des scanners dans les premiers batchs (scan rapide)
    if (discovered.length > 0 && candidates.length <= 50) {
      console.log(`Scan rapide: trouvé ${discovered.length} scanner(s), arrêt anticipé`);
      break;
    }
    
    // Pour les scans complets, continuer mais afficher le progrès
    if (candidates.length > 50 && (i + batchSize) % 100 === 0) {
      console.log(`Scan en cours: ${i + batchSize}/${candidates.length} IPs testées, ${discovered.length} scanner(s) trouvé(s)`);
    }
  }
  
  return discovered;
}

/**
 * Génère la liste des IP candidates à scanner
 */
export function buildCandidateIPs(subnet, start, end) {
  const subnets = [];
  
  // Si un sous-réseau spécifique est fourni
  if (subnet && /^\d+\.\d+\.\d+$/.test(subnet)) {
    subnets.push(subnet);
  } else {
    // Utiliser les sous-réseaux les plus communs
    subnets.push('192.168.68', '192.168.1', '192.168.0', '10.0.0', '172.16.0');
  }
  
  const ips = [];
  for (const sn of subnets) {
    // IPs ultra-prioritaires pour imprimantes/scanners
    const ultraPriorityIPs = [106, 100, 101, 102, 103, 1, 2, 200, 201, 202];
    
    // Ajouter d'abord les IPs ultra-prioritaires
    for (const ip of ultraPriorityIPs) {
      if (ip >= start && ip <= end) {
        ips.push(`${sn}.${ip}`);
      }
    }
    
    // IPs secondaires communes
    const secondaryIPs = [104, 105, 107, 108, 109, 110, 203, 204, 205, 206, 10, 20, 30, 50];
    for (const ip of secondaryIPs) {
      if (ip >= start && ip <= end && !ips.includes(`${sn}.${ip}`)) {
        ips.push(`${sn}.${ip}`);
      }
    }
    
    // Puis ajouter le reste seulement si demandé explicitement (plage > 50)
    if (end > 50) {
      for (let i = start; i <= end; i++) {
        const ipAddr = `${sn}.${i}`;
        if (!ips.includes(ipAddr)) {
          ips.push(ipAddr);
        }
      }
    }
  }
  
  return ips;
}

/**
 * Récupère le nom du scanner depuis ses capacités
 */
async function getScannerName(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/eSCL/ScannerCapabilities`, { method: 'GET' });
    if (!res.ok) return null;
    
    const xml = await res.text();
    const makeModelMatch = xml.match(/<pwg:MakeAndModel>([^<]+)</);
    return makeModelMatch ? makeModelMatch[1].trim() : null;
  } catch {
    return null;
  }
}
