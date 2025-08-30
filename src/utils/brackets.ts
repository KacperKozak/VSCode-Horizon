export const isOpening = (c: string) => c === '[' || c === '{' || c === '('
export const isClosing = (c: string) => c === ']' || c === '}' || c === ')'
export const matching: Record<string, string> = { '[': ']', '{': '}', '(': ')' }

export const findEnclosingPair = (
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
