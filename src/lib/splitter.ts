import { EnvKind } from '../types/EnvKind'
import { Chunk, ChunkKind } from '../types/Chunk'
import { isOpening, isClosing, matching } from '../utils/brackets'

const splitByCommas = (content: string): Chunk[] => {
    const chunks: Chunk[] = []
    let current = ''
    let quote: string | undefined
    const stack: string[] = []

    for (let i = 0; i < content.length; i++) {
        const ch = content[i]
        const next = content[i + 1]
        const prev = content[i - 1]

        if (!quote && isOpening(ch)) {
            stack.push(matching[ch])
            current += ch
            continue
        }

        if (!quote && isClosing(ch)) {
            if (stack[stack.length - 1] === ch) stack.pop()
            current += ch
            continue
        }

        if (ch === '"' || ch === "'" || ch === '`') {
            if (quote === ch && prev !== '\\') {
                quote = undefined
            } else if (!quote) {
                quote = ch
            }
            current += ch
            continue
        }

        if (ch === ',' && !quote && stack.length === 0) {
            if (current.length > 0) {
                chunks.push({ kind: ChunkKind.Element, text: current.trim() })
                current = ''
            }
            const sep = next === ' ' ? ', ' : ','
            chunks.push({ kind: ChunkKind.Separator, text: sep })
            if (next === ' ') i++
            continue
        }

        current += ch
    }

    if (current.length > 0) chunks.push({ kind: ChunkKind.Element, text: current.trim() })
    return chunks
}

const splitByPipesTopLevel = (content: string): Chunk[] => {
    const chunks: Chunk[] = []
    let current = ''
    let quote: string | undefined
    const stack: string[] = []
    for (let i = 0; i < content.length; i++) {
        const ch = content[i]
        const next = content[i + 1]
        const prev = content[i - 1]
        if (!quote && isOpening(ch)) {
            stack.push(matching[ch])
            current += ch
            continue
        }
        if (!quote && isClosing(ch)) {
            if (stack[stack.length - 1] === ch) stack.pop()
            current += ch
            continue
        }
        if (ch === '"' || ch === "'" || ch === '`') {
            if (quote === ch && prev !== '\\') {
                quote = undefined
            } else if (!quote) {
                quote = ch
            }
            current += ch
            continue
        }
        if (ch === '|' && !quote && stack.length === 0) {
            // finalize current element, trim outer spaces
            if (current.length > 0) {
                chunks.push({ kind: ChunkKind.Element, text: current.trim() })
                current = ''
            }
            const sep = next === ' ' && content[i - 1] === ' ' ? ' | ' : '|'
            chunks.push({ kind: ChunkKind.Separator, text: sep })
            if (next === ' ') i++
            continue
        }
        current += ch
    }
    if (current.length > 0) chunks.push({ kind: ChunkKind.Element, text: current.trim() })
    return chunks
}

const splitLogical = (content: string): Chunk[] => {
    const chunks: Chunk[] = []
    let current = ''
    let quote: string | undefined
    const stack: string[] = []
    const flushElement = () => {
        if (current.length > 0) {
            // trim trailing spaces; they belong to separator
            let end = current.length - 1
            while (end >= 0 && current[end] === ' ') end--
            const trimmed = current.slice(0, end + 1)
            if (trimmed.length > 0)
                chunks.push({ kind: ChunkKind.Element, text: trimmed })
            current = ''
        }
    }
    for (let i = 0; i < content.length; i++) {
        const ch = content[i]
        const next = content[i + 1]
        const prev = content[i - 1]
        if (!quote && isOpening(ch)) {
            stack.push(matching[ch])
            current += ch
            continue
        }
        if (!quote && isClosing(ch)) {
            if (stack[stack.length - 1] === ch) stack.pop()
            current += ch
            continue
        }
        if (ch === '"' || ch === "'" || ch === '`') {
            if (quote === ch && prev !== '\\') {
                quote = undefined
            } else if (!quote) {
                quote = ch
            }
            current += ch
            continue
        }
        const isAnd = ch === '&' && next === '&'
        const isOr = ch === '|' && next === '|'
        if ((isAnd || isOr) && !quote && stack.length === 0) {
            // remove trailing spaces from current and push
            flushElement()
            // capture spaces around operator
            const hasLeftSpace = chunks.length > 0 && content[i - 1] === ' '
            const afterOp = content[i + 2]
            const hasRightSpace = afterOp === ' '
            const op = isAnd ? '&&' : '||'
            const sep = `${hasLeftSpace ? ' ' : ''}${op}${hasRightSpace ? ' ' : ''}`
            chunks.push({ kind: ChunkKind.Separator, text: sep })
            if (hasRightSpace) i += 2
            else i += 1
            continue
        }
        current += ch
    }
    flushElement()
    return chunks
}

