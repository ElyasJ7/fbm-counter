# docs/quality-checklist.md
# Manual responsive / a11y smoke checklist (Phase 9 Quality)

## Responsive
- [ ] Mobile (<640px): hamburger opens sidebar; overlay closes it
- [ ] Mobile: Log out visible in sidebar footer
- [ ] Mobile: Global search usable in header
- [ ] Tablet: tables scroll horizontally without breaking layout
- [ ] Desktop: sidebar static; user block + logout in header

## Accessibility
- [ ] Skip link appears on Tab from page load and jumps to main
- [ ] Focus rings visible on buttons, links, inputs
- [ ] Notification panel closes with Escape
- [ ] Search combobox closes with Escape; Enter opens first hit
- [ ] Decorative icons are aria-hidden; icon-only buttons have aria-label

## Auth smoke
- [ ] VIEWER cannot create invoices (UI hides write actions; API returns 403)
- [ ] Logout clears session on mobile and desktop
