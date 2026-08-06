import { describe, expect, it } from 'bun:test'
import path from 'node:path'
import { certFileBase, renewalOutputBase } from '../src/utils'

/**
 * Where a renewal writes its result.
 *
 * These are regression tests for a silent data-loss bug. `acme:renew` derived
 * its output filename from the renewed certificate's contents —
 * `certFileBase(domains[0])`, where `domains` came from `validateCertificate()`
 * and therefore began with the certificate's COMMON NAME.
 *
 * Nothing requires a certificate's CN to match the file it is stored in. On a
 * multi-tenant mail host two files shared a CN:
 *
 *   mail.stacksjs.com.crt          CN=mail.stacksjs.com, 8 SANs  (the live cert)
 *   autodiscover.stacksjs.com.crt  CN=mail.stacksjs.com, 4 SANs
 *
 * Renewing both in one run renewed the wide certificate, then wrote the narrow
 * one over the top of it — dropping four hostnames belonging to other projects
 * from the certificate actually being served. Nothing errored.
 */

describe('renewalOutputBase', () => {
  it('writes back to the certificate it read', () => {
    expect(renewalOutputBase('/etc/certs/mail.example.com.crt')).toBe('/etc/certs/mail.example.com')
  })

  it('ignores the certificate contents entirely', () => {
    // The whole point: the output path is a function of the INPUT PATH alone.
    // A cert whose CN is something else cannot redirect the write.
    const target = renewalOutputBase('/etc/certs/autodiscover.example.com.crt')
    expect(target).toBe('/etc/certs/autodiscover.example.com')
    expect(target).not.toContain('mail.example.com')
  })

  it('two certificates sharing a CN renew to two different files', () => {
    // The exact production collision. Both files have CN=mail.example.com; the
    // old code mapped both onto mail.example.com.crt and the second clobbered
    // the first.
    const wide = renewalOutputBase('/etc/certs/mail.example.com.crt')
    const narrow = renewalOutputBase('/etc/certs/autodiscover.example.com.crt')

    expect(wide).not.toBe(narrow)
  })

  it('keeps a wildcard file on its mkcert-style name', () => {
    // Renewal must not "helpfully" re-derive `_wildcard.` from the SAN `*.x`,
    // which would move the file out from under whatever reads it.
    expect(renewalOutputBase('/etc/certs/_wildcard.example.com.crt')).toBe('/etc/certs/_wildcard.example.com')
  })

  it('leaves a path with no .crt suffix alone rather than truncating it', () => {
    expect(renewalOutputBase('/etc/certs/mail.example.com')).toBe('/etc/certs/mail.example.com')
  })

  it('only strips a trailing .crt, not one inside a directory name', () => {
    expect(renewalOutputBase('/etc/my.crt.d/mail.example.com.crt')).toBe('/etc/my.crt.d/mail.example.com')
  })

  it('produces the sibling paths a renewal writes', () => {
    const base = renewalOutputBase('/etc/certs/mail.example.com.crt')

    expect(`${base}.crt`).toBe('/etc/certs/mail.example.com.crt')
    expect(`${base}.key`).toBe('/etc/certs/mail.example.com.key')
    expect(`${base}.chain.crt`).toBe('/etc/certs/mail.example.com.chain.crt')
  })

  it('round-trips: renewing the file a previous run wrote targets that same file', () => {
    const issued = path.join('/etc/certs', `${certFileBase('mail.example.com')}.crt`)
    expect(`${renewalOutputBase(issued)}.crt`).toBe(issued)
  })
})

describe('certFileBase', () => {
  it('maps a wildcard to the mkcert convention', () => {
    expect(certFileBase('*.example.com')).toBe('_wildcard.example.com')
  })

  it('leaves an ordinary hostname alone', () => {
    expect(certFileBase('mail.example.com')).toBe('mail.example.com')
  })

  it('only rewrites a leading wildcard label', () => {
    expect(certFileBase('a.*.example.com')).toBe('a.*.example.com')
  })
})
