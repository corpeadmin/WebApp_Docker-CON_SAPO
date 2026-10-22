# Technical documentation

## Overview

**My Docker App** is a small two-tier web application built for the IPT 102 Integrative Programming 2 Docker activity. The frontend is React 19 + Vite 8 served by Nginx; the backend is a .NET 10 Web API; PostgreSQL 16 demonstrates Compose networking and data persistence. All services are orchestrated with Docker Compose.

## Architecture

```text
 browser
   |
   | http://localhost:3000        http://localhost:5000/api/message
   v                              v
+-------------+         +--------------------------+
|   web:80    |         |      api:8080            |
| nginx + React|         |  .NET 10 Web API         |
+-------------+         +--------------------------+
   |                              ^
   | http://api:8080/api/message  | GET /api/message
   +------------------------------+
   service name "api" on myapp_default network

+--------------------------+
|      db:5432             |
|   PostgreSQL 16          |
|  (internal only, volume  |
|   myapp_db-data)         |
+--------------------------+
```

The web container reaches the API and database by **service name** (`api`, `db`) on the `myapp_default` bridge network. PostgreSQL has no published host port, so it is reachable only from inside Compose.

## Technology versions used

| Layer | Host tool | Container image |
| --- | --- | --- |
| Docker | Docker Desktop 29.6.2 | - |
| Frontend build | Node v24.19.0 / npm 11.17.0 | `node:22-alpine` |
| Frontend runtime | - | `nginx:alpine` |
| React / Vite | React 19.3.1, Vite 8.3.5 | - |
| Backend | .NET SDK 10.0.402 | `mcr.microsoft.com/dotnet/sdk:10.0` |
| Backend runtime | - | `mcr.microsoft.com/dotnet/aspnet:10.0` |
| Database | - | `postgres:16-alpine` |

## Project structure

```text
myapp/
  api/
    Program.cs            GET /api/message, CORS, configuration
    api.csproj            .NET 10 web project
    Dockerfile            build (sdk 10.0) + run (aspnet 10.0)
    .dockerignore         bin, obj, .vs
  web/
    package.json
    vite.config.js
    src/App.jsx           calls /api/message via VITE_API_URL
    Dockerfile            build with Node 22, serve dist via Nginx
    .dockerignore         node_modules, dist, .git
  docker-compose.yml      api, web, db services + db-data volume
  .env                    APP_MESSAGE, DB_PASSWORD
  docs/screenshot.png     rendered app screenshot
  README.md               front-facing project README
  documentation.md        this file
```

## Request flow

1. Browser opens `http://localhost:3000`.
2. Nginx serves the compiled React app.
3. React calls `GET /api/message`.
4. The API returns JSON: `{ "message": "..." }`.
5. React renders the message.
6. If the API cannot be reached, React renders **Cannot reach the API**.

## API reference

**`GET /api/message`**

- Source: `api/Program.cs`
- Reads setting `Message` from configuration; default `"Hello from the API"`.
- Response:
  ```json
  { "message": "Hello from the API" }
  ```
- CORS policy (`AddDefaultPolicy`) allows origins `http://localhost:3000` and `http://localhost:5173`, any header, any method. Without CORS, the browser would block cross-origin calls from the React dev server and show **blocked by CORS policy**.

Configuration:
- Containerized API reads `Message` from environment, supplied by Compose as `${APP_MESSAGE}`.
- .NET environment variables use double underscores for nested keys, e.g. `ConnectionStrings__Default`.

## Frontend (`web/src/App.jsx`)

- Reads `API_URL` from `import.meta.env.VITE_API_URL`, default `http://localhost:5000`.
- On mount, fetches `${API_URL}/api/message` and stores the result in state.
- Shows `Loading...` initially, then the message or `Cannot reach the API`.
- `VITE_API_URL` is a **build-time** value: read by Vite during `npm run build`, not at runtime inside Nginx. Changing it requires rebuilding the `web` image.

## Docker images

### `api` (`myapp-api:1.0`)

Stage 1 (`mcr.microsoft.com/dotnet/sdk:10.0`): restores, builds, publishes.
Stage 2 (`mcr.microsoft.com/dotnet/aspnet:10.0`): copies published output only, listens on `8080`, runs `api.dll`.
- Exposed port: `8080`.
- Entry point: `dotnet api.dll`.

### `web` (`myapp-web:1.0`)

Stage 1 (`node:22-alpine`): installs dependencies (`npm ci`), sets `VITE_API_URL` build arg, runs `npm run build`.
Stage 2 (`nginx:alpine`): copies `/app/dist` into `/usr/share/nginx/html`.
- Exposed port: `80`.

