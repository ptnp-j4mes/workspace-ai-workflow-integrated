import { app } from './app'

if (process.env.NODE_ENV === 'production') {
  for (const key of ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGIN', 'API_PUBLIC_URL', 'FRONTEND_URL']) {
    if (!process.env[key]) {
      throw new Error(`${key} env var is required in production`)
    }
  }
}

const PORT = Number(process.env.PORT ?? 3011)

app.listen(PORT, () => {
  console.log(`api listening on :${PORT}`)
})
