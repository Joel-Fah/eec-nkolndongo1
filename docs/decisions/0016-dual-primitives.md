# 0016 — Dual primitives: native Astro on the public site, Base UI in the admin
**Status:** Accepted · 2026-10-19
**Context:** The public site must stay tiny on mid-range phones and paid data (≤ 100 KB JS); the admin is a
logged-in app where a React runtime is fine. Both must look identical and every dropdown, select, dialog
must look on-brand — never browser- or library-default.
**Decision:**
- **One stylesheet** (`packages/ui/styles/components.css`) styles both, with tokens only and no one-sided
  borders (frames are inset box-shadows).
- **Public (Astro):** components in `packages/ui/astro` on native `<dialog>`, `[popover]`, `<details>` and a
  styled native `<select>`, plus ~2 KB of delegated vanilla TS (`packages/ui/src/primitives.ts`). **No React
  runtime on ordinary pages**; React islands only for complex future widgets.
- **Admin (React):** `packages/ui/react` on **Base UI** (chosen over Radix: it ships Select, Combobox, Drawer,
  Toast and Menu in one package, with unstyled parts we skin with the shared classes).
- **Strings** come from the caller (`packages/i18n`); the primitives hold none.
- Both flavours are documented with live demos in `/fr/_brand` → Composants; the React ones also have the
  admin `/ui` gallery.
**Consequences:** Two implementations of each behaviour to keep in step (mitigated by the shared CSS and
the documentation page). Measured result: public pages ship **5.4 KB** of JS (gz).
