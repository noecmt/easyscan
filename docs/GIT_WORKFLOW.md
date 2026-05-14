# Easy Scan — Git Workflow

## Structure des branches

```
main
 └── develop
      ├── feature/nom-de-la-feature
      ├── fix/nom-du-bug
      └── release/x.y.z
```

| Branche | Rôle | Règle |
|---|---|---|
| `main` | Production, stable | Jamais de commit direct — PR uniquement depuis `release/*` ou `fix/*` urgent |
| `develop` | Intégration en cours | Base de toutes les features |
| `feature/*` | Nouvelle fonctionnalité | Depuis `develop`, merge dans `develop` |
| `fix/*` | Correction de bug | Depuis `develop` (ou `main` si hotfix critique) |
| `release/*` | Préparation d'une version | Depuis `develop`, merge dans `main` + tag |

---

## Nommage des branches

```bash
feature/scanner-auto-discovery
feature/claude-ocr
fix/hp-scanner-timeout
fix/popup-ui-overflow
release/1.0.0
release/1.1.0
```

---

## Workflow quotidien

### Commencer une nouvelle feature

```bash
git checkout develop
git pull origin develop
git checkout -b feature/ma-feature
# ... travail ...
git add src/...
git commit -m "feat: description courte de ce que ça fait"
git push origin feature/ma-feature
# → ouvrir une PR vers develop sur GitHub
```

### Corriger un bug

```bash
git checkout develop
git pull origin develop
git checkout -b fix/nom-du-bug
# ... correction ...
git commit -m "fix: description du bug corrigé"
git push origin fix/nom-du-bug
# → PR vers develop
```

### Préparer une release

```bash
git checkout develop
git pull origin develop
git checkout -b release/1.0.0
# ajuster version dans manifest.json, mettre à jour CHANGELOG
git commit -m "chore: bump version to 1.0.0"
git push origin release/1.0.0
# → PR vers main
# → après merge : git tag v1.0.0
```

---

## Convention de messages de commit

Utiliser le format **Conventional Commits** :

```
type: description courte (max 72 chars)

Corps optionnel si besoin d'expliquer le pourquoi.
```

| Type | Quand l'utiliser |
|---|---|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `chore` | Maintenance (deps, config, build) |
| `docs` | Documentation uniquement |
| `refactor` | Refacto sans changement de comportement |
| `test` | Ajout ou modification de tests |
| `style` | Formatting, pas de changement logique |

Exemples :
```
feat: auto-discover scanners on popup open
fix: retry on 403 error from HP scanner
chore: bump vite to 5.4.0
docs: add GIT_WORKFLOW guide
```

---

## Règles de protection (à configurer sur GitHub)

Dans **Settings → Branches → Branch protection rules** pour `main` :

- [x] Require a pull request before merging
- [x] Require at least 1 approval (si collaborateurs)
- [x] Do not allow bypassing the above settings

---

## Tags et versions

On suit **Semantic Versioning** : `MAJOR.MINOR.PATCH`

- `PATCH` (1.0.1) : bug fix
- `MINOR` (1.1.0) : nouvelle feature rétro-compatible
- `MAJOR` (2.0.0) : changement cassant

Créer un tag après merge d'une release dans `main` :
```bash
git tag v1.0.0
git push origin v1.0.0
```
