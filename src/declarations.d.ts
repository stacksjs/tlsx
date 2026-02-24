declare module 'cac' {
  export class CAC {
    constructor(name?: string)
    command(name: string, description?: string): any
    option(name: string, description?: string, config?: any): CAC
    help(): CAC
    version(version: string): CAC
    parse(argv?: string[]): any
  }
  export function cac(_name?: string): CAC
  export default cac
}

declare module 'consola' {
  interface ConsolaInstance {
    info(...args: any[]): void
    success(...args: any[]): void
    warn(...args: any[]): void
    error(...args: any[]): void
    debug(...args: any[]): void
    log(...args: any[]): void
    start(...args: any[]): void
    box(...args: any[]): void
  }
  export const consola: ConsolaInstance
  export default consola
  export function createConsola(_options?: any): ConsolaInstance
}
