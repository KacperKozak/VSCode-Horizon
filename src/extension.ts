import * as vscode from 'vscode'

export function activate(context: vscode.ExtensionContext) {
    const moveRight = vscode.commands.registerCommand('react-organize.move-right', () => {
        moveWord(1)
    })

    const moveLeft = vscode.commands.registerCommand('react-organize.move-left', () => {
        moveWord(-1)
    })

    context.subscriptions.push(moveRight, moveLeft)
}

// This method is called when your extension is deactivated
export function deactivate() {}

interface BracketType {
    bracket: RegExp
    separator: string
    joiner?: string
    word: RegExp | undefined
}

const types: BracketType[] = [
    { bracket: /<.*>/, separator: ' ', joiner: ' ', word: /[^<>\s]+/ },
    { bracket: /{.*}/, separator: ',', joiner: ', ', word: /[^{}\,]+/ },
    { bracket: /\[.*\]/, separator: ',', joiner: ', ', word: /[^[\]\,]+/ },
    { bracket: /\(.*\)/, separator: ',', joiner: ', ', word: /[^()\,]+/ },
]

const moveWord = (dir = 1) => {
    const editor = vscode.window.activeTextEditor
    if (!editor) return

    const cursorAnchor = editor.selection.anchor

    // get everything that is inside { and } brackets
    let bracketRange: vscode.Range | undefined
    let bracketType: BracketType | undefined

    for (const type of types) {
        const range = editor.document.getWordRangeAtPosition(cursorAnchor, type.bracket)
        if (range) {
            bracketRange = range
            bracketType = type
            break
        }
    }

    if (!bracketRange) return
    if (!bracketType) return

    const wordAtCursorRange = editor.document.getWordRangeAtPosition(
        cursorAnchor,
        bracketType.word,
    )
    if (!wordAtCursorRange) return
    const cursorWord = editor.document.getText(wordAtCursorRange).trim()
    const bracketText = editor.document.getText(bracketRange)

    // remove { and } from the text
    const [bracketStart, bracketEnd] = [bracketText.at(0), bracketText.at(-1)]
    const bracketHadSpaces = bracketText.at(1) === ' '
    const bracketTextWithoutBrackets = bracketText.slice(1, -1).trim()
    const bracketTextArray = bracketTextWithoutBrackets
        .split(bracketType.separator)
        .map((item) => item.trim())

    // move cursorWord one position to the right
    const cursorWordIndex = bracketTextArray.indexOf(cursorWord)
    if (cursorWordIndex === -1) return

    const nextWord = bracketTextArray[cursorWordIndex + dir]
    if (!nextWord) return

    // swap cursorWord with nextWord
    const newBracketTextArray = bracketTextArray.map((item) => {
        if (item === cursorWord) return nextWord
        if (item === nextWord) return cursorWord
        return item
    })

    const s = bracketHadSpaces ? ' ' : ''
    const joined = newBracketTextArray.join(bracketType.joiner)
    const newBracketText = `${bracketStart}${s}${joined}${s}${bracketEnd}`

    // how position changed after replacing text
    const editStartCharacter = bracketRange.start.character

    // find where is cursorWord new position
    const positionChange = regexIndexOf(newBracketText, new RegExp(`\\b${cursorWord}\\b`))

    // replace text inside brackets
    editor
        .edit((editBuilder) => {
            editBuilder.replace(bracketRange!, newBracketText)
        })
        .then(() => {
            // select cursorWord new position
            editor.selection = new vscode.Selection(
                new vscode.Position(
                    bracketRange!.start.line,
                    editStartCharacter + positionChange,
                ),
                new vscode.Position(
                    bracketRange!.start.line,
                    editStartCharacter + positionChange + cursorWord.length,
                ),
            )
        })
}

function regexIndexOf(string: string, regex: RegExp, startpos = 0) {
    var indexOf = string.substring(startpos).search(regex)
    return indexOf >= 0 ? indexOf + startpos : indexOf
}
