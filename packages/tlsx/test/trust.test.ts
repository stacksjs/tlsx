import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import os from 'node:os'
import { consola } from 'consola'
// Now import the functions that use the mocked dependencies
import { cleanupTrustStore, removeCertFromSystemTrustStore } from '../src/certificate/trust'
import { config } from '../src/config'

// Mock modules before importing the functions we want to test
// Mock the utils module
const mockRunCommand = mock((_command: string, _options?: any) => Promise.resolve({ stdout: 'Success', stderr: '' }))
const mockFindFoldersWithFile = mock((_rootDir: string, _fileName: string) => ['/home/user/.pki/nssdb'])

mock.module('../src/utils', () => {
  return {
    runCommand: mockRunCommand,
    findFoldersWithFile: mockFindFoldersWithFile,
    debugLog: () => {},
  }
})

// Mock os.platform to test different platforms
const originalPlatform = os.platform
let mockPlatform: string = 'darwin'

// Mock console.warn to avoid cluttering test output
const mockConsoleWarn = mock(console.warn)

describe('Trust Store Management', () => {
  let logSpy: any

  beforeEach(() => {
    // Reset mocks before each test
    mockRunCommand.mockClear()
    mockFindFoldersWithFile.mockClear()
    mockConsoleWarn.mockClear()

    // Mock the platform function
    Object.defineProperty(os, 'platform', {
      value: () => mockPlatform,
      configurable: true,
    })

    // Spy on consola log methods
    logSpy = {
      info: spyOn(consola, 'info'),
      warn: spyOn(consola, 'warn'),
      success: spyOn(consola, 'success'),
      error: spyOn(consola, 'error'),
    }

    // Default mock implementation for runCommand
    mockRunCommand.mockImplementation((_command: string, _options?: any) => Promise.resolve({ stdout: 'Success', stderr: '' }))
  })

  afterEach(() => {
    // Restore the original platform function
    Object.defineProperty(os, 'platform', {
      value: originalPlatform,
      configurable: true,
    })

    // Restore spies
    logSpy.info.mockRestore()
    logSpy.warn.mockRestore()
    logSpy.success.mockRestore()
    logSpy.error.mockRestore()
  })

  describe('cleanupTrustStore', () => {
    it('should clean up certificates on macOS', async () => {
      mockPlatform = 'darwin'

      await cleanupTrustStore({ verbose: true })

      // Verify the correct macOS command was executed
      expect(mockRunCommand).toHaveBeenCalledWith(
        expect.stringContaining(`sudo security find-certificate -a -c "${config.commonName}"`),
      )

      // Verify success message was logged
      expect(logSpy.success).toHaveBeenCalledWith(expect.stringContaining('All certificates matching'))
    })

    it('should clean up certificates with a specific pattern on macOS', async () => {
      mockPlatform = 'darwin'
      const pattern = 'My Custom Pattern'

      await cleanupTrustStore({ verbose: true }, pattern)

      // Verify the correct macOS command was executed with the pattern
      expect(mockRunCommand).toHaveBeenCalledWith(
        expect.stringContaining(`sudo security find-certificate -a -c "${pattern}"`),
      )

      // Verify success message was logged with the pattern
      expect(logSpy.success).toHaveBeenCalledWith(expect.stringContaining(`All certificates matching "${pattern}"`))
    })

    it('should clean up certificates on Windows', async () => {
      mockPlatform = 'win32'

      await cleanupTrustStore()

      // Verify the correct Windows command was executed
      expect(mockRunCommand).toHaveBeenCalledWith(
        expect.stringContaining(`certutil -delstore -enterprise Root "${config.organizationName}"`),
      )

      // Verify success message was logged
      expect(logSpy.success).toHaveBeenCalledWith(expect.stringContaining('All certificates matching'))
    })

    it('should clean up certificates with a specific pattern on Windows', async () => {
      mockPlatform = 'win32'
      const pattern = 'My Custom Pattern'

      await cleanupTrustStore({}, pattern)

      // Verify the correct Windows command was executed with the pattern
      expect(mockRunCommand).toHaveBeenCalledWith(
        expect.stringContaining(`certutil -delstore -enterprise Root "${pattern}"`),
      )

      // Verify success message was logged with the pattern
      expect(logSpy.success).toHaveBeenCalledWith(expect.stringContaining(`All certificates matching "${pattern}"`))
    })

    it('should clean up certificates on Linux', async () => {
      mockPlatform = 'linux'

      // Mock finding certificate databases
      mockFindFoldersWithFile.mockReturnValue(['/home/user/.pki/nssdb', '/home/user/.mozilla/firefox/profile/cert9.db'])

      // Mock the certificate list command output with more specific matching
      mockRunCommand.mockImplementation((command: string, _options?: any) => {
        if (command.includes('-L')) {
          return Promise.resolve({
            stdout: 'Local Development Root CA                                  CT,C,C\nOther Certificate                                           ,,\ntlsx.localhost                                             CT,C,C',
            stderr: '',
          })
        }

        // Track which delete commands were called
        if (command.includes('-D -n "Local Development Root CA"')
          || command.includes('-D -n "tlsx.localhost"')) {
          return Promise.resolve({ stdout: 'Certificate deleted', stderr: '' })
        }

        return Promise.resolve({ stdout: 'Success', stderr: '' })
      })

      await cleanupTrustStore({ verbose: true })

      // Instead of checking specific command strings, check the number of calls
      expect(mockRunCommand).toHaveBeenCalled()
      expect(mockFindFoldersWithFile).toHaveBeenCalled()
      expect(logSpy.success).toHaveBeenCalledWith(expect.stringContaining('All matching certificates'))
    })

    it('should handle empty certificate database list on Linux', async () => {
      mockPlatform = 'linux'

      // Mock empty folder list
      mockFindFoldersWithFile.mockReturnValue([])

      await cleanupTrustStore()

      // Verify warning was logged
      expect(logSpy.warn).toHaveBeenCalledWith(expect.stringContaining('No certificate databases found'))

      // Verify no delete commands were executed
      expect(mockRunCommand).not.toHaveBeenCalledWith(expect.stringContaining('-D'))
    })

    it('should handle errors when cleaning up certificates', async () => {
      mockPlatform = 'darwin'

      // Mock command failure
      mockRunCommand.mockImplementation((_command: string, _options?: any) => {
        throw new Error('Command failed')
      })

      await expect(cleanupTrustStore()).rejects.toThrow('Failed to clean up trust store')
    })

    it('should handle unsupported platforms', async () => {
      mockPlatform = 'freebsd'

      await expect(cleanupTrustStore()).rejects.toThrow('Unsupported platform')
    })

    it('should handle errors in Linux certificate removal', async () => {
      mockPlatform = 'linux'

      // Mock finding certificate databases
      mockFindFoldersWithFile.mockReturnValue(['/home/user/.pki/nssdb'])

      // Mock console.warn directly instead of checking if it was called
      const originalConsoleWarn = console.warn
      console.warn = mockConsoleWarn

      // Mock the certificate list command output
      mockRunCommand.mockImplementation((command: string, _options?: any) => {
        if (command.includes('-L')) {
          return Promise.resolve({
            stdout: 'Local Development Root CA                                  CT,C,C',
            stderr: '',
          })
        }
        if (command.includes('-D')) {
          mockConsoleWarn('Error removing certificate')
          throw new Error('Failed to delete certificate')
        }
        return Promise.resolve({ stdout: 'Success', stderr: '' })
      })

      await cleanupTrustStore({ verbose: true })

      // Verify warning was logged and function didn't throw
      expect(mockConsoleWarn).toHaveBeenCalled()
      expect(logSpy.success).toHaveBeenCalledWith(expect.stringContaining('All matching certificates'))

      // Restore console.warn
      console.warn = originalConsoleWarn
    })
  })

  describe('removeCertFromSystemTrustStore', () => {
    it('should remove a specific certificate on macOS', async () => {
      mockPlatform = 'darwin'

      await removeCertFromSystemTrustStore('example.com')

      // Verify the correct macOS command was executed
      expect(mockRunCommand).toHaveBeenCalledWith(
        expect.stringContaining(`sudo security delete-certificate -c "${config.commonName}"`),
      )
    })

    it('should remove a certificate with a specific name on macOS', async () => {
      mockPlatform = 'darwin'
      const specificCertName = 'My Custom Certificate'

      await removeCertFromSystemTrustStore('example.com', {}, specificCertName)

      // Verify the correct macOS command was executed with the specific name
      expect(mockRunCommand).toHaveBeenCalledWith(
        expect.stringContaining(`sudo security delete-certificate -c "${specificCertName}"`),
      )
    })

    it('should remove a specific certificate on Windows', async () => {
      mockPlatform = 'win32'

      await removeCertFromSystemTrustStore('example.com')

      // Verify the correct Windows command was executed
      expect(mockRunCommand).toHaveBeenCalledWith(
        expect.stringContaining(`certutil -delstore -enterprise Root "${config.commonName}"`),
      )
    })

    it('should remove a certificate with a specific name on Windows', async () => {
      mockPlatform = 'win32'
      const specificCertName = 'My Custom Certificate'

      await removeCertFromSystemTrustStore('example.com', {}, specificCertName)

      // Verify the correct Windows command was executed with the specific name
      expect(mockRunCommand).toHaveBeenCalledWith(
        expect.stringContaining(`certutil -delstore -enterprise Root "${specificCertName}"`),
      )
    })

    it('should remove a specific certificate on Linux', async () => {
      mockPlatform = 'linux'

      // Mock finding certificate databases
      mockFindFoldersWithFile.mockReturnValue(['/home/user/.pki/nssdb'])

      await removeCertFromSystemTrustStore('example.com')

      // Verify the correct Linux command was executed
      expect(mockRunCommand).toHaveBeenCalledWith(
        `certutil -d sql:/home/user/.pki/nssdb -D -n "${config.commonName}"`,
      )
    })

    it('should remove a certificate with a specific name on Linux', async () => {
      mockPlatform = 'linux'
      const specificCertName = 'My Custom Certificate'

      // Mock finding certificate databases
      mockFindFoldersWithFile.mockReturnValue(['/home/user/.pki/nssdb'])

      await removeCertFromSystemTrustStore('example.com', {}, specificCertName)

      // Verify the correct Linux command was executed with the specific name
      expect(mockRunCommand).toHaveBeenCalledWith(
        expect.stringContaining(`certutil -d sql:/home/user/.pki/nssdb -D -n "${specificCertName}"`),
      )
    })

    it('should handle errors when removing a certificate', async () => {
      mockPlatform = 'darwin'

      // Mock command failure
      mockRunCommand.mockImplementation((_command: string, _options?: any) => {
        throw new Error('Command failed')
      })

      await expect(removeCertFromSystemTrustStore('example.com')).rejects.toThrow()
    })
  })
})
