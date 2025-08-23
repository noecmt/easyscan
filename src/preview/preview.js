// Gestionnaire de la page de preview
class PreviewManager {
    constructor() {
        this.currentScan = null;
        this.scanHistory = [];
        this.init();
    }

    async init() {
        console.log('🎬 Initialisation de la page preview');
        await this.loadElements();
        await this.setupEventListeners();
        await this.loadCurrentScan();
        await this.loadScanHistory();
        this.hideLoading();
    }

    async loadElements() {
        this.elements = {
            // Indicateurs
            loadingIndicator: document.getElementById('loadingIndicator'),
            previewContent: document.getElementById('previewContent'),
            noScanMessage: document.getElementById('noScanMessage'),
            
            // Preview
            previewImage: document.getElementById('previewImage'),
            pdfPreview: document.getElementById('pdfPreview'),
            openPdfBtn: document.getElementById('openPdfBtn'),
            
            // Info scan
            scanDate: document.getElementById('scanDate'),
            scanFormat: document.getElementById('scanFormat'),
            scanSize: document.getElementById('scanSize'),
            
            // Boutons d'action
            saveBtn: document.getElementById('saveBtn'),
            copyBtn: document.getElementById('copyBtn'),
            printBtn: document.getElementById('printBtn'),
            newScanBtn: document.getElementById('newScanBtn'),
            closeBtn: document.getElementById('closeBtn'),
            backToPopupBtn: document.getElementById('backToPopupBtn'),
            
            // Historique
            historyList: document.getElementById('historyList'),
            
            // Toast
            toast: document.getElementById('toast'),
            toastMessage: document.getElementById('toastMessage')
        };
    }

    setupEventListeners() {
        // Boutons d'action
        this.elements.saveBtn.addEventListener('click', () => this.downloadScan());
        this.elements.copyBtn.addEventListener('click', () => this.copyToClipboard());
        this.elements.printBtn.addEventListener('click', () => this.printScan());
        
        // Navigation
        this.elements.newScanBtn.addEventListener('click', () => this.openPopup());
        this.elements.closeBtn.addEventListener('click', () => window.close());
        this.elements.backToPopupBtn.addEventListener('click', () => this.openPopup());
        
        // PDF
        this.elements.openPdfBtn.addEventListener('click', () => this.openPdfInNewTab());
        
        // Preview image click
        this.elements.previewImage.addEventListener('click', () => this.openFullscreen());
        
        console.log('✅ Event listeners configurés');
    }

    async loadCurrentScan() {
        try {
            console.log('📄 Chargement du scan actuel...');
            
            // Récupérer depuis le storage local
            const result = await chrome.storage.local.get(['currentScan', 'lastScanData']);
            
            if (result.currentScan || result.lastScanData) {
                const scanData = result.currentScan || result.lastScanData;
                console.log('✅ Scan trouvé:', {
                    mimeType: scanData.mimeType,
                    size: scanData.data ? `${Math.round(scanData.data.length / 1024)} KB` : 'N/A',
                    timestamp: scanData.timestamp
                });
                
                this.currentScan = scanData;
                this.displayScan(scanData);
                this.updateScanInfo(scanData);
            } else {
                console.log('❌ Aucun scan trouvé');
                this.showNoScanMessage();
            }
        } catch (error) {
            console.error('❌ Erreur lors du chargement du scan:', error);
            this.showError('Erreur lors du chargement du scan');
            this.showNoScanMessage();
        }
    }

    displayScan(scanData) {
        const { data, mimeType } = scanData;
        
        if (!data) {
            this.showNoScanMessage();
            return;
        }

        // Masquer le message "pas de scan"
        this.elements.noScanMessage.style.display = 'none';
        this.elements.previewContent.style.display = 'flex';

        if (mimeType === 'application/pdf') {
            // Affichage PDF
            this.elements.previewImage.style.display = 'none';
            this.elements.pdfPreview.style.display = 'block';
        } else {
            // Affichage image
            this.elements.pdfPreview.style.display = 'none';
            this.elements.previewImage.style.display = 'block';
            this.elements.previewImage.src = data;
            this.elements.previewImage.dataset.originalData = data;
            this.elements.previewImage.dataset.originalMime = mimeType;
        }

        // Activer les boutons
        this.enableActionButtons();
    }

    updateScanInfo(scanData) {
        const { mimeType, timestamp, data } = scanData;
        
        // Date
        if (timestamp) {
            const date = new Date(timestamp);
            this.elements.scanDate.textContent = date.toLocaleString('fr-FR');
        }
        
        // Format
        const formatText = mimeType === 'application/pdf' ? 'PDF' : 
                          mimeType.includes('jpeg') ? 'JPEG' :
                          mimeType.includes('png') ? 'PNG' : 'Image';
        this.elements.scanFormat.textContent = formatText;
        
        // Taille
        if (data) {
            const sizeKB = Math.round(data.length / 1024);
            this.elements.scanSize.textContent = `${sizeKB} KB`;
        }
    }

    async loadScanHistory() {
        try {
            const result = await chrome.storage.local.get(['scanHistory']);
            this.scanHistory = result.scanHistory || [];
            this.renderHistory();
        } catch (error) {
            console.error('❌ Erreur lors du chargement de l\'historique:', error);
        }
    }

