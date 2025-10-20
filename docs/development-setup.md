# Local Development Setup

This guide covers setting up the RFP Agent application for local development using Docker.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ and pnpm installed
- Git

## Quick Start

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd rfpagent
pnpm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

The default configuration in `.env.local` is already set up for Docker-based local development:

```env
# Local Docker PostgreSQL
DATABASE_URL="postgresql://rfpuser:rfppassword@localhost:5432/rfpagent"
USE_NEON="false"

# Local Docker Redis
REDIS_URL="redis://localhost:6379"
```

### 3. Start Docker Services

Start PostgreSQL and Redis containers:

```bash
docker-compose up -d postgres redis
```

Verify services are running:

```bash
docker-compose ps
```

You should see:
- `rfp-agent-postgres` - running on port 5432
- `rfp-agent-redis` - running on port 6379

### 4. Run Database Migrations

Initialize the database schema:

```bash
pnpm db:migrate
```

### 5. Start Development Server

```bash
pnpm dev
```

The application will be available at http://localhost:5001

## Database Configuration

### Local Development (Default)

The application automatically detects local databases and uses the standard PostgreSQL driver:

- **Host**: localhost
- **Port**: 5432
- **Database**: rfpagent
- **User**: rfpuser
- **Password**: rfppassword

### Driver Selection

The application in [server/db.ts](/server/db.ts) automatically selects the appropriate database driver:

1. **Local Detection**: Checks if `DATABASE_URL` points to localhost
2. **Override**: Use `USE_NEON` environment variable to force driver selection
   - `USE_NEON="false"` → Standard PostgreSQL (node-postgres)
   - `USE_NEON="true"` → Neon serverless driver

### Production Deployment

For production on Fly.io with Postgres:

```env
DATABASE_URL="postgresql://user:password@your-app.internal:5432/rfpagent?sslmode=require"
USE_NEON="false"
```

For production using Neon Database:

```env
DATABASE_URL="postgresql://user:password@ep-xxxxx.aws.neon.tech/database?sslmode=require"
USE_NEON="true"
```

## Docker Services

### PostgreSQL

Access the database directly:

```bash
docker exec -it rfp-agent-postgres psql -U rfpuser -d rfpagent
```

View logs:

```bash
docker-compose logs -f postgres
```

### Redis

Access Redis CLI:

```bash
docker exec -it rfp-agent-redis redis-cli
```

View logs:

```bash
docker-compose logs -f redis
```

## Common Tasks

### Reset Database

Stop containers and remove volumes:

```bash
docker-compose down -v
docker-compose up -d postgres redis
pnpm db:migrate
```

### Update Database Schema

After modifying schema files:

```bash
pnpm db:generate  # Generate migration
pnpm db:migrate   # Apply migration
```

### Stop All Services

```bash
docker-compose down
```

### View All Logs

```bash
docker-compose logs -f
```

## Troubleshooting

### Connection Refused

If you see `ECONNREFUSED` errors:

1. Verify Docker services are running:
   ```bash
   docker-compose ps
   ```

2. Check if ports are available:
   ```bash
   lsof -i :5432  # PostgreSQL
   lsof -i :6379  # Redis
   ```

3. Restart Docker services:
   ```bash
   docker-compose restart postgres redis
   ```

### Database Migration Errors

If migrations fail:

1. Check database connection:
   ```bash
   docker exec -it rfp-agent-postgres pg_isready -U rfpuser
   ```

2. Verify DATABASE_URL in `.env.local`

3. Reset database if needed (see Reset Database section)

### Port Conflicts

If ports 5432 or 6379 are already in use:

1. Stop conflicting services
2. Or modify ports in `docker-compose.yml`:
   ```yaml
   ports:
     - "5433:5432"  # Use 5433 instead
   ```
   Then update `DATABASE_URL` accordingly.

## Development Workflow

1. **Start Docker services** before development
2. **Run migrations** when pulling schema changes
3. **Use `.env.local`** for local configuration (git-ignored)
4. **Never commit** API keys or secrets
5. **Stop services** when done: `docker-compose down`

## Next Steps

- [API Documentation](/docs/api/README.md)
- [Database Schema](/docs/architecture/database-schema.md)
- [Contributing Guide](/CONTRIBUTING.md)
