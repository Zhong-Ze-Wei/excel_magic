import { describe, it, expect, vi, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import CleaningView from '../views/CleaningView.vue'
import { useDataShareStore } from '../stores/dataShare'

vi.mock('../composables/useDevice', () => ({ useDevice: () => ({ isMobile: ref(true) }) }))
let wrapper
afterEach(() => wrapper?.unmount())

describe('手机专家清洗审计', () => {
  it('有清洗行时正常渲染状态，并能覆写决策', async () => {
    localStorage.clear()
    const pinia = createPinia()
    setActivePinia(pinia)
    useDataShareStore().setSharedData(['评论'], [['正常评论'], ['']])
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] })
    await router.push('/')
    const errorHandler = vi.fn()
    wrapper = mount(CleaningView, { global: { plugins: [pinia, router], config: { errorHandler }, stubs: { StatsPieChart: true } } })
    await nextTick()
    expect(errorHandler).not.toHaveBeenCalled()
    const audit = wrapper.findAll('table').at(-1)
    expect(audit.findAll('tbody tr')).toHaveLength(2)
    const row = audit.findAll('tbody tr')[0]
    await row.findAll('button')[1].trigger('click')
    expect(row.text()).toContain('已删除')
    expect(errorHandler).not.toHaveBeenCalled()
  })
})
