import type { ScanRecord } from '../../core/types'
import { t } from '../../utils/i18n'

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
          <div class="pdf-icon" onClick={onOpenPreview} title={t('openPreview')}>
            📄 PDF
          </div>
        ) : (
          <img
            src={record.dataUrl}
            class="preview-image"
            onClick={onOpenPreview}
            alt={t('scanPreviewAlt')}
            style={{ cursor: 'pointer' }}
          />
        )}
      </div>
      <div class="download-actions">
        <button onClick={onCopy} title={t('copy')}>{t('copy')}</button>
        <button onClick={onDownload} title={t('save')}>{t('save')}</button>
        <button onClick={onOpenPreview} title={t('preview')}>{t('preview')}</button>
      </div>
    </div>
  )
}
