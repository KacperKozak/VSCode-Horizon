import * as vscode from 'vscode'
import { computeSwapForLine } from './lib/brackets'

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
    const currentLine = editor.document.lineAt(cursorAnchor.line).text

    const { result } = computeSwapForLine(
        currentLine,
        cursorAnchor.character,
        (dir === 1 ? 1 : -1) as 1 | -1,
    )
    if (!result) return

    const bracketRange = new vscode.Range(
        new vscode.Position(cursorAnchor.line, result.bracketLeft),
        new vscode.Position(cursorAnchor.line, result.bracketRight + 1),
    )

    editor
        .edit((editBuilder) => {
            editBuilder.replace(bracketRange, result.newBracketText)
        })
        .then(() => {
            editor.selection = new vscode.Selection(
                new vscode.Position(cursorAnchor.line, result.selectionStart),
                new vscode.Position(cursorAnchor.line, result.selectionEnd),
            )
        })
}
