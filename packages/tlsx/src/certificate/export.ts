/**
 * CA export: hand a local Root CA to another device.
 *
 * A CA minted on one machine (a Pi running a gateway, say) is only useful
 * once the laptops and phones that talk to it trust it too. Each platform
 * wants the CA in a different container: macOS and Linux take PEM, Windows
 * prefers DER, and iOS will only install a root through a configuration
 * profile (.mobileconfig). This module produces all three from one PEM file
 * and pairs them with the exact steps each platform needs.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import { getCertificateFromCertPemOrPath, pemToDer, sha256FingerprintOfDer } from './validation'

export type CAExportFormat = 'pem' | 'der' | 'mobileconfig'

export interface ExportCAOptions {
  /** Path to the CA certificate (PEM). A PEM string is accepted too. */
  caCertPath: string
  format: CAExportFormat
  /** Display name for the profile and the export filename. @default the CA's Common Name */
  name?: string
  /** Organization shown on the profile. @default the CA's O attribute, then 'tlsx' */
  organization?: string
  /** Reverse-DNS profile identifier. @default dev.stacksjs.tlsx.<fingerprint-prefix> */
  identifier?: string
}

export interface ExportedCA {
  /** PEM and mobileconfig are text; DER is raw bytes. */
  data: Uint8Array | string
  /** A suggested filename with the conventional extension for the format. */
  filename: string
  mime: string
}

export const TRUST_PLATFORMS = ['macos', 'ios', 'windows', 'debian', 'rhel', 'android', 'linux-nss'] as const
export type TrustPlatform = typeof TRUST_PLATFORMS[number]

export const EXPORT_MIME_TYPES: Record<CAExportFormat, string> = {
  pem: 'application/x-pem-file',
  der: 'application/x-x509-ca-cert',
  mobileconfig: 'application/x-apple-aspen-config',
}

const EXPORT_EXTENSIONS: Record<CAExportFormat, string> = {
  pem: 'pem',
  der: 'cer',
  mobileconfig: 'mobileconfig',
}

/** Profile identifiers default to this prefix plus a fingerprint slice. */
export const DEFAULT_PROFILE_IDENTIFIER_PREFIX = 'dev.stacksjs.tlsx'

// RFC 4122 name-based (v5) UUIDs. The tlsx namespace is itself a v5 UUID of
// the identifier prefix under the standard DNS namespace, so every UUID this
// module emits is a pure function of the CA's fingerprint.
const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex')
}

/**
 * Deterministic RFC 4122 version 5 UUID of `name` under `namespace`.
 * Uppercase, as Apple's own profiles print them.
 * @param name - The name to hash.
 * @param namespace - Namespace UUID. @default the tlsx namespace
 */
