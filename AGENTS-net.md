# AGENTS.md — .NET Core Web API

## Core Principles

- **Pragmatism over dogma.** Choose the simplest design that solves the problem. Resist over-engineering.
- **Explicit over implicit.** Clear naming, clear contracts, clear errors. No magic.
- **Fail fast and loud.** Validate at boundaries; let invariants hold inside.

## Architecture

- Use **minimal APIs** for new endpoints unless the project standard is controllers — be consistent within a project.
- Layer separation: **Controllers/Endpoints → Application/Services → Domain → Infrastructure**. No reverse dependencies.
- DTOs for transport, never expose entities directly. Use records for immutable DTOs.
- Use **dependency injection** for everything. No `new` for services or repositories.
- Async all the way down. Never block on `.Result` or `.Wait()`.

## Code Style

- Follow **Microsoft C# conventions**: PascalCase for types/methods, camelCase for locals/parameters, `_camelCase` for private fields.
- Enable **nullable reference types** (`<Nullable>enable</Nullable>`). Treat warnings as errors in CI.
- Prefer `record` for DTOs and value objects; `class` for entities and services.
- Use `IOptions<T>` for configuration; never read `IConfiguration` directly outside startup.
- Validate input with **FluentValidation** or `[Required]`/`[Range]` data annotations. Return `400` with a problem details payload on failure.

## Error Handling

- Use **ProblemDetails** (`RFC 7807`) for all error responses.
- Centralize exception handling via middleware. Do not catch-and-rethrow without adding value.
- Log with structured logging (`ILogger<T>`). Never log secrets, tokens, or PII.

## Testing — MANDATORY

- **Every service, handler, and endpoint must have unit tests.** No exceptions.
- Use **xUnit** (preferred) with **FluentAssertions** and **Moq** or **NSubstitute**.
- Integration tests for endpoints via `WebApplicationFactory<T>`. Cover the happy path, validation failures, and auth failures at minimum.
- Test behavior, not implementation. Do not assert on private state.
- Coverage floor: **80% lines, 75% branches**. Use **Coverlet** for measurement. Do not lower thresholds to make a build pass.
- **After every iteration — feature, bugfix, refactor — run the full test suite.** Fix failures before moving on. Do not commit red.

```bash
dotnet test --collect:"XPlat Code Coverage"
```

## Documentation — MANDATORY

- Update the relevant `README.md` or `docs/` entry **in the same change** that modifies behavior. Stale docs are worse than no docs.
- All public types and methods require **XML doc comments** (`<summary>`, `<param>`, `<returns>`, `<exception>`).
- Keep **OpenAPI/Swagger** annotations current: `[ProducesResponseType]`, `[SwaggerOperation]`, descriptions on DTOs.
- Document architectural decisions in `docs/adr/` (Architecture Decision Records). One file per decision.
- Document **why**, not **what**.

## Database & Persistence

- Use **migrations** for schema changes. Never edit the database manually.
- Repositories return domain objects, not raw entities, when an aggregate boundary exists.
- Use `IAsyncEnumerable<T>` for streaming reads where appropriate.
- Wrap multi-step writes in transactions explicitly.

## Security

- All endpoints authenticated by default; opt out explicitly with `[AllowAnonymous]`.
- Validate authorization at the endpoint, not just the controller.
- Never trust client input. Validate, sanitize, parameterize.
- Secrets via `User Secrets` (dev) or environment/key vault (prod). Never in source.

## Definition of Done

A change is not done until:
1. Solution builds with **zero warnings** (`TreatWarningsAsErrors=true`).
2. All unit and integration tests pass and coverage thresholds hold.
3. XML docs and OpenAPI annotations are updated.
4. Relevant `README.md`, ADRs, or `docs/` entries are updated.
5. No `TODO` without a tracking ticket reference.

## Skepticism Checklist

Before accepting a suggestion (mine or anyone's), ask:
- Does this actually solve the problem, or just move it?
- What is the simplest thing that could work?
- What breaks if this assumption is wrong?
- Is this layer the right place for this logic?
