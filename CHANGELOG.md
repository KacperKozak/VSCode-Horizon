# Change Log

## 2.2.0 - 2025-08-31

- Add: Detect and handle class lists in React props (className strings and `cn()` calls) enabling correct reordering of class tokens while respecting quotes and Tailwind arbitrary values
  - e.g. `className="p-2 bg-white text-sm"`, `className={cn("p-2 bg-white", isActive && "text-blue-600")}`
- Add: Detect and handle class lists in HTML-like tags via `class="..."` (non-React)
  - e.g. `<div class="p-2 bg-white text-sm"></div>`
- Add: Simple environment support — reorder plain words/identifiers and across mixed separators in non-bracketed text
  - e.g. `alpha beta gamma`, `user.profile.name`

## 2.1.0 - 2025-08-30

- Add: TypeScript generics support (detect and reorder `<T, U extends X, ...>`)

## 2.0.2 - 2025-08-30

- Fix: Preserve cursor column after horizontal moves (arrays, objects, unions, logical expressions, JSX props)
- Fix: Treat cursor at a closing bracket as inside the enclosing pair for environment detection

## 2.0.0 - 2025-08-30

- Swapped old compute logic for a new manipulation engine. Now it should handle more cases and edge cases
- Commands now keep a collapsed cursor at the original column (no selection juggling)
- VS Code integration tests exercising `horizon.move-right` and `horizon.move-left`

## 1.0.1 - 2025-08-29

- **Open VSX** marketplace support
- CI for publishing and testing
- Added `LICENSE`

## 1.0.0 - 2023-08-03

- Initial release
