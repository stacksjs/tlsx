/**
 * CA export: PEM / DER / .mobileconfig, and the per-platform trust steps.
 *
 * The CA below is a fixed fixture rather than a freshly minted one so the
 * derived values (fingerprint, profile identifier, both PayloadUUIDs) can be
 * asserted as literals. If any of those literals ever change for this PEM,
 * a re-export would stop matching the profile already installed on a phone.
 */
import { describe, expect, it } from 'bun:test'
import { X509Certificate } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildMobileConfig, exportCA, TLSX_UUID_NAMESPACE, TRUST_PLATFORMS, trustInstructions, uuidV5 } from '../src/certificate/export'
import { getCertSha256Fingerprint, pemToDer, sha256FingerprintOfDer } from '../src/certificate/validation'

const FIXTURE_PEM = `-----BEGIN CERTIFICATE-----
MIID5jCCAs6gAwIBAgIUH6oQ6yWu7ThOjy9SCDj3q8EPDBkwDQYJKoZIhvcNAQEL
BQAwgYkxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApDYWxpZm9ybmlhMRQwEgYDVQQH
DAtQbGF5YSBWaXN0YTETMBEGA1UECgwKdGxzeCBUZXN0czEeMBwGA1UECwwVQ2Vy
dGlmaWNhdGUgQXV0aG9yaXR5MRowGAYDVQQDDBF0bHN4IFRlc3QgUm9vdCBDQTAg
Fw0yNjA4MzEwMDAwMDBaGA8yMDc2MDgxODIzNTk1OVowgYkxCzAJBgNVBAYTAlVT
MRMwEQYDVQQIDApDYWxpZm9ybmlhMRQwEgYDVQQHDAtQbGF5YSBWaXN0YTETMBEG
A1UECgwKdGxzeCBUZXN0czEeMBwGA1UECwwVQ2VydGlmaWNhdGUgQXV0aG9yaXR5
MRowGAYDVQQDDBF0bHN4IFRlc3QgUm9vdCBDQTCCASIwDQYJKoZIhvcNAQEBBQAD
ggEPADCCAQoCggEBAMoxXwvfUqfHY2VxJYRMcLgj8EkZfTk8iL7Vre8QunLQQfh4
kPXjWZT6qbB9IEAgPdrYTLo/eVKN5oEueZ5REDzKj0d/i90Vn5htBUbHIaEBgRRa
XU5l+ek/dMqgnZrX/m2JFeO6IgHFN8fpXZ0DVxahCbDQpZqaTnaqPjCCnWPGit9Z
sVSmaOxDSil/sFoHharRccveZT/dg7JHDoy3sGeNjD9RU788QtxM5G4OqGDdt5Lc
jRIid4gthA9GhyH/46Jb4d4weWEladdciP0i/1+MfDG7ONcpymm009PTtsHrnNfM
4C0tn0bqYy3aN9x54L57XSuKNLMkVtzOqiqZkv8CAwEAAaNCMEAwDwYDVR0TAQH/
BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAQYwHQYDVR0OBBYEFHfR6e4Mw8AAM7Ffe532
uUUudhORMA0GCSqGSIb3DQEBCwUAA4IBAQC00ELTOy6/zMlEX0UUFdjf2DnyyQU/
Bg1Sd4Cr/z51Cxa01GGYEhumn++dQJIozdGB+OrdOyKmcmpzzrrkbGZc9EA3oBou
YtJ9cL2FucfNNY8UJbsg2xh/qEbQ+KNDLRgu/bopWm6+NRTP5vPjni4XZoi7vV/R
Y7a1E5p0wucePrngNikImnse/TVaEJz8I6CUU9aCZ0JXDblqzjp2gUsZ5adFFbfu
kND+hjQzaed6FPl/60votwnrXiNz+mwl4YZxx6edARBlObQkfDS+y0OC67siI5ld
Lxqs68Fm4K8RfHJo/TBJBC//cwvP5Po81/PkODjBVVk8DlkS+WBXFd17
-----END CERTIFICATE-----
`

// Derived from FIXTURE_PEM. Literal on purpose: see the header comment.
const FIXTURE_FINGERPRINT = '0A1572FF42775B985ADE86376F3F3DC3B27AEB0C6D47FD6BB930D5E74BF0C793'
const FIXTURE_IDENTIFIER = 'dev.stacksjs.tlsx.0a1572ff4277'
const FIXTURE_PROFILE_UUID = '5A4F525F-0271-5AEA-A39F-73FBCC1FF43C'
const FIXTURE_ROOT_UUID = 'D4ACB228-7F48-59F2-BEE6-C45B42567B03'

