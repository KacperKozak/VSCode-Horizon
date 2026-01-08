import { describe, it, expect } from 'bun:test'
import { manipulateLine } from './manipulator'
import { codeCursor } from '../utils/tests'

describe('manipulateLine', () => {
    it('moves array element right within brackets', () => {
        const from = codeCursor('const a = [┇1, 2, 3, 4]')
        const to = codeCursor('const a = [2, ┇1, 3, 4]')

        const { text, cursor } = manipulateLine(from.code, from.cursor, +1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('moves array element left within brackets', () => {
        const from = codeCursor('[aaa, bb┇b, ccc]')
        const to = codeCursor('[bb┇b, aaa, ccc]')

        const { text, cursor } = manipulateLine(from.code, from.cursor, -1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('does not move when out of range', () => {
        const from = codeCursor('[┇a, b]')

        const { text, cursor } = manipulateLine(from.code, from.cursor, -1)
        expect(text).toBe(from.code)
        expect(cursor).toBe(from.cursor)
    })

    it('moves object property right', () => {
        const from = codeCursor('const o = { a: 1, b:┇ 2, c: 3 }')
        const to = codeCursor('const o = { a: 1, c: 3, b:┇ 2 }')

        const { text, cursor } = manipulateLine(from.code, from.cursor, +1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('moves function param to the left', () => {
        const from = codeCursor('(x, y, ┇z) => {}')
        const to = codeCursor('(x, ┇z, y) => {}')

        const { text, cursor } = manipulateLine(from.code, from.cursor, -1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('moves function param right', () => {
        const from = codeCursor('(x: A, ┇y: B, z: C) => {}')
        const to = codeCursor('(x: A, z: C, ┇y: B) => {}')

        const { text, cursor } = manipulateLine(from.code, from.cursor, +1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('moves union member left by two', () => {
        const from = codeCursor('type U = Aaa | Bbb | Ccc | ┇Ddd')
        const to = codeCursor('type U = Aaa | ┇Ddd | Bbb | Ccc')

        const { text, cursor } = manipulateLine(from.code, from.cursor, -2)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('moves mixed union member left', () => {
        const from = codeCursor(
            'type U = Simple | Generic<T, X> | [string, number] | { a: number } | ┇never',
        )
        const to = codeCursor(
            'type U = Simple | Generic<T, X> | ┇never | [string, number] | { a: number }',
        )

        const { text, cursor } = manipulateLine(from.code, from.cursor, -2)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('reorders react props', () => {
        const from = codeCursor('<C a={1} ┇b="x" c />')
        const to = codeCursor('<C ┇b="x" a={1} c />')

        const { text, cursor } = manipulateLine(from.code, from.cursor, -1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('reorders react props with nested values intact', () => {
        const from = codeCursor('<C items={[1,2]} onClick={() => x()} ┇cfg={{a:1}} />')
        const to = codeCursor('<C ┇cfg={{a:1}} items={[1,2]} onClick={() => x()} />')

        const { text, cursor } = manipulateLine(from.code, from.cursor, -2)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('reorders array inside a prop', () => {
        const from = codeCursor('<C items={[1, ┇2, 3]} data-id={1} />')
        const to = codeCursor('<C items={[1, 3, ┇2]} data-id={1} />')

        const { text, cursor } = manipulateLine(from.code, from.cursor, +1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('in understands react JSX as a const', () => {
        const from = codeCursor('const x = <C items={[1, 2, 3]} ┇data-id={1} />')
        const to = codeCursor('const x = <C ┇data-id={1} items={[1, 2, 3]} />')

        const { text, cursor } = manipulateLine(from.code, from.cursor, -1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('reorders arguments inside a prop', () => {
        const from = codeCursor('<C onClick={(a, ┇x, b) => x()} data-id={1} />')
        const to = codeCursor('<C onClick={(┇x, a, b) => x()} data-id={1} />')

        const { text, cursor } = manipulateLine(from.code, from.cursor, -1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('reorders react props with className containing spaces', () => {
        const from = codeCursor('<C className="bg red large" ┇data-id={1} />')
        const to = codeCursor('<C ┇data-id={1} className="bg red large" />')

        const { text, cursor } = manipulateLine(from.code, from.cursor, -1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('reorders logical items', () => {
        const from = codeCursor('if (a && ┇b)')
        const to = codeCursor('if (┇b && a)')

        const { text, cursor } = manipulateLine(from.code, from.cursor, -1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('reorders logical items across || clauses', () => {
        const from = codeCursor('if (a && b || ┇c && d)')
        const to = codeCursor('if (a && ┇c || b && d)')

        const { text, cursor } = manipulateLine(from.code, from.cursor, -1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('reorders logical items across multiple ||', () => {
        const from = codeCursor('if (a || b || ┇c || d)')
        const to = codeCursor('if (a || ┇c || b || d)')

        const { text, cursor } = manipulateLine(from.code, from.cursor, -1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('reorders logical items across multiple || in multiline if statement', () => {
        const from = codeCursor('a || b || ┇c || d')
        const to = codeCursor('a || ┇c || b || d')

        const { text, cursor } = manipulateLine(from.code, from.cursor, -1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('reorders classes inside HTML class attribute', () => {
        const from = codeCursor('<div class="bg red ┇large"></div>')
        const to = codeCursor('<div class="bg ┇large red"></div>')

        const { text, cursor } = manipulateLine(from.code, from.cursor, -1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('reorders plain words separated by spaces (simple env)', () => {
        const from = codeCursor('aaa ┇bbb ccc')
        const to = codeCursor('┇bbb aaa ccc')

        const { text, cursor } = manipulateLine(from.code, from.cursor, -1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('reorders identifiers around dot separators (simple env)', () => {
        const from = codeCursor('user.┇name.length')
        const to = codeCursor('user.length.┇name')

        const { text, cursor } = manipulateLine(from.code, from.cursor, +1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('reorders across mixed comma and semicolon separators (simple env)', () => {
        const from = codeCursor('a, ┇b; c')
        const to = codeCursor('a, c; ┇b')

        const { text, cursor } = manipulateLine(from.code, from.cursor, +1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('moves function argument with string literal left', () => {
        const from = codeCursor('onSubmit(varA, vatB, ┇"something")')
        const to = codeCursor('onSubmit(varA, ┇"something", vatB)')

        const { text, cursor } = manipulateLine(from.code, from.cursor, -1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('moves function argument with string containing comma', () => {
        const from = codeCursor('fn(┇a, "hello, world", c)')
        const to = codeCursor('fn("hello, world", ┇a, c)')

        const { text, cursor } = manipulateLine(from.code, from.cursor, +1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('moves string argument with comma inside to the left', () => {
        const from = codeCursor('fn(a, ┇"hello, world", c)')
        const to = codeCursor('fn(┇"hello, world", a, c)')

        const { text, cursor } = manipulateLine(from.code, from.cursor, -1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('moves string argument when cursor is inside the string', () => {
        const from = codeCursor('fn(a, "hello, ┇world", c)')
        const to = codeCursor('fn("hello, ┇world", a, c)')

        const { text, cursor } = manipulateLine(from.code, from.cursor, -1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })

    it('moves string argument right when cursor is inside the string', () => {
        const from = codeCursor('fn(a, "fox ┇example here", c)')
        const to = codeCursor('fn(a, c, "fox ┇example here")')

        const { text, cursor } = manipulateLine(from.code, from.cursor, +1)
        expect(text).toBe(to.code)
        expect(cursor).toBe(to.cursor)
    })
})
