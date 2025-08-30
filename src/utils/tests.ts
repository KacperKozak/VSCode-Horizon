/** Use '┇' as a cursor to indicate the position of the cursor */
export const codeCursor = (codeWithCursor: string) => {
    const cursor = codeWithCursor.indexOf('┇')
    const code = codeWithCursor.replace('┇', '')
    return { code, cursor }
}
