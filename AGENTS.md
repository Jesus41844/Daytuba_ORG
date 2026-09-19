<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Guía del proyecto para agentes (UTP Tasks / Daytuba Tasks)

## Fuente de verdad
El roadmap, las fases y los pendientes viven en la nota de Obsidian, no en el
README: `~/Documents/ObsidianDaytubaOS/DaytubaOS/02 Projects/UTP Tasks.md`.
Consultarla antes de asumir en qué fase está el proyecto.

## Base de datos: Supabase, no Docker
Ya no se usa Postgres local en Docker. `DATABASE_URL` debe apuntar a Supabase.
Para desarrollo local, traer las variables reales de producción:

```
npx vercel login
npx vercel env pull
```

(proyecto Vercel: `jesus41844s-projects/daytuba-org`). Si `DATABASE_URL` sigue
apuntando a `localhost:5433`, login/registro fallan con `ECONNREFUSED`.

## Deploy
`git push origin self-hosted` dispara un deploy de producción en Vercel
automáticamente — no hay entorno de staging. Verificar con
`npx vercel list --format=json` (revisar `state` y `githubCommitSha`) o con un
curl a `https://daytuba-org.vercel.app/`.

## Higiene de git
Nunca `git add -A` / `git add .` en este repo — un script de scratch
(`verify.js`) se coló en un commit así. Nombrar los archivos explícitamente y
revisar `git status --short` antes de commitear.

## Tests (Vitest)
- `npm run test:run`. Cualquier módulo que arrastre `@/db` (import
  transitivo, p.ej. un componente client que importa un Server Action) lanza
  `DATABASE_URL no está configurada` en tests si no se mockea. Mockear el
  módulo de actions, no solo `@/db`.
- Los componentes de `@base-ui/react` (Menu, Dropdown) no disparan `onSelect`
  con `fireEvent.click`/`keyDown` en jsdom — hace falta
  `@testing-library/user-event`, que **no está instalado**. No agregar esa
  dependencia sin que el usuario lo pida; mientras tanto esos flujos de
  interacción quedan sin cobertura automatizada de clic/selección real.

## Arquitectura de espacios de trabajo (en transición)
Hoy el filtro activo es cookie-based (cookie `active_workspace`, ver
`src/lib/active-workspace.ts` y `setActiveWorkspace` en
`src/features/workspaces/actions.ts`). Hay una decisión tomada (2026-09-19,
aún no implementada) de eliminar `workspaces`/`workspace_members` por
completo y mover todo a `projects` con roles owner/editor/viewer, agrupados
por categoría/etiqueta en vez de por espacio. No expandir la jerarquía de
workspaces sin confirmar primero que ese refactor sigue en pie.
