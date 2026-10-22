# Web client

React + Vite frontend for **My Docker App**.

The UI calls the API at `VITE_API_URL/api/message` and displays the returned text. See the [project README](../README.md) for full setup instructions and [documentation.md](../documentation.md) for technical details.

## Run locally (without Docker)

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. The API must be running at <http://localhost:5000>.

## Build

```bash
npm run build
```

The production files are written to `dist/` and served by Nginx inside the Docker image.
