/**
 * Page d'options complète pour l'extension Easy Scan
 */

// Éléments DOM
const elements = {
  // Paramètres par défaut
  defaultDpi: document.getElementById('defaultDpi'),
  defaultColorMode: document.getElementById('defaultColorMode'),
  defaultFormat: document.getElementById('defaultFormat'),
  
  // Scanner par défaut
  defaultScanner: document.getElementById('defaultScanner'),
  discoverScannersBtn: document.getElementById('discoverScannersBtn'),
  discoveredScanners: document.getElementById('discoveredScanners'),
  testScannerBtn: document.getElementById('testScannerBtn'),
  clearScannerBtn: document.getElementById('clearScannerBtn'),
  scannerActions: document.getElementById('scannerActions'),
  scannerStatus: document.getElementById('scannerStatus'),
  
  // Actions principales
  saveBtn: document.getElementById('saveBtn'),
  resetBtn: document.getElementById('resetBtn'),
  status: document.getElementById('optionsStatus')
};

// Paramètres par défaut
const defaultSettings = {
  dpi: 300,
  colorMode: 'RGB24',
  format: 'jpeg'
};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  loadOptions();
  setupEventListeners();
});

// ---- Event Listeners ----

function setupEventListeners() {
  // Actions principales
  elements.saveBtn.addEventListener('click', saveOptions);
  elements.resetBtn.addEventListener('click', resetOptions);
  
  // Gestion du scanner
  elements.discoverScannersBtn.addEventListener('click', discoverScanners);
  elements.discoveredScanners.addEventListener('change', selectScanner);
  elements.testScannerBtn.addEventListener('click', testScanner);
  elements.clearScannerBtn.addEventListener('click', clearScanner);
  
  // Auto-sauvegarde des paramètres par défaut
  [elements.defaultDpi, elements.defaultColorMode, elements.defaultFormat].forEach(element => {
    if (element) {
      element.addEventListener('change', autoSaveDefaults);
    }
  });
}

// ---- Fonctions principales ----

async function loadOptions() {
  try {
    // Charger les paramètres par défaut
    const saved = await chrome.storage.sync.get(defaultSettings);
    
    if (elements.defaultDpi) elements.defaultDpi.value = saved.dpi || defaultSettings.dpi;
    if (elements.defaultColorMode) elements.defaultColorMode.value = saved.colorMode || defaultSettings.colorMode;
    if (elements.defaultFormat) elements.defaultFormat.value = saved.format || defaultSettings.format;
    
    // Charger le scanner configuré
    const scannerData = await chrome.storage.local.get(['printer']);
    if (scannerData.printer) {
      elements.defaultScanner.value = scannerData.printer;
      elements.scannerActions.classList.remove('hidden');
      setScannerStatus('Scanner configuré', 'success');
    } else {
      setScannerStatus('Aucun scanner configuré', 'info');
    }
    
    setStatus('Options chargées', 'success');
    setTimeout(() => setStatus('', ''), 2000);
  } catch (error) {
    setStatus('Erreur lors du chargement: ' + error.message, 'error');
  }
}

async function saveOptions() {
  try {
    const settings = {
      dpi: parseInt(elements.defaultDpi.value),
      colorMode: elements.defaultColorMode.value,
      format: elements.defaultFormat.value
    };
    
    await chrome.storage.sync.set(settings);
    setStatus('Paramètres sauvegardés avec succès!', 'success');
    
    setTimeout(() => setStatus('', ''), 3000);
  } catch (error) {
    setStatus('Erreur lors de la sauvegarde: ' + error.message, 'error');
  }
}

async function resetOptions() {
  if (!confirm('Êtes-vous sûr de vouloir réinitialiser tous les paramètres ?')) {
    return;
  }
  
  try {
    // Réinitialiser les paramètres par défaut
    await chrome.storage.sync.set(defaultSettings);
    
    // Effacer le scanner configuré
    await chrome.storage.local.remove(['printer']);
    
    // Recharger l'interface
    await loadOptions();
    
    // Réinitialiser l'interface scanner
    elements.defaultScanner.value = '';
    elements.discoveredScanners.classList.add('hidden');
    elements.discoveredScanners.innerHTML = '<option value="">Sélectionner un scanner...</option>';
    elements.scannerActions.classList.add('hidden');
    
    setStatus('Tous les paramètres ont été réinitialisés', 'success');
    setTimeout(() => setStatus('', ''), 3000);
  } catch (error) {
    setStatus('Erreur lors de la réinitialisation: ' + error.message, 'error');
  }
}

