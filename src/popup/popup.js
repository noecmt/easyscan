/**
 * Interface utilisateur pour l'extension Easy Scan
 */

// Éléments DOM
const elements = {
  scannerIP: document.getElementById('scannerIP'),
  dpi: document.getElementById('dpi'),
  colorMode: document.getElementById('colorMode'),
  format: document.getElementById('format'),
  scanBtn: document.getElementById('scanBtn'),
  discoverBtn: document.getElementById('discoverBtn'),
  connectivityBtn: document.getElementById('connectivityBtn'),
  previewPageBtn: document.getElementById('previewPageBtn'),
  discoveredSelect: document.getElementById('discoveredSelect'),
  copyBtn: document.getElementById('copyBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  previewBtn: document.getElementById('previewBtn'),
  optionsBtn: document.getElementById('optionsBtn'),
  status: document.getElementById('status'),
  previewImg: document.getElementById('previewImg'),
  downloadActions: document.getElementById('downloadActions')
};

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  // Vérifier que tous les éléments DOM sont présents
  const missingElements = [];
  Object.entries(elements).forEach(([key, element]) => {
    if (!element) {
      missingElements.push(key);
    }
  });
  
  if (missingElements.length > 0) {
    console.error('Éléments DOM manquants:', missingElements);
  }
  
  loadSettings();
  setupEventListeners();
  
  // Recherche automatique seulement si aucune configuration n'existe
  const hasConfiguration = elements.scannerIP.value.trim();
  if (!hasConfiguration) {
    await autoDiscoverScanners();
  } else {
    // Si configuration existante, juste afficher le statut
    setStatus('Scanner configuré - prêt à scanner', 'success');
  }
});

// ---- Event Listeners ----

function setupEventListeners() {
  // Scan principal
  elements.scanBtn.addEventListener('click', handleScan);
  
  // Découverte
  elements.discoverBtn.addEventListener('click', handleDiscover);
  elements.discoveredSelect.addEventListener('change', handleScannerSelect);
  
  // Tests
  elements.connectivityBtn.addEventListener('click', handleConnectivityTest);
  
  // Page preview
  elements.previewPageBtn.addEventListener('click', openPreviewPage);
  
  // Actions de téléchargement
  elements.copyBtn.addEventListener('click', handleCopy);
  elements.downloadBtn.addEventListener('click', handleDownload);
  elements.previewBtn.addEventListener('click', openPreviewPage);
  
  // Options
  elements.optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Preview image - clic pour ouvrir en grand
  elements.previewImg.addEventListener('click', openImageInNewTab);
  
  // Sauvegarde des paramètres
  ['change', 'input'].forEach(event => {
    elements.scannerIP.addEventListener(event, saveSettings);
    elements.dpi.addEventListener(event, saveSettings);
    elements.colorMode.addEventListener(event, saveSettings);
    elements.format.addEventListener(event, saveSettings);
  });
}

// ---- Découverte automatique au démarrage ----

async function autoDiscoverScanners() {
  // Si une IP est déjà configurée, on ne fait rien
  if (elements.scannerIP.value.trim()) {
    return;
  }

  setStatus('Recherche automatique de scanners...', 'info');
  
  try {
    // Lancer une découverte réseau ultra-rapide (seulement les IPs les plus communes)
    const response = await sendMessage({
      type: 'DISCOVER_SCANNERS',
      payload: { subnet: null, start: 1, end: 20 } // Scan ultra-rapide
    });
    
    if (response.ok && response.scanners.length > 0) {
      // Prendre le premier scanner trouvé
      const firstScanner = response.scanners[0];
      elements.scannerIP.value = firstScanner.url;
      
      // Remplir la liste déroulante avec tous les scanners trouvés
      elements.discoveredSelect.innerHTML = '<option value="">Sélectionner un scanner découvert...</option>';
      for (const scanner of response.scanners) {
        const option = document.createElement('option');
        option.value = scanner.url;
        option.textContent = `${scanner.ip} – ${scanner.name}`;
        if (scanner.url === firstScanner.url) {
          option.selected = true;
        }
        elements.discoveredSelect.appendChild(option);
      }
      
      elements.discoveredSelect.classList.remove('hidden');
      setStatus(`${response.scanners.length} scanner(s) trouvé(s) - ${firstScanner.name} sélectionné`, 'success');
      saveSettings();
      
      // Test automatique de connectivité sur le premier scanner
      setTimeout(() => {
        handleConnectivityTest();
      }, 500);
      
    } else {
      setStatus('Aucun scanner trouvé - cliquez sur Découvrir pour scan étendu', 'info');
    }
  } catch (error) {
    setStatus('Cliquez sur Découvrir pour rechercher des scanners', 'info');
  }
}

// ---- Handlers principaux ----

