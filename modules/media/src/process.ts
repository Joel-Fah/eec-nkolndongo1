/** Browser side: hands a photo to the processing worker and waits for the variants. */

import type { ProcessIn, ProcessOut } from './process.worker.ts'
import { VARIANT_WIDTHS } from './rules.ts'

let worker: Worker | undefined
const waiting = new Map<string, (out: ProcessOut) => void>()

function get() {
  if (!worker) {
    worker = new Worker(new URL('./process.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<ProcessOut>) => {
      waiting.get(e.data.id)?.(e.data)
      waiting.delete(e.data.id)
    }
  }
  return worker
}

export function processImage(
  file: File,
  widths: readonly number[] = VARIANT_WIDTHS,
): Promise<ProcessOut> {
  return new Promise((resolve) => {
    const id = crypto.randomUUID()
    waiting.set(id, resolve)
    get().postMessage({ id, file, widths: [...widths] } satisfies ProcessIn)
  })
}
