# Install

Installing `tlsx` is easy. Simply pull it in via your package manager of choice, or download the binary directly.

## Package Managers

Choose your package manager of choice:

::: code-group

```sh [npm]
npm install --save-dev @stacksjs/tlsx
# npm i -d @stacksjs/tlsx

# or, install globally via
npm i -g @stacksjs/tlsx
```

```sh [bun]
bun install --dev @stacksjs/tlsx
# bun add --dev @stacksjs/tlsx
# bun i -d @stacksjs/tlsx

# or, install globally via
bun add --global @stacksjs/tlsx
```

```sh [pnpm]
pnpm add --save-dev @stacksjs/tlsx
# pnpm i -d @stacksjs/tlsx

# or, install globally via
pnpm add --global @stacksjs/tlsx
```

```sh [yarn]
yarn add --dev @stacksjs/tlsx
# yarn i -d @stacksjs/tlsx

# or, install globally via
yarn global add @stacksjs/tlsx
```

```sh [brew]
brew install tlsx # coming soon
```

```sh [pkgx]
pkgx tlsx # coming soon
```

:::

Read more about how to use it in the Usage section of the documentation.

## Binaries

Choose the binary that matches your platform and architecture:

::: code-group

```sh [macOS (arm64)]
# Download the binary
curl -L https://github.com/stacksjs/tlsx/releases/download/v0.10.0/tlsx-darwin-arm64 -o tlsx

# Make it executable
chmod +x tlsx

# Move it to your PATH
mv tlsx /usr/local/bin/tlsx
```

```sh [macOS (x64)]
# Download the binary
curl -L https://github.com/stacksjs/tlsx/releases/download/v0.10.0/tlsx-darwin-x64 -o tlsx

# Make it executable
chmod +x tlsx

# Move it to your PATH
mv tlsx /usr/local/bin/tlsx
```

```sh [Linux (arm64)]
# Download the binary
curl -L https://github.com/stacksjs/tlsx/releases/download/v0.10.0/tlsx-linux-arm64 -o tlsx

# Make it executable
chmod +x tlsx

# Move it to your PATH
mv tlsx /usr/local/bin/tlsx
```

```sh [Linux (x64)]
# Download the binary
curl -L https://github.com/stacksjs/tlsx/releases/download/v0.10.0/tlsx-linux-x64 -o tlsx

# Make it executable
chmod +x tlsx

# Move it to your PATH
mv tlsx /usr/local/bin/tlsx
```

```sh [Windows (x64)]
# Download the binary
curl -L https://github.com/stacksjs/tlsx/releases/download/v0.10.0/tlsx-windows-x64.exe -o tlsx.exe

# Move it to your PATH (adjust the path as needed)
move tlsx.exe C:\Windows\System32\tlsx.exe
```

::: tip
You can also find the `tlsx` binaries in GitHub [releases](https://github.com/stacksjs/tlsx/releases).
:::
