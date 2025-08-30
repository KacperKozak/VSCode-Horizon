import { describe, it, expect } from 'bun:test'
import { detectEnvironment } from './detector'
import { EnvKind } from '~/types/EnvKind'

describe('detectEnvironment', () => {
    it('detects array environment (cursor at: 3)', () => {
        const line = '[ 1, 2, 3, 4 ]'
        const cursor = line.indexOf('3')
        const detection = detectEnvironment(line, cursor)
        expect(detection.env).toBe(EnvKind.Array)
    })

    it('detects object environment when cursor inside object', () => {
        const line = '{ a: 1, b: 2 }'
        const cursor = line.indexOf('b')
        const detection = detectEnvironment(line, cursor)
        expect(detection.env).toBe(EnvKind.Object)
    })

    it('detects react component environment', () => {
        const line = '<Component somePros={x} here="aa" />'
        const cursor = line.indexOf('Component')
        const detection = detectEnvironment(line, cursor)
        expect(detection.env).toBe(EnvKind.ReactComponent)
    })

    it('detects function params environment', () => {
        const line = '(key: Key, value: number) => {}'
        const cursor = line.indexOf('Key')
        const detection = detectEnvironment(line, cursor)
        expect(detection.env).toBe(EnvKind.FunctionParams)
    })

    it('detects logical expression environment', () => {
        const line = 'if (some && condition || here)'
        const cursor = line.indexOf('condition')
        const detection = detectEnvironment(line, cursor)
        expect(detection.env).toBe(EnvKind.Logical)
    })

    it('detects union environment', () => {
        const line = "type Union = 'a' | 'b' | 'c'"
        const cursor = line.indexOf("'b'")
        const detection = detectEnvironment(line, cursor)
        expect(detection.env).toBe(EnvKind.Union)
    })

    it('detects nested object inside array (cursor inside object)', () => {
        const line = '[ {a:1, b:2}, 1, 2, 3 ]'
        const cursor = line.indexOf('a')
        const detection = detectEnvironment(line, cursor)
        expect(detection.env).toBe(EnvKind.Object)
    })

    it('detects outer array when cursor on array item after nested object', () => {
        const line = '[ {a:1, b:2}, 1, 2, 3 ]'
        const afterObjectComma = line.indexOf('},')
        const cursor = afterObjectComma + 6 // points to the '2' in ', 1, 2, 3'
        const detection = detectEnvironment(line, cursor)
        expect(detection.env).toBe(EnvKind.Array)
    })

    it('detects array inside object (cursor inside first array)', () => {
        const line = '{ a: [1,2,3], b: [4,5,6] }'
        const cursor = line.indexOf('2')
        const detection = detectEnvironment(line, cursor)
        expect(detection.env).toBe(EnvKind.Array)
    })

    it('detects array inside object (cursor inside second array)', () => {
        const line = '{ a: [1,2,3], b: [4,5,6] }'
        const cursor = line.lastIndexOf('5')
        const detection = detectEnvironment(line, cursor)
        expect(detection.env).toBe(EnvKind.Array)
    })

    it('detects object environment when cursor on property name', () => {
        const line = '{ a: [1,2,3], b: [4,5,6] }'
        const cursor = line.indexOf('a')
        const detection = detectEnvironment(line, cursor)
        expect(detection.env).toBe(EnvKind.Object)
    })

    it('computes scope for array within a larger assignment', () => {
        const line = 'const a: SomeType = [1, 2, 3]'
        const cursor = line.indexOf('2')
        const detection = detectEnvironment(line, cursor)
        expect(detection.env).toBe(EnvKind.Array)
        // scope should be content inside brackets, positions of '1' and '3'
        expect(detection.scope?.[0]).toBe(line.indexOf('1'))
        expect(detection.scope?.[1]).toBe(line.indexOf('3'))
    })

    it('computes scope for object within a larger assignment', () => {
        const line = 'const my = { a: 1, b: 2 } // trailing'
        const cursor = line.indexOf('b')
        const detection = detectEnvironment(line, cursor)
        expect(detection.env).toBe(EnvKind.Object)
        expect(detection.scope?.[0]).toBe(line.indexOf('a'))
        expect(detection.scope?.[1]).toBe(line.indexOf('2'))
    })
})
