import * as vscode from 'vscode'

type Brackets = [string, string]

/*
Works for
	[ test, test2 ]
	{ test1: 'a', test2: 2, test }
	[ 321, 432, 543 ]
	
Mostly works for (treats element name as one of elements in array)
	<div key={i} color={color} data-test={key}>
	
Don't work (TODO)
	(key: Key, value: number) => {}
	if (some && condition || here)
	type Union = 'a' | 'b' | 'c'
	{ obj: { a, b }, arr: [x, y] }
	[ [123, 123], [321, 321] ]
*/

interface BracketType {
    bracket: Brackets
    separator: string
    joiner: string
    word: RegExp | undefined
}

const types: BracketType[] = [
    { bracket: ['<', '>'], separator: ' ', joiner: ' ', word: /[^<>\s]+/ },
    { bracket: ['{', '}'], separator: ',', joiner: ', ', word: /[^{}\,]+/ },
    { bracket: ['[', ']'], separator: ',', joiner: ', ', word: /[^[\]\,]+/ },
    { bracket: ['(', ')'], separator: ',', joiner: ', ', word: /[^()\,]+/ },
]

export function activate(context: vscode.ExtensionContext) {
    const moveRight = vscode.commands.registerCommand('horizon.move-right', () => {
        moveWord(+1)
    })

    const moveLeft = vscode.commands.registerCommand('horizon.move-left', () => {
        moveWord(-1)
    })

    context.subscriptions.push(moveRight, moveLeft)
}

// This method is called when your extension is deactivated
export function deactivate() {}

const moveWord = (dir = 1) => {
    const editor = vscode.window.activeTextEditor
    if (!editor) return

    const cursorAnchor = editor.selection.anchor

    // get everything that is inside brackets
    let bracketRange: vscode.Range | undefined
    let bracketType: BracketType | undefined

    for (const type of types) {
        const currentLine = editor.document.lineAt(cursorAnchor.line).text

        // console.log(type.bracket.join(''), cursorAnchor.character, '----')
        // TODO
        splitByBracket(currentLine, type.bracket, type.separator, cursorAnchor.character)

        const range = editor.document.getWordRangeAtPosition(
            cursorAnchor,
            new RegExp(`\\${type.bracket[0]}.+?\\${type.bracket[1]}`),
        )
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

    // console.log(cursorWord)
    // console.log(bracketText)
    // console.log(bracketTextArray)

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

    // find cursorWord new position
    const positionChange = (() => {
        let change = 0
        for (const item of newBracketTextArray) {
            if (item === cursorWord) break
            change += item.length + bracketType!.joiner.length
        }
        return change + bracketType!.joiner.length
    })()

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
                    bracketRange!.start.character + positionChange,
                ),
                new vscode.Position(
                    bracketRange!.start.line,
                    bracketRange!.start.character + positionChange + cursorWord.length,
                ),
            )
        })
}

// split by bracket including nested brackets and cursor position
const splitByBracket = (
    text: string,
    [l, r]: Brackets,
    separator: string,
    cursorPosition: number,
) => {
    // find first bracket left of cursor
    let pos = cursorPosition
    let leftBracketPos = -1
    while (text[pos]) {
        if (text[pos] === l) {
            leftBracketPos = pos
            break
        }
        pos--
    }

    // find first bracket right of cursor including nested brackets
    pos = cursorPosition
    let rightBracketPos = -1
    let nestedBrackets = 0
    while (text[pos]) {
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

    // find left current item position by the cursor
    let leftCurrentPos = cursorPosition
    while (text[leftCurrentPos - 1]) {
        if (text[leftCurrentPos - 1] === separator) {
            break
        }
        if (text[leftCurrentPos - 1] === l) {
            break
        }
        leftCurrentPos--
    }

    // find left current item position by the cursor including nested brackets
    let rightCurrentPos = cursorPosition
    let currentPosNested = 0
    while (text[rightCurrentPos]) {
        if (text[rightCurrentPos + 1] === separator) {
            break
        }
        if (text[rightCurrentPos + 1] === r) {
            break
        }
        if (text[rightCurrentPos + 1] === l) {
            currentPosNested++
        } else if (text[rightCurrentPos + 1] === r) {
            if (currentPosNested === 0) {
                break
            }
            currentPosNested--
        }
        rightCurrentPos++
    }

    const currentItemText = text.slice(leftCurrentPos, rightCurrentPos + 1)

    const bracketText = text.slice(leftBracketPos + 1, rightBracketPos)

    const result: string[] = []

    // split by separator including nested brackets
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

    // console.log(l, r, '---------')
    // console.log(bracketText)
    // console.log(trimmed)
    // console.log(currentItemText)
}