async function handleScan() {
  const settings = collectSettings();
  if (!settings.printer) {
    setStatus('Veuillez entrer une adresse IP de scanner', 'error');
    return;
  }
  
  setStatus('Scan en cours...', 'info');
  elements.scanBtn.disabled = true;
  hidePreview();
  
  try {
    const response = await sendMessage({
      type: 'START_SCAN',
      payload: { printerUrl: settings.printer, settings }
    });
    
    if (response.ok) {
      setStatus(`Scan réussi ! Paramètres utilisés: ${response.variantUsed.colorMode}, ${response.variantUsed.dpi}DPI`, 'success');
      showPreview(response.image?.dataUrl, response.image?.mimeType);
    } else {
      setStatus(`Erreur: ${response.error}`, 'error');
    }
  } catch (error) {
    setStatus(`Erreur: ${error.message}`, 'error');
  } finally {
    elements.scanBtn.disabled = false;
  }
}

async function handleDiscover() {
  setStatus('Découverte en cours...', 'info');
  elements.discoverBtn.disabled = true;
  elements.discoveredSelect.classList.add('hidden');
  elements.discoveredSelect.innerHTML = '<option value="">Sélectionner un scanner découvert...</option>';
  
  try {
    // Déduire sous-réseau depuis IP saisie si possible, sinon auto-détection
    let subnet = '';
    const val = elements.scannerIP.value.trim();
    const match = /^(?:https?:\/\/)?(\d+\.\d+\.\d+)\./.exec(val);
    if (match) {
      subnet = match[1];
    }
    // Si pas de sous-réseau défini, on laisse le backend auto-détecter
    
    const response = await sendMessage({
      type: 'DISCOVER_SCANNERS',
      payload: { subnet: subnet || null, start: 1, end: 254 }
    });
    
    if (!response.ok) throw new Error(response.error || 'Échec de la découverte');
    
    if (!response.scanners.length) {
      setStatus('Aucun scanner trouvé (plage restreinte)', 'error');
      return;
    }
    
    for (const scanner of response.scanners) {
      const option = document.createElement('option');
      option.value = scanner.url;
      option.textContent = `${scanner.ip} – ${scanner.name}`;
      elements.discoveredSelect.appendChild(option);
    }
    
    elements.discoveredSelect.classList.remove('hidden');
    setStatus(`${response.scanners.length} scanner(s) trouvé(s)`, 'success');
    
  } catch (error) {
    setStatus(`Erreur découverte: ${error.message}`, 'error');
  } finally {
    elements.discoverBtn.disabled = false;
  }
}

async function handleConnectivityTest() {
  const printer = elements.scannerIP.value.trim();
  if (!printer) {
    setStatus('Veuillez entrer une adresse IP', 'error');
    return;
  }
  
  setStatus('Test de connectivité...', 'info');
  
  try {
    const response = await sendMessage({
      type: 'CONNECTIVITY_TEST',
      payload: { printerUrl: printer }
    });
    
    if (!response.ok) {
      setStatus('Échec test: ' + response.error, 'error');
      return;
    }
    
    setStatus(`Status eSCL: ${response.primary}, AirScan: ${response.alt ?? 'n/a'}`, 'success');
  } catch (error) {
    setStatus(`Erreur test: ${error.message}`, 'error');
  }
}

async function handleDebugXML() {
  const settings = collectSettings();
  if (!settings.printer) {
    setStatus('Veuillez entrer une adresse IP', 'error');
    return;
  }
  
  try {
    const response = await sendMessage({
      type: 'DEBUG_XML',
      payload: { printerUrl: settings.printer, settings }
    });
    
    if (response.ok) {
      setStatus('XML affiché dans la console (F12)', 'info');
    } else {
      setStatus(`Erreur debug: ${response.error}`, 'error');
    }
  } catch (error) {
    setStatus(`Erreur debug: ${error.message}`, 'error');
  }
}

async function handleCopy() {
  try {
    const response = await sendMessage({ type: 'COPY_LAST_SCAN', payload: {} });
    if (response.ok && response.image) {
      // Copier dans le presse-papiers
      const blob = await dataUrlToBlob(response.image.dataUrl);
      await navigator.clipboard.write([
        new ClipboardItem({ [response.image.mimeType]: blob })
      ]);
      setStatus('Image copiée dans le presse-papiers', 'success');
    } else {
      setStatus('Aucune image à copier', 'error');
    }
  } catch (error) {
    setStatus(`Erreur copie: ${error.message}`, 'error');
  }
}

function handleDownload() {
  const dataUrl = elements.previewImg.src;
  if (!dataUrl) return;
  
  const a = document.createElement('a');
  const ext = elements.format.value === 'jpeg' ? 'jpg' : elements.format.value;
  a.download = `scan.${ext}`;
  a.href = dataUrl;
  a.click();
}

