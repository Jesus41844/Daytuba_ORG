# Daytuba Tasks

Plataforma de gestión de tareas para estudiantes UTP, construida con Next.js 16, PostgreSQL y shadcn/ui. Stack 100% self-hosted en Docker.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16.3.1 (App Router, Turbopack), React 19, TypeScript |
| UI | shadcn/ui (Base UI), Tailwind CSS 4, Lucide Icons |
| State | React hooks, `useSyncExternalStore` (dark mode) |
| Validación | Zod 4.4.3, react-hook-form |
| Base de datos | PostgreSQL 17 + Drizzle ORM |
| Auth | Sesiones propias (bcrypt + cookie httpOnly) |
| Archivos | Volumen local servido por `/api/files/*` autenticada |
| Deploy | Docker Compose (web + postgres) |

## Características

- **Autenticación** — Email/password con bcrypt, sesiones en BD con cookie httpOnly (7 días)
- **Tareas** — CRUD completo, estados (pending/in-progress/completed/cancelled), prioridades, fechas, horas estimadas
- **Proyectos** — Organizar tareas en grupos, colorear, reordenar, editar/eliminar inline
- **Categorías** — Labels multi-selección para filtrar tareas, gestión inline (crear/editar/eliminar con color)
- **Inbox** — Vista de tareas sin proyecto asignado
- **Dashboard** — Resumen: vencidas, completadas esta semana, para hoy
- **Horario** — Bloques semanales + importación desde PDF
- **Moodle sync** — Sincroniza cursos y entregas de eCampus/Campus Virtual/Virtual UTP (credenciales cifradas AES-256-GCM)
- **Adjuntos PDF** — Subida/borrado por tarea y bloque, servidos con control de ownership
- **Dark mode** — Light / Dark / System, anti-flash al cargar, persistencia localStorage
- **Sidebar redimensionable** — Drag handle, colapsa a icono hamburguesa, ancho persistido
- **Mobile** — Sheet drawer responsive + barra superior con hamburguesa
- **404 / Error boundaries** — Páginas personalizadas para errores y rutas inexistentes

## Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/          # Login, register (layout con branding)
│   ├── (app)/           # Dashboard protegido (layout con sidebar)
│   │   └── dashboard/   # tasks, projects, categories, inbox, calendar, schedule, settings
│   ├── api/
│   │   └── files/[...path]/  # Sirve PDFs validando sesión y ownership
│   └── layout.tsx       # Root (ThemeProvider + anti-flash script)
├── db/
│   ├── schema.ts        # Esquema Drizzle (8 tablas)
│   ├── mappers.ts       # Filas → tipos de dominio
│   └── index.ts         # Pool postgres.js + cliente Drizzle
├── features/
│   ├── auth/            # Login, register, sesión, perfil, password
│   ├── tasks/           # CRUD + calendario + horario
│   ├── projects/        # CRUD
│   ├── categories/      # CRUD
│   ├── events/          # Eventos de calendario
│   ├── schedule/        # Bloques de horario
│   ├── files/           # Adjuntos PDF
│   ├── moodle/          # Sync Moodle (cliente, parser, crypto)
│   └── inbox/           # Query + lista
├── lib/
│   ├── auth/session.ts  # getSession / requireSession / createSession
│   ├── errors.ts        # AppError, NotFoundError, ActionResult<T>
│   ├── validations/     # Schemas Zod
│   └── utils.ts         # cn()
├── types/               # Task, Project, Category, etc.
└── proxy.ts             # Session cookie → login redirect
drizzle/                 # Migraciones SQL generadas
scripts/                 # Migración Firestore→Postgres (one-off)
docker-compose.yml       # Producción: web + postgres
docker-compose.dev.yml   # Desarrollo: solo postgres
Dockerfile               # Build multi-stage (output standalone)
```

## Modelo de datos

PostgreSQL con foreign keys y ownership por `user_id`:

```
users(id, email UNIQUE, display_name, photo_url, password_hash, role)
sessions(id = sha256(token), user_id FK, expires_at)
projects(id, user_id FK, name, sort_order, is_default, moodle_*)
categories(id, user_id FK, name UNIQUE(user), color)
tasks(id, user_id FK, project_id FK SET NULL, parent_id, status, priority,
      due_date, categories text[], pdf_url/pdf_name, moodle_*, ...)
calendar_events(id, user_id FK, date/dia_semana, start/end_time)
schedule_blocks(id, user_id FK, day_of_week, start/end_time, pdf_url)
moodle_credentials(id, user_id FK, platform UNIQUE(user), password cifrado AES-256-GCM)
```

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

```
DATABASE_URL=postgres://usuario:password@host:5432/utp_tasks
UPLOADS_DIR=./uploads
MOODLE_ENCRYPTION_KEY=<hex 32 bytes>   # openssl rand -hex 32
```

## Desarrollo

```bash
# Levantar Postgres
docker compose -f docker-compose.dev.yml up -d

# Instalar dependencias
npm install

# Aplicar migraciones
npm run db:migrate

# Servidor de desarrollo (Turbopack)
npm run dev

# Regenerar esquema tras editar src/db/schema.ts
npm run db:generate
```

## Producción (Docker)

```bash
# Configurar entorno (POSTGRES_PASSWORD y MOODLE_ENCRYPTION_KEY obligatorias)
cp .env.example .env && $EDITOR .env

# Primera vez: aplicar migraciones (sin exponer el puerto de la BD)
docker compose up -d db
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U utp -d utp_tasks < drizzle/0000_init-selfhosted-schema.sql

# Construir y levantar todo
docker compose up -d --build

# Backup de la base de datos
docker compose exec db pg_dump -U utp utp_tasks > backup.sql
```

La app corre como usuario no-root, escucha en el puerto 3000 (`HOSTNAME=0.0.0.0`) y usa output standalone (~150 MB). Para HTTPS, poner un reverse proxy (Caddy/nginx/Traefik) delante del puerto 3000.

## Licencia

Proyecto privado — Daytuba.
