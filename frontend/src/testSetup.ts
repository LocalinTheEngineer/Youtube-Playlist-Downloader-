import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(cleanup)

export class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = []
  url: string
  closed = false
  constructor(url: string) { super(); this.url = url; FakeEventSource.instances.push(this) }
  close() { this.closed = true }
  emit(data: unknown) { this.dispatchEvent(new MessageEvent('progress', { data: JSON.stringify(data) })) }
}

vi.stubGlobal('EventSource', FakeEventSource)
