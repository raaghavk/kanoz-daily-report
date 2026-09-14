import { describe, it, expect } from 'vitest'
import { answerDemoQuestion } from '../answers'
import { createDemoSeed } from '../seed'

describe('demo insights answers', () => {
  const db = createDemoSeed()

  it('prefixes every answer as sample data', () => {
    const a = answerDemoQuestion('Production this month', { fn: 'ai-query', db })
    expect(a).toMatch(/sample data only/i)
    expect(a).toMatch(/MT/)
  })

  it('summarises pending payments from the seed', () => {
    const a = answerDemoQuestion('Pending payments', { fn: 'ai-query', db })
    expect(a).toMatch(/Pending/i)
    expect(a).toMatch(/RM-/)
  })

  it('refuses live weather on plant-chat', () => {
    const a = answerDemoQuestion('What is the weather?', { fn: 'plant-chat', db })
    expect(a).toMatch(/weather is turned off/i)
  })
})