function handleScannerSelect() {
  const selected = elements.discoveredSelect.value;
  if (selected) {
    // Garder l'URL complète avec http://
    elements.scannerIP.value = selected;
    saveSettings();
  }
}

// ---- Fonctions utilitaires ----

function collectSettings() {
  return {
    printer: elements.scannerIP.value.trim(),
    dpi: parseInt(elements.dpi.value, 10),
    colorMode: elements.colorMode.value,
    format: elements.format.value
  };
}

function saveSettings() {
  const settings = collectSettings();
  chrome.storage.local.set({
    printer: settings.printer,
    dpi: settings.dpi,
    colorMode: settings.colorMode,
    format: settings.format
  });
}

async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get(['printer', 'dpi', 'colorMode', 'format']);
    if (stored.printer) elements.scannerIP.value = stored.printer;
    if (stored.dpi) elements.dpi.value = stored.dpi;
    if (stored.colorMode) elements.colorMode.value = stored.colorMode;
    if (stored.format) elements.format.value = stored.format;
  } catch (error) {
    // Paramètres non chargés - utiliser les valeurs par défaut
  }
}

function setStatus(message, type = '') {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
}

async function showPreview(dataUrl, mimeType) {
  if (!elements.previewImg) {
    console.error('previewImg element not found!');
    return;
  }
  
  if (!elements.downloadActions) {
    console.error('downloadActions element not found!');
    return;
  }
  
  if (dataUrl) {
    try {
      // Stocker le scan actuel pour la page preview
      const scanData = {
        data: dataUrl,
        mimeType: mimeType,
        timestamp: Date.now()
      };
      
      // Sauvegarder le scan actuel
      await chrome.storage.local.set({ 
        currentScan: scanData,
        lastScanData: scanData 
      });
      
      // Ajouter à l'historique
      const result = await chrome.storage.local.get(['scanHistory']);
      const history = result.scanHistory || [];
      history.push(scanData);
      
      // Garder seulement les 10 derniers scans
      if (history.length > 10) {
        history.shift();
      }
      
      await chrome.storage.local.set({ scanHistory: history });
      
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
    }
    
    // Pour les images : affichage normal
    if (mimeType && mimeType.startsWith('image/')) {
      elements.previewImg.src = dataUrl;
      elements.previewImg.classList.remove('hidden');
      elements.downloadActions.classList.remove('hidden');
      
      elements.previewImg.style.cursor = 'pointer';
      elements.previewImg.title = 'Cliquer pour ouvrir en grand';
      
    }
    // Pour les PDF : afficher une icône de prévisualisation
    else if (mimeType && mimeType === 'application/pdf') {
      // Créer une miniature PDF temporaire
      const pdfIcon = 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="120" viewBox="0 0 100 120">
          <rect width="100" height="120" fill="#ff4444" rx="5"/>
          <text x="50" y="40" text-anchor="middle" fill="white" font-size="12" font-family="Arial">PDF</text>
          <text x="50" y="60" text-anchor="middle" fill="white" font-size="8" font-family="Arial">Cliquer pour</text>
          <text x="50" y="75" text-anchor="middle" fill="white" font-size="8" font-family="Arial">ouvrir</text>
        </svg>
      `);
      
      elements.previewImg.src = pdfIcon;
      elements.previewImg.classList.remove('hidden');
      elements.downloadActions.classList.remove('hidden');
      
      elements.previewImg.style.cursor = 'pointer';
      elements.previewImg.title = 'PDF généré - Cliquer pour ouvrir';
      
      // Stocker le dataUrl original pour l'ouverture
      elements.previewImg.dataset.originalData = dataUrl;
      elements.previewImg.dataset.originalMime = mimeType;
      
    }
    // Autres formats : essayer quand même d'afficher
    else {
      elements.previewImg.src = dataUrl;
      elements.previewImg.classList.remove('hidden');
      elements.downloadActions.classList.remove('hidden');
      
      elements.previewImg.style.cursor = 'pointer';
      elements.previewImg.title = 'Cliquer pour ouvrir';
    }
  } else {
    hidePreview();
  }
}

function hidePreview() {
  elements.previewImg.classList.add('hidden');
  elements.downloadActions.classList.add('hidden');
  elements.previewImg.style.cursor = '';
  elements.previewImg.title = '';
}

function openImageInNewTab() {
  // Ouvrir la page preview dédiée
  const previewUrl = chrome.runtime.getURL('src/preview/preview.html');
  chrome.tabs.create({ url: previewUrl });
}

function openPreviewPage() {
  // Ouvrir la page preview dédiée
  const previewUrl = chrome.runtime.getURL('src/preview/preview.html');
  chrome.tabs.create({ url: previewUrl });
}

async function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}
