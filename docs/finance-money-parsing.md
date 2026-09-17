# German money input parsing

## Display vs storage

- **Display:** `formatMoneyDe` → de-DE currency string (e.g. `1.234,56 €`)
- **Storage/API:** decimal string with `.` as decimal separator (e.g. `1234.5600`)

## Parsing (`parseMoneyDe`)

Accepted:

- `1.234,56`, `1234,56`, `0,99`
- `1.234` (thousand grouping → `1234`)
- `1234.56` (plain/API)
- optional `-` / `+`, spaces, `€` / `EUR`

Rejected without silent reinterpretation:

- empty / non-numeric
- ambiguous `1,234.56` (US grouping + decimal)

Use `parseMoneyDe` / `parseMoneyDeToFixed` from `@fbm/financial-core` before submitting forms.
Never use `Number("1.234,56")`.
