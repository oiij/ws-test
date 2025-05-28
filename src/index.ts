/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

let count = 0
async function handleSession(request: Request, socket: WebSocket) {
  socket.accept()
  count += 1
  socket.send(`connected, you are visitor number ${count}!`)
  socket.addEventListener('message', (ev) => {
    socket.send(`You said: ${ev.data}`)
  })
  socket.addEventListener('close', () => {
    count -= 1
    socket.close()
  })
}
async function websocketHandler(request: Request) {
  const upgradeHeader = request.headers.get('Upgrade')
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected websocket', { status: 400 })
  }

  const [client, server] = Object.values(new WebSocketPair())

  await handleSession(request, server)

  return new Response(null, {
    status: 101,
    webSocket: client,
  })
}
async function sseHandler(request: Request) {
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()
  const interval = setInterval(() => {
    writer.write(encoder.encode(`data: ${new Date().toISOString()}\n\n`))
  }, 1000 * 5)
  request.signal.addEventListener('abort', () => {
    clearInterval(interval)
    writer.close()
  })
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    },

  })
}
export default {
  async fetch(request, _env, _ctx): Promise<Response> {
    try {
      const url = new URL(request.url)
      if (url.pathname === '/ws') {
        return websocketHandler(request)
      }
      if (url.pathname === '/sse') {
        return sseHandler(request)
      }
      return new Response('Not found', { status: 404 })
    }
    catch (err: any) {
      return new Response(err.toString())
    }
  },
} satisfies ExportedHandler<Env>
