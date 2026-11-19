# Start PLAN EDU SUITE

The archive contains the updated application source, all three database migrations, Docker setup, tests and developer documentation. See REFINEMENT.md for the organization licensing migration, corporate interface changes and current verification limits. Keep your current .env and database volumes when updating an existing installation.

1. Install/open **Docker Desktop**.
2. Extract this folder, copy `.env.example` to `.env`, and set your own administrator email and password in that file.
3. Open a terminal in this folder and run:

   ```sh
   docker compose up --build -d
   ```

4. Open **http://localhost:3000**.
5. Select **Super Admin**, sign in with the credentials from `.env` and set a new password.

Use Organizations → Add organization, then Onboarding to complete the seven-step client journey. At activation, copy the generated client credentials. The client uses the Organization login tab and must replace their temporary password.

Inside the client portal: Institution → Academic year → School Registration / Academic Sections / Classroom Setup / Bell Time & Calendar → Review & activate.

For an existing active structure, choose **Edit configuration** to create a draft and **Review & publish** to apply it. **History** preserves earlier publications.

The project has not been deployed. Production build and unit-test results are recorded in `VERIFICATION.md`; full database/browser acceptance still needs to run in a normal Docker environment. `README.md` has the developer setup, troubleshooting entry points and production configuration.

## Working on source changes locally

Use one app server at a time. `docker compose up -d` starts the last built Docker app; it does not rebuild source changes. Running that alongside `npm run dev` makes both copies compete for port 3000.

For local development with immediate source updates:

```sh
docker compose stop api web
docker compose up -d --wait postgres minio
docker compose up -d bucket
npm run dev
```

Open http://localhost:3000. Keep that development terminal running. `npm run dev` now checks for occupied app ports before starting and explains how to resolve a conflict.

For Docker-only use, stop `npm run dev` first, then run `docker compose up -d --build` to rebuild and start the current source. Do not run development alongside it. Both workflows preserve database and asset volumes.
