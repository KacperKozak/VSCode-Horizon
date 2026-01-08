import { EnvKind } from '../types/EnvKind'
import { findEnclosingPair } from '../utils/brackets'

export interface Detection {
    env: EnvKind
    scope?: [number, number]
}

// Small helpers to reduce nesting
const hasUnionPattern = (codeLine: string): boolean =>
    /['"`][^'"`]*\|[^'"`]*['"`]/.test(codeLine) || /\b\w+\s*\|\s*\w+/.test(codeLine)

const hasLogicalPattern = (codeLine: string): boolean => /(?:&&|\|\|)/.test(codeLine)

const findTypeParamsAnglePair = (
    codeLine: string,
    cursorIndex: number,
): { openIndex: number; closeIndex: number } | undefined => {
    for (let i = cursorIndex; i >= 0; i--) {
        if (codeLine[i] !== '<') continue
        let depth = 0
        let quote: string | undefined
        let closeAt = -1
        for (let j = i; j < codeLine.length; j++) {
            const c = codeLine[j]
            const p = codeLine[j - 1]
            if (quote) {
                if (c === quote && p !== '\\') quote = undefined
                continue
            }
            if (c === '"' || c === "'" || c === '`') {
                quote = c
                continue
            }
            if (c === '<') depth++
            else if (c === '>') {
                depth--
                if (depth === 0) {
                    closeAt = j
                    break
                }
            }
        }
        if (closeAt === -1) continue
        if (!(i < cursorIndex && cursorIndex <= closeAt)) continue
        let li = i - 1
        while (li >= 0 && /\s/.test(codeLine[li])) li--
        let ri = closeAt + 1
        while (ri < codeLine.length && /\s/.test(codeLine[ri])) ri++
        const leftChar = codeLine[li]
        const rightChar = codeLine[ri]
        const looksLikeAfterName = !!leftChar && /[A-Za-z0-9_\]]/.test(leftChar)
        const looksLikeFnGeneric = rightChar === '('
        if (looksLikeAfterName || looksLikeFnGeneric)
            return { openIndex: i, closeIndex: closeAt }
    }
    return undefined
}

const trimInnerScope = (
    codeLine: string,
    innerStart: number,
    innerEnd: number,
): [number, number] => {
    let s = innerStart
    while (s <= innerEnd && /\s/.test(codeLine[s])) s++
    let e = innerEnd
    while (e >= innerStart && /\s/.test(codeLine[e])) e--
    return [s, e]
}

const detectTypeParams = (
    codeLine: string,
    cursorIndex: number,
): Detection | undefined => {
    const anglePair = findTypeParamsAnglePair(codeLine, cursorIndex)
    if (!anglePair) return undefined
    const [s, e] = trimInnerScope(
        codeLine,
        anglePair.openIndex + 1,
        anglePair.closeIndex - 1,
    )
    return { env: EnvKind.TypeParams, scope: [s, e] }
}

