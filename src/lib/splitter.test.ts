import { describe, it, expect } from 'bun:test'
import { splitScope } from './splitter'
import { EnvKind } from '~/types/EnvKind'

const texts = (chunks: { text: string }[]) => chunks.map((c) => c.text)
const kinds = (chunks: { kind: string }[]) => chunks.map((c) => c.kind)

describe('splitScope', () => {
    it('splits simple array by top-level commas preserving separators', () => {
        const scope = '1, 2, 3'
        const chunks = splitScope(scope, EnvKind.Array)
        expect(kinds(chunks)).toEqual([
            'element',
            'separator',
            'element',
            'separator',
            'element',
        ])
        expect(texts(chunks)).toEqual(['1', ', ', '2', ', ', '3'])
    })

    it('does not split inside nested brackets in arrays', () => {
        const scope = '1, [2, 3], 4'
        const chunks = splitScope(scope, EnvKind.Array)
        expect(texts(chunks)).toEqual(['1', ', ', '[2, 3]', ', ', '4'])
    })

    it('splits simple object properties by top-level commas', () => {
        const scope = 'a: 1, b: 2'
        const chunks = splitScope(scope, EnvKind.Object)
        expect(kinds(chunks)).toEqual(['element', 'separator', 'element'])
        expect(texts(chunks)).toEqual(['a: 1', ', ', 'b: 2'])
    })

    it('splits function params by top-level commas', () => {
        const scope = 'a: A, b: B'
        const chunks = splitScope(scope, EnvKind.FunctionParams)
        expect(texts(chunks)).toEqual(['a: A', ', ', 'b: B'])
    })

    it('handles nested arrays inside arrays', () => {
        const scope = '1, [2, [3, 4], 5], 6'
        const chunks = splitScope(scope, EnvKind.Array)
        expect(texts(chunks)).toEqual(['1', ', ', '[2, [3, 4], 5]', ', ', '6'])
    })

    it('handles nested objects and arrays inside object', () => {
        const scope = 'a: [1, 2], b: { x: 1, y: 2 }, c: 3'
        const chunks = splitScope(scope, EnvKind.Object)
        expect(texts(chunks)).toEqual([
            'a: [1, 2]',
            ', ',
            'b: { x: 1, y: 2 }',
            ', ',
            'c: 3',
        ])
    })

    it('splits unions by top-level pipes', () => {
        const scope = "'a' | 'b' | 'c'"
        const chunks = splitScope(scope, EnvKind.Union)
        expect(kinds(chunks)).toEqual([
            'element',
            'separator',
            'element',
            'separator',
            'element',
        ])
        expect(texts(chunks)).toEqual(["'a'", ' | ', "'b'", ' | ', "'c'"])
    })

    it('splits logical expressions by top-level && and ||', () => {
        const scope = 'a && b || c && d'
        const chunks = splitScope(scope, EnvKind.Logical)
        expect(texts(chunks)).toEqual(['a', ' && ', 'b', ' || ', 'c', ' && ', 'd'])
    })

    it('splits react props by spaces, respecting braces and quotes', () => {
        const scope = 'a={x} b="y z" c'
        const chunks = splitScope(scope, EnvKind.ReactComponent)
        expect(texts(chunks)).toEqual(['a={x}', ' ', 'b="y z"', ' ', 'c'])
    })

    it('splits react props with array, callback and object values', () => {
        const scope =
            'items={[1, 2]} onClick={(event, config) => doX(event, config)} config={{a:1, b:2}}'
        const chunks = splitScope(scope, EnvKind.ReactComponent)
        expect(texts(chunks)).toEqual([
            'items={[1, 2]}',
            ' ',
            'onClick={(event, config) => doX(event, config)}',
            ' ',
            'config={{a:1, b:2}}',
        ])
    })

    it('splits react className with multiple spaces preserved as part of prop', () => {
        const scope = 'className="bg red large" data-id={1}'
        const chunks = splitScope(scope, EnvKind.ReactComponent)
        expect(texts(chunks)).toEqual(['className="bg red large"', ' ', 'data-id={1}'])
    })
})
