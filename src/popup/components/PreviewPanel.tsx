import type { ScanRecord } from '../../core/types'

interface Props {
  record: ScanRecord | null
  onCopy: () => void
  onDownload: () => void
  onOpenPreview: () => void
}

export function PreviewPanel({ record, onCopy, onDownload, onOpenPreview }: Props) {
  if (!record) return null

  const isPdf = record.mimeType === 'application/pdf'

  return (
    <div class="preview-panel">
      <div class="preview-container">
        {isPdf ? (
          <div class="pdf-icon" onClick={onOpenPreview} title="Ouvrir l'aperçu">
            📄 PDF
          </div>
        ) : (
          <img
            src={record.dataUrl}
            class="preview-image"
            onClick={onOpenPreview}
            alt="Aperçu du scan"
            style={{ cursor: 'pointer' }}
          />
        )}
      </div>
      <div class="download-actions">
        <button onClick={onCopy} title="Copier">📋</button>
        <button onClick={onDownload} title="Télécharger">💾</button>
        <button onClick={onOpenPreview} title="Aperçu complet">👁️</button>
      </div>
    </div>
  )
}
