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
| Archivos | Vercel Blob (`/api/blob-upload` emite el presigned URL) |
| Deploy | Vercel + Postgres gestionado, o Docker Compose (web + postgres + cron) |

## Características

- **Autenticación** — Email/password con bcrypt, sesiones en BD con cookie httpOnly (7 días)
- **Tareas** — CRUD completo, estados (pending/in-progress/completed/cancelled), prioridades, fechas, horas estimadas
- **Proyectos** — Organizar tareas en grupos, colorear, reordenar, editar/eliminar inline
- **Categorías** — Labels multi-selección para filtrar tareas, gestión inline (crear/editar/eliminar con color)
- **Inbox** — Vista de tareas sin proyecto asignado
- **Dashboard** — Resumen: vencidas, completadas esta semana, para hoy
- **Horario** — Bloques semanales + importación desde PDF
- **Moodle sync** — Sincroniza cursos y entregas de eCampus/Campus Virtual/Virtual UTP (credenciales cifradas AES-256-GCM). Automático por cron, con aviso cuando una tarea ya importada cambia de fecha o título
- **Espacios de trabajo** — Workspaces con roles (admin/member/viewer), proyectos y tareas compartidas, además del espacio personal
- **Notificaciones** — In-app (campana) + Web Push (VAPID) + recordatorios por cron; badge con pendientes en el ícono de la PWA
- **Offline** — Los cambios de estado hechos sin conexión se encolan en IndexedDB y se sincronizan al volver la conexión, detectando conflictos de versión
- **Adjuntos PDF** — Subida/borrado por tarea y bloque, con presigned URL de Vercel Blob
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
│   │   ├── blob-upload/ # Presigned URL de Vercel Blob (valida sesión)
│   │   ├── cron/        # reminders + moodle-sync (auth con CRON_SECRET)
│   │   └── push/        # Alta/baja de suscripciones Web Push
│   └── layout.tsx       # Root (ThemeProvider + anti-flash script)
├── db/
│   ├── schema.ts        # Esquema Drizzle (15 tablas)
│   ├── mappers.ts       # Filas → tipos de dominio
│   └── index.ts         # Pool postgres.js + cliente Drizzle
├── features/
│   ├── auth/            # Login, register, sesión, perfil, password
│   ├── tasks/           # CRUD + calendario + kanban + horario
│   ├── projects/        # CRUD
│   ├── categories/      # CRUD
│   ├── events/          # Eventos de calendario
│   ├── schedule/        # Bloques de horario
│   ├── files/           # Adjuntos PDF
│   ├── moodle/          # Sync Moodle (cliente, parser, crypto, sync)
│   ├── workspaces/      # Espacios con roles y miembros
│   ├── collaboration/   # Compartir proyectos (project_members)
│   ├── comments/        # Comentarios en tareas
│   ├── notifications/   # Campana in-app, preferencias, push
│   └── inbox/           # Query + lista
├── lib/
│   ├── auth/session.ts  # getSession / requireSession / createSession
│   ├── access.ts        # Permisos: proyecto / workspace / tarea
│   ├── errors.ts        # AppError, ConflictError, ActionResult<T>
│   ├── offline-queue.ts # Cola IndexedDB + flush con chequeo de versión
│   ├── reminder-service.ts / moodle-cron-service.ts  # Barridos de cron
│   ├── validations/     # Schemas Zod
│   └── utils.ts         # cn()
├── types/               # Task, Project, Category, etc.
└── proxy.ts             # Session cookie → login redirect
drizzle/                 # Migraciones SQL generadas
public/sw.js             # Service worker (precache, push, background sync)
scripts/                 # Migraciones one-off + crontab del sidecar
docker-compose.yml       # Producción: web + postgres + cron
docker-compose.dev.yml   # Desarrollo: solo postgres
Dockerfile               # Build multi-stage (output standalone)
```

## Modelo de datos

PostgreSQL (15 tablas) con foreign keys y ownership por `user_id`:

```
users(id, email UNIQUE, display_name, photo_url, password_hash, role)
sessions(id = sha256(token), user_id FK, expires_at)
projects(id, user_id FK, workspace_id FK SET NULL, name, sort_order, moodle_*)
categories(id, user_id FK, name UNIQUE(user), color)
tasks(id, user_id FK, project_id FK SET NULL, parent_id, assignee_id FK, status,
      priority, due_date, categories text[], pdf_url/pdf_name, moodle_*,
      reminder_at/reminder_sent_at, ...)