### Why two stages

Build images contain compilers/SDKs/toolchains; runtime images contain only what is needed to run. This keeps final images small (e.g. `myapp-api:1.0` 340 MB, `myapp-web:1.0` 93.9 MB) and reduces the attack surface.

## Docker Compose

`docker-compose.yml` defines three services:

| Service | Image / build | Published port | Purpose |
| --- | --- | --- | --- |
| `api` | `build: ./api` | `5000:8080` | Web API |
| `web` | `build: ./web` | `3000:80` | React frontend via Nginx |
| `db` | `postgres:16-alpine` | none | PostgreSQL, internal only |

- `environment` on `api`: `Message: ${APP_MESSAGE}`.
- `build.args` on `web`: `VITE_API_URL: http://localhost:5000`.
- `depends_on: - api` on `web`: tells Compose to start `api` before `web`. It **does not** wait until the API is ready to accept requests; the frontend retries/fails gracefully.
- `db` uses `db-data:/var/lib/postgresql/data` named volume.
- Top-level `volumes: db-data:` declares the volume.
- All services share the `myapp_default` bridge network.

## Environment variables

`.env` (same folder as `docker-compose.yml`):

```dotenv
APP_MESSAGE=Hello from Docker Compose and SAPO!
DB_PASSWORD=change_me_123
```

Apply changes with `docker compose up -d`. Never commit `.env`; it is in `.gitignore`.

## Verification performed

The following commands were run and confirmed:

| Check | Command | Result |
| --- | --- | --- |
| Tool versions | `docker --version`, `dotnet --version`, `node --version`, `npm --version` | Docker 29.6.2; .NET 10.0.402; Node v24.19.0; npm 11.17.0 |
| Local API | `dotnet run --urls http://localhost:5050` | `GET /api/message` returned `{"message":"Hello from the API"}` |
| Local frontend | `npm run dev --port 5173` | Vite served `http://localhost:5173` with status 200 |
| Image build | `docker build -t myapp-api:1.0 ./api`, `./web` | Built successfully |
| Run containers | `docker run ...` | API on 5000, web on 3000 both served pages |
| Image sizes | `docker images` | `myapp-api:1.0` 340 MB; `myapp-web:1.0` 93.9 MB |
| Compose up | `docker compose up -d --build` | api, web, db all Up; `myapp_default` network present |
| Env config | `.env` APP_MESSAGE change | Page/API returned the new message after `up -d` |
| Networking | `docker compose exec web ping -c 2 api` / `db` | 2 packets received for both |
| Database access | `psql -U postgres -d appdb -c "\l"` | `appdb` database exists |
| Table insert | `INSERT INTO students (name) VALUES ('Juan')` | `INSERT 0 1` |
| Select | `SELECT * FROM students` | row `1 | Juan` shown |
| Persistence | `docker compose down` then `up -d` | row `Juan` still present |
| Volume loss | `docker compose down -v` then `up -d` | `relation "students" does not exist` |

Screenshot: `docs/screenshot.png` (page shows **My Docker App** and the compose message).

## Data persistence lifecycle

- Container removed (`docker compose down`): data stays in `db-data`.
- Volume removed (`docker compose down -v`): data is lost; tables must be recreated.
- This is why databases should mount named volumes in production.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Page says **Cannot reach the API** | API not running | `docker compose ps`, start `api` |
| **blocked by CORS policy** | CORS missing/origin wrong | Add origin to `Program.cs`, restart API |
| Port already allocated | Old containers on 3000/5000 | `docker compose down` or stop containers |
| YAML spacing errors | Tabs / wrong indentation | Use 2-space indentation, no tabs |
| `.env` not found | Wrong file name/folder | File must be `.env` next to `docker-compose.yml` |
| Password authentication failed | `DB_PASSWORD` changed after volume creation | `docker compose down -v` (deletes data) |

## Cleanup

```bash
docker compose down -v --rmi local
docker rmi myapp-api:1.0 myapp-web:1.0
```

Then verify with `docker ps -a`, `docker images`, `docker volume ls`. Source code in `myapp/` remains intact; rebuild anytime with `docker compose up --build`.

## Notes

- This demonstration app does not connect the API to PostgreSQL; the database exists to exercise Compose networking and volumes.
- Windows users: use PowerShell. On Git Bash, `docker compose exec` may report *"the input device is not a TTY"*; use PowerShell or VS Code Terminal instead.
