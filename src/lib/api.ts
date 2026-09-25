export class ApiError extends Error {
  constructor(public status: number, message: string, public field?: string) { super(message) }
}

async function parse(res: Response) {
  if (res.ok) return res.status === 204 ? null : res.json()
  let msg = `Request failed (${res.status}).`
  let field: string | undefined
  try { const j = await res.json(); msg = j.error ?? msg; field = j.field } catch { /* not JSON */ }
  if (res.status === 401 && !location.pathname.startsWith('/login')) {
    const next = encodeURIComponent(location.pathname + location.search)
    location.assign(`/login?next=${next}&expired=1`)
  }
  throw new ApiError(res.status, msg, field)
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined && !(body instanceof FormData) ? { 'content-type': 'application/json' } : undefined,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Can’t reach the Hisab server. Check it’s running and try again.')
  }
  return parse(res) as Promise<T>
}

export const api = {
  get: <T>(p: string) => send<T>('GET', p),
  post: <T>(p: string, b?: unknown) => send<T>('POST', p, b ?? {}),
  put: <T>(p: string, b?: unknown) => send<T>('PUT', p, b ?? {}),
  del: <T>(p: string) => send<T>('DELETE', p),
}

/** Download a file from the API, surfacing server errors as messages instead of saving an error page. */
export async function download(path: string): Promise<string> {
  const res = await fetch(path, { credentials: 'same-origin' })
  if (!res.ok) await parse(res)
  const cd = res.headers.get('content-disposition') ?? ''
  const name = decodeURIComponent(/filename\*=UTF-8''([^;]+)/.exec(cd)?.[1] ?? /filename="([^"]+)"/.exec(cd)?.[1] ?? 'download')
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
  return name
}
