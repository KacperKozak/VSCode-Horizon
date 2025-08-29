export type Brackets = [string, string]

export interface BracketType {
    bracket: Brackets
    separator: string
    joiner: string
    word: RegExp | undefined
}

export const types: BracketType[] = [
    { bracket: ['<', '>'], separator: ' ', joiner: ' ', word: /[^<>\s]+/ },
    { bracket: ['{', '}'], separator: ',', joiner: ', ', word: /[^{},]+/ },
    { bracket: ['[', ']'], separator: ',', joiner: ', ', word: /[^[\],]+/ },
    { bracket: ['(', ')'], separator: ',', joiner: ', ', word: /[^(),]+/ },
]

export interface SwapResult {
    bracketLeft: number
    bracketRight: number
    newBracketText: string
    selectionStart: number
    selectionEnd: number
    cursorWord: string
}

interface SplitOutcome {
    leftBracketPos: number
    rightBracketPos: number
    currentItemText: string
    items: string[]
}

const splitByBracket = (
    text: string,
    [l, r]: Brackets,
    separator: string,
    cursorPosition: number,
): SplitOutcome | undefined => {
    let pos = cursorPosition
    let leftBracketPos = -1
    while (text[pos] !== undefined && pos >= 0) {
        if (text[pos] === l) {
            leftBracketPos = pos
            break
        }
        pos--
    }
    if (leftBracketPos === -1) return undefined

    pos = cursorPosition
    let rightBracketPos = -1
    let nestedBrackets = 0
    while (text[pos] !== undefined) {
        if (text[pos] === l) {
            nestedBrackets++
        } else if (text[pos] === r) {
            if (nestedBrackets === 0) {
                rightBracketPos = pos
                break
            }
            nestedBrackets--
        }
        pos++
    }
    if (rightBracketPos === -1) return undefined

    let leftCurrentPos = cursorPosition
    while (text[leftCurrentPos - 1] !== undefined) {
        if (text[leftCurrentPos - 1] === separator) break
        if (text[leftCurrentPos - 1] === l) break
        leftCurrentPos--
    }

    let rightCurrentPos = cursorPosition
    let currentPosNested = 0
    while (text[rightCurrentPos] !== undefined) {
        if (text[rightCurrentPos + 1] === separator) break
        if (text[rightCurrentPos + 1] === r) break
        if (text[rightCurrentPos + 1] === l) {
            currentPosNested++
        } else if (text[rightCurrentPos + 1] === r) {
            if (currentPosNested === 0) break
            currentPosNested--
        }
        rightCurrentPos++
    }

    const currentItemText = text.slice(leftCurrentPos, rightCurrentPos + 1)
    const bracketText = text.slice(leftBracketPos + 1, rightBracketPos)

    const result: string[] = []
    let current = ''
    let nested = 0
    for (const char of bracketText) {
        if (char === l) {
            nested++
        } else if (char === r) {
            nested--
        } else if (char === separator && nested === 0) {
            result.push(current)
            current = ''
            continue
        }
        current += char
    }
    result.push(current)
    const trimmed = result.map((item) => item.trim())

    return {
        leftBracketPos,
        rightBracketPos,
        currentItemText,
        items: trimmed,
    }
}

export const computeSwapForLine = (
    text: string,
    cursorPosition: number,
    dir: 1 | -1,
): { result?: SwapResult; type?: BracketType } => {
    for (const type of types) {
        const split = splitByBracket(text, type.bracket, type.separator, cursorPosition)
        if (!split) continue

        const { leftBracketPos, rightBracketPos, currentItemText, items } = split
        const cursorWord = currentItemText.trim()
        const cursorWordIndex = items.indexOf(cursorWord)
        if (cursorWordIndex === -1) continue

        const targetIndex = cursorWordIndex + dir
        if (targetIndex < 0 || targetIndex >= items.length) return { type }

        const nextWord = items[targetIndex]
        if (!nextWord) return { type }

        const newArray = items.map((item) => {
            if (item === cursorWord) return nextWord
            if (item === nextWord) return cursorWord
            return item
        })

        const s = text[leftBracketPos + 1] === ' ' ? ' ' : ''
        const [bracketStart, bracketEnd] = [text[leftBracketPos], text[rightBracketPos]]
        const joined = newArray.join(type.joiner)
        const newBracketText = `${bracketStart}${s}${joined}${s}${bracketEnd}`

        let offset = 0
        for (let i = 0; i < targetIndex; i++) {
            offset += newArray[i].length
            if (i < targetIndex) offset += type.joiner.length
        }

        const selectionStart = leftBracketPos + 1 + s.length + offset
        const selectionEnd = selectionStart + cursorWord.length

        return {
            type,
            result: {
                bracketLeft: leftBracketPos,
                bracketRight: rightBracketPos,
                newBracketText,
                selectionStart,
                selectionEnd,
                cursorWord,
            },
        }
    }
    return {}
}
