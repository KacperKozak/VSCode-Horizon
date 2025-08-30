export enum ChunkKind {
    Element = 'element',
    Separator = 'separator',
}

export interface Chunk {
    kind: ChunkKind
    text: string
}