calendar_events(id, user_id FK, date/dia_semana, start/end_time)
schedule_blocks(id, user_id FK, day_of_week, start/end_time, pdf_url)
moodle_credentials(id, user_id FK, platform UNIQUE(user), password cifrado AES-256-GCM)

-- Colaboración
workspaces(id, name, color, created_by FK SET NULL)
workspace_members(PK workspace_id + user_id, role admin|member|viewer, invited_by)
project_members(PK project_id + user_id, role editor|viewer, invited_by)
task_comments(id, task_id FK, user_id FK, body)

-- Notificaciones
notifications(id, user_id FK, type, title, body, url, actor_id FK SET NULL, read_at)
notification_preferences(id, user_id FK UNIQUE, reminder_push, reminder_email)
push_subscriptions(id, user_id FK, endpoint UNIQUE, p256dh, auth)
```

`projects.workspace_id` en NULL = espacio personal.

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

```
# Supabase: transaction pooler (:6543) para la app, session pooler (:5432)
# o conexión directa para migraciones con drizzle-kit.
DATABASE_URL=postgres://postgres.<ref>:password@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require
BLOB_READ_WRITE_TOKEN=<token del store de Vercel Blob>
MOODLE_ENCRYPTION_KEY=<hex 32 bytes>   # openssl rand -hex 32
CRON_SECRET=<hex 24 bytes>             # openssl rand -hex 24
REMINDERS_CRON_SCHEDULE=0 14 * * *     # barrido diario en UTC (= 09:00 Panamá)
MOODLE_SYNC_CRON_SCHEDULE=0 11 * * *   # sync de Moodle en UTC (= 06:00 Panamá)
```

## Desarrollo

Desarrollo va **contra Supabase**, la misma base que producción (el Postgres
local en Docker quedó descartado). Trae las variables desde Vercel con
`vercel env pull` o copia la cadena desde el dashboard de Supabase
(Project Settings → Database → Connection string).

```bash
# Instalar dependencias
npm install

# Aplicar migraciones
# Ojo: usa la cadena del session pooler (:5432) o la conexión directa.
# El transaction pooler (:6543) no soporta lo que necesita drizzle-kit.
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

El compose levanta además el sidecar `cron` (imagen `busybox`, script
`scripts/cron-jobs.sh`), que actúa como crontab para dos barridos diarios,
ambos autenticados con `CRON_SECRET`:

- `/api/cron/reminders` (`REMINDERS_CRON_SCHEDULE`, default 09:00 Panamá) —
  recordatorios vencidos. Mientras la app está abierta también se entregan al
  instante vía el polling del cliente; el cron cubre a los usuarios inactivos.
- `/api/cron/moodle-sync` (`MOODLE_SYNC_CRON_SCHEDULE`, default 06:00 Panamá) —
  sincroniza Moodle para **todas** las credenciales guardadas (con espera
  aleatoria entre logins) y notifica cuando una tarea ya importada cambia de
  fecha o de título.

En Vercel los mismos endpoints se disparan por `vercel.json` (`crons`). Ojo:
el plan Hobby limita la frecuencia de los cron jobs a una vez al día.

La app corre como usuario no-root, escucha en el puerto 3000 (`HOSTNAME=0.0.0.0`) y usa output standalone (~150 MB). Para HTTPS, poner un reverse proxy (Caddy/nginx/Traefik) delante del puerto 3000.

## Licencia

Proyecto privado — Daytuba.
