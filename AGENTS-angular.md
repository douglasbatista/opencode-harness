# AGENTS.md — Angular Web Application

## Core Principles

- **Pragmatism over dogma.** Prefer the simplest solution that works. Avoid premature abstraction.
- **Type safety is non-negotiable.** No `any` without justification. Enable `strict` mode in `tsconfig.json`.
- **Stateless where possible.** Pure functions and immutable data first; reach for state only when needed.

## Architecture

- Use **standalone components** by default. Avoid `NgModule` unless maintaining legacy code.
- Follow the **smart/dumb component** pattern: containers handle state, presentational components receive inputs and emit outputs.
- Use **signals** for reactive state. Reserve RxJS for streams (HTTP, events, debouncing).
- Lazy-load routes. Keep initial bundle small.
- Use `OnPush` change detection by default.

## Code Style

- One responsibility per file. If a component exceeds ~200 lines, split it.
- Use `inject()` over constructor injection.
- Prefer `readonly` and `const`. Mutate only when necessary.
- Name files with kebab-case: `user-profile.component.ts`.
- No logic in templates beyond simple expressions.

## Testing — MANDATORY

- **Every component, service, pipe, and guard must have unit tests.** No exceptions.
- Use **Jest** or **Karma + Jasmine** (whichever the project already uses — do not mix).
- Test behavior, not implementation. Avoid testing private methods directly.
- Use `TestBed` with standalone component imports. Mock dependencies with `jest.fn()` or spy objects.
- Coverage floor: **80% lines, 75% branches**. Do not lower thresholds to make a build pass.
- **After every iteration — feature, bugfix, refactor — run the full test suite.** Fix failures before moving on. Do not commit red.

```bash
npm test -- --watch=false --code-coverage
```

## Documentation — MANDATORY

- Update the relevant `README.md` or `docs/` entry **in the same change** that modifies behavior. Stale docs are worse than no docs.
- Public APIs (services, exported functions, complex components) require JSDoc with at least a one-line summary and `@param`/`@returns` where applicable.
- Document **why**, not **what**. The code shows what it does.
- When introducing a new pattern or dependency, add a short note to `docs/decisions.md` (or create it).

## Definition of Done

A change is not done until:
1. Code compiles with no warnings under `--strict`.
2. Linter (`ng lint` / ESLint) passes clean.
3. All unit tests pass and coverage thresholds hold.
4. Relevant docs and JSDoc are updated.
5. No `console.log`, `debugger`, or commented-out code remains.

## Skepticism Checklist

Before accepting a suggestion (mine or anyone's), ask:
- Does this actually solve the problem, or just move it?
- What is the simplest thing that could work?
- What breaks if this assumption is wrong?
