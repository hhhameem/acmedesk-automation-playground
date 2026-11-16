# TestDesk — Code Review Findings

Review date: 2026-11-16 · Scope: the whole `src/` tree, config, `README.md` and `docs/scenarios.md`.

This list covers **real bugs and improvements only**. Behaviour that is deliberately hostile to automation is left out: flaky or failing endpoints, injected latency, unstable IDs, moving targets, occlusion, early-dismissing toasts, closed shadow DOM, hover-only triggers, native dialogs, the random password and OTP flow, and so on. Each item was checked against the code. Items marked ✅ were also confirmed by hand, either by re-reading the code or by running it.

**Severity:**
- 🔴 **High:** crashes, or a core flow is broken.
- 🟠 **Medium:** wrong behaviour, or a documented scenario can't be completed.
- 🟡 **Low:** an edge case or polish.
- 🔵 **Improvement:** not a bug.

---

## 🔴 High

### 1. Entering tags in the New Ticket wizard crashes the Tickets list and the ticket page ✅
- **Where:** [NewTicketWizard.tsx:57](src/pages/NewTicketWizard.tsx#L57), [handlers.ts:208](src/mocks/handlers.ts#L208), [Tickets.tsx:481](src/pages/Tickets.tsx#L481), [TicketDetail.tsx:237](src/pages/TicketDetail.tsx#L237)
- **What happens:**
  - The `<TagInput>` stores tags as a comma-joined **string**. The wizard POSTs the form as-is, so the mock server saves `tags: "a,b"` where it expects a `string[]`.
  - `/tickets` then throws `t.tags.map is not a function`, and so does the ticket detail page.
  - Any search also throws inside the handler's `t.tags.join` ([handlers.ts:93](src/mocks/handlers.ts#L93)).
- **Fix:** In the wizard's `mutationFn`, send `tags: form.tags.split(',').map(s => s.trim()).filter(Boolean)`. Also normalise the value on the server.

### 2. Ticket actions fail when the ticket was opened by its ref (`TCK-xxxx`) ✅
- **Where:** [Dashboard.tsx:218](src/pages/Dashboard.tsx#L218), [handlers.ts:180-246](src/mocks/handlers.ts#L180-L246), [TicketDetail.tsx:46-80](src/pages/TicketDetail.tsx#L46-L80)
- **What happens:**
  - The dashboard activity feed links to `/tickets/<ref>`. `GET /api/tickets/:id` matches by id **or** ref, so the page loads.
  - `PATCH`, `DELETE` and the comment POST match by **id only**. Changing status, escalating or deleting returns 404 "Ticket not found".
  - Posting a comment shows "Comment added", but the comment is saved under the ref and never appears.
  - Orders have the same split: GET accepts a ref, but ship, advance, refund and cancel don't.
- **Fix:** Use `data.ticket.id` (the real id) for every mutation URL in `TicketDetail`. Also add one shared `findByIdOrRef` helper for every ticket and order handler.

### 3. The modal moves focus to "Close" on every parent re-render ✅
- **Where:** [Modal.tsx:42-82](src/components/Modal.tsx#L42-L82)
- **What happens:**
  - The focus-trap effect depends on `[open, onClose]`, and every caller passes an inline `onClose`. Each parent re-render re-runs the effect, which focuses the first focusable element: the header **Close** button.
  - Typing "25" one key at a time into the Inventory "Adjust stock" input enters "2". Focus then jumps to Close, and the "5" is lost. If Enter or Space is pressed next, the modal closes.
  - Playwright's `pressSequentially`/`type` and real keyboard users hit this. `fill()` hides it.
- **Fix:** Keep `onClose` in a ref, run the effect on `[open]` only, and set the initial focus once.

### 3b. The nested vendor iframes show the app's 404 page instead of the vendor portal ✅
- **Where:** [mockServiceWorker.js:95](public/mockServiceWorker.js#L95), [handlers.ts](src/mocks/handlers.ts) (`/embed/vendor`, `/embed/vendor/status`), [Settings.tsx:303](src/pages/Settings.tsx#L303), [NestedIframesChallenge.tsx:45](src/features/challenges/items/NestedIframesChallenge.tsx#L45)
- **What happens:**
  - The mock service worker deliberately bypasses page navigations (`request.mode === 'navigate'`), and an iframe's `src` load counts as one.
  - The `/embed/vendor` HTML handlers therefore never run. The dev server returns the app shell, and the React router shows `/404` inside the iframe.
  - Confirmed in a browser on `/settings`: the frame URL is `http://localhost:5199/404`.
  - This breaks the C8 nested-iframe and `postMessage` scenarios and the Nested Iframes challenge.
  - The Dashboard "Embedded analytics" panel had the same problem and was rebuilt as an app route (`/embed/analytics` with `/api/analytics`).
- **Fix:** Use the same approach: make `/embed/vendor` and `/embed/vendor/status` app routes. Alternatively, ship them as static files in `public/embed/`, which the dev server and Netlify serve directly.

---

## 🟠 Medium

### 4. Double-clicking Send posts duplicate comments ✅
- **Where:** [TicketDetail.tsx:213-218](src/pages/TicketDetail.tsx#L213-L218)
- **What happens:** The button is disabled only by text length, not while the request is pending. `docs/scenarios.md` AD-09 explicitly says the comment Send button disables while pending.
- **Fix:** Add `|| commentMutation.isPending` to `disabled`. Also add `disabled={escalateMutation.isPending}` to `escalate-confirm`.

### 5. Bulk selection survives paging and filtering, so bulk delete removes hidden tickets
- **Where:** [Tickets.tsx:39](src/pages/Tickets.tsx#L39), [Tickets.tsx:74-78](src/pages/Tickets.tsx#L74-L78), [Tickets.tsx:376-397](src/pages/Tickets.tsx#L376-L397)
- **What happens:** Select 3 rows, then change the page or a filter. The bar still says "3 selected", and "Delete selected" deletes tickets the user can't see.
- **Fix:** Clear `selected` when filters, page or view change, or limit it to the ids in the current `items`.

### 6. Bulk delete reports every selected ticket as deleted, even when some fail
- **Where:** [Tickets.tsx:184-191](src/pages/Tickets.tsx#L184-L191)
- **What happens:** Each delete has `.catch(() => null)`, and the result modal shows `ids.length`. With a failure rate set, it says "5 deleted" when only 3 were.
- **Fix:** Use `Promise.allSettled`, count the fulfilled results, report the failures, and keep the failed ids selected.

### 7. The "Page size" setting does nothing on most lists
- **Where:** [Settings.tsx:29](src/pages/Settings.tsx#L29), [config.ts:6](src/mocks/config.ts#L6). The hard-coded `pageSize` is in Orders, Inventory, Returns and Customers.
- **What happens:** README and scenarios say this setting controls rows per page. Each list page sends its own `pageSize`, which overrides it.
- **Fix:** Have list pages omit `pageSize` (or read it from `mockConfig`). Otherwise, change the docs.

### 8. The documented selector `save-backend` doesn't exist ✅
- **Where:** [Settings.tsx:253](src/pages/Settings.tsx#L253) (actual id `save-simulation`), [Capabilities.tsx:359](src/pages/Capabilities.tsx#L359), [Capabilities.tsx:439](src/pages/Capabilities.tsx#L439), [scenarios.md:444](docs/scenarios.md#L444)
- **What happens:** Testers following AD-05 never find the button. The docs also say there are 3 Save buttons, but `save-navigation` makes 4.
- **Fix:** Rename the testid to `save-backend`, or update both docs and list all four buttons.

### 9. The Capabilities catalog never shows the selectors it defines
- **Where:** [Capabilities.tsx:811-916](src/pages/Capabilities.tsx#L811-L916)
- **What happens:** About 95 `selector` strings are defined, but the table renders only name, page, trigger and tier. Searching for e.g. `otp-input` also finds nothing.
- **Fix:** Add a Selector column, or a `<code>` line under the trigger, and include `selector` in the search filter.

### 10. Ticket refs aren't unique
- **Where:** [data.ts:122](src/mocks/data.ts#L122), [handlers.ts:199](src/mocks/handlers.ts#L199)
- **What happens:** Refs are a random `TCK-1000..9999`. The fixed seed produces 4 duplicate pairs: TCK-8791, 9010, 8199 and 7929. TCK-8791 is also an activity-feed target, so a ref link or search can open the wrong ticket.
- **Fix:** Use sequential refs (`TCK-${1000 + i}`, as orders already do) or re-roll on collision.

### 11. A shipment marked as an exception gets stuck or goes back to the start ✅
- **Where:** [handlers.ts:484-492](src/mocks/handlers.ts#L484-L492), [OrderDetail.tsx:83-155](src/pages/OrderDetail.tsx#L83-L155)
- **What happens:**
  - After "Mark exception", "Advance" computes `indexOf('exception') + 1 = 0`, which sends the parcel back to `label_created`.
  - On the order page, every stage option is disabled, so the order can't move forward.
- **Fix:** Take the current stage from the last non-exception event, and handle `exception` explicitly in `OrderDetail`.

### 12. Lists show stale data after changes (missing cache invalidation)
- **Where:** [NewTicketWizard.tsx:58](src/pages/NewTicketWizard.tsx#L58), [TicketDetail.tsx:49](src/pages/TicketDetail.tsx#L49), [TicketDetail.tsx:70](src/pages/TicketDetail.tsx#L70), [NewOrder.tsx:59](src/pages/NewOrder.tsx#L59), [OrderDetail.tsx:31](src/pages/OrderDetail.tsx#L31), [Shipments.tsx:52](src/pages/Shipments.tsx#L52)
- **What happens:** `staleTime` is 15 s ([main.tsx:13](src/main.tsx#L13)). A new ticket or order, or a status change, doesn't show in the related list for up to 15 s.
- **Fix:** Also invalidate the related query prefixes: `['tickets']`, `['orders']`, `['shipments']`, `['returns']` and `['stats']`.

### 13. If the mock service worker fails to start, the page stays blank ✅
- **Where:** [main.tsx:18-33](src/main.tsx#L18-L33)
- **What happens:** `enableMocking().then(render)` has no `.catch`. In a Firefox private window, or over plain http on a LAN IP, service workers are unavailable, so React never mounts.
- **Fix:** Add a `.catch` that renders a clear "Service workers are required" message, or renders anyway.

### 14. Inventory CSV export ignores the search box
- **Where:** [handlers.ts:315-326](src/mocks/handlers.ts#L315-L326)
- **What happens:** Search "cable" and then export, and the CSV contains every product. The tickets and orders exports follow the filters.
- **Fix:** Apply the same `q` filter as `GET /api/inventory`, ideally through one shared filter function.

### 15. Report PDFs have wrong byte offsets and a garbled title
- **Where:** [handlers.ts:667](src/mocks/handlers.ts#L667), [pdf.ts:12-39](src/mocks/pdf.ts#L12-L39)
- **What happens:** The title contains an em dash (`—`). `createPdf` measures lengths in JS characters, but the response is UTF-8. `/Length` and the xref offsets end up 2 bytes off, and the dash renders as `â€”`. Strict PDF parsers may reject the file.
- **Fix:** Use `-` in titles, and have `createPdf` strip non-ASCII characters and count bytes with `TextEncoder`.

### 16. Settings accordion: following C16-01 collapses the SLA panel instead of expanding it ✅
- **Where:** [Accordion.tsx:17](src/components/Accordion.tsx#L17), [scenarios.md:361-363](docs/scenarios.md#L361-L363)
- **What happens:** The first item (`sla`) is open by default, so clicking it as the scenario says **closes** it.
- **Fix:** Default to nothing open (or add a `defaultOpenId` prop), or update the scenario.

### 17. A pointer click closes the profile menu that hover just opened ✅
- **Where:** [HoverClickDropdown.tsx:51-60](src/components/HoverClickDropdown.tsx#L51-L60)
- **What happens:** Playwright's `click()` moves the mouse first, which fires `mouseenter` and opens the menu. The click then toggles it closed. AD-01b says click-only tools must succeed.
- **Fix:** Make click open-only, and close on outside click, Esc or mouse-out. Alternatively, ignore a toggle-close that comes within about 300 ms of a hover-open.

### 18. Challenge goals that can't be verified as written
- **Where and what:**
  - [NestedIframesChallenge.tsx:15](src/features/challenges/items/NestedIframesChallenge.tsx#L15): goal 1 says "the outer count must increase", but the challenge page has no `message` listener and no counter.
  - [ObscuredChallenge.tsx:17](src/features/challenges/items/ObscuredChallenge.tsx#L17) ✅: goal 3 mentions a toast that overlaps the action, but none is ever shown.
  - [DragDropChallenge.tsx:20-26](src/features/challenges/items/DragDropChallenge.tsx#L20-L26): `log()` runs inside a `setOrder` updater, so StrictMode logs every move twice and creates duplicate keys. `draggingCard` is never cleared, which logs stale moves. Goal 3's "card counts" are never shown.
- **Fix:** Add the missing counter and the toast. In DragDrop, log outside the updater, clear the card on `dragend`, and show the counts.

### 19. Rate-limited attempt counter goes up by 2 per click ✅
- **Where:** [FlakyNetworkChallenge.tsx:30-36](src/features/challenges/items/FlakyNetworkChallenge.tsx#L30-L36)
- **Fix:** Remove the `+ 1` from the success and error branches (`loadFlaky` already does this correctly).

### 20. "Reset feed" during a load corrupts the infinite-scroll feed
- **Where:** [InfiniteScrollChallenge.tsx:41-83](src/features/challenges/items/InfiniteScrollChallenge.tsx#L41-L83)
- **What happens:** A response that was still in flight lands after the reset and appends an old page. Rows from page 1 never come back, and the target row may become unreachable.
- **Fix:** Use a generation counter (or `AbortController`) and drop outdated responses.

---

## 🟡 Low

| # | Where | Problem | Fix |
|---|-------|---------|-----|
| 21 | [NewTicketWizard.tsx:31](src/pages/NewTicketWizard.tsx#L31), [handlers.ts:212](src/mocks/handlers.ts#L212) | A ticket with no due date shows "Due: Invalid Date" (`''` survives `??`). | Send `undefined`, and use `\|\|` on the server. |
| 22 | [TicketDetail.tsx:45-80](src/pages/TicketDetail.tsx#L45-L80) | Status, escalate and delete mutations have no `onError`, so failures are silent and the select just snaps back. | Add an error toast to each. |
| 23 | [Tickets.tsx:77](src/pages/Tickets.tsx#L77), [Tickets.tsx:285](src/pages/Tickets.tsx#L285) | Search adds a history entry per keystroke: typing "printer" takes 7 Back presses to leave. | Use `replace: true` for `q`, or debounce it. |
| 24 | [handlers.ts:46-57](src/mocks/handlers.ts#L46-L57), list pages | `?page=-1`, `0`, `abc` or `99` gives odd slices or an empty state with no pagination to get back. | Clamp `page` and `pageSize` in `paginate`, and clamp in the UI. |
| 25 | [Inventory.tsx:41](src/pages/Inventory.tsx#L41), [Inventory.tsx:241-249](src/pages/Inventory.tsx#L241-L249) | Stock adjust accepts negative, blank or fractional values. | Validate as an integer ≥ 0 and show an inline error. |
| 26 | [NewOrder.tsx:84](src/pages/NewOrder.tsx#L84), [OrderDetail.tsx:200](src/pages/OrderDetail.tsx#L200) | Fractional quantities are accepted, and the same product on two lines gives duplicate React keys. | Use `Number.isInteger(q) && q >= 1`, and merge duplicate products. |
| 27 | [Shipments.tsx:124](src/pages/Shipments.tsx#L124) | The status filter offers "pending", which can never match. | Remove the option. |
| 28 | [Reports.tsx:30](src/pages/Reports.tsx#L30), [Reports.tsx:120](src/pages/Reports.tsx#L120) | Two summary reports on the same day get duplicate `download-*` testids. | Build the testid from `r.id`. |
| 29 | [Settings.tsx:17-20](src/pages/Settings.tsx#L17-L20) | The `postMessage` listener doesn't check `origin` or `source`. | Check that `e.origin` is the page's own origin and `e.source` is the vendor iframe. |
| 30 | [Inventory.tsx:104](src/pages/Inventory.tsx#L104), [Shipments.tsx:141](src/pages/Shipments.tsx#L141) | Filter dropdown options vanish during every refetch. | Use `placeholderData: keepPreviousData`. |
| 31 | [store/auth.ts](src/store/auth.ts), [store/ui.ts](src/store/ui.ts) | Signing out in one tab can be undone by a write in another tab. | Listen for `storage` events and call `persist.rehydrate()`. |
| 32 | [RequireAuth.tsx:9](src/app/RequireAuth.tsx#L9) | The post-login redirect drops the query string and hash. | Navigate to `pathname + search + hash`. |
| 33 | [StaleElementChallenge.tsx:46-48](src/features/challenges/items/StaleElementChallenge.tsx#L46-L48) | The cleanup `setTimeout` isn't tracked, so it leaks after unmount and quick reloads overlap. | Store timer ids and clear them on unmount. |
| 34 | [DelayedAsyncChallenge.tsx:15-18](src/features/challenges/items/DelayedAsyncChallenge.tsx#L15-L18) | On a revisit the cached data shows instantly, with no skeleton. | Set `gcTime: 0, staleTime: 0` for this query. |
| 35 | [Tooltip.tsx:14-26](src/components/Tooltip.tsx#L14-L26) | Hidden only by `opacity-0`, so Playwright always treats it as visible. It is also offset in RTL. | Use `invisible`/`visible`, and add `rtl:translate-x-1/2`. |
| 36 | [FileUpload.tsx:88-99](src/features/files/FileUpload.tsx#L88-L99) | Uploading the same filename twice gives duplicate keys, and one Remove deletes both. Space doesn't activate the dropzone. | Key by a generated id, and handle Space. |
| 37 | [ContextMenu.tsx:20-36](src/components/ContextMenu.tsx#L20-L36) | Can open off-screen near the edges, and Esc doesn't close it. | Reuse DropdownMenu's clamping, and add an Escape handler. |
| 38 | [ConsentBanner.tsx:10-31](src/components/ConsentBanner.tsx#L10-L31) | "Reset consent" only brings the banner back after a reload, and "Decline" stores `accepted`. | Listen for a reset event, and store `declined`. |
| 39 | Challenges | Missing or incorrect labels:<br>• the Detached note `<label>` has no `htmlFor`<br>• the LogicGate input has no label<br>• the LogicGate heading says "2" and should be "3"<br>• the UnstableIds docs mention testids the component doesn't render | Fix the labels and the docs. |

---

## 🔵 Improvements

1. **Bundle size and code splitting.** The main chunk is about **1.35 MB**. Pages import plain constants from `@/mocks/data`, which pulls **faker and all the seed data** into the main bundle. All routes are imported eagerly.
   - Move the constants and types to `src/lib/constants.ts`.
   - Load pages with `React.lazy`, especially the Challenge Lab, Dashboard (recharts) and Reports.
2. **Tooling.** There are no lint, test or format scripts.
   - Add ESLint with `react-hooks` (it would have caught #3), and Vitest.
   - Good first tests: `paginate`/filters, `lib/otp.ts`, password generation and `createPdf`.
   - `@types/dompurify` is redundant and can be removed.
3. **Keep the docs in sync with the code.** Challenge selectors and goals are written by hand in three places: the components, `Capabilities.tsx` and `scenarios.md`. Items 8, 16, 18 and 38 are this kind of drift.
   - Generate the Capabilities Challenge Lab section from `registry.tsx`.
   - Add a CI check that every `[testid]` named in the docs exists in `src/`.
4. **Docs are out of date after the login changes.** README says "no authentication", and `docs/scenarios.md` has no scenario for the dynamic password, emailed OTP or demo inbox. Add a login/OTP scenario tier.
5. **Split `Tickets.tsx` (595 lines).** Extract `useTicketFilters`, `useTicketMutations`, `TicketsTable` and `BulkBar`. Orders, Inventory, Shipments and Returns duplicate the filter, page and export logic and keep it in component state, so Back loses their filters. A shared, URL-backed `useListParams` hook would fix both problems.
6. **Consistent testids and accessibility.**
   - Returns uses the same `return-next`/`return-reject` on every row, and should add a `-${ref}` suffix per row.
   - Several filters and selects have no testid.
   - Sort headers need `aria-sort`.
   - Modal needs `aria-labelledby` and should return focus on close.
   - RichTextEditor needs an accessible name: `label htmlFor="description"` points at nothing.
   - The SavedViews rename and delete buttons need `focus:opacity-100`.
7. **Kanban drag and drop.** Call `dataTransfer.setData` (needed for Firefox), skip drops onto the same column, and fix the `dragleave` flicker.
8. **Theme and locale.**
   - Theme and RTL are applied after first paint, which causes a brief light, left-to-right flash. Apply them before React renders.
   - Dashboard chart colours are hard-coded for light mode.
   - `lib/format.ts` ignores the selected language.
9. **Deterministic seed dates.** Faker is seeded, but dates are relative to "now", so they change from day to day. Pass a fixed `refDate` if fully deterministic data is the goal.
10. **Minor cleanup.**
    - Don't persist `sidebarOpen` (use `partialize`), which removes a workaround in `Layout`.
    - Add `import.meta.hot` handling for the custom-element modules so edits apply without a full reload.
    - Reword the generic "Use the test credentials shown above" error now that the password is dynamic.

---

### Checked and judged fine or intentional
- NewOrder totals, tax and rounding match the server.
- Carousel wrap, Pagination bounds and VirtualList maths are correct.
- DropdownMenu's outside-click and clamping work.
- Nested-modal stacking order is correct.
- DOMPurify sanitises ticket comments on display.
- `download.ts` revokes its object URLs.
- Timers, intervals and observers are cleaned up in most challenges.
- The OTP and password flows behave as designed.
- All other documented testids exist in the code.
