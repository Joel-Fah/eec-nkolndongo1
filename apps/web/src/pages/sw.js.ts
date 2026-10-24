/** `/sw.js` at the root (so its scope is the whole site), stamped with this build so old caches are dropped on activate. */
import type { APIRoute } from 'astro'
import source from '../sw/sw.js?raw'

export const prerender = true
// A build-time stamp (astro.config): the worker's bytes change on every deploy, which is what makes browsers fetch the new one.
const BUILD = import.meta.env.PUBLIC_BUILD_ID

export const GET: APIRoute = () =>
  new Response(source.replace('__BUILD__', BUILD), {
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      // The browser must always look for a newer worker.
      'cache-control': 'no-cache',
      'service-worker-allowed': '/',
    },
  })
