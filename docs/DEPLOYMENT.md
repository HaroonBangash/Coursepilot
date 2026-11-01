# Deployment

CoursePilot runs as a Docker container on a Linux server. Uploaded notes and accounts live in Docker volumes, so they survive restarts and new releases.

## Requirements

- A Linux server with Docker and the Compose plugin
- At least 4 GB of free memory and 15 GB of free disk
- A public address that points to the server

## First deployment

1. Copy this repository to the server.
2. Create the settings file and fill it in:

   ```bash
   cp deploy/.env.example deploy/.env
   ```

3. Build and start the app:

   ```bash
   docker compose -f deploy/docker-compose.yml up -d --build
   ```

4. Make the app public, using one of these:
   - **Nothing is using ports 80 and 443:** add `--profile proxy` to the command above. Caddy serves the site and manages its HTTPS certificate.
   - **The server already runs a web server:** forward your site's address to `127.0.0.1:3100` from that web server.

## Updating

Copy the new code to the server, then run:

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

## Backups

Accounts and notes are stored in the `coursepilot_coursepilot-data` and `coursepilot_coursepilot-storage` volumes. Back these up regularly, because they aren't in Git.

## Limits

The app container is limited to 2 CPUs and 6 GB of memory so it can share a server safely. Uploads are limited to 25 MB. Edit `deploy/docker-compose.yml` to change the resource limits.
