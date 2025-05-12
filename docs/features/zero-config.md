# Zero-Config & Zero-Setup

`tlsx` is designed to work with zero configuration required, making it easy to get started with secure local development.

## What is Zero-Config?

Zero-config means that `tlsx` works out of the box with sensible defaults, eliminating the need for complex setup and configuration. It follows the "convention over configuration" principle, allowing you to focus on your development instead of certificate management.

## Benefits of Zero-Config

- **Get Started Quickly**: No complex setup or configuration required
- **Sensible Defaults**: Reasonable default settings for most use cases
- **Reduced Cognitive Load**: Focus on your project, not on certificate management
- **Consistency**: Standard behavior across different projects

## Default Configuration

Out of the box, `tlsx` provides:

- Default certificate paths in a user-specific location
- Standard common name (`stacks.localhost`)
- Proper validity periods for development certificates
- Automatic trust store integration
- Localhost and 127.0.0.1 alternative names

## Flexible When Needed

While `tlsx` works with zero configuration, it's also highly configurable when you need it to be:

- Custom domains and wildcards
- Multiple alternative names
- Configurable validity periods
- Custom organization and location details
- Overridable certificate paths

## Example: Zero-Config Usage

Using the CLI with zero configuration:

```bash
tlsx secure
```

This will create and install a certificate for `stacks.localhost` with all default settings.

## Example: Custom Configuration

Create a `tls.config.ts` file when you need customization:

```ts
// tls.config.ts
export default {
  domain: 'myapp.local',
  organizationName: 'My Organization',
  validityDays: 365,
}
```

## Related Features

- [System Trust Store Integration](/features/system-trust-store)
- [SSL Support](/features/ssl-support)
