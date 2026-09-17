# CSV export security

## Separator

Semicolon (`;`) with UTF-8 BOM for Excel/de-DE.

## Formula injection

User-controlled text cells beginning with `=`, `+`, `-`, `@`, tab, or CR are prefixed with `'` so spreadsheet apps treat them as text.

Plain numeric cells such as `-12.5` remain numeric (not prefixed).

Formula-like strings such as `-1+2` or `=CMD()` are neutralized.

Helper: `csvEscapeCell` / `toCsvDocument` / `neutralizeCsvFormula` in `@fbm/financial-core`.
