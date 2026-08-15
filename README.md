# WherezIt — AI-Powered Storage Memory App

WherezIt is an AI-powered storage memory application that helps users catalog, locate, and manage physical belongings across arbitrary storage locations using photos, QR/barcodes, and natural language search.

Built with React, ASP.NET Core, PostgreSQL, Google Cloud, and Gemini-powered agents.

---

## Technical Stack

- **Frontend**: React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod
- **Backend**: C#, ASP.NET Core 10, Modular Monolith Architecture
- **Database**: PostgreSQL (Entity Framework Core + Npgsql provider)
- **Cloud & Services**: Firebase Authentication, Firebase Hosting, Cloud Run, Cloud SQL for PostgreSQL, Cloud Storage, Vertex AI / Gemini

---

## Monorepo Layout

```text
wherezit/
├── GEMINI.md                     # Source-of-truth agent rules & constraints
├── README.md                     # Project documentation & execution guide
├── WherezIt.sln                  # ASP.NET Core solution file
├── docs/                         # Specification, tickets, ADRs, AI orchestration specs
│   ├── MVP_SPEC.md               # Product & engineering specification
│   ├── TICKETS.md                # Task backlog & execution order
│   ├── ADR/                      # Approved Architecture Decision Records
│   └── AI_AGENT_ORCHESTRATION.md # Product AI agent architecture
├── agents/                       # Coding agent prompt definitions
├── apps/                         # Main applications
│   ├── web/                      # React / Vite / TypeScript web application
│   └── api/                      # Modular monolith ASP.NET Core API
│       ├── WherezIt.Domain/       # Core domain entities & invariants
│       ├── WherezIt.Application/  # Use cases & service interfaces
│       ├── WherezIt.Infrastructure/# EF Core, PostgreSQL & GCP services
│       └── WherezIt.Api/          # REST API & Cloud Run entrypoints
├── tests/                        # Test suites
│   ├── Domain.Tests/             # Unit tests for Domain rules
│   ├── Api.IntegrationTests/     # Integration tests against PostgreSQL & API
│   └── E2E/                      # End-to-end testing suite
├── database/                     # Migrations & seeds
│   ├── migrations/               # EF Core versioned migrations
│   └── seeds/                    # Environment seeding scripts
├── infrastructure/               # IaC & Deployment configs
│   ├── firebase/                 # Firebase hosting configuration
│   ├── cloudbuild/               # CI/CD pipelines
│   └── gcp/                      # Google Cloud configuration
└── scripts/                      # Local developer helper scripts
```

---

## Quickstart

### Prerequisites

- **Node.js**: v18+ and `npm`
- **.NET SDK**: 10.0+ (ASP.NET Core 10)
- **PostgreSQL**: Local PostgreSQL or Docker

### Frontend (`apps/web`)

```bash
cd apps/web
npm install
npm run dev     # Starts Vite dev server
npm run build   # Production build
npm run test    # Runs Vitest unit tests
```

### Backend (`apps/api`)

```bash
# From workspace root:
dotnet build WherezIt.sln
dotnet test WherezIt.sln
```

### Container Build

```bash
# From workspace root:
docker build -t wherezit-api .
```