const UUID_V5_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-5[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/

function plistString(plist: string, key: string): string[] {
  const re = new RegExp(`<key>${key}</key>\\s*<(?:string|integer)>([^<]*)</(?:string|integer)>`, 'g')
  return [...plist.matchAll(re)].map(m => m[1]!)
}

describe('uuidV5', () => {
  it('is deterministic, version 5, RFC 4122 variant, and namespaced', () => {
    const a = uuidV5('hello')
    expect(a).toBe(uuidV5('hello'))
    expect(a).toMatch(UUID_V5_RE)
    expect(uuidV5('hello', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).not.toBe(a)
    expect(TLSX_UUID_NAMESPACE).toMatch(UUID_V5_RE)
  })
})

describe('exportCA', () => {
  it('pem: returns the certificate text unchanged, with a trailing newline', async () => {
    const out = await exportCA({ caCertPath: FIXTURE_PEM.trimEnd(), format: 'pem' })
    expect(out.data).toBe(FIXTURE_PEM)
    expect(out.filename).toBe('tlsx-test-root-ca.pem')
    expect(out.mime).toBe('application/x-pem-file')
  })

  it('der: round-trips to the same certificate and fingerprint', async () => {
    const out = await exportCA({ caCertPath: FIXTURE_PEM, format: 'der' })
    expect(out.data).toBeInstanceOf(Uint8Array)
    expect(typeof out.data).not.toBe('string')
    expect(out.filename).toBe('tlsx-test-root-ca.cer')
    expect(out.mime).toBe('application/x-x509-ca-cert')

    const der = out.data as Uint8Array
    // DER is a SEQUENCE; the parsed cert must be the fixture, byte for byte.
    expect(der[0]).toBe(0x30)
    const parsed = new X509Certificate(Buffer.from(der))
    expect(parsed.fingerprint256.replace(/:/g, '').toUpperCase()).toBe(FIXTURE_FINGERPRINT)
    expect(parsed.subject).toContain('CN=tlsx Test Root CA')
    expect(sha256FingerprintOfDer(der)).toBe(getCertSha256Fingerprint(FIXTURE_PEM))
    expect(Buffer.from(der).equals(pemToDer(FIXTURE_PEM))).toBe(true)
  })

  it('reads the CA from a file path as well as from PEM text', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tlsx-export-'))
    try {
      const file = path.join(dir, 'ca.crt')
      fs.writeFileSync(file, FIXTURE_PEM)
      const fromFile = await exportCA({ caCertPath: file, format: 'mobileconfig' })
      const fromPem = await exportCA({ caCertPath: FIXTURE_PEM, format: 'mobileconfig' })
      expect(fromFile.data).toBe(fromPem.data)
    }
    finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('mobileconfig: an unsigned com.apple.security.root profile with stable identifiers', async () => {
    const out = await exportCA({ caCertPath: FIXTURE_PEM, format: 'mobileconfig' })
    expect(out.filename).toBe('tlsx-test-root-ca.mobileconfig')
    expect(out.mime).toBe('application/x-apple-aspen-config')
    const plist = out.data as string

    expect(plist.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(plist).toContain('<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"')
    expect(plist).toContain('<plist version="1.0">')

    // Inner payload: the root cert.
    expect(plistString(plist, 'PayloadType')).toEqual(['com.apple.security.root', 'Configuration'])
    expect(plistString(plist, 'PayloadVersion')).toEqual(['1', '1'])
    expect(plistString(plist, 'PayloadDisplayName')).toEqual(['tlsx Test Root CA', 'tlsx Test Root CA'])
    expect(plistString(plist, 'PayloadIdentifier')).toEqual([`${FIXTURE_IDENTIFIER}.root`, FIXTURE_IDENTIFIER])
    expect(plistString(plist, 'PayloadUUID')).toEqual([FIXTURE_ROOT_UUID, FIXTURE_PROFILE_UUID])
    expect(plistString(plist, 'PayloadOrganization')).toEqual(['tlsx Tests'])
    expect(plistString(plist, 'PayloadCertificateFileName')).toEqual(['tlsx-test-root-ca.cer'])
    expect(plist).toMatch(/<key>PayloadRemovalDisallowed<\/key>\s*<false\/>/)

    // PayloadContent <data> is the base64 DER of the CA.
    const data = plist.match(/<data>\s*([\s\S]*?)\s*<\/data>/)!
    const embedded = Buffer.from(data[1]!.replace(/\s+/g, ''), 'base64')
    expect(embedded.equals(pemToDer(FIXTURE_PEM))).toBe(true)
    expect(sha256FingerprintOfDer(embedded)).toBe(FIXTURE_FINGERPRINT)

    // Both UUIDs are v5 and are a function of the fingerprint alone.
    expect(FIXTURE_ROOT_UUID).toMatch(UUID_V5_RE)
    expect(FIXTURE_PROFILE_UUID).toMatch(UUID_V5_RE)
    expect(uuidV5(`${FIXTURE_FINGERPRINT}:root`)).toBe(FIXTURE_ROOT_UUID)
    expect(uuidV5(`${FIXTURE_FINGERPRINT}:profile`)).toBe(FIXTURE_PROFILE_UUID)
  })

  it('mobileconfig: exporting twice yields byte-identical profiles', async () => {
    const a = await exportCA({ caCertPath: FIXTURE_PEM, format: 'mobileconfig' })
    const b = await exportCA({ caCertPath: FIXTURE_PEM, format: 'mobileconfig' })
    expect(a.data).toBe(b.data)
  })

  it('mobileconfig: name, organization and identifier overrides are honoured and XML-escaped', async () => {
    const out = await exportCA({
      caCertPath: FIXTURE_PEM,
      format: 'mobileconfig',
      name: 'Pi <Stacks> & Co',
      organization: 'Home "Lab"',
      identifier: 'local.pi-stacks.ca',
    })
    const plist = out.data as string
    expect(out.filename).toBe('pi-stacks-co.mobileconfig')
    expect(plistString(plist, 'PayloadDisplayName')).toEqual(['Pi &lt;Stacks&gt; &amp; Co', 'Pi &lt;Stacks&gt; &amp; Co'])
    expect(plistString(plist, 'PayloadOrganization')).toEqual(['Home &quot;Lab&quot;'])
    expect(plistString(plist, 'PayloadIdentifier')).toEqual(['local.pi-stacks.ca.root', 'local.pi-stacks.ca'])
    expect(plist).not.toContain('<Stacks>')
    // UUIDs follow the certificate, not the display name.
    expect(plistString(plist, 'PayloadUUID')).toEqual([FIXTURE_ROOT_UUID, FIXTURE_PROFILE_UUID])
  })

  it('buildMobileConfig accepts colon-separated fingerprints', () => {
    const der = pemToDer(FIXTURE_PEM)
    const colon = FIXTURE_FINGERPRINT.match(/.{2}/g)!.join(':')
    const a = buildMobileConfig({ certificateDer: der, displayName: 'x', organization: 'o', identifier: 'i', fingerprint: colon })
    const b = buildMobileConfig({ certificateDer: der, displayName: 'x', organization: 'o', identifier: 'i', fingerprint: FIXTURE_FINGERPRINT })
    expect(a).toBe(b)
  })

  it('rejects an unknown format', async () => {
    await expect(exportCA({ caCertPath: FIXTURE_PEM, format: 'p12' as any })).rejects.toThrow('Unsupported export format')
  })
})

describe('trustInstructions', () => {
  const caPath = '/home/pi/.stacks/ssl/root-ca.pem'

  it('macos: the exact security add-trusted-cert invocation', () => {
    expect(trustInstructions('macos', caPath))
      .toContain(`sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${caPath}`)
  })

  it('ios: profile install and the full-trust toggle', () => {
    const text = trustInstructions('ios', '/tmp/pi.mobileconfig')
    expect(text).toContain('AirDrop')
    expect(text).toContain('Profile Downloaded')
    expect(text).toContain('Certificate Trust Settings')
    expect(text).toContain('/tmp/pi.mobileconfig')
  })

  it('windows: certutil into ROOT', () => {
    expect(trustInstructions('windows', 'C:\\ca\\root.cer')).toContain('certutil -addstore -f ROOT C:\\ca\\root.cer')
  })

  it('debian and rhel: anchor dir plus update command', () => {
    const deb = trustInstructions('debian', caPath)
    expect(deb).toContain('/usr/local/share/ca-certificates/')
    expect(deb).toContain('sudo update-ca-certificates')
    const rhel = trustInstructions('rhel', caPath)
    expect(rhel).toContain('/etc/pki/ca-trust/source/anchors/')
    expect(rhel).toContain('sudo update-ca-trust')
  })

  it('android and linux-nss: user CA caveat and certutil', () => {
    expect(trustInstructions('android', caPath)).toContain('CA certificate')
    expect(trustInstructions('android', caPath)).toContain('network security config')
    expect(trustInstructions('linux-nss', caPath)).toContain('certutil -d sql:$HOME/.pki/nssdb -A')
  })

  it('covers every platform, mentions the path, and never uses an em-dash', () => {
    for (const platform of TRUST_PLATFORMS) {
      const text = trustInstructions(platform, caPath)
      expect(text.length).toBeGreaterThan(40)
      expect(text).toContain(caPath)
      expect(text).not.toMatch(/[\u2013\u2014]/)
    }
  })

  it('throws on an unknown platform', () => {
    expect(() => trustInstructions('beos' as any, caPath)).toThrow('Unknown platform')
  })
})
