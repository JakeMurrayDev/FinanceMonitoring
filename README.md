# Finance Monitor

A personal finance dashboard: React + TypeScript frontend, .NET 11 API.

> Full README (screenshots, live demo, technical decisions) arrives in Phase 6.

## Prerequisites

- Node.js 22+ and pnpm 11
- .NET SDK 11.0.100 (pinned in `global.json`)

## Getting started

```bash
pnpm install
dotnet tool restore --tool-manifest api/dotnet-tools.json
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:5080, with interactive docs at http://localhost:5080/scalar

The API creates and migrates its SQLite database (`finance.db`) on first run.

## Scripts (from the repo root)

| Command          | What it does                                             |
| ---------------- | -------------------------------------------------------- |
| `pnpm dev`       | Run the API (with `dotnet watch`) and the web app together |
| `pnpm test`      | Run the Vitest and xUnit suites                          |
| `pnpm check`     | Typecheck, lint, format-check and test both apps         |
| `pnpm build`     | Production build of both apps                            |

## Repository layout

```
web/        React app (Vite, TanStack Router/Query, Tailwind, shadcn/ui)
api/        ASP.NET Core minimal API using the REPR pattern, EF Core + SQLite
fixtures/   Test data shared by both test suites (e.g. currency conversion cases)
```
