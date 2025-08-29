import { describe, it, expect } from 'bun:test'
import { computeSwapForLine } from './brackets'

describe('computeSwapForLine', () => {
    it('swaps inside array with commas to the right', () => {
        const line = '[ a, b, c ]'
        const cursor = line.indexOf('a')
        const { result } = computeSwapForLine(line, cursor, 1)
        expect(result?.newBracketText).toBe('[ b, a, c ]')
    })

    it('swaps inside array with commas to the left', () => {
        const line = '[ a, b, c ]'
        const cursor = line.indexOf('b')
        const { result } = computeSwapForLine(line, cursor, -1)
        expect(result?.newBracketText).toBe('[ b, a, c ]')
    })

    it('swaps inside object braces', () => {
        const line = '{ x, y, z }'
        const cursor = line.indexOf('y')
        const { result } = computeSwapForLine(line, cursor, 1)
        expect(result?.newBracketText).toBe('{ x, z, y }')
    })

    it('does nothing when at edge moving out of range', () => {
        const line = '[ a, b ]'
        const cursor = line.indexOf('b')
        const { result } = computeSwapForLine(line, cursor, 1)
        expect(result).toBeUndefined()
    })
})
