# VPS production deployment

This deployment runs the public site behind Caddy with automatic HTTPS. PostgreSQL, MinIO, the API, and the MinIO console have no public ports. Migrations finish before the API starts, and Caddy waits for the application health checks.

## VPS requirements

- A current 64-bit Linux VPS with at least 2 CPU cores, 4 GB RAM, and 25 GB of persistent disk
- Docker Engine with the Compose plugin
- An A/AAAA DNS record for the application domain pointing to the VPS
- Inbound TCP ports 80 and 443, plus UDP 443, allowed by the VPS firewall

## First deployment

1. Copy the repository to a non-public directory on the VPS and enter it.
2. Create the production environment file:

   ```sh
   cp .env.production.example .env.production
   chmod 600 .env.production
   ```

3. Replace every example value. Use independent URL-safe values (for example, `openssl rand -hex 32`) for the database password, storage access key, and storage secret. `WEB_ORIGIN` must be exactly `https://<DOMAIN>` and `S3_PUBLIC_URL` must be `https://<DOMAIN>/assets`.
4. Validate and start the stack:

   ```sh
   docker compose --env-file .env.production -f compose.production.yaml config --quiet
   docker compose --env-file .env.production -f compose.production.yaml up -d --build --wait
   ```

5. Provision the first platform administrator once. Replace the three values in the shell environment; they are not stored in Compose:

   ```sh
   docker compose --env-file .env.production -f compose.production.yaml run --rm \
     -e PROVISION_ADMIN_EMAIL='admin@example.com' \
     -e PROVISION_ADMIN_NAME='Platform Administrator' \
     -e PROVISION_ADMIN_PASSWORD='use-a-unique-long-password' \
     migrate npm run admin:provision
   ```

6. Open the HTTPS URL and replace the temporary administrator password at first login.

## Updates

Back up first, fetch or copy the reviewed release, then rebuild. The one-shot migration container applies only pending migrations before the new API starts.

```sh
docker compose --env-file .env.production -f compose.production.yaml exec -T postgres \
  pg_dump -U plan -d plan -Fc > "backups/manual-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose --env-file .env.production -f compose.production.yaml up -d --build --wait
docker compose --env-file .env.production -f compose.production.yaml ps
```

Do not run `docker compose down -v`: `-v` permanently removes the database, uploaded assets, and TLS state.

## Operations

```sh
# Service status and health
docker compose --env-file .env.production -f compose.production.yaml ps

# Recent application and proxy logs
docker compose --env-file .env.production -f compose.production.yaml logs --tail=200 api web caddy

# Restart application containers without touching stored data
docker compose --env-file .env.production -f compose.production.yaml restart api web caddy
```

Daily database dumps are written to `BACKUP_DIR` and retained for `BACKUP_RETENTION_DAYS`. Copy this directory to encrypted off-site storage and test restoration regularly. Also back up the `assets_data` Docker volume; database dumps do not contain uploaded logos.

For production monitoring, alert on the public `/api/health` endpoint, low disk space, container restarts, failed backup creation, and TLS expiry. Keep the OS and Docker patched, restrict SSH to keys, and allow database/storage access only through Docker's private network.