    renderHistory() {
        const historyContainer = this.elements.historyList;
        historyContainer.innerHTML = '';
        
        if (this.scanHistory.length === 0) {
            historyContainer.innerHTML = '<p style="color: #666; font-style: italic;">Aucun scan dans l\'historique</p>';
            return;
        }

        this.scanHistory.slice(-5).reverse().forEach((scan, index) => {
            const item = document.createElement('div');
            item.className = 'history-item';
            if (index === 0) item.classList.add('active');
            
            const date = new Date(scan.timestamp);
            const formatText = scan.mimeType === 'application/pdf' ? 'PDF' : 'IMG';
            
            item.innerHTML = `
                <span>📄</span>
                <div>
                    <div style="font-weight: 500;">${formatText}</div>
                    <div style="font-size: 0.7rem; opacity: 0.8;">${date.toLocaleDateString()}</div>
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.loadHistoryItem(scan);
                this.renderHistory(); // Refresh pour mettre à jour l'état actif
            });
            
            historyContainer.appendChild(item);
        });
    }

    async loadHistoryItem(scanData) {
        this.currentScan = scanData;
        this.displayScan(scanData);
        this.updateScanInfo(scanData);
        this.hideLoading();
    }

    async downloadScan() {
        if (!this.currentScan?.data) {
            this.showError('Aucun scan à télécharger');
            return;
        }

        try {
            const { data, mimeType } = this.currentScan;
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
            
            let extension = 'jpg';
            if (mimeType === 'application/pdf') extension = 'pdf';
            else if (mimeType.includes('png')) extension = 'png';
            
            const filename = `scan-${timestamp}.${extension}`;
            
            // Créer le lien de téléchargement
            const link = document.createElement('a');
            link.href = data;
            link.download = filename;
            link.click();
            
            this.showSuccess(`Scan téléchargé: ${filename}`);
            console.log('✅ Téléchargement initié:', filename);
        } catch (error) {
            console.error('❌ Erreur lors du téléchargement:', error);
            this.showError('Erreur lors du téléchargement');
        }
    }

    async copyToClipboard() {
        if (!this.currentScan?.data) {
            this.showError('Aucun scan à copier');
            return;
        }

        try {
            const { data, mimeType } = this.currentScan;
            
            if (mimeType === 'application/pdf') {
                // Pour les PDF, copier le lien data
                await navigator.clipboard.writeText(data);
                this.showSuccess('Lien PDF copié dans le presse-papiers');
            } else {
                // Pour les images, essayer de copier l'image
                const response = await fetch(data);
                const blob = await response.blob();
                
                await navigator.clipboard.write([
                    new ClipboardItem({
                        [blob.type]: blob
                    })
                ]);
                
                this.showSuccess('Image copiée dans le presse-papiers');
            }
            
            console.log('✅ Copie réussie');
        } catch (error) {
            console.error('❌ Erreur lors de la copie:', error);
            this.showError('Erreur lors de la copie');
        }
    }

    printScan() {
        if (!this.currentScan?.data) {
            this.showError('Aucun scan à imprimer');
            return;
        }

        try {
            const { data, mimeType } = this.currentScan;
            
            if (mimeType === 'application/pdf') {
                // Ouvrir le PDF dans un nouvel onglet pour impression
                const newWindow = window.open(data, '_blank');
                if (newWindow) {
                    newWindow.onload = () => {
                        newWindow.print();
                    };
                }
            } else {
                // Créer une page d'impression pour image
                const printWindow = window.open('', '_blank');
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Impression - Easy Scan</title>
                        <style>
                            body { margin: 0; padding: 0; }
                            img { max-width: 100%; height: auto; }
                            @media print {
                                body { margin: 0; }
                                img { width: 100%; height: auto; }
                            }
                        </style>
                    </head>
                    <body>
                        <img src="${data}" onload="window.print(); window.close();" />
                    </body>
                    </html>
                `);
                printWindow.document.close();
            }
            
            this.showSuccess('Impression lancée');
            console.log('✅ Impression initiée');
        } catch (error) {
            console.error('❌ Erreur lors de l\'impression:', error);
            this.showError('Erreur lors de l\'impression');
        }
    }

    openPdfInNewTab() {
        if (this.currentScan?.data && this.currentScan.mimeType === 'application/pdf') {
            window.open(this.currentScan.data, '_blank');
        }
    }

    openFullscreen() {
        if (this.currentScan?.data && this.currentScan.mimeType !== 'application/pdf') {
            window.open(this.currentScan.data, '_blank');
        }
    }

    openPopup() {
        // Ouvrir le popup de l'extension
        chrome.tabs.create({ url: chrome.runtime.getURL('src/popup/popup.html') });
    }

    enableActionButtons() {
        this.elements.saveBtn.disabled = false;
        this.elements.copyBtn.disabled = false;
        this.elements.printBtn.disabled = false;
    }

    disableActionButtons() {
        this.elements.saveBtn.disabled = true;
        this.elements.copyBtn.disabled = true;
        this.elements.printBtn.disabled = true;
    }

    showNoScanMessage() {
        this.elements.previewContent.style.display = 'none';
        this.elements.noScanMessage.style.display = 'flex';
        this.disableActionButtons();
    }

    hideLoading() {
        this.elements.loadingIndicator.style.display = 'none';
    }

    showToast(message, type = 'info') {
        this.elements.toastMessage.textContent = message;
        this.elements.toast.className = `toast ${type}`;
        this.elements.toast.classList.add('show');
        
        setTimeout(() => {
            this.elements.toast.classList.remove('show');
        }, 3000);
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showInfo(message) {
        this.showToast(message, 'info');
    }
}

// Initialiser la page preview
document.addEventListener('DOMContentLoaded', () => {
    new PreviewManager();
});
