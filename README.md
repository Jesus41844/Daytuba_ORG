# Daytuba Tasks

Plataforma de gestión de tareas para estudiantes UTP, construida con Next.js 16, Firebase y shadcn/ui.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16.3.1 (App Router, Turbopack), React 19, TypeScript |
| UI | shadcn/ui (Base UI), Tailwind CSS 4, Lucide Icons |
| State | React hooks, `useSyncExternalStore` (dark mode) |
| Validación | Zod 4.4.3, react-hook-form |
| Backend | Firebase (Auth + Firestore) |
| Deploy | Vercel |

## Características

- **Autenticación** — Email/password + Google OAuth, sesiones cookies via `firebase-admin`
- **Tareas** — CRUD completo, estados (pending/in-progress/completed/cancelled), prioridades, fechas, horas estimadas
- **Proyectos** — Organizar tareas en grupos, colorear, reordenar, editar/eliminar inline
- **Categorías** — Labels multi-selección para filtrar tareas, gestión inline (crear/editar/eliminar con color)
- **Inbox** — Vista de tareas sin proyecto asignado
- **Dashboard** — Resumen: vencidas, completadas esta semana, para hoy
- **Dark mode** — Light / Dark / System, anti-flash al cargar, persistencia localStorage
- **Sidebar redimensionable** — Drag handle, colapsa a icono hamburguesa, ancho persistido
- **Mobile** — Sheet drawer responsive + barra superior con hamburguesa
- **404 / Error boundaries** — Páginas personalizadas para errores y rutas inexistentes
- **Firestore security rules** — Owner-only por colección, deny-all para no autenticados
- **Firestore indexes** — Composite indexes para queries multi-campo

## Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/          # Login, register (layout con branding)
│   ├── (app)/           # Dashboard protegido (layout con sidebar)
│   │   ├── dashboard/
│   │   │   ├── page.tsx           # Dashboard principal
│   │   │   ├── tasks/             # Lista + detalle de tareas
│   │   │   ├── projects/          # Gestión de proyectos
│   │   │   ├── categories/        # Gestión de categorías
│   │   │   ├── inbox/             # Bandeja de entrada
│   │   │   ├── calendar/          # (placeholder Fase 2)
│   │   │   └── settings/          # (placeholder)
│   │   ├── error.tsx              # Error boundary
│   │   ├── loading.tsx            # Skeleton de carga
│   │   └── not-found.tsx          # 404 del dashboard
│   ├── not-found.tsx              # 404 global
│   └── layout.tsx                 # Root (ThemeProvider + anti-flash script)
├── components/
│   ├── layout/                    # Sidebar, PageHeader, EmptyState, ThemeToggle
│   └── ui/                        # 18 componentes shadcn/ui
├── features/
│   ├── auth/                      # Login, register, session, logout
│   ├── tasks/                     # CRUD, queries, hooks, TaskCard, forms
│   ├── projects/                  # CRUD, ProjectList (con edit/delete inline)
│   ├── categories/                # CRUD, CategoryManager (con edit/delete inline)
│   └── inbox/                     # Query + lista
├── lib/
│   ├── auth/session.ts            # getSession / requireSession (firebase-admin)
│   ├── firebase/admin.ts          # Admin SDK (dynamic import)
│   ├── firebase/client.ts         # Client SDK
│   ├── firebase/mappers.ts        # mapTask, mapProject, mapCategory
│   ├── db/server.ts               # getDb() singleton
│   ├── errors.ts                  # AppError, NotFoundError, ActionResult<T>
│   ├── validations/index.ts       # Schemas Zod
│   └── utils.ts                   # cn()
├── types/
│   ├── task.ts                    # Task, Project, Category
│   └── user.ts                    # User (scaffolding)
└── proxy.ts                       # Session cookie → login redirect
```

## Arquitectura de datos

Firestore usa colecciones planas con campo `userId` para ownership:

```
tasks/{id}       → userId, projectId, categories[], status, priority, dates...
projects/{id}    → userId, name, color, sortOrder
categories/{id}  → userId, name, color
users/{uid}      → email, displayName, photoUrl, role
```

- Una tarea → un proyecto máximo
- Una tarea → muchas categorías (array de IDs)
- Seguridad: reglas Firestore validan `userId == auth.uid` por documento

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

## Desarrollo

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo (Turbopack)
npm run dev

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Build
npm run build

# Desplegar reglas + indexes de Firestore
firebase deploy --only firestore
```

## Scripts útiles

```bash
# Verificar que no hay errores de TypeScript
npx tsc --noEmit

# Desplegar solo reglas
firebase deploy --only firestore:rules

# Desplegar solo indexes (forzar limpieza de indexes viejos)
firebase deploy --only firestore:indexes --force
```

## Fases

| Fase | Estado |
|------|--------|
| Auth (email/password + Google) | Completado |
| Sidebar + navegación | Completado |
| Tareas CRUD | Completado |
| Proyectos CRUD (con edit/delete) | Completado |
| Categorías CRUD (con edit/delete) | Completado |
| Dashboard + resumen | Completado |
| Bandeja de entrada | Completado |
| Dark mode | Completado |
| Sidebar redimensionable | Completado |
| Error boundaries + loading + 404 | Completado |
| Security rules + indexes | Completado |
| Calendario | Pendiente (Fase 2) |
| Configuración de perfil | Pendiente (Fase 2) |
| Subtareas | Pendiente |
| Horas estimadas/registradas | Pendiente |
| Tests (Vitest) | Pendiente |
| PWA (Serwist) | Pendiente |

## Licencia

Proyecto privado — Daytuba.
