import { describe, it, expect } from 'bun:test'
import { splitScope } from './splitter'
import { EnvKind } from '../types/EnvKind'

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

    it('splits HTML-like props by spaces, preserving quoted class value', () => {
        const scope = 'class="bg red large" id="i1"'
        const chunks = splitScope(scope, EnvKind.ReactComponent)
        expect(texts(chunks)).toEqual(['class="bg red large"', ' ', 'id="i1"'])
    })

    it('splits class list content by spaces respecting Tailwind arbitrary values', () => {
        const scope = "bg [content:'a b'] hover:[&>*]:text-sm"
        const chunks = splitScope(scope, EnvKind.ClassList)
        expect(texts(chunks)).toEqual([
            'bg',
            ' ',
            "[content:'a b']",
            ' ',
            'hover:[&>*]:text-sm',
        ])
    })

    it('splits function params with string arguments', () => {
        const scope = 'varA, vatB, "something"'
        const chunks = splitScope(scope, EnvKind.FunctionParams)
        expect(texts(chunks)).toEqual(['varA', ', ', 'vatB', ', ', '"something"'])
    })

    it('does not split inside string literals in function params', () => {
        const scope = 'varA, "hello, world", varC'
        const chunks = splitScope(scope, EnvKind.FunctionParams)
        expect(texts(chunks)).toEqual(['varA', ', ', '"hello, world"', ', ', 'varC'])
    })

    it('handles single quotes in function params', () => {
        const scope = "varA, 'hello, world', varC"
        const chunks = splitScope(scope, EnvKind.FunctionParams)
        expect(texts(chunks)).toEqual(['varA', ', ', "'hello, world'", ', ', 'varC'])
    })

    it('handles template literals in function params', () => {
        const scope = 'varA, `hello, ${x}`, varC'
        const chunks = splitScope(scope, EnvKind.FunctionParams)
        expect(texts(chunks)).toEqual(['varA', ', ', '`hello, ${x}`', ', ', 'varC'])
    })

    it('handles escaped quotes in function params', () => {
        const scope = 'varA, "hello, \\"world", varC'
        const chunks = splitScope(scope, EnvKind.FunctionParams)
        expect(texts(chunks)).toEqual(['varA', ', ', '"hello, \\"world"', ', ', 'varC'])
    })

    it('handles mixed nested brackets and strings in arrays', () => {
        const scope = '1, [2, "a, b"], "c, d"'
        const chunks = splitScope(scope, EnvKind.Array)
        expect(texts(chunks)).toEqual(['1', ', ', '[2, "a, b"]', ', ', '"c, d"'])
    })

    it('does not treat brackets inside strings as nesting in function params', () => {
        const scope = 'a, "text [with, brackets]", b'
        const chunks = splitScope(scope, EnvKind.FunctionParams)
        expect(texts(chunks)).toEqual(['a', ', ', '"text [with, brackets]"', ', ', 'b'])
    })

    it('does not treat curly braces inside strings as nesting in function params', () => {
        const scope = 'a, "text {with, braces}", b'
        const chunks = splitScope(scope, EnvKind.FunctionParams)
        expect(texts(chunks)).toEqual(['a', ', ', '"text {with, braces}"', ', ', 'b'])
    })

    it('does not treat parentheses inside strings as nesting in function params', () => {
        const scope = 'a, "text (with, parens)", b'
        const chunks = splitScope(scope, EnvKind.FunctionParams)
        expect(texts(chunks)).toEqual(['a', ', ', '"text (with, parens)"', ', ', 'b'])
    })

    it('handles all bracket types inside strings', () => {
        const scope = 'a, "[{(,)}]", b'
        const chunks = splitScope(scope, EnvKind.FunctionParams)
        expect(texts(chunks)).toEqual(['a', ', ', '"[{(,)}]"', ', ', 'b'])
    })

    it('handles strings inside nested brackets in arrays', () => {
        const scope = '1, {key: "value, with, commas"}, 2'
        const chunks = splitScope(scope, EnvKind.Array)
        expect(texts(chunks)).toEqual([
            '1',
            ', ',
            '{key: "value, with, commas"}',
            ', ',
            '2',
        ])
    })

    it('handles deeply nested structures with strings', () => {
        const scope = 'a, {x: [1, "a, b", 2]}, c'
        const chunks = splitScope(scope, EnvKind.FunctionParams)
        expect(texts(chunks)).toEqual(['a', ', ', '{x: [1, "a, b", 2]}', ', ', 'c'])
    })
})
