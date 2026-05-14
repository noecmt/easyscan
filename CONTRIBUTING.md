# Contributing to Easy Scan

## Branch model

`main` is protected — never commit directly to it. All work flows through `develop`.

```
main  ←  release/*  ←  develop  ←  feature/*
                                 ←  fix/*
```

Full details: [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md)

## Branch naming

| Prefix | When to use |
|---|---|
| `feature/short-name` | New functionality |
| `fix/short-name` | Bug fix |
| `release/x.y.z` | Version preparation |

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type: short description (max 72 chars)
```

| Type | When |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Deps, config, build |
| `docs` | Documentation only |
| `refactor` | Refactor without behavior change |
| `test` | Add or update tests |

## Opening a PR

1. Fork the repo and create your branch from `develop`
2. Make your changes
3. Open a pull request **targeting `develop`**, not `main`
4. Describe what changed and why

## Code style

- ES modules (`import`/`export`) throughout
- No transpilation required for core logic (`src/core/`)
- The background service worker is the only context that makes HTTP requests — keep scanner calls out of popup and preview scripts
