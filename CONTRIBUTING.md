# Contributing to TestDesk

Thanks for helping make TestDesk a better place to practice test automation. This guide covers how
to report problems, how to propose changes, and the conventions the codebase relies on.

Please be respectful and constructive in issues, reviews and discussions.

## Table of contents

- [Ways to contribute](#ways-to-contribute)
- [Reporting bugs](#reporting-bugs)
- [Suggesting features and challenges](#suggesting-features-and-challenges)
- [Development setup](#development-setup)
- [Workflow](#workflow)
- [Pull request checklist](#pull-request-checklist)
- [Coding conventions](#coding-conventions)
- [Common tasks](#common-tasks)

---

## Ways to contribute

- Report a bug or a confusing behavior.
- Add or improve a practice scenario in [`docs/scenarios.md`](docs/scenarios.md).
- Add a new Challenge Lab challenge.
- Improve an existing page, component or the mock backend.
- Fix documentation.

For anything larger than a small fix, please open an issue first so the approach can be agreed
before you spend time on it.

## Reporting bugs

Open an issue and include:

- **What you did** — the page, the steps, and the test tool if one was involved.
- **What you expected** and **what happened** instead.
- **Browser and version**, and whether it happens after **Settings → Reset demo data**.
- Screenshots, console errors or a short test script if you have them.

Some behavior is **deliberately difficult** (random loaders, unstable IDs in the Challenge Lab,
elements that move or detach). If you are unsure whether something is a bug or part of a
challenge, check the Capabilities page or the challenge's goal and hints first.

## Suggesting features and challenges

A good proposal explains which real-world automation problem it lets people practice, where it
would live (a production-like page or the Challenge Lab), and how a tester would know they
succeeded.

---

## Development setup

You need [Node.js](https://nodejs.org/) 24 LTS (see [`.nvmrc`](.nvmrc)) and npm.

```bash
git clone https://github.com/hhhameem/acmedesk-automation-playground.git
cd acmedesk-automation-playground
npm install
npm run dev        # http://localhost:4040
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run typecheck` | Type-check the project |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the production build |

After changing files in `src/mocks/`, hard-refresh (`Ctrl+Shift+R`) so the service worker picks up
the new handlers. After changing a Tailwind config file, restart the dev server.

---

## Workflow

1. **Branch from `main`** using a short, descriptive name with a type prefix:
   `feat/canvas-challenge`, `fix/kanban-drop`, `docs/sign-in-scenarios`, `chore/deps`.
2. **Commit using [Conventional Commits](https://www.conventionalcommits.org/)**, as the history
   already does:

   ```
   feat: add stale element challenge to the Challenge Lab
   fix: keep ticket filters when returning from a detail page
   docs: add sign-in scenarios
   ```

   Common types: `feat`, `fix`, `docs`, `refactor`, `perf`, `style`, `chore`.
3. **Keep pull requests focused.** One feature or fix per pull request is much easier to review.
4. **Open a pull request against `main`** describing what changed and why, how you tested it, and
   screenshots for visual changes. Link the issue it resolves.

## Pull request checklist

Before requesting a review, check that:

- [ ] `npm run build` passes (it type-checks first).
- [ ] You tried the change in the browser, including **dark mode**, **Arabic (right-to-left)**
      and a **phone-width** window for UI changes.
- [ ] Existing `data-testid` values are unchanged, or the pull request clearly lists any that
      changed (see [Test IDs](#test-ids)).
- [ ] The **Capabilities** page ([`src/pages/Capabilities.tsx`](src/pages/Capabilities.tsx)) and
      [`docs/scenarios.md`](docs/scenarios.md) describe any new or changed behavior.
- [ ] The [README](README.md) is updated if routes, commands or configuration changed.
- [ ] No console errors or warnings were introduced.

---

## Coding conventions

### General

- **TypeScript in strict mode.** Avoid `any`; model data in [`src/lib/domain.ts`](src/lib/domain.ts).
- **Match the surrounding style** of the file you are editing.
- **New pages are lazy-loaded.** Register them in [`src/app/App.tsx`](src/app/App.tsx) with
  `lazyPage()` so they get their own chunk and a loading skeleton.

### UI and mock backend stay separate

- UI code talks to the mock backend **only through the REST API** (`src/lib/api.ts`). It must not
  import from `src/mocks/`; this keeps seed data and faker out of the app bundle.
- Shared types and constants live in [`src/lib/domain.ts`](src/lib/domain.ts).
- Handlers in [`src/mocks/handlers.ts`](src/mocks/handlers.ts) read and write through
  `store.read()` / `store.write()`, validate their input, and return clear error messages with
  proper status codes.
- When you change seed data or the shape of a record, bump `SEED_VERSION` in
  [`src/mocks/store/index.ts`](src/mocks/store/index.ts) so existing browsers reseed.

### Test IDs

People write tests against this site, so selectors are part of its public interface.

- Give interactive and important elements a descriptive, kebab-case `data-testid`
  (`ticket-search`, `bulk-delete`, `kanban-move-<ref>`).
- **Do not rename or remove existing test IDs on production-like pages.** If you must, list the
  change in the pull request as a breaking change and update the docs.
- Deliberately unstable selectors belong **only in the Challenge Lab**.

### Styling, accessibility and locales

- Use Tailwind utilities. Every color needs a matching `dark:` variant.
- Use logical spacing and positioning (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) instead of
  left/right, so layouts work in right-to-left Arabic.
- Give form fields labels and icon buttons an `aria-label`, and keep everything usable by
  keyboard. Realistic, accessible markup is what makes role- and label-based locators work.

### The landing page

[`index.html`](index.html) is static HTML so search engines can read it without JavaScript.

- Keep all content in the HTML. The script in [`src/landing/landing.ts`](src/landing/landing.ts)
  only adds interactivity.
- Keep the inline `<head>` script tiny (it only sets the `js` and `dark` classes). Never read
  `localStorage` there: it can delay the first paint by seconds on slow phones.
- Dark mode is driven only by the `dark` class on `<html>`. Style dark backgrounds with `dark:`
  utilities or `html.dark` selectors, not a `prefers-color-scheme` media query, so backgrounds and
  text always switch together.
- Keep the figures in sync when they change: the number of practice tasks and challenges appears
  in `index.html` and in `public/og-image.png`.
- If the app's look changes noticeably, retake the screenshots in `public/screens/` (WebP at 720
  and 1440 px wide).

---

## Common tasks

### Add a Challenge Lab challenge

1. Create the component in `src/features/challenges/items/`, using an existing challenge as a
   template.
2. Register it in [`src/features/challenges/registry.tsx`](src/features/challenges/registry.tsx)
   with a `slug`, `title`, `blurb`, `tier` (`easy`, `medium` or `hard`), `tags` and the component.
3. Add its tasks to the **C17 — Challenge Lab** section of
   [`docs/scenarios.md`](docs/scenarios.md) and an entry on the Capabilities page.
4. Add it to the Challenge Lab list on the landing page and update the challenge count (see
   [The landing page](#the-landing-page)).

### Add a practice scenario

Add it to the matching section of [`docs/scenarios.md`](docs/scenarios.md) with the next free ID
and the same format as its neighbors:

```markdown
### C6-05 — Short task title

- **Tier:** easy | medium | hard
- **Preconditions:** where to start and what must be true
- **Task:** what the tester should automate
- **Expected:** how they can tell it worked
```

Update the task count on the landing page if the total changes.

### Add an API endpoint

Add the handler to [`src/mocks/handlers.ts`](src/mocks/handlers.ts) using `store.read()` or
`store.write()`, validate the request body, and call it from the UI through `src/lib/api.ts`. If
it needs a new collection, add the type to [`src/lib/domain.ts`](src/lib/domain.ts), the
collection to [`src/mocks/store/types.ts`](src/mocks/store/types.ts), seed it in
[`src/mocks/data.ts`](src/mocks/data.ts), and bump `SEED_VERSION`.
