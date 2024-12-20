# Install

## Bun & Node.js

```bash
bun install -d @stacksjs/tlsx
npm install -g @stacksjs/tlsx

# or, invoke immediately
bunx @stacksjs/tlsx
npx @stacksjs/tlsx
```

_We are looking to publish this package npm under the name `tlsx`. We are also hoping npm will release the name for us._

## Binaries

For now, you can download the `tlsx` binaries from the [releases page](https://github.com/stacksjs/tlsx/releases/tag/v0.10.0). Choose the binary that matches your platform and architecture:

## macOS (Darwin)

For M1/M2 Macs (arm64):

```bash
# Download the binary
curl -L https://github.com/stacksjs/tlsx/releases/download/v0.10.0/tlsx-darwin-arm64 -o tlsx

# Make it executable
chmod +x tlsx

# Move it to your PATH
mv tlsx /usr/local/bin/tlsx
```

For Intel Macs (amd64):

```bash
# Download the binary
curl -L https://github.com/stacksjs/tlsx/releases/download/v0.10.0/tlsx-darwin-x64 -o tlsx

# Make it executable
chmod +x tlsx

# Move it to your PATH
mv tlsx /usr/local/bin/tlsx
```

## Linux

For ARM64:

```bash
# Download the binary
curl -L https://github.com/stacksjs/tlsx/releases/download/v0.10.0/tlsx-linux-arm64 -o tlsx

# Make it executable
chmod +x tlsx

# Move it to your PATH
mv tlsx /usr/local/bin/tlsx
```

For x64:

```bash
# Download the binary
curl -L https://github.com/stacksjs/tlsx/releases/download/v0.10.0/tlsx-linux-x64 -o tlsx

# Make it executable
chmod +x tlsx

# Move it to your PATH
mv tlsx /usr/local/bin/tlsx
```

## Windows

For x64:

```bash
# Download the binary
curl -L https://github.com/stacksjs/tlsx/releases/download/v0.10.0/tlsx-windows-x64.exe -o tlsx.exe

# Move it to your PATH (adjust the path as needed)
move tlsx.exe C:\Windows\System32\tlsx.exe
```

<!-- _Alternatively, you can install:_
```bash
brew install tlsx # wip
pkgx install tlsx # wip
``` -->
