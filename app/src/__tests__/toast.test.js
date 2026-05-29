import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useToast } from '../services/toast'

describe('useToast', () => {
  const toast = useToast()

  beforeEach(() => {
    vi.useFakeTimers()
    toast.clearAll()
  })

  it('show() 添加一条 toast', () => {
    toast.show('hello', 'info', 99999)
    expect(toast.toasts.value).toHaveLength(1)
    expect(toast.toasts.value[0].message).toBe('hello')
    expect(toast.toasts.value[0].type).toBe('info')
  })

  it('success/error/info/warn 设置正确的 type', () => {
    toast.success('ok')
    toast.error('fail')
    toast.info('hint')
    toast.warn('careful')
    expect(toast.toasts.value.map(t => t.type)).toEqual(['success', 'error', 'info', 'warn'])
  })

  it('duration 后自动 dismiss', () => {
    toast.show('temp', 'info', 2000)
    expect(toast.toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(2000)
    expect(toast.toasts.value).toHaveLength(0)
  })

  it('dismiss 手动移除', () => {
    toast.show('stay', 'info', 99999)
    const id = toast.toasts.value[0].id
    toast.dismiss(id)
    expect(toast.toasts.value).toHaveLength(0)
  })
})
