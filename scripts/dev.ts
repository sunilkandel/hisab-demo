// Starts the API server (watch mode, :3001) and Vite (:5173) together; Ctrl+C stops both.
const procs = [
  Bun.spawn(['bun', '--watch', 'server/index.ts'], { stdout: 'inherit', stderr: 'inherit' }),
  Bun.spawn(['bunx', 'vite'], { stdout: 'inherit', stderr: 'inherit' }),
]
const stop = () => { for (const p of procs) p.kill(); process.exit(0) }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
await Promise.race(procs.map((p) => p.exited))
stop()
