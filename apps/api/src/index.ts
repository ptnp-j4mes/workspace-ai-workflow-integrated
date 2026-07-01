import { app } from './app'

const PORT = Number(process.env.PORT ?? 3011)

app.listen(PORT, () => {
  console.log(`api listening on :${PORT}`)
})
