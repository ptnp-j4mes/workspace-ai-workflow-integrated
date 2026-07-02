import { app } from './app'

// JWT_SECRET is validated by src/lib/auth.ts (same NODE_ENV=development/test allowlist as below).
if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
  for (const key of ['DATABASE_URL', 'CORS_ORIGIN', 'API_PUBLIC_URL', 'FRONTEND_URL']) {
    if (!process.env[key]) {
      throw new Error(`${key} env var is required outside NODE_ENV=development/test`)
    }
  }
}

const PORT = Number(process.env.PORT ?? 3011)

app.listen(PORT, () => {
  console.log(`api listening on :${PORT}`)
})
