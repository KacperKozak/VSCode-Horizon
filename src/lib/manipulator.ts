import { detectEnvironment } from './detector'
import { splitScope } from './splitter'
import { EnvKind } from '../types/EnvKind'
import { Chunk, ChunkKind } from '../types/Chunk'

export interface ManipulateResult {
    text: string
    cursor: number
}

const joinChunks = (chunks: Chunk[]): string => chunks.map((c) => c.text).join('')

const findElementIndexAt = (chunks: Chunk[], relativeIndex: number): number => {
    let pos = 0
    for (let i = 0, elemIdx = 0; i < chunks.length; i++) {
        const ch = chunks[i]
        const nextPos = pos + ch.text.length
        if (relativeIndex >= pos && relativeIndex < nextPos) {
            return ch.kind === ChunkKind.Separator ? Math.max(0, elemIdx - 1) : elemIdx
        }
        if (ch.kind === ChunkKind.Element) elemIdx++
        pos = nextPos
    }
    return Math.max(0, chunks.filter((c) => c.kind === ChunkKind.Element).length - 1)
}

const reorderByMoving = (chunks: Chunk[], fromIdx: number, toIdx: number) => {
    const elements = chunks.filter((c) => c.kind === ChunkKind.Element)
    if (toIdx < 0 || toIdx >= elements.length) return chunks
    const order = elements.map((e) => e.text)
    const [moved] = order.splice(fromIdx, 1)
    order.splice(toIdx, 0, moved)
    let k = 0
    return chunks.map((c) =>
        c.kind === ChunkKind.Element ? { ...c, text: order[k++] } : c,
    )
}

const simpleSplit = (content: string): Chunk[] => {
    const chunks: Chunk[] = []
    let current = ''
    const isWord = (ch: string) => /[A-Za-z0-9_$]/.test(ch)
    let currentKind: ChunkKind | undefined = undefined

    for (let i = 0; i < content.length; i++) {
        const ch = content[i]
        const nextIsWord = isWord(ch)
        if (currentKind === undefined) {
            currentKind = nextIsWord ? ChunkKind.Element : ChunkKind.Separator
            current = ch
            continue
        }
        if ((currentKind === ChunkKind.Element) === nextIsWord) {
            current += ch
        } else {
            chunks.push({ kind: currentKind, text: current })
            currentKind = nextIsWord ? ChunkKind.Element : ChunkKind.Separator
            current = ch
        }
    }
    if (currentKind) chunks.push({ kind: currentKind, text: current })

    // Trim leading/trailing separators into surrounding context by keeping them as separators
    // and normalizing element texts (no trimming to preserve exact positions)
    return chunks
}

export const manipulateLine = (
    line: string,
    cursor: number,
    delta: number,
): ManipulateResult => {
    const detection = detectEnvironment(line, cursor)
    const env = detection.env

    let s = 0
    let e = line.length - 1
    let chunks: Chunk[]

    if (env === EnvKind.Simple || detection.scope === undefined) {
        chunks = simpleSplit(line)
    } else {
        ;[s, e] = detection.scope
        const scopeContent = line.slice(s, e + 1)
        chunks = splitScope(scopeContent, env)
    }

    const relativeCursor = cursor - s
    const fromElemIdx = findElementIndexAt(chunks, relativeCursor)
    const getElementStartAndLength = (
        list: Chunk[],
        elemIdx: number,
    ): { start: number; length: number } => {
        let pos = 0
        let seen = 0
        for (const c of list) {
            if (c.kind === ChunkKind.Element) {
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

    const afterMove = reorderByMoving(chunks, fromElemIdx, toElemIdx)
    if (afterMove === chunks) return { text: line, cursor }
    const newScope = joinChunks(afterMove)
    const newLine = line.slice(0, s) + newScope + line.slice(e + 1)

    const movedIdx = Math.max(
        0,
        Math.min(
            toElemIdx,
            afterMove.filter((c) => c.kind === ChunkKind.Element).length - 1,
        ),
    )
    const movedLoc = getElementStartAndLength(afterMove, movedIdx)
    const newRelative = movedLoc.start + Math.min(withinOffset, movedLoc.length)
    return { text: newLine, cursor: s + newRelative }
}
