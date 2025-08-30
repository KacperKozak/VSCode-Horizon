# Horizon

Move pieces of code horizontally. Think `Alt+Up/Down`, but sideways.

Horizon lets you nudge list items, object props, function params, union members, logical operands, and even JSX props left and right without breaking a sweat (or your formatting).

## Why?

Because reordering `[1, 2, 3]` to `[2, 1, 3]` with three backspaces and a prayer is a rite of passage we can skip.

## Features

- Move array elements: `[┇1, 2, 3, 4]` → `[2, ┇1, 3, 4]`
- Reorder object properties: `{ a: 1, ┇b: 2, c: 3 }` → `{ a: 1, c: 3, ┇b: 2 }`
- Shuffle function params (typed too): `(x: A, ┇y: B, z: C)` → `(x: A, z: C, ┇y: B)`
- Navigate union members: `A | B | ┇C` → `A | ┇C | B`
- Handle logical chains: `a && b || ┇c && d` → `a && ┇c || b && d`
- Play nice with JSX props: `<C a={1} ┇b="x" c />` → `<C ┇b="x" a={1} c />`

It understands nested structures (arrays in objects, callbacks in props), so your cursor lands where it should, not where it can.

## Commands

- Move right: `horizon.move-right`
- Move left: `horizon.move-left`

Default keybindings:

- macOS: `cmd+alt+]` / `cmd+alt+[`
- Windows/Linux: `ctrl+alt+]` / `ctrl+alt+[`

## How it works (briefly)

Under the hood, Horizon detects the current environment (array, object, function params, union, logical expression, or JSX props), splits it into chunks, then swaps elements while preserving separators and whitespace. The cursor remains connected to the original element when you move, so you can keep moving it forward or backward.

## Testing

- Unit tests run with Bun: `bun run test`
- VSCod e2e tests: `bun run compile && bun run test:e2e`

Both are wired into CI. If it breaks, it doesn’t ship.

## Requirements

- VS Code 1.79+

## Release Notes

See `CHANGELOG.md` for full details.
