export const dynamic = 'force-static'

export function GET() {
  // Return a 1x1 transparent ICO to silence the 404 in dev.
  const ico = Buffer.from(
    'AAABAAEAAQEAAAEAIAAwAAAAFgAAACgAAAABAAAAAgAAAAEAIAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'base64'
  )
  return new Response(ico, {
    headers: {
      'content-type': 'image/x-icon',
      'cache-control': 'public, max-age=86400',
    },
  })
}