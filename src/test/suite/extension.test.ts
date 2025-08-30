import * as assert from 'assert'
import * as vscode from 'vscode'

const activateExtension = async () => {
    const ext = vscode.extensions.getExtension('code-cooking.horizon')
    assert.ok(ext, 'Extension not found')
    await ext.activate()
}

const openDocWith = async (text: string): Promise<vscode.TextEditor> => {
    const doc = await vscode.workspace.openTextDocument({ content: text })
    const editor = await vscode.window.showTextDocument(doc)
    return editor
}

const setCursorAt = (editor: vscode.TextEditor, character: number, line = 0) => {
    const pos = new vscode.Position(line, character)
    editor.selection = new vscode.Selection(pos, pos)
}

const waitForLineEquals = async (
    editor: vscode.TextEditor,
    expected: string,
    line = 0,
    timeoutMs = 2000,
) => {
    const start = Date.now()
    for (;;) {
        const actual = editor.document.lineAt(line).text
        if (actual === expected) return
        if (Date.now() - start > timeoutMs) {
            assert.strictEqual(actual, expected, 'Timed out waiting for line equality')
            return
        }
        await new Promise((r) => setTimeout(r, 25))
    }
}

suite('Horizon commands', () => {
    test('horizon.move-right moves array element and keeps cursor column', async () => {
        await activateExtension()

        const from = 'const a = [1, 2, 3, 4]'
        const to = 'const a = [2, 1, 3, 4]'
        const editor = await openDocWith(from)

        const cursorChar = from.indexOf('1')
        setCursorAt(editor, cursorChar)

        await vscode.commands.executeCommand('horizon.move-right')
        await waitForLineEquals(editor, to)

        const active = editor.selection.active
        assert.ok(editor.selection.isEmpty, 'Selection should be collapsed')
        assert.strictEqual(active.line, 0)
        assert.strictEqual(active.character, cursorChar)
    })

    test('horizon.move-left reorders props and keeps cursor column', async () => {
        await activateExtension()

        const from = '<C a={1} b="x" c />'
        const to = '<C b="x" a={1} c />'
        const editor = await openDocWith(from)

        const cursorChar = from.indexOf('b=')
        setCursorAt(editor, cursorChar)

        await vscode.commands.executeCommand('horizon.move-left')
        await waitForLineEquals(editor, to)

        const active = editor.selection.active
        assert.ok(editor.selection.isEmpty, 'Selection should be collapsed')
        assert.strictEqual(active.line, 0)
        assert.strictEqual(active.character, cursorChar)
    })
})