function autoSaveDefaults() {
  saveOptions();
}

// ---- Gestion des scanners ----

async function discoverScanners() {
  setScannerStatus('Découverte des scanners en cours...', 'info');
  elements.discoverScannersBtn.disabled = true;
  elements.discoveredScanners.classList.add('hidden');
  elements.discoveredScanners.innerHTML = '<option value="">Sélectionner un scanner...</option>';
  
  try {
    const response = await sendMessage({
      type: 'DISCOVER_SCANNERS',
      payload: { subnet: null, start: 1, end: 254 }
    });
    
    if (!response.ok) throw new Error(response.error || 'Échec de la découverte');
    
    if (!response.scanners.length) {
      setScannerStatus('Aucun scanner trouvé sur le réseau', 'error');
      return;
    }
    
    // Remplir la liste des scanners trouvés
    for (const scanner of response.scanners) {
      const option = document.createElement('option');
      option.value = scanner.url;
      option.textContent = `${scanner.ip} – ${scanner.name}`;
      elements.discoveredScanners.appendChild(option);
    }
    
    elements.discoveredScanners.classList.remove('hidden');
    setScannerStatus(`${response.scanners.length} scanner(s) trouvé(s) - sélectionnez-en un`, 'success');
    
  } catch (error) {
    setScannerStatus(`Erreur de découverte: ${error.message}`, 'error');
  } finally {
    elements.discoverScannersBtn.disabled = false;
  }
}

async function selectScanner() {
  const selected = elements.discoveredScanners.value;
  if (!selected) return;
  
  try {
    // Sauvegarder le scanner sélectionné
    await chrome.storage.local.set({ printer: selected });
    
    // Mettre à jour l'interface
    elements.defaultScanner.value = selected;
    elements.scannerActions.classList.remove('hidden');
    
    setScannerStatus('Scanner sélectionné et sauvegardé', 'success');
    
    // Test automatique de connectivité
    setTimeout(() => {
      testScanner();
    }, 1000);
    
  } catch (error) {
    setScannerStatus('Erreur lors de la sauvegarde: ' + error.message, 'error');
  }
}

async function testScanner() {
  const scanner = elements.defaultScanner.value;
  if (!scanner) {
    setScannerStatus('Aucun scanner à tester', 'error');
    return;
  }
  
  setScannerStatus('Test de connectivité en cours...', 'info');
  elements.testScannerBtn.disabled = true;
  
  try {
    const response = await sendMessage({
      type: 'CONNECTIVITY_TEST',
      payload: { printerUrl: scanner }
    });
    
    if (!response.ok) {
      setScannerStatus('Test échoué: ' + response.error, 'error');
      return;
    }
    
    setScannerStatus(`Connectivité OK - eSCL: ${response.primary}, AirScan: ${response.alt || 'n/a'}`, 'success');
  } catch (error) {
    setScannerStatus('Erreur de test: ' + error.message, 'error');
  } finally {
    elements.testScannerBtn.disabled = false;
  }
}

async function clearScanner() {
  if (!confirm('Êtes-vous sûr de vouloir effacer le scanner configuré ?')) {
    return;
  }
  
  try {
    await chrome.storage.local.remove(['printer']);
    
    elements.defaultScanner.value = '';
    elements.discoveredScanners.classList.add('hidden');
    elements.discoveredScanners.innerHTML = '<option value="">Sélectionner un scanner...</option>';
    elements.scannerActions.classList.add('hidden');
    
    setScannerStatus('Scanner effacé', 'success');
    setTimeout(() => setScannerStatus('Aucun scanner configuré', 'info'), 2000);
  } catch (error) {
    setScannerStatus('Erreur lors de l\'effacement: ' + error.message, 'error');
  }
}

// ---- Fonctions utilitaires ----

function setStatus(message, type) {
  if (!elements.status) return;
  
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
  
  if (!message) {
    elements.status.className = 'status';
  }
}

function setScannerStatus(message, type) {
  if (!elements.scannerStatus) return;
  
  elements.scannerStatus.textContent = message;
  elements.scannerStatus.className = `status ${type}`;
  
  if (!message) {
    elements.scannerStatus.className = 'status';
  }
}

// Fonction de communication avec le service worker
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}
