import { $ } from 'bun'

await $`mv ./bin/tlsx ./dist/tlsx`
await $`cp ./dist/tlsx ./rp`
