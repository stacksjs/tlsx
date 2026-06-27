import { describe, expect, it } from 'bun:test'
import { X509Certificate } from 'node:crypto'
import { createRootCA, generateCertificate } from '../src'
import { generateSerialNumber } from '../src/certificate/native-crypto'

/**
 * Regression coverage for serial-number DER encoding.
 *
 * A raw `crypto.randomBytes(20)` serial intermittently produced a non-minimal or
 * negative ASN.1 INTEGER (leading `0x00` + `<0x80` byte, or a high-bit-set first
 * byte), which strict parsers (LibreSSL/BoringSSL, hence Bun's TLS) reject with
 * `INVALID_INTEGER` — silently breaking ~1 in 512 cert generations.
 */
describe('generateSerialNumber', () => {
  it('always yields a positive, minimally-encoded 20-byte serial', () => {
    // Sample heavily so the old ~1/512 failure mode would reliably surface.
    for (let i = 0; i < 5000; i++) {
      const serial = generateSerialNumber()
      expect(serial.length).toBe(20)
      // First byte in [0x01, 0x7f]: high bit clear (positive — no sign pad) and
      // non-zero (minimal — no superfluous leading 0x00).
      expect(serial[0]).toBeGreaterThan(0)
      expect(serial[0]).toBeLessThan(0x80)
    }
  })
})

describe('certificate DER encoding', () => {
  it('produces root CA + host certs that strict ASN.1 parsers accept, repeatedly', async () => {
    // Each iteration is an independent random serial; without the fix this loop
    // would throw on the first invalid encoding within a handful of runs.
    for (let i = 0; i < 40; i++) {
      const rootCA = await createRootCA()
      // X509Certificate (BoringSSL) is strict about DER and throws on a
      // non-minimal/negative serial INTEGER.
      expect(() => new X509Certificate(rootCA.certificate)).not.toThrow()

      const cert = await generateCertificate({
        domain: 'localhost',
        rootCA: { certificate: rootCA.certificate, privateKey: rootCA.privateKey },
      })
      expect(() => new X509Certificate(cert.certificate)).not.toThrow()
    }
  })
})
