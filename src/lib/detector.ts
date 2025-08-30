import { EnvKind } from '~/types/EnvKind'

export interface Detection {
    env: EnvKind
    scope?: [number, number]
}

const findEnclosingPair = (
    codeLine: string,
    cursorIndex: number,
): { open: string; close: string; openIndex: number; closeIndex: number } | undefined => {
    const match: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>' }
    for (let i = cursorIndex; i >= 0; i--) {
        const ch = codeLine[i]
        if (match[ch]) {
            const open = ch
            const close = match[ch]
            let depth = 0
            for (let j = i; j < codeLine.length; j++) {
                const c = codeLine[j]
                if (c === open) depth++
                else if (c === close) {
                    depth--
                    if (depth === 0) {
                        if (i < cursorIndex && cursorIndex < j)
                            return { open, close, openIndex: i, closeIndex: j }
                        break
                    }
                }
            }
        }
    }
    return undefined
}

export const detectEnvironment = (codeLine: string, cursorIndex: number): Detection => {
    // High-level patterns that take precedence
    if (/<[A-Z][A-Za-z0-9]*[\s/>]/.test(codeLine)) return { env: EnvKind.ReactComponent }
    if (/['"`][^'"`]*\|[^'"`]*['"`]/.test(codeLine)) return { env: EnvKind.Union }
    if (/(?:&&|\|\|)/.test(codeLine)) return { env: EnvKind.Logical }

    const pair = findEnclosingPair(codeLine, cursorIndex)
    if (pair) {
        const innerStart = pair.openIndex + 1
        const innerEnd = pair.closeIndex - 1
        let scopeStart = innerStart
        while (scopeStart <= innerEnd && /\s/.test(codeLine[scopeStart])) scopeStart++
        let scopeEnd = innerEnd
        while (scopeEnd >= innerStart && /\s/.test(codeLine[scopeEnd])) scopeEnd--

        if (pair.open === '[' && pair.close === ']') {
            return { env: EnvKind.Array, scope: [scopeStart, scopeEnd] }
        }
        if (pair.open === '{' && pair.close === '}') {
            return { env: EnvKind.Object, scope: [scopeStart, scopeEnd] }
        }
        if (pair.open === '(' && pair.close === ')') {
            if (/\)\s*=>/.test(codeLine))
                return {
                    env: EnvKind.FunctionParams,
                    scope: [scopeStart, scopeEnd],
                }
        }
        if (pair.open === '<' && pair.close === '>')
            return {
                env: EnvKind.ReactComponent,
                scope: [scopeStart, scopeEnd],
            }
    }

    // Fallback: naive nearest pair by indices, useful when complex tokens confuse the scanner
    const simplePair = (open: string, close: string) => {
        const openIndex = codeLine.lastIndexOf(open, cursorIndex)
        const closeIndex = codeLine.indexOf(close, cursorIndex)
        if (
            openIndex !== -1 &&
            closeIndex !== -1 &&
            openIndex < cursorIndex &&
            cursorIndex < closeIndex
        ) {
            return { openIndex, closeIndex }
        }
        return undefined
    }
    const spArray = simplePair('[', ']')
    if (spArray) {
        let s = spArray.openIndex + 1
        let e = spArray.closeIndex - 1
        while (s <= e && /\s/.test(codeLine[s])) s++
        while (e >= s && /\s/.test(codeLine[e])) e--
        return { env: EnvKind.Array, scope: [s, e] }
    }
    const spObj = simplePair('{', '}')
    if (spObj) {
        let s = spObj.openIndex + 1
        let e = spObj.closeIndex - 1
        while (s <= e && /\s/.test(codeLine[s])) s++
        while (e >= s && /\s/.test(codeLine[e])) e--
        return { env: EnvKind.Object, scope: [s, e] }
    }
    const spPar = simplePair('(', ')')
    if (spPar && /\)\s*=>/.test(codeLine)) {
        let s = spPar.openIndex + 1
        let e = spPar.closeIndex - 1
        while (s <= e && /\s/.test(codeLine[s])) s++
        while (e >= s && /\s/.test(codeLine[e])) e--
        return { env: EnvKind.FunctionParams, scope: [s, e] }
    }

    return { env: EnvKind.Simple }
}
