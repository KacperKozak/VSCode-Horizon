import { EnvKind } from '../types/EnvKind'

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
                        if (i < cursorIndex && cursorIndex <= j)
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
    // High-level pattern flags
    const isReact = /<[A-Z][A-Za-z0-9*[\s/>]/.test(codeLine)
    const isUnion =
        /['"`][^'"`]*\|[^'"`]*['"`]/.test(codeLine) || /\b\w+\s*\|\s*\w+/.test(codeLine)
    const isLogical = /(?:&&|\|\|)/.test(codeLine)

    // React: scope is props between tag name end and '>' (ignoring '=>')
    if (isReact) {
        // Find nearest '<'
        let lt = -1
        for (let i = cursorIndex; i >= 0; i--) {
            if (codeLine[i] === '<') {
                lt = i
                break
            }
        }
        if (lt !== -1) {
            // Scan past tag name
            let i = lt + 1
            while (codeLine[i] === ' ') i++
            while (/[A-Za-z0-9_.]/.test(codeLine[i] || '')) i++
            const tagEnd = i - 1
            // Find matching '>' respecting quotes/braces and skipping '=>'
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
                else if (ch === '}' || ch === ')' || ch === ']')
                    depth = Math.max(0, depth - 1)
                if (depth > 0) continue
                if (ch === '>' && prev !== '=') {
                    gt = i
                    break
                }
            }
            if (gt !== -1) {
                // props start after tag name
                let s = tagEnd + 1
                while (s < gt && /\s/.test(codeLine[s])) s++
                // props end before '>', trim spaces and optional '/'
                let e = gt - 1
                while (e > s && /\s/.test(codeLine[e])) e--
                if (codeLine[e] === '/') e--
                while (e > s && /\s/.test(codeLine[e])) e--
                // If cursor is inside a nested pair within props (e.g. array/object/params),
                // prefer the nested environment over the generic React component.
                const nested = findEnclosingPair(codeLine, cursorIndex)
                if (
                    nested &&
                    nested.open !== '<' &&
                    nested.openIndex > s &&
                    nested.closeIndex < gt
                ) {
                    const innerStart = nested.openIndex + 1
                    const innerEnd = nested.closeIndex - 1
                    const innerText = codeLine.slice(innerStart, innerEnd + 1)
                    let scopeStart = innerStart
                    while (scopeStart <= innerEnd && /\s/.test(codeLine[scopeStart]))
                        scopeStart++
                    let scopeEnd = innerEnd
                    while (scopeEnd >= innerStart && /\s/.test(codeLine[scopeEnd]))
                        scopeEnd--
                    if (nested.open === '[' && nested.close === ']') {
                        return { env: EnvKind.Array, scope: [scopeStart, scopeEnd] }
                    }
                    if (nested.open === '{' && nested.close === '}') {
                        // Only treat as object literal if inner content looks like object properties
                        if (/:/.test(innerText)) {
                            return { env: EnvKind.Object, scope: [scopeStart, scopeEnd] }
                        }
                        // otherwise it's a generic expression inside a prop -> keep ReactComponent
                    }
                    if (nested.open === '(' && nested.close === ')') {
                        if (/\)\s*=>/.test(codeLine)) {
                            return {
                                env: EnvKind.FunctionParams,
                                scope: [scopeStart, scopeEnd],
                            }
                        }
                        if (isLogical) {
                            return {
                                env: EnvKind.Logical,
                                scope: [scopeStart, scopeEnd],
                            }
                        }
                    }
                }
                if (s <= e) {
                    return { env: EnvKind.ReactComponent, scope: [s, e] }
                } else {
                    return { env: EnvKind.ReactComponent }
                }
            }
        }
    }

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
        // Logical expressions often live inside parens
        if (isLogical && pair.open === '(' && pair.close === ')')
            return {
                env: EnvKind.Logical,
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
            cursorIndex <= closeIndex
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

    // Union scope heuristic: capture region around top-level pipes
    if (isUnion) {
        const firstPipe = codeLine.indexOf('|')
        const lastPipe = codeLine.lastIndexOf('|')
        if (firstPipe !== -1 && lastPipe !== -1) {
            // Prefer range after '=' if present
            const eq = codeLine.lastIndexOf('=')
            let s = eq !== -1 ? eq + 1 : 0
            let e = codeLine.length - 1
            // stop at comment start or semicolon
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

    if (isLogical) {
        // Default to full trimmed line as logical scope
        let s = 0
        let e = codeLine.length - 1
        while (s <= e && /\s/.test(codeLine[s])) s++
        while (e >= s && /\s/.test(codeLine[e])) e--
        return { env: EnvKind.Logical, scope: [s, e] }
    }

    return { env: EnvKind.Simple }
}