const detectReact = (
    codeLine: string,
    cursorIndex: number,
    isLogical: boolean,
): Detection | undefined => {
    // Support both React components (PascalCase) and HTML/framework tags (lowercase, kebab, namespaced)
    const looksLikeTag = /<[A-Za-z][A-Za-z0-9:_-]*[\s/>]/.test(codeLine)
    if (!looksLikeTag) return undefined

    let lt = -1
    for (let i = cursorIndex; i >= 0; i--) {
        if (codeLine[i] === '<') {
            lt = i
            break
        }
    }
    if (lt === -1) return undefined

    let i = lt + 1
    while (codeLine[i] === ' ') i++
    while (/[A-Za-z0-9:._-]/.test(codeLine[i] || '')) i++
    const tagEnd = i - 1

    let gt = -1
    let quote: string | undefined
    let depth = 0
    for (; i < codeLine.length; i++) {
        const ch = codeLine[i]
        const prev = codeLine[i - 1]
        if (quote) {
            if (ch === quote && prev !== '\\') quote = undefined
            continue
        }
        if (ch === '"' || ch === "'" || ch === '`') {
            quote = ch
            continue
        }
        if (ch === '{' || ch === '(' || ch === '[') depth++
        else if (ch === '}' || ch === ')' || ch === ']') depth = Math.max(0, depth - 1)
        if (depth > 0) continue
        if (ch === '>' && prev !== '=') {
            gt = i
            break
        }
    }
    if (gt === -1) return undefined

    let s = tagEnd + 1
    while (s < gt && /\s/.test(codeLine[s])) s++
    let e = gt - 1
    while (e > s && /\s/.test(codeLine[e])) e--
    if (codeLine[e] === '/') e--
    while (e > s && /\s/.test(codeLine[e])) e--

    const findClassStringScope = (): [number, number] | undefined => {
        for (let q = cursorIndex; q >= s; q--) {
            const ch = codeLine[q]
            if (ch !== '"' && ch !== "'") continue
            const prev = codeLine[q - 1]
            if (prev === '\\') continue
            let close = -1
            for (let j = q + 1; j <= e; j++) {
                const cj = codeLine[j]
                if (cj === ch && codeLine[j - 1] !== '\\') {
                    close = j
                    break
                }
            }
            if (close !== -1 && q < cursorIndex && cursorIndex <= close) {
                const before = codeLine.slice(s, q)
                const hasClassProp =
                    before.lastIndexOf('className=') !== -1 ||
                    before.lastIndexOf('class=') !== -1
                if (hasClassProp) return [q + 1, close - 1]
                break
            }
        }
        return undefined
    }
    const classStringScope = findClassStringScope()
    if (classStringScope) return { env: EnvKind.ClassList, scope: classStringScope }

    const nested = findEnclosingPair(codeLine, cursorIndex)
    if (nested && nested.open !== '<' && nested.openIndex > s && nested.closeIndex < gt) {
        const innerStart = nested.openIndex + 1
        const innerEnd = nested.closeIndex - 1
        const innerText = codeLine.slice(innerStart, innerEnd + 1)
        const [scopeStart, scopeEnd] = trimInnerScope(codeLine, innerStart, innerEnd)
        if (nested.open === '[' && nested.close === ']') {
            return { env: EnvKind.Array, scope: [scopeStart, scopeEnd] }
        }
        if (nested.open === '{' && nested.close === '}') {
            if (/:/.test(innerText))
                return { env: EnvKind.Object, scope: [scopeStart, scopeEnd] }
        }
        if (nested.open === '(' && nested.close === ')') {
            if (/\)\s*=>/.test(codeLine))
                return { env: EnvKind.FunctionParams, scope: [scopeStart, scopeEnd] }
            if (isLogical) return { env: EnvKind.Logical, scope: [scopeStart, scopeEnd] }
        }
    }
    if (s <= e) return { env: EnvKind.ReactComponent, scope: [s, e] }
    return { env: EnvKind.ReactComponent }
}

const CONTROL_KEYWORDS = ['if', 'while', 'for', 'switch', 'catch', 'with']

const isFunctionCall = (codeLine: string, openIndex: number): boolean => {
    let end = openIndex - 1
    while (end >= 0 && /\s/.test(codeLine[end])) end--
    if (end < 0 || !/[A-Za-z0-9_$\]]/.test(codeLine[end])) return false

    let start = end
    while (start > 0 && /[A-Za-z0-9_$]/.test(codeLine[start - 1])) start--
    const identifier = codeLine.slice(start, end + 1)

    return !CONTROL_KEYWORDS.includes(identifier)
}

const detectByNearestPair = (
    codeLine: string,
    cursorIndex: number,
    isLogical: boolean,
): Detection | undefined => {
    const pair = findEnclosingPair(codeLine, cursorIndex)
    if (!pair) return undefined
    const [scopeStart, scopeEnd] = trimInnerScope(
        codeLine,
        pair.openIndex + 1,
        pair.closeIndex - 1,
    )
    if (pair.open === '[' && pair.close === ']')
        return { env: EnvKind.Array, scope: [scopeStart, scopeEnd] }
    if (pair.open === '{' && pair.close === '}')
        return { env: EnvKind.Object, scope: [scopeStart, scopeEnd] }
    if (pair.open === '(' && pair.close === ')') {
        const isArrowFn = /\)\s*=>/.test(codeLine)
        const isFnCall = isFunctionCall(codeLine, pair.openIndex)
        if (isArrowFn || isFnCall)
            return { env: EnvKind.FunctionParams, scope: [scopeStart, scopeEnd] }
    }
    if (pair.open === '<' && pair.close === '>')
        return { env: EnvKind.ReactComponent, scope: [scopeStart, scopeEnd] }
    if (isLogical && pair.open === '(' && pair.close === ')')
        return { env: EnvKind.Logical, scope: [scopeStart, scopeEnd] }
    return undefined
}

