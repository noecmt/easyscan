import type { DiscoveredScanner, DiscoveryOptions } from './types'

const DEFAULT_TIMEOUT = 800
const DEFAULT_BATCH_SIZE = 20
const DEFAULT_SUBNETS = ['192.168.68', '192.168.1', '192.168.0', '10.0.0', '172.16.0']

const PRIORITY_SUFFIXES = [106, 100, 101, 102, 103, 1, 2, 200, 201, 202]
const SECONDARY_SUFFIXES = [104, 105, 107, 108, 109, 110, 203, 204, 205, 206, 10, 20, 30, 50]

async function getLocalSubnets(): Promise<string[]> {
  try {
    const interfaces = await new Promise<chrome.system.network.NetworkInterface[]>(resolve =>
      chrome.system.network.getNetworkInterfaces(resolve)
    )
    const subnets = interfaces
      .filter(i => !i.address.includes(':') && i.prefixLength >= 16 && i.prefixLength <= 30)
      .map(i => i.address.split('.').slice(0, 3).join('.'))
    return subnets.length > 0 ? [...new Set(subnets)] : DEFAULT_SUBNETS
  } catch {
    return DEFAULT_SUBNETS
  }
}

export async function discoverScanners(options: DiscoveryOptions = {}): Promise<DiscoveredScanner[]> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE

  // Fast path: try known/cached IPs first — return immediately if one responds
  if (options.knownIps?.length) {
    const results = await Promise.all(options.knownIps.map(ip => probeScanner(ip, timeout)))
    const found = results.filter((r): r is DiscoveredScanner => r !== null)
    if (found.length > 0) return found
  }

  // Detect real subnets from network interfaces, fall back to hardcoded list
  const subnets = options.subnets ?? await getLocalSubnets()
  const candidates = buildCandidateIPs(subnets)
  const found: DiscoveredScanner[] = []

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize)
    const results = await Promise.all(batch.map(ip => probeScanner(ip, timeout)))
    found.push(...results.filter((r): r is DiscoveredScanner => r !== null))
    if (found.length > 0 && i >= PRIORITY_SUFFIXES.length * subnets.length) break
  }

  return found
}

async function probeScanner(ip: string, timeout: number): Promise<DiscoveredScanner | null> {
  const [escl, airscan] = await Promise.all([
    probeEndpoint(ip, 'eSCL', timeout),
    probeEndpoint(ip, 'AirScan', timeout),
  ])
  if (escl) return { ip, name: escl.name, protocol: 'escl', baseUrl: `http://${ip}` }
  if (airscan) return { ip, name: airscan.name, protocol: 'airscan', baseUrl: `http://${ip}` }
  return null
}

async function probeEndpoint(
  ip: string,
  endpoint: 'eSCL' | 'AirScan',
  timeout: number
): Promise<{ name: string } | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    const res = await fetch(`http://${ip}/${endpoint}/ScannerStatus`, {
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) return null

    const xml = await res.text()
    const name = extractScannerName(xml) ?? `Scanner (${ip})`
    return { name }
  } catch {
    return null
  }
}

function extractScannerName(xml: string): string | null {
  const match =
    xml.match(/<pwg:MakeAndModel>([^<]+)<\/pwg:MakeAndModel>/) ??
    xml.match(/<MakeAndModel>([^<]+)<\/MakeAndModel>/)
  return match?.[1]?.trim() ?? null
}

function buildCandidateIPs(subnets: string[]): string[] {
  const priority = PRIORITY_SUFFIXES.flatMap(n => subnets.map(s => `${s}.${n}`))
  const secondary = SECONDARY_SUFFIXES.flatMap(n => subnets.map(s => `${s}.${n}`))
  return [...priority, ...secondary]
}
