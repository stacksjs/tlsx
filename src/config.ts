import { loadConfig } from 'c12'

// Get loaded config
const { config } = await loadConfig({
  name: 'tls',
})

export { config }