const splitProps = (content: string): Chunk[] => {
    const chunks: Chunk[] = []
    let current = ''
    let quote: string | undefined
    const stack: string[] = []
    const pushElement = () => {
        if (current.length > 0) {
            chunks.push({ kind: ChunkKind.Element, text: current })
            current = ''
        }
    }
    for (let i = 0; i < content.length; i++) {
        const ch = content[i]
        const prev = content[i - 1]
        if (!quote && isOpening(ch)) {
            stack.push(matching[ch])
            current += ch
            continue
        }
        if (!quote && isClosing(ch)) {
            if (stack[stack.length - 1] === ch) stack.pop()
            current += ch
            continue
        }
        if (ch === '"' || ch === "'" || ch === '`') {
            if (quote === ch && prev !== '\\') {
                quote = undefined
            } else if (!quote) {
                quote = ch
            }
            current += ch
            continue
        }
        if (ch === ' ' && !quote && stack.length === 0) {
            // collapse consecutive spaces into a single separator
            pushElement()
            // skip additional spaces
            while (content[i + 1] === ' ') i++
            chunks.push({ kind: ChunkKind.Separator, text: ' ' })
            continue
        }
        current += ch
    }
    pushElement()
    return chunks
}

const splitClassList = (content: string): Chunk[] => {
    const chunks: Chunk[] = []
    let current = ''
    let inQuote: string | undefined
    let bracketDepth = 0 // only track square brackets used by Tailwind arbitrary values
    const pushElement = () => {
        if (current.length > 0) {
            chunks.push({ kind: ChunkKind.Element, text: current })
            current = ''
        }
    }
    for (let i = 0; i < content.length; i++) {
        const ch = content[i]
        const prev = content[i - 1]
        if (inQuote) {
            if (ch === inQuote && prev !== '\\') inQuote = undefined
            current += ch
            continue
        }
        if (ch === '"' || ch === "'") {
            inQuote = ch
            current += ch
            continue
        }
        if (ch === '[') {
            bracketDepth++
            current += ch
            continue
        }
        if (ch === ']' && bracketDepth > 0) {
            bracketDepth--
            current += ch
            continue
        }
        if (ch === ' ' && bracketDepth === 0) {
            // collapse consecutive spaces into a single separator between tokens
            pushElement()
            while (content[i + 1] === ' ') i++
            chunks.push({ kind: ChunkKind.Separator, text: ' ' })
            continue
        }
        current += ch
    }
    pushElement()
    return chunks
}

export const splitScope = (content: string, env: EnvKind): Chunk[] => {
    if (
        env === EnvKind.Array ||
        env === EnvKind.Object ||
        env === EnvKind.FunctionParams ||
        env === EnvKind.TypeParams
    ) {
        return splitByCommas(content)
    }
    if (env === EnvKind.Union) {
        return splitByPipesTopLevel(content)
    }
    if (env === EnvKind.Logical) {
        return splitLogical(content)
    }
    if (env === EnvKind.ReactComponent) {
        return splitProps(content)
    }
    if (env === EnvKind.ClassList) {
        return splitClassList(content)
    }
    return [{ kind: ChunkKind.Element, text: content }]
}
