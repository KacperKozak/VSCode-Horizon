import * as vscode from 'vscode'
import { manipulateLine } from './lib/manipulator'

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

    const { text, cursor } = manipulateLine(
        currentLine,
        cursorAnchor.character,
        (dir === 1 ? 1 : -1) as 1 | -1,
    )
    if (text === currentLine) return

    const lineRange = editor.document.lineAt(cursorAnchor.line).range

    editor
        .edit((editBuilder) => {
            editBuilder.replace(lineRange, text)
        })
        .then(() => {
            const newChar = Math.min(cursor, text.length)
            const pos = new vscode.Position(cursorAnchor.line, newChar)
            editor.selection = new vscode.Selection(pos, pos)
        })
}