export function uuidV5(name: string, namespace: string = TLSX_UUID_NAMESPACE): string {
  const hash = crypto.createHash('sha1')
    .update(Buffer.concat([uuidToBytes(namespace), Buffer.from(name, 'utf8')]))
    .digest()
  const bytes = Buffer.from(hash.subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0F) | 0x50
  bytes[8] = (bytes[8] & 0x3F) | 0x80
  const hex = bytes.toString('hex').toUpperCase()
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export const TLSX_UUID_NAMESPACE: string = uuidV5(DEFAULT_PROFILE_IDENTIFIER_PREFIX, DNS_NAMESPACE)

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fileSlug(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'root-ca'
}

function subjectAttribute(subject: string, shortName: string): string | undefined {
  for (const line of subject.split('\n')) {
    const eq = line.indexOf('=')
    if (eq !== -1 && line.slice(0, eq).trim() === shortName)
      return line.slice(eq + 1).trim()
  }
  return undefined
}

function wrapBase64(base64: string, width = 64): string {
  const lines: string[] = []
  for (let i = 0; i < base64.length; i += width)
    lines.push(base64.slice(i, i + width))
  return lines.join('\n')
}

export interface MobileConfigOptions {
  /** DER bytes of the CA certificate. */
  certificateDer: Uint8Array
  displayName: string
  organization: string
  identifier: string
  /** Uppercase hex SHA-256 fingerprint of the certificate; seeds the UUIDs. */
  fingerprint: string
}

/**
 * Build an unsigned Apple configuration profile that installs a root CA
 * (`com.apple.security.root`). Both PayloadUUIDs are v5 UUIDs derived from
 * the CA fingerprint, so exporting the same CA twice yields byte-identical
 * profiles and iOS treats a re-export as the same profile rather than a
 * duplicate.
 */
export function buildMobileConfig(options: MobileConfigOptions): string {
  const fingerprint = options.fingerprint.replace(/:/g, '').toUpperCase()
  const profileUuid = uuidV5(`${fingerprint}:profile`)
  const payloadUuid = uuidV5(`${fingerprint}:root`)
  const base64 = wrapBase64(Buffer.from(options.certificateDer).toString('base64'))
  const name = escapeXml(options.displayName)
  const organization = escapeXml(options.organization)
  const identifier = escapeXml(options.identifier)
  const fileName = escapeXml(`${fileSlug(options.displayName)}.cer`)

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>PayloadContent</key>
\t<array>
\t\t<dict>
\t\t\t<key>PayloadCertificateFileName</key>
\t\t\t<string>${fileName}</string>
\t\t\t<key>PayloadContent</key>
\t\t\t<data>
${base64}
\t\t\t</data>
\t\t\t<key>PayloadDescription</key>
\t\t\t<string>Adds the ${name} root certificate</string>
\t\t\t<key>PayloadDisplayName</key>
\t\t\t<string>${name}</string>
\t\t\t<key>PayloadIdentifier</key>
\t\t\t<string>${identifier}.root</string>
\t\t\t<key>PayloadType</key>
\t\t\t<string>com.apple.security.root</string>
\t\t\t<key>PayloadUUID</key>
\t\t\t<string>${payloadUuid}</string>
\t\t\t<key>PayloadVersion</key>
\t\t\t<integer>1</integer>
\t\t</dict>
\t</array>
\t<key>PayloadDescription</key>
\t<string>Trusts the ${name} certificate authority on this device (SHA-256 ${fingerprint.slice(0, 16)})</string>
\t<key>PayloadDisplayName</key>
\t<string>${name}</string>
\t<key>PayloadIdentifier</key>
\t<string>${identifier}</string>
\t<key>PayloadOrganization</key>
\t<string>${organization}</string>
\t<key>PayloadRemovalDisallowed</key>
\t<false/>
\t<key>PayloadType</key>
\t<string>Configuration</string>
\t<key>PayloadUUID</key>
\t<string>${profileUuid}</string>
\t<key>PayloadVersion</key>
\t<integer>1</integer>
</dict>
</plist>
`
}

/**
 * Export a CA certificate as PEM, DER, or an Apple .mobileconfig profile.
 * The result carries the bytes (or text), a filename with the right
 * extension, and the MIME type, so it can be written to disk or served
 * straight from an HTTP handler.
 * @param options - Source CA, target format, and profile metadata.
 */
export async function exportCA(options: ExportCAOptions): Promise<ExportedCA> {
  const source = options.caCertPath.startsWith('-----BEGIN')
    ? options.caCertPath
    : fs.readFileSync(options.caCertPath, 'utf8')
  const cert = getCertificateFromCertPemOrPath(source)
  const der = pemToDer(source)
  const fingerprint = sha256FingerprintOfDer(der)

  const displayName = options.name?.trim() || subjectAttribute(cert.subject, 'CN') || 'tlsx Root CA'
  const organization = options.organization?.trim() || subjectAttribute(cert.subject, 'O') || 'tlsx'
  const identifier = options.identifier?.trim() || `${DEFAULT_PROFILE_IDENTIFIER_PREFIX}.${fingerprint.slice(0, 12).toLowerCase()}`
  const filename = `${fileSlug(displayName)}.${EXPORT_EXTENSIONS[options.format]}`
  const mime = EXPORT_MIME_TYPES[options.format]

  switch (options.format) {
    case 'pem':
      return { data: source.endsWith('\n') ? source : `${source}\n`, filename, mime }
    case 'der':
      return { data: new Uint8Array(der), filename, mime }
    case 'mobileconfig':
      return {
        data: buildMobileConfig({ certificateDer: der, displayName, organization, identifier, fingerprint }),
        filename,
        mime,
      }
    default:
      throw new Error(`Unsupported export format: ${String(options.format)}`)
  }
}

/**
 * Human-readable steps for trusting the CA at `caPath` on a platform. For
 * iOS, `caPath` should be the exported .mobileconfig; for the others the
 * PEM (or DER on Windows) file.
 * @param platform - Target platform.
 * @param caPath - Where the exported CA lives, as the user will type it.
 */
export function trustInstructions(platform: TrustPlatform, caPath: string): string {
  switch (platform) {
    case 'macos':
      return [
        'macOS (system keychain, all users and browsers):',
        `  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${caPath}`,
        '  Restart any open browser afterwards.',
      ].join('\n')
    case 'ios':
      return [
        'iOS / iPadOS (configuration profile):',
        `  1. Export the profile if you have not yet: tlsx export-ca --format mobileconfig --out ${caPath}`,
        `  2. Send ${caPath} to the device (AirDrop, Mail, or a link) and open it.`,
        '  3. Settings > Profile Downloaded > Install, and confirm with the passcode.',
        '  4. Settings > General > About > Certificate Trust Settings, then enable full trust for the new root.',
        '  Without step 4 the profile is installed but Safari still rejects the certificate.',
      ].join('\n')
    case 'windows':
      return [
        'Windows (Local Machine root store, run from an elevated prompt):',
        `  certutil -addstore -f ROOT ${caPath}`,
        '  Or double-click the file, Install Certificate, Local Machine, Trusted Root Certification Authorities.',
      ].join('\n')
    case 'debian':
      return [
        'Debian / Ubuntu / Raspberry Pi OS:',
        `  sudo cp ${caPath} /usr/local/share/ca-certificates/tlsx-root-ca.crt`,
        '  sudo update-ca-certificates',
        '  The file must end in .crt to be picked up. Browsers using NSS (Firefox, Chromium) keep their own store; see linux-nss.',
      ].join('\n')
    case 'rhel':
      return [
        'RHEL / Fedora / Rocky / AlmaLinux:',
        `  sudo cp ${caPath} /etc/pki/ca-trust/source/anchors/tlsx-root-ca.crt`,
        '  sudo update-ca-trust',
      ].join('\n')
    case 'android':
      return [
        'Android (user CA):',
        `  1. Copy ${caPath} to the device (it must be PEM or DER with a .crt or .cer extension).`,
        '  2. Settings > Security > Encryption & credentials > Install a certificate > CA certificate.',
        '  Apps only trust user CAs when their network security config opts in (Android 7+); Chrome does, most apps do not.',
      ].join('\n')
    case 'linux-nss':
      return [
        'Linux browser stores (Firefox, Chromium via NSS):',
        `  certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n "tlsx Root CA" -i ${caPath}`,
        '  For Firefox, repeat with -d sql:$HOME/.mozilla/firefox/<profile>, or import via Settings > Privacy & Security > Certificates.',
        '  tlsx install does this for every cert9.db it finds under your home directory.',
      ].join('\n')
    default:
      throw new Error(`Unknown platform: ${String(platform)}. Expected one of ${TRUST_PLATFORMS.join(', ')}`)
  }
}
