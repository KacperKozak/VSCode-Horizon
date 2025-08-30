import { describe, it, expect } from 'bun:test'
import { detectEnvironment } from './detector'
import { EnvKind } from '../types/EnvKind'
import { codeCursor } from '../utils/tests'

const detectWithCursor = (codeWithCursor: string) => {
    const { code, cursor } = codeCursor(codeWithCursor)
    const detection = detectEnvironment(code, cursor)
    const scopedCode = detection.scope
        ? code.slice(detection.scope[0], detection.scope[1] + 1)
        : undefined
    return { ...detection, scopedCode }
}

describe('detectEnvironment', () => {
    it('should detect nothing', () => {
        const result = detectWithCursor('const a┇ = 1')
        expect(result.env).toBe(EnvKind.Simple)
        expect(result.scope).toBeUndefined()
    })

    it('should not fail on empty code', () => {
        const result = detectWithCursor('┇')
        expect(result.env).toBe(EnvKind.Simple)
        expect(result.scope).toBeUndefined()
    })

    it('should detect array environment', () => {
        const result = detectWithCursor('[1, 2, 3, 4┇]')
        expect(result.env).toBe(EnvKind.Array)
        expect(result.scopedCode).toBe('1, 2, 3, 4')
    })

    it('should detect object environment when cursor inside object', () => {
        const result = detectWithCursor('{ a: 1, ┇b: 2 }')
        expect(result.env).toBe(EnvKind.Object)
        expect(result.scopedCode).toBe('a: 1, b: 2')
    })

    it('should detect very simple react component environment', () => {
        const result = detectWithCursor('<┇Component a b c />')
        expect(result.env).toBe(EnvKind.ReactComponent)
        expect(result.scopedCode).toBe('a b c')
    })

    it('should detect react component environment', () => {
        const result = detectWithCursor('<Component somePros={x┇} here="aa" />')
        expect(result.env).toBe(EnvKind.ReactComponent)
        expect(result.scopedCode).toBe('somePros={x} here="aa"')
    })

    it('should detect react component with nested array/callback/object props', () => {
        const result = detectWithCursor(
            '<Component items┇={[1,2]} onClick={() => x()} cfg={{a:1}} />',
        )
        expect(result.env).toBe(EnvKind.ReactComponent)
        expect(result.scopedCode).toBe('items={[1,2]} onClick={() => x()} cfg={{a:1}}')
    })

    it('should detect array inside a react component prop', () => {
        const result = detectWithCursor('<Component items={[1,┇2,3]} />')
        expect(result.env).toBe(EnvKind.Array)
        expect(result.scopedCode).toBe('1,2,3')
    })

    it('should detect object inside a react multiline component prop', () => {
        const result = detectWithCursor('items={{ a: 1, b: 2, ┇c: 3}}')
        expect(result.env).toBe(EnvKind.Object)
        expect(result.scopedCode).toBe('a: 1, b: 2, c: 3')
    })

    it('should detect function params environment', () => {
        const result = detectWithCursor('(key: Key┇, value: number) => {}')
        expect(result.env).toBe(EnvKind.FunctionParams)
        expect(result.scopedCode).toBe('key: Key, value: number')
    })

    it('should detect logical expression environment', () => {
        const result = detectWithCursor('if (some && condi┇tion || here)')
        expect(result.env).toBe(EnvKind.Logical)
        expect(result.scopedCode).toBe('some && condition || here')
    })

    it('should detect union environment', () => {
        const result = detectWithCursor("type Union = 'a' | '┇b' | 'c'")
        expect(result.env).toBe(EnvKind.Union)
        expect(result.scopedCode).toBe("'a' | 'b' | 'c'")
    })

    it('should detect type parameters on interface', () => {
        const result = detectWithCursor(
            'interface Test<T, T = string, X extends Something┇> {}',
        )
        expect(result.env).toBe(EnvKind.TypeParams)
        expect(result.scopedCode).toBe('T, T = string, X extends Something')
    })

    it('should detect type parameters on class', () => {
        const result = detectWithCursor('class Box<T extends Item, U = number┇> {}')
        expect(result.env).toBe(EnvKind.TypeParams)
        expect(result.scopedCode).toBe('T extends Item, U = number')
    })

    it('should detect type parameters on function', () => {
        const result = detectWithCursor('const fn = <T, U extends X┇>(a: T, b: U) => {}')
        expect(result.env).toBe(EnvKind.TypeParams)
        expect(result.scopedCode).toBe('T, U extends X')
    })

    it('should detect class list inside className string', () => {
        const result = detectWithCursor('<C className="size-4 ┇animate-spin" />')
        expect(result.env).toBe(EnvKind.ClassList)
        expect(result.scopedCode).toBe('size-4 animate-spin')
    })

    it('should detect class list inside cn() call in prop', () => {
        const result = detectWithCursor(
            "<Card className={cn('transition-all', isActive ? 'bg-primary text-background' : 'text-primary hover:bg-┇secondary')} />",
        )
        expect(result.env).toBe(EnvKind.ClassList)
        expect(result.scopedCode).toBe('text-primary hover:bg-secondary')
    })

    it('should detect class list inside HTML class attribute (double quotes)', () => {
        const result = detectWithCursor('<div class="size-4 ┇animate-spin"></div>')
        expect(result.env).toBe(EnvKind.ClassList)
        expect(result.scopedCode).toBe('size-4 animate-spin')
    })

    it('should detect class list inside HTML class attribute (single quotes)', () => {
        const result = detectWithCursor("<span class='p-2 ┇text-sm'></span>")
        expect(result.env).toBe(EnvKind.ClassList)
        expect(result.scopedCode).toBe('p-2 text-sm')
    })

    it('should detect nested object inside array (cursor inside object)', () => {
        const result = detectWithCursor('[ {┇a:1, b:2}, 1, 2, 3 ]')
        expect(result.env).toBe(EnvKind.Object)
        expect(result.scopedCode).toBe('a:1, b:2')
    })

    it('should detect outer array when cursor on array item after nested object', () => {
        const result = detectWithCursor('[ {a:1, b:2}, 1, ┇2, 3 ]')
        expect(result.env).toBe(EnvKind.Array)
        expect(result.scopedCode).toBe('{a:1, b:2}, 1, 2, 3')
    })

    it('should detect array inside object (cursor inside first array)', () => {
        const result = detectWithCursor('{ a: [1,┇2,3], b: [4,5,6] }')
        expect(result.env).toBe(EnvKind.Array)
        expect(result.scopedCode).toBe('1,2,3')
    })

    it('should detect array inside object (cursor inside second array)', () => {
        const result = detectWithCursor('{ a: [1,2,3], b: [4,┇5,6] }')
        expect(result.env).toBe(EnvKind.Array)
        expect(result.scopedCode).toBe('4,5,6')
    })

    it('should detect object environment when cursor on property name', () => {
        const result = detectWithCursor('{ a┇: [1,2,3], b: [4,5,6] }')
        expect(result.env).toBe(EnvKind.Object)
        expect(result.scopedCode).toBe('a: [1,2,3], b: [4,5,6]')
    })

    it('should compute scope for array within a larger assignment', () => {
        const result = detectWithCursor('const a: SomeType = [1, ┇2, 3]')
        expect(result.env).toBe(EnvKind.Array)
        expect(result.scopedCode).toBe('1, 2, 3')
    })

    it('should compute scope for object within a larger assignment', () => {
        const result = detectWithCursor('const my = { a: 1, b: 2┇ } // trailing')
        expect(result.env).toBe(EnvKind.Object)
        expect(result.scopedCode).toBe('a: 1, b: 2')
    })
})
