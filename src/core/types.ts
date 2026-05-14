export type ColorMode = 'RGB24' | 'Grayscale8' | 'BlackAndWhite1'
export type ScanFormat = 'jpeg' | 'png' | 'pdf'
export type DPI = 75 | 150 | 300 | 600 | 1200

export interface ScanSettings {
  dpi: DPI
  colorMode: ColorMode
  format: ScanFormat
}

export interface ScannerCapabilities {
  minDpi: number
  maxDpi: number
  colorModes: ColorMode[]
  formats: ScanFormat[]
  maxWidthPx: number
  maxHeightPx: number
}

export interface SavedScanner {
  id: string
  name: string
  ip: string
  lastUsed: number  // timestamp ms
}

export interface ScanRecord {
  id: string
  dataUrl: string
  mimeType: string
  timestamp: number
  scannerId?: string
}

export type ScannerProtocol = 'escl' | 'airscan'

export interface DiscoveredScanner {
  ip: string
  name: string
  protocol: ScannerProtocol
  baseUrl: string
}

export interface DiscoveryOptions {
  timeout?: number
  subnets?: string[]
  batchSize?: number
  knownIps?: string[]
}
