import type { ColorMode, ScanFormat, ScanSettings, ScannerCapabilities, ScanJob, ScanJobStatus, ScanResult } from './types'

export type ScannerErrorCode = 'busy' | 'timeout' | 'expired' | 'canceled' | 'http' | 'network'

export class ScannerError extends Error {
  constructor(public readonly code: ScannerErrorCode, message: string) {
    super(message)
    this.name = 'ScannerError'
  }
}

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, '')
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const MIME_TO_FORMAT: Record<string, ScanFormat> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'application/pdf': 'pdf',
}

const FORMAT_TO_MIME: Record<ScanFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
}

function mimeTypeFor(format: ScanFormat): string {
  return FORMAT_TO_MIME[format]
}

const COLOR_MODE_ALIASES: Record<string, ColorMode> = {
  'Color': 'RGB24',
  'RGB24': 'RGB24',
  'Grayscale': 'Grayscale8',
  'Grayscale8': 'Grayscale8',
  'BlackAndWhite1': 'BlackAndWhite1',
  'Black and White': 'BlackAndWhite1',
}

function parseCapabilities(xml: string): ScannerCapabilities {
  const resMatches = [...xml.matchAll(/<scan:(?:XResolution|YResolution)>(\d+)</g)]
  const resNums = resMatches.map(m => parseInt(m[1], 10))
  const minDpi = resNums.length ? Math.min(...resNums) : 75
  const maxDpi = resNums.length ? Math.max(...resNums) : 600

  const fmtMatches = [...xml.matchAll(/<scan:DocumentFormat>([^<]+)</g)]
  const formats: ScanFormat[] = fmtMatches
    .map(m => MIME_TO_FORMAT[m[1].trim()])
    .filter((f): f is ScanFormat => f !== undefined)
  const uniqueFormats = [...new Set(formats)]

  const colorMatches = [...xml.matchAll(/<scan:ColorMode>([^<]+)</g)]
  const colorModes: ColorMode[] = colorMatches
    .map(m => COLOR_MODE_ALIASES[m[1].trim()])
    .filter((c): c is ColorMode => c !== undefined)
  const uniqueColorModes = [...new Set(colorModes)]

  const widthMatch = xml.match(/<scan:MaxWidth>(\d+)</)
  const heightMatch = xml.match(/<scan:MaxHeight>(\d+)</)

  return {
    minDpi,
    maxDpi,
    colorModes: uniqueColorModes.length ? uniqueColorModes : ['RGB24'],
    formats: uniqueFormats.length ? uniqueFormats : ['jpeg'],
    maxWidthPx: widthMatch ? parseInt(widthMatch[1], 10) : 2480,
    maxHeightPx: heightMatch ? parseInt(heightMatch[1], 10) : 3508,
  }
}

function buildScanJobXML(settings: ScanSettings, caps: ScannerCapabilities): string {
  const dpi = Math.min(settings.dpi, caps.maxDpi)
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<scan:ScanSettings xmlns:scan="http://schemas.hp.com/imaging/escl/2011/05/03" xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">` +
    `<pwg:Version>2.63</pwg:Version>` +
    `<pwg:ScanRegions>` +
    `<pwg:ScanRegion>` +
    `<pwg:XOffset>0</pwg:XOffset>` +
    `<pwg:YOffset>0</pwg:YOffset>` +
    `<pwg:Width>${caps.maxWidthPx}</pwg:Width>` +
    `<pwg:Height>${caps.maxHeightPx}</pwg:Height>` +
    `<pwg:ContentRegionUnits>escl:ThreeHundredthsOfInches</pwg:ContentRegionUnits>` +
    `</pwg:ScanRegion>` +
    `</pwg:ScanRegions>` +
    `<pwg:InputSource>Platen</pwg:InputSource>` +
    `<scan:ColorMode>${settings.colorMode}</scan:ColorMode>` +
    `<scan:XResolution>${dpi}</scan:XResolution>` +
    `<scan:YResolution>${dpi}</scan:YResolution>` +
    `<pwg:DocumentFormat>${mimeTypeFor(settings.format)}</pwg:DocumentFormat>` +
    `</scan:ScanSettings>`
  )
}

function extractJobStatus(xml: string): ScanJobStatus | null {
  const match = xml.match(/<scan:JobState>([^<]+)<\/scan:JobState>/)
  if (!match) return null
  const s = match[1].trim()
  if (s === 'Processing' || s === 'Completed' || s === 'Aborted' || s === 'Canceled') return s
  return null
}

export async function getCapabilities(baseUrl: string): Promise<ScannerCapabilities> {
  const url = normalizeBase(baseUrl) + '/eSCL/ScannerCapabilities'
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new ScannerError('network', `Cannot reach ${url}`)
  }
  if (!res.ok) throw new ScannerError('http', `HTTP ${res.status} from ScannerCapabilities`)
  return parseCapabilities(await res.text())
}

export async function checkConnectivity(baseUrl: string): Promise<boolean> {
  try {
    await getCapabilities(baseUrl)
    return true
  } catch {
    return false
  }
}

export async function warmUp(baseUrl: string): Promise<void> {
  await getCapabilities(baseUrl)
  await delay(1000)
}

export async function createScanJob(baseUrl: string, settings: ScanSettings): Promise<ScanJob> {
  const base = normalizeBase(baseUrl)
  const caps = await getCapabilities(base)
  const xml = buildScanJobXML(settings, caps)

  for (let attempt = 1; attempt <= 3; attempt++) {
    let res: Response
    try {
      res = await fetch(`${base}/eSCL/ScanJobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: xml,
      })
    } catch {
      throw new ScannerError('network', 'Network error creating scan job')
    }

    if (res.status === 201) {
      const location = res.headers.get('Location')
      if (!location) throw new ScannerError('http', 'No Location header in 201 response')
      const jobUrl = location.startsWith('http') ? new URL(location).pathname : location
      return { jobUrl, protocol: 'escl' }
    }

    if (res.status === 403 || res.status === 409) {
      if (attempt < 3) {
        await delay(2000)
      } else {
        throw new ScannerError('busy', 'Scanner busy after 3 attempts')
      }
    } else {
      throw new ScannerError('http', `HTTP ${res.status} creating scan job`)
    }
  }

  throw new ScannerError('busy', 'Scanner busy')
}

export async function waitForCompletion(baseUrl: string, job: ScanJob): Promise<ScanResult> {
  const base = normalizeBase(baseUrl)
  const deadline = Date.now() + 30_000

  while (Date.now() < deadline) {
    const statusRes = await fetch(`${base}${job.jobUrl}`)

    if (statusRes.status === 410) throw new ScannerError('expired', 'Scan job expired')

    const status = extractJobStatus(await statusRes.text())

    if (status === 'Completed') {
      const imageRes = await fetch(`${base}${job.jobUrl}/NextDocument`)
      if (!imageRes.ok) throw new ScannerError('http', `HTTP ${imageRes.status} fetching document`)
      return { blob: await imageRes.blob(), mimeType: imageRes.headers.get('Content-Type') ?? 'image/jpeg' }
    }

    if (status === 'Aborted' || status === 'Canceled') {
      throw new ScannerError('canceled', `Job ${status.toLowerCase()}`)
    }

    await delay(500)
  }

  throw new ScannerError('timeout', 'Scan timeout after 30s')
}

export async function performScan(baseUrl: string, settings: ScanSettings): Promise<ScanResult> {
  await warmUp(baseUrl)
  const job = await createScanJob(baseUrl, settings)
  return waitForCompletion(baseUrl, job)
}
