import { detectEnvironment } from './detector'
import { splitScope } from './splitter'
import { EnvKind } from '../types/EnvKind'

export interface ManipulateResult {
    text: string
    cursor: number
}

const joinChunks = (chunks: { kind: 'element' | 'separator'; text: string }[]): string =>
    chunks.map((c) => c.text).join('')

const findElementIndexAt = (
    chunks: { kind: 'element' | 'separator'; text: string }[],
    relativeIndex: number,
): number => {
    let pos = 0
    for (let i = 0, elemIdx = 0; i < chunks.length; i++) {
        const ch = chunks[i]
        const nextPos = pos + ch.text.length
        if (relativeIndex >= pos && relativeIndex < nextPos) {
            return ch.kind === 'separator' ? Math.max(0, elemIdx - 1) : elemIdx
        }
        if (ch.kind === 'element') elemIdx++
        pos = nextPos
    }
    return Math.max(0, chunks.filter((c) => c.kind === 'element').length - 1)
}

const reorderByMoving = (
    chunks: { kind: 'element' | 'separator'; text: string }[],
    fromIdx: number,
    toIdx: number,
) => {
    const elements = chunks.filter((c) => c.kind === 'element')
    if (toIdx < 0 || toIdx >= elements.length) return chunks
    const order = elements.map((e) => e.text)
    const [moved] = order.splice(fromIdx, 1)
    order.splice(toIdx, 0, moved)
    let k = 0
    return chunks.map((c) => (c.kind === 'element' ? { ...c, text: order[k++] } : c))
}

export const manipulateLine = (
    line: string,
    cursor: number,
    delta: number,
): ManipulateResult => {
    const detection = detectEnvironment(line, cursor)
    const env = detection.env
    if (env === EnvKind.Simple || detection.scope === undefined) {
        return { text: line, cursor }
    }

    const [s, e] = detection.scope
    const scopeContent = line.slice(s, e + 1)
    const chunks = splitScope(scopeContent, env)

    const relativeCursor = cursor - s
    const fromElemIdx = findElementIndexAt(chunks, relativeCursor)
    // compute offset within the element where the cursor currently is
    const getElementStartAndLength = (
        list: { kind: 'element' | 'separator'; text: string }[],
        elemIdx: number,
    ): { start: number; length: number } => {
        let pos = 0
        let seen = 0
        for (const c of list) {
            if (c.kind === 'element') {
                if (seen === elemIdx) return { start: pos, length: c.text.length }
                seen++
            }
            pos += c.text.length
        }
        return { start: pos, length: 0 }
    }
    const fromElemLoc = getElementStartAndLength(chunks, fromElemIdx)
    const withinOffset = Math.max(
        0,
        Math.min(relativeCursor - fromElemLoc.start, fromElemLoc.length),
    )
    let toElemIdx = fromElemIdx + delta

    // Generic reorder for all envs (React props are scoped to props only by detector)
    const afterMove = reorderByMoving(chunks, fromElemIdx, toElemIdx)
    if (afterMove === chunks) return { text: line, cursor }
    const newScope = joinChunks(afterMove)
    const newLine = line.slice(0, s) + newScope + line.slice(e + 1)

    const movedIdx = Math.max(
        0,
        Math.min(toElemIdx, afterMove.filter((c) => c.kind === 'element').length - 1),
    )
    const movedLoc = getElementStartAndLength(afterMove, movedIdx)
    const newRelative = movedLoc.start + Math.min(withinOffset, movedLoc.length)
    return { text: newLine, cursor: s + newRelative }
}