const detectBySimplePairs = (
    codeLine: string,
    cursorIndex: number,
): Detection | undefined => {
    const simplePair = (open: string, close: string) => {
        const openIndex = codeLine.lastIndexOf(open, cursorIndex)
        const closeIndex = codeLine.indexOf(close, cursorIndex)
        if (
            openIndex !== -1 &&
            closeIndex !== -1 &&
            openIndex < cursorIndex &&
            cursorIndex <= closeIndex
        ) {
            return { openIndex, closeIndex }
        }
        return undefined
    }
    const spArray = simplePair('[', ']')
    if (spArray) {
        const [s, e] = trimInnerScope(
            codeLine,
            spArray.openIndex + 1,
            spArray.closeIndex - 1,
        )
        return { env: EnvKind.Array, scope: [s, e] }
    }
    const spObj = simplePair('{', '}')
    if (spObj) {
        const [s, e] = trimInnerScope(codeLine, spObj.openIndex + 1, spObj.closeIndex - 1)
        return { env: EnvKind.Object, scope: [s, e] }
    }
    const spPar = simplePair('(', ')')
    if (spPar) {
        const isArrowFn = /\)\s*=>/.test(codeLine)
        const isFnCall = isFunctionCall(codeLine, spPar.openIndex)
        if (isArrowFn || isFnCall) {
            const [s, e] = trimInnerScope(
                codeLine,
                spPar.openIndex + 1,
                spPar.closeIndex - 1,
            )
            return { env: EnvKind.FunctionParams, scope: [s, e] }
        }
    }
    return undefined
}

const detectUnion = (codeLine: string): Detection | undefined => {
    if (!hasUnionPattern(codeLine)) return undefined
    const firstPipe = codeLine.indexOf('|')
    const lastPipe = codeLine.lastIndexOf('|')
    if (firstPipe !== -1 && lastPipe !== -1) {
        const eq = codeLine.lastIndexOf('=')
        let s = eq !== -1 ? eq + 1 : 0
        let e = codeLine.length - 1
        const semi = codeLine.indexOf(';', s)
        const comment = codeLine.indexOf('//', s)
        if (semi !== -1) e = Math.min(e, semi - 1)
        if (comment !== -1) e = Math.min(e, comment - 1)
        while (s <= e && /\s/.test(codeLine[s])) s++
        while (e >= s && /\s/.test(codeLine[e])) e--
        return { env: EnvKind.Union, scope: [s, e] }
    }
    return { env: EnvKind.Union }
}

const detectLogicalFullLine = (codeLine: string): Detection | undefined => {
    if (!hasLogicalPattern(codeLine)) return undefined
    let s = 0
    let e = codeLine.length - 1
    while (s <= e && /\s/.test(codeLine[s])) s++
    while (e >= s && /\s/.test(codeLine[e])) e--
    return { env: EnvKind.Logical, scope: [s, e] }
}

export const detectEnvironment = (codeLine: string, cursorIndex: number): Detection => {
    const isLogical = hasLogicalPattern(codeLine)

    return (
        detectTypeParams(codeLine, cursorIndex) ||
        detectReact(codeLine, cursorIndex, isLogical) ||
        detectByNearestPair(codeLine, cursorIndex, isLogical) ||
        detectBySimplePairs(codeLine, cursorIndex) ||
        detectUnion(codeLine) ||
        detectLogicalFullLine(codeLine) || { env: EnvKind.Simple }
    )
}
