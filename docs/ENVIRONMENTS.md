# Environment model

The application uses three explicit environments.

## Development

- Local developer data and credentials only.
- Disposable database instances/branches are allowed.
- Never use production OAuth or database credentials.
- `APP_ENV=development`.

## Preview

- Per-branch / pull-request Vercel deployment.
- Non-production database and OAuth credentials.
- May use realistic synthetic fixtures, never private production data.
- `APP_ENV=preview`.

## Production

- Real user data and production integrations.
- Separate production secrets and database.
- Destructive migration/release behavior requires backup and rollback/forward-fix consideration.
- `APP_ENV=production`.

The same application artifact may run in all environments, but credentials, databases, provider configuration, and operational guarantees remain isolated.
