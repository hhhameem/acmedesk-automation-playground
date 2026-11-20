# TestDesk — Practice Scenario Catalog

Task catalog for practicing AI test automation. Each scenario lists the
capability, difficulty tier, preconditions, the task, and the expected outcome.

**How to run:** `npm install` then `npm run dev` (http://localhost:4040). The mock
backend runs in-browser via MSW. Data is deterministic (seeded) and saved in the
browser, shared across tabs and kept across reloads — open any page with `?reset=1`
(or use Settings → "Reset demo data") to start each run from the seed. Use Settings →
"Backend simulation" to inject latency/failures and change page size.

**Selector hints:** `data-testid` attributes are provided where relevant and noted
as `[id]`. Many flows intentionally have **no** stable hooks and require text/role
targeting, visual inspection, or shadow-DOM traversal.

Tiers: `easy` · `medium` · `hard`.

---

## Directory

| Capability                               | Scenarios       |
| ---------------------------------------- | --------------- |
| C0 Sign-in (dynamic password + OTP)      | C0-01 … C0-04   |
| C1 New tab                               | C1-01, C1-02    |
| C2 New window                            | C2-01           |
| C3 Back/forward                          | C3-01, C3-02    |
| C4 Native dialogs (alert/confirm/prompt) | C4-01 … C4-04   |
| C5 Modals / popups                       | C5-01 … C5-03   |
| C6 Download                              | C6-01 … C6-04   |
| C7 Upload                                | C7-01 … C7-03   |
| C8 Iframes                               | C8-01, C8-02    |
| C9 Toasts / async                        | C9-01 … C9-03   |
| C10 Long / virtualized lists             | C10-01, C10-02  |
| C11 Wizard / forms                       | C11-01, C11-02  |
| C12 Context menu / keyboard              | C12-01, C12-02  |
| C13 Clipboard / print                    | C13-01, C13-02  |
| C14 Locale / theme / RTL                 | C14-01, C14-02  |
| C15 beforeunload guard                   | C15-01          |
| C16 Interactive widgets                  | C16-01 … C16-07 |
| Adversarial                              | AD-01 … AD-09   |
| C17 Challenge Lab                        | C17-01 …        |
| C18 Orders & fulfillment                 | C18-01 …        |
| C19 Element Lab (native form elements)   | C19-01 … C19-10 |

---

## C0 — Sign-in

Every page except `/login`, `/inbox` and the two practice labs (`/elements`, `/challenges`) requires signing in. Nothing about it is fixed:
the **password changes on every visit** to the sign-in page, and the **one-time code is
random and delivered to a demo inbox** in a separate tab. Read both from the UI; never
hard-code them.

### C0-01 — Sign in with the dynamic password

- **Tier:** medium
- **Preconditions:** signed out, on `/login`.
- **Task:** Read the username from `[hint-username]` and the password from
  `[hint-password]` (marked "Changes every load"), fill `[login-username]` /
  `[login-password]`, and click `[login-submit]`.
- **Expected:** `[auth-step]` switches to `data-step="2"` (one-time code). A password read
  before a reload is rejected after it, with `[auth-error]` shown. Clicking `[auth-back]`
  returns to step 1 with a **new** password.

### C0-02 — Fetch the one-time code from the demo inbox

- **Tier:** hard
- **Preconditions:** on the OTP step (after C0-01).
- **Task:** Click `[open-inbox]` (opens `/inbox` in a **new tab**). Wait for the newest
  email to arrive — delivery takes an unpredictable few seconds, so wait for it instead of
  sleeping a fixed time. Click the top `[inbox-message]`, read `[otp-code]`, switch back to
  the sign-in tab, type it into `[otp-input]` and click `[otp-submit]`.
- **Expected:** you land on the page you originally asked for (including its `?filters`).
  Older emails in the inbox hold codes that no longer work — only the newest one is valid,
  and each code works once.

### C0-03 — Expiry and resend

- **Tier:** hard
- **Task:** On the OTP step, watch `[otp-countdown]` (also exposed as
  `data-seconds-left`). Confirm `[otp-resend]` is **disabled** while the code is valid. Let
  it expire, confirm the countdown reads "Code expired" and that submitting the old code
  shows "This code has expired". Then click `[otp-resend]`.
- **Expected:** a "New code sent" toast (`[toast]`) appears, the countdown restarts, resend
  is disabled again, a new email arrives in the inbox, and the previous code is rejected.

### C0-04 — Dismiss the error banner

- **Tier:** easy
- **Task:** Submit a wrong code, then close the error with `[auth-error-dismiss]`.
- **Expected:** `[auth-error]` is removed from the page.

---

## C1 — New tab

### C1-01 — Open a ticket in a new tab

- **Tier:** easy
- **Preconditions:** on `/tickets`
- **Task:** Open the first ticket row "Open in new tab" action.
- **Expected:** a new browser tab opens at `/tickets/:id`; the original tab stays on `/tickets`.
- **Selector:** row hover reveals `[open-newtab-<ref>]` (hidden until row hover).

### C1-02 — Open print view in a new tab

- **Tier:** easy
- **Preconditions:** on any `/tickets/:id`
- **Task:** Use "Open print view in new tab" in the Actions panel.
- **Expected:** new tab at `/tickets/:id?print=1`.

---

## C2 — New window (window.open with features)

### C2-01 — Pop out widget with auto-refresh

- **Tier:** medium
- **Preconditions:** on `/dashboard`
- **Task:** Click `[popout-widget]`, then wait.
- **Expected:** a separate, resized **window** (480×380, no toolbar) opens showing
  `[popout-widget-root]` with live KPIs. After the loader, `[popout-auto-refresh]` appears
  and the **whole window reloads itself every 10s** (loader shows again). The tool must
  handle a window, not a tab, that refreshes on its own.

---

## C3 — Back / forward navigation with state

### C3-01 — Filters survive detail → back

- **Tier:** medium
- **Preconditions:** on `/tickets`, apply filter `status=open` and priority `urgent`, go to page 2.
- **Task:** Open a ticket, then use the browser Back button.
- **Expected:** returns to `/tickets` **with filters and page preserved** (filters are in the URL).

### C3-02 — Wizard step navigation

- **Tier:** medium
- **Preconditions:** on `/tickets/new`, filled step 1.
- **Task:** Move Next → Back → Next.
- **Expected:** step state and entered values persist across Next/Back.

---

## C4 — Native browser dialogs

### C4-01 — Confirm single delete

- **Tier:** medium
- **Preconditions:** on `/tickets`
- **Task:** Open a row's context menu (right-click or `MoreHorizontal`) → Delete; accept the confirm.
- **Expected:** a **native `window.confirm`** appears; on OK the row is removed and a
  **confirmation modal** (`[deleted-modal]`) appears instead of a toast.

### C4-02 — Bulk delete confirm

- **Tier:** medium
- **Task:** Select ≥2 rows → `[bulk-delete]`; accept.
- **Expected:** native confirm names the count; selected tickets are deleted and a
  confirmation modal (`[deleted-modal]`) reports how many were deleted.

### C4-03 — Prompt to name a saved view

- **Tier:** hard
- **Preconditions:** on `/tickets` with some filters applied.
- **Task:** `[saved-views]` → "Save current view"; enter a name in the **prompt**.
- **Expected:** native `window.prompt` appears; the view is saved and listed.

### C4-04 — Confirm discard on wizard cancel

- **Tier:** medium
- **Preconditions:** `/tickets/new` with unsaved input.
- **Task:** Click Cancel; dismiss (Cancel) first, then accept.
- **Expected:** native confirm asks to discard; cancel keeps you on the wizard, OK leaves to `/tickets`.

---

## C5 — Modals / popups

### C5-01 — In-app edit modal

- **Tier:** easy
- **Preconditions:** on `/inventory`
- **Task:** Click `[adjust-<sku>]`, change stock, Save.
- **Expected:** in-app modal; saving PATCHes and shows a success toast.

### C5-02 — Nested modals (escalation)

- **Tier:** hard
- **Preconditions:** on `/tickets/:id`
- **Task:** `[escalate]` → `[escalate-next]` → `[escalate-confirm]`.
- **Expected:** a second modal stacks over the first; only the top-most closes on Escape.

### C5-03 — Focus-trapped modal

- **Tier:** medium
- **Task:** Open any modal; press Tab repeatedly.
- **Expected:** focus cycles only within the modal; Escape closes it.

---

## C6 — Download

### C6-01 — Export filtered tickets to CSV

- **Tier:** medium
- **Preconditions:** on `/tickets`, filter `status=open`.
- **Task:** Click `[export-tickets]`.
- **Expected:** a file `tickets-<date>.csv` downloads; rows match the active filter.

### C6-02 — Export low-stock inventory

- **Tier:** medium
- **Preconditions:** on `/inventory`, enable `[low-stock-filter]`.
- **Task:** Click `[export-inventory]`.
- **Expected:** `inventory-low-stock-<date>.csv` downloads with only low-stock items.
- **Adversarial:** export button sits above a sticky table header; the button is fine,
  but pagination/rows near the viewport bottom may be covered by the consent banner.

### C6-03 — Download ticket PDF

- **Tier:** easy
- **Task:** On `/tickets/:id` click `[download-pdf]`.
- **Expected:** `<ref>.pdf` downloads (valid PDF).

### C6-04 — Generate then download a report

- **Tier:** hard
- **Task:** On `/reports` click `[generate-summary]`, wait for async completion, then download it.
- **Expected:** after a ~0.9s delay the report appears in `[generated-reports]`; downloading
  yields a PDF.

---

## C7 — Upload

### C7-01 — Attach files via the file picker

- **Tier:** medium
- **Task:** On `/tickets/:id` use `[ticket-attachments]` and select a PNG/PDF.
- **Expected:** file uploads (POST multipart) and is listed; success toast.

### C7-02 — Drag & drop upload

- **Tier:** hard
- **Task:** Drag a file onto the upload dropzone.
- **Expected:** same result as C7-01 via drag & drop.

### C7-03 — Upload validation error

- **Tier:** hard
- **Task:** Upload a file larger than 5 MB (or an unsupported type).
- **Expected:** error toast with the server message; file is rejected.

---

## C8 — Iframes

### C8-01 — Read and drive data inside an embedded iframe

- **Tier:** medium
- **Preconditions:** on `/dashboard`
- **Task:** Inside `[analytics-iframe]` (the embedded TestDesk Analytics report served from
  `/embed/analytics`), read `[analytics-heading]` and `[analytics-kpi-tickets]`, then click
  `[analytics-range-7]`.
- **Expected:** the tool must switch into the iframe's own document to find these elements
  (they are not in the host page's DOM). After the click, the KPI values and
  `[analytics-range-label]` update to "Last 7 days".

### C8-02 — Interact with a real third-party site in an iframe

- **Tier:** hard
- **Preconditions:** on `/settings`
- **Task:** Inside `[integration-iframe]` (the real `https://demoqa.com/` site), expand an
  accordion / click a menu item.
- **Expected:** the tool switches into the cross-origin iframe context and drives the external
  page's own DOM (no TestDesk selectors apply inside it).

---

## C9 — Toasts / async feedback

### C9-01 — Success toast on save

- **Tier:** easy
- **Task:** Save any settings section / create a ticket.
- **Expected:** `[toast]` appears with variant `success`.

### C9-02 — Wait for async state under latency

- **Tier:** medium
- **Preconditions:** set latency to ~2000ms in Settings.
- **Task:** Navigate to `/tickets`.
- **Expected:** a loading indicator shows; the tool must wait for rows rather than fail fast.

### C9-03 — Wait for the random data loader

- **Tier:** medium
- **Preconditions:** open `/customers` (or the Dashboard "Pop out widget" window).
- **Task:** Wait for the data to populate.
- **Expected:** the table / widget area shows `[data-loader]` for a **non-deterministic 5–10s**
  (a progress bar fills over that time) before content appears; the tool must not time out or
  assert before the loader disappears. The duration differs on each visit.

---

## C10 — Long / virtualized lists

### C10-01 — Paginate a table

- **Tier:** easy
- **Task:** On `/tickets` go to page 3 and check `[pagination-summary]`.
- **Expected:** correct range/count.

### C10-02 — Find a row that is not yet in the DOM

- **Tier:** hard
- **Preconditions:** on `/customers`
- **Task:** Find and open a specific customer that is far down the list (e.g. by scrolling).
- **Expected:** the tool must **scroll** `[customer-virtual-list]` — off-screen rows are not
  rendered until scrolled into view.

---

## C11 — Wizard / forms

### C11-01 — Complete create-ticket wizard

- **Tier:** medium
- **Task:** `/tickets/new`: choose customer, subject, details, review, submit.
- **Expected:** validation blocks short input; success toast + redirect to `/tickets`.

### C11-02 — Validation prevents progress

- **Tier:** medium
- **Task:** Click `[wizard-next]` with an empty subject.
- **Expected:** inline error shown; step does not advance.

---

## C12 — Context menu / keyboard

### C12-01 — Right-click context menu

- **Tier:** hard
- **Task:** Right-click a ticket row.
- **Expected:** `[context-menu]` appears at the cursor with actions. Near the window edges it
  stays fully on screen. Focus moves to the first item, `↑`/`↓` move between items, and
  `Esc` or an outside click closes it.

### C12-03 — Row "⋮" actions dropdown

- **Tier:** easy
- **Task:** Hover a ticket row, click the `[row-menu-<ref>]` button, then choose "Assign to me".
- **Expected:** `[row-actions-menu-<ref>]` appears anchored to the button; the assignee column
  updates to "Alex Vance (me)" after the PATCH, with a success toast. "Mark as resolved" sets
  status to _resolved_.

### C12-02 — Keyboard shortcut

- **Tier:** medium
- **Task:** Press `/` (not in an input).
- **Expected:** `[global-search]` receives focus.

---

## C13 — Clipboard / print

### C13-01 — Copy ticket reference

- **Tier:** medium
- **Task:** On `/tickets/:id` click the copy icon next to `[ticket-ref]`.
- **Expected:** clipboard contains the ref; info toast.
- **Note:** clipboard read requires browser permission (your automation tool must grant it).

### C13-02 — Print

- **Tier:** medium
- **Task:** Click Print on a ticket.
- **Expected:** `window.print()` is invoked (test must handle/deny the print dialog).

---

## C14 — Locale / theme / RTL

### C14-01 — Switch to dark theme

- **Tier:** easy
- **Task:** Use `[theme-toggle]` or Settings `[theme-dark]`.
- **Expected:** `html` gains class `dark`; colors invert.

### C14-02 — Switch to Arabic (RTL)

- **Tier:** medium
- **Task:** Change `[locale-switch]` to العربية.
- **Expected:** `html` gets `dir="rtl"` and `lang="ar"`; nav labels become Arabic and layout mirrors.

---

## C15 — beforeunload guard

### C15-01 — Unsaved-changes guard

- **Tier:** hard
- **Preconditions:** `/tickets/new` with entered data.
- **Task:** Trigger a page unload (e.g. reload or navigate away).
- **Expected:** browser shows the native "Leave site?" beforeunload prompt.

---

## C16 — Interactive widgets

### C16-01 — Accordion

- **Tier:** easy
- **Preconditions:** `/settings` (Help & FAQ section).
- **Task:** Click `[settings-accordion-sla]`, then another header.
- **Expected:** the panel expands (`[settings-accordion-sla-panel]`); opening a second collapses
  the first (single-open accordion); `aria-expanded` flips.

### C16-02 — Rich text editor

- **Tier:** medium
- **Preconditions:** `/tickets/new` step 2 (Details).
- **Task:** Type into `[wizard-description-editor]`, select the text, click `[wizard-description-bold]`.
- **Expected:** the selection is wrapped in `<b>`/`<strong>` inside the contentEditable; the
  toolbar must be used without losing the text selection.

### C16-03 — Date & time picker

- **Tier:** medium
- **Preconditions:** `/tickets/new` step 2.
- **Task:** Set a value in `[wizard-due-date]` (native `datetime-local`).
- **Expected:** the control accepts both a date and a time; the value shows on the review step.

### C16-04 — Carousel with Prev / Next

- **Tier:** easy
- **Preconditions:** `/dashboard`.
- **Task:** Click `[dashboard-spotlight-next]` twice, then `[dashboard-spotlight-prev]`.
- **Expected:** the active slide changes; the position indicator (`[dashboard-spotlight-position]`)
  and the dots update; `next` wraps around from the last slide to the first.

### C16-05 — Navigation drawer (off-canvas)

- **Tier:** medium
- **Preconditions:** `/settings` → Navigation set to "Collapsed (drawer)", desktop viewport.
- **Task:** Click `[nav-drawer-toggle]` to open the drawer, then close it via the backdrop, Escape, or by picking a nav item.
- **Expected:** `[sidebar]` slides in over a dimmed backdrop (closed by default on load); Escape and
  backdrop clicks close it; selecting a link navigates and closes the drawer.

### C16-06 — Tooltips

- **Tier:** easy
- **Preconditions:** on `/tickets`.
- **Task:** Hover the theme toggle, the bell, and a row's "new tab" icon.
- **Expected:** a tooltip appears (`[tooltip-theme]`, `[tooltip-notifications]`,
  `[tooltip-newtab-<ref>]`) and disappears on mouse-out.

### C16-07 — Sidebar display preference (radio group)

- **Tier:** medium
- **Preconditions:** `/settings` (Navigation section), desktop viewport.
- **Task:** Select `[settings-sidebar-mode-pinned]` and `[settings-sidebar-mode-drawer]` (native radios in `[settings-sidebar-mode]`).
- **Expected:** on "pinned" the sidebar is docked and content shifts right (☰ hidden); on "drawer"
  the sidebar collapses off-canvas and the ☰ button appears. The choice persists across reloads and
  only affects desktop — mobile always uses the drawer.

---

## Adversarial scenarios

### AD-01 — Hover-only trigger

- **Tier:** medium — `[open-newtab-<ref>]` and the row menu are hidden until the row is hovered.

### AD-01b — Dropdown opens on hover AND on click

- **Tier:** medium — the topbar account dropdown (`[profile-menu-trigger]` → `[profile-menu]`)
  opens both when the avatar is **hovered** and when it is **clicked** (toggle). It closes on
  mouse-out, outside click, or `Esc`. Tools that only dispatch `click()` without hovering, or
  only `hover()` without clicking, must both succeed. A click right after a hover-open keeps
  the menu open; a second click closes it.

### AD-02 — Shadow DOM input

- **Tier:** hard — the wizard tag input is a `<testdesk-tag-input>` web component
  (`[tag-input]`) inside an open Shadow DOM. Value/change must be read through the shadow root.

### AD-03 — Action inside an iframe

- **Tier:** hard — see C8-02.

### AD-04 — Virtualized list

- **Tier:** hard — see C10-02.

### AD-05 — Ambiguous selectors

- **Tier:** medium — Settings has four buttons labelled "Save" (`[save-appearance]`,
  `[save-language]`, `[save-navigation]`, `[save-simulation]`). Targeting by text alone is
  ambiguous.

### AD-06 — Overlay / occlusion

- **Tier:** medium — the consent banner (`[consent-banner]`) overlays the bottom of the
  viewport until accepted (`[consent-accept]`), and inventory uses a sticky table header.

### AD-07 — Fast auto-dismiss

- **Tier:** hard — after a report download, `[flash-message]` disappears in **800 ms**.

### AD-08 — Non-click popup trigger

- **Tier:** hard — `/reports` "Preview in new tab" opens a new tab via **form submit**
  (`target="_blank"`), not a click handler.

### AD-09 — Race conditions / double submit

- **Tier:** hard — submit buttons disable while pending (comment send, wizard submit,
  stock save). A tool that double-clicks must not create duplicates.

---

## C17 — Challenge Lab (hard-to-automate widgets)

These pages are **intentionally hostile** to naive automation. They are isolated from the
production pages (which keep stable ids). **Public: no sign-in.** Hub: `/challenges`.

### C17-01 — Shadow DOM

- **Tier:** hard → `/challenges/shadow-dom`
- **Task:** Fill the open shadow card (`[aria-label="Cardholder name"]`, inside
  `testdesk-shadow-open`), click **Save card**, read the status. Then click **Reveal code**
  in the closed shadow root (`testdesk-shadow-closed`) and capture the code.
- **Expected:** open root is reachable via shadow-piercing selectors; the closed root is not —
  you must interact via the host's accessible tree or positionally.

### C17-02 — Nested & dynamic iframes

- **Tier:** hard → `/challenges/nested-iframes`
- **Task:** Switch into the nested `iframe.frame`, then its child frame (2 levels), click
  **Refresh status** and check `[relay-count]` on the page increases. Spawn a
  new frame (appears after ~800 ms), resize the outer frame, and toggle the hidden frame.
- **Expected:** 2-level frame switching, waiting for a spawned frame, and frame
  context resets between actions.

### C17-03 — Unstable IDs & attributes

- **Tier:** hard → `/challenges/unstable-ids`
- **Task:** Tick consent, type a reason and submit — while every id/name/testid regenerates
  on a 2 s timer. Then toggle **Freeze IDs**.
- **Expected:** role/label-based locators survive; id-based selectors go stale.

### C17-04 — Moving targets & layout shift

- **Tier:** hard → `/challenges/moving-targets`
- **Task:** Click the floating **Confirm** (moves every 1.2 s), click the **Shy** button
  (dodges on hover), wait for the promo banner, dismiss it, then click **Proceed to checkout**.
- **Expected:** click lands despite movement; the post-render banner shifts layout (stale
  element positions must be re-read).

### C17-05 — Hover-only controls

- **Tier:** medium → `/challenges/hover-only`
- **Task:** Hover each invoice row and click **Archive** / **Attach**; click **Download**
  under a tooltip; reveal the tier text on hover.
- **Expected:** actions only exist after hover; tooltip must not intercept the click.

### C17-06 — Overlays & occlusion

- **Tier:** medium → `/challenges/obscured`
- **Task:** Close the ad overlay, then **Save preferences**; accept/decline the sticky cookie bar;
  wait for the toast (`[obscuring-toast]`, ~3 s) covering the button to disappear before
  saving again.
- **Expected:** clicks on the covered button are intercepted until the overlay is dismissed.

### C17-07 — Detached & self-resetting DOM

- **Tier:** hard → `/challenges/detached-dom`
- **Task:** Pause the refresh, click the **UMBR** ticker; type a note and **Save** before it
  clears; click **Claim bonus** before the banner removes itself (~2.5 s).
- **Expected:** element handles go stale on re-render; the note field self-clears every 5 s
  unless paused.

### C17-08 — Delayed async rendering

- **Tier:** medium → `/challenges/delayed-async`
- **Task:** Wait for the skeleton to become rows (server delay 1.5–4.5 s); refresh; capture the
  secret token that appears after a random 2–6 s.
- **Expected:** no fixed sleeps — wait for the rows; the token is time-unpredictable.

### C17-09 — Flaky network & retries

- **Tier:** hard → `/challenges/flaky-network`
- **Task:** Retry the ~50% 500 endpoint until success; retry the 429 endpoint past the limit;
  trigger the slow endpoint and observe the 3 s client timeout; catch the intermittent element.
- **Expected:** robust retry/backoff and error handling; assertions must tolerate failures.

### C17-10 — Native dialogs

- **Tier:** medium → `/challenges/native-prompts`
- **Task:** Trigger `alert`/`confirm`/`prompt` and handle each; toggle the beforeunload guard.
- **Expected:** a dialog handler must be registered before triggering, or the run hangs.

### C17-11 — Logic & reasoning gate

- **Tier:** hard → `/challenges/logic-gate`
- **Task:** Compute the displayed product, click the **3rd** node, set the slider to the target
  (±1), and type the displayed word exactly.
- **Expected:** requires reading values and reasoning — no single selector answer.

### C17-12 — Drag & drop

- **Tier:** hard → `/challenges/drag-and-drop`
- **Task:** Reorder the checklist so **Review metrics** is first; drag **Ship it** into **Done**;
  verify the order and card counts in the log (`[todo-count]` / `[done-count]`).
- **Expected:** HTML5 drag events (`dragstart`/`dragover`/`drop`) via `dragTo()` or a synthesized
  event sequence.

### C17-13 — Infinite scroll & lazy loading

- **Tier:** medium → `/challenges/infinite-scroll`
- **Task:** Scroll the inner feed container (`[data-testid="feed-scroll"]`) repeatedly until
  `[data-testid="feed-end"]` appears, then click the row with `[data-ref="LOG-0054"]`.
- **Expected:** paging is driven by an `IntersectionObserver` sentinel, not a button, and only
  fires when the **container** (not the window) is scrolled; rows share repeated messages, so
  text-based locators are ambiguous and you must scroll-until-present rather than sleeping.

### C17-14 — Canvas & coordinate targeting

- **Tier:** hard → `/challenges/canvas`
- **Task:** Click the dot painted on `canvas[data-testid="canvas-board"]` until the score reads
  **3/3** (it relocates every 0.9 s); then drag a stroke on
  `canvas[data-testid="canvas-signature"]` and click **Confirm signature**.
- **Expected:** the dot and the running score/miss counter exist only as pixels — the DOM
  exposes no elements or text, so locators cannot find them. Coordinates must be derived from
  the canvas bounding box (e.g. `mouse.click(x, y)` or a dispatched pointer sequence), and the
  signature must be drawn via pointer move events.

### C17-15 — Stale element references

- **Tier:** hard → `/challenges/stale-elements`
- **Task:** Pin the row with `[data-ref="PIN-0042"]`. Repeat with **Auto-refresh** enabled
  (every 2.6 s), then use **Refresh list** and click **Pin** on `PIN-0042` again.
- **Expected:** each refresh rebuilds every row node, so a handle captured before the rebuild
  detaches — clicking it fails until the row is re-located. For ~0.7 s after a rebuild the
  outgoing rows linger (fading out, `pointer-events-none`) alongside the new ones, so
  `data-ref`/text locators match **two** elements at once and a strict locator throws.

---

## C18 - Orders & fulfillment

End-to-end commerce flow across four linked pages: `/orders`, `/orders/new`,
`/orders/:id` (with `/shipments` and `/returns` as work queues). Writes are saved in the
browser and shared across tabs until you reset the demo data.

### C18-01 — Filter the order list

- **Tier:** medium → `/orders`
- **Task:** Search a ref/customer, filter by status, payment and channel; check
  `[pagination-summary]` and the per-status counts in the status dropdown.
- **Expected:** the table, counts and pagination all update from the same query.

### C18-02 — Export filtered orders to CSV

- **Tier:** medium → `/orders`
- **Task:** Apply a filter, click **Export CSV** (`[export-orders]`).
- **Expected:** a real download; the file reflects the active filters, not the whole list.

### C18-03 — Create an order with computed totals

- **Tier:** medium → `/orders/new`
- **Task:** Pick a customer, add line items (change quantity), submit `[create-order]`.
- **Expected:** subtotal/shipping/tax/total compute live client-side (21% VAT, free
  shipping over €150) and match the amounts stored on the created order; redirect to detail.

### C18-04 — Drive the order state machine

- **Tier:** hard → any `/orders/:id`
- **Task:** **Create shipment**, then use the shipment **stage dropdown**
  (`[shipment-stage]`) to move to the next step — only the single step after the current one
  is enabled, everything else is blocked; try **Refund** and **Cancel** and observe which
  actions are enabled per state.
- **Expected:** each transition changes status badges and appends to `[shipment-timeline]`;
  the dropdown only permits one step forward at a time, and disabled options/actions must be
  respected, not clicked blindly.

### C18-05 — Request a return

- **Tier:** easy → a _delivered_ `/orders/:id`
- **Task:** Click **Request return** (`[request-return]`), pick a reason, confirm.
- **Expected:** an `RMA-####` is created and appears under Returns on the order; the button
  is disabled for non-delivered orders.

### C18-06 — Work the fulfillment queue

- **Tier:** medium → `/shipments`
- **Task:** Filter by carrier/status, then use each row's action menu
  (`[shipment-menu-<ref>]`) to **Advance to next stage**, **Mark exception**, or **Reset
  tracking**.
- **Expected:** row shipment badges progress; the exception path is reachable; reset clears
  the timeline and returns the order to _processing_; delivered rows only offer reset.

### C18-07 — Process an RMA

- **Tier:** medium → `/returns`
- **Task:** Approve a _requested_ return, then mark it received and refund; also reject one.
- **Expected:** status workflow (requested → approved/rejected → received → refunded) with
  updated status counts.

---

## C19 — Element Lab (native form elements)

Component practice, not workflows. **Public: no sign-in.** Hub: `/elements`; each element has
its own page, e.g. `/elements/date`. Every variant's control has `id` and `data-testid`
`el-<element>-<variant>` (shown on its card), and a readout next to it:

- `[<id>-value]`: the current value; the exact value is in its `data-value` attribute.
- `[<id>-valid]`: `data-valid` is `valid`, `invalid` or `na` (not validated: disabled, read-only…);
  `[<id>-flag]` lists the true `ValidityState` flags (`valueMissing`, `patternMismatch`…).
- `[<id>-events]`: the last 8 events, each `li` with `data-event` (`input`, `change`, `focus`,
  `blur`, `click`, `invalid`, `submit`, `reset`, `toggle`, `close`, `cancel`);
  `[<id>-event-count]` has the total in `data-count`.
- `[<id>-submitted]`: the form data of the last submit (forms never navigate away).
- `[<id>-check]` calls `reportValidity()`; `[<id>-reset]` restores the starting state.

Values set with JavaScript (`el.value = …`) fire no events, so the readout does not change.
Labels follow the language (English, Deutsch, Arabic); values and ids do not. Native pickers
and validation messages (date, color, file, "Please fill out this field") follow the
browser's language, not the page's.

### C19-01 — Text and validation flags

- **Tier:** easy → `/elements/text`
- **Task:** Fill `[el-text-pattern]` with `abc`, then with `ABC-1234`. Leave
  `[el-text-required]` empty and press its **Check validity**.
- **Expected:** `patternMismatch` then `valid`; the required field shows `valueMissing` and the
  browser's message in `[el-text-required-message]`; an `invalid` event is logged.

### C19-02 — Read-only, disabled and hidden

- **Tier:** easy → `/elements/text`, `/elements/hidden`
- **Task:** Try to type into `[el-text-readonly]` and `[el-text-disabled]`. Read
  `[el-hidden-default]`, click `[el-hidden-default-change]`, read it again.
- **Expected:** neither field changes and both are `na`; the hidden input's value goes
  `token-1` → `token-2` and must be read from the DOM, not from visible text.

### C19-03 — Date and time formats

- **Tier:** medium → `/elements/date`, `/elements/time`, `/elements/week`
- **Task:** Set `[el-date-minmax]` to `2027-02-01`, `[el-time-minmax]` to `09:10`, and
  `[el-week-default]` to `2026-W10`.
- **Expected:** values use the fixed formats (`YYYY-MM-DD`, `HH:MM`, `YYYY-Www`) whatever the
  display looks like; the date is `rangeOverflow`, the time is `stepMismatch` (15-minute steps).

### C19-04 — Checkbox states

- **Tier:** easy → `/elements/checkbox`
- **Task:** Check that `[el-checkbox-indeterminate]` starts `indeterminate`; tick
  `[el-checkbox-indeterminate-sms]` and `[el-checkbox-indeterminate-push]`.
- **Expected:** the parent becomes `checked`; `indeterminate` is a property only (no HTML attribute).

### C19-05 — Radio groups and selects

- **Tier:** easy → `/elements/radio`, `/elements/select`, `/elements/select-multiple`
- **Task:** Pick **Team** by its label; try the disabled option in `[el-radio-disabled-option]`.
  Select **High** by visible text, `JP` by value in `[el-select-optgroup]`, and two categories in
  `[el-select-multiple-default]`.
- **Expected:** values `team`, `high`, `JP`, `billing, returns`; disabled options cannot be chosen.

### C19-06 — Slider, color and computed output

- **Tier:** medium → `/elements/range`, `/elements/color`, `/elements/output`
- **Task:** Move `[el-range-default]` one step with the arrow key; set `[el-color-default]` to
  `#ff0000`; change `[el-output-sum-a]` to `10`.
- **Expected:** `51`, `#ff0000`, and `[el-output-sum]` reads `13`.

### C19-07 — Files without the system dialog

- **Tier:** easy → `/elements/file`
- **Task:** Set two files on `[el-file-multiple]`; check `[el-file-required]` without a file.
- **Expected:** the readout lists both file names; the required input is `valueMissing`.

### C19-08 — Which button sent the form

- **Tier:** easy → `/elements/button`, `/elements/input-button`
- **Task:** Type a comment and click `[el-button-submit-send]`; edit `[el-button-reset]` and
  click `[el-button-reset-button]`; click `[el-input-button-image]` at a known position.
- **Expected:** `[el-button-submit-submitted]` contains `action=send`; the reset restores
  `Alex Morgan`; the image submit sends `pos.x` and `pos.y`.

### C19-09 — Native dialog and details

- **Tier:** medium → `/elements/dialog`, `/elements/details`
- **Task:** Open `[el-dialog-modal]` with `[el-dialog-modal-open]`, confirm; open it again and press
  Escape. Open two sections of `[el-details-exclusive]`.
- **Expected:** `closed; returnValue=confirm`, then `closed` with a `cancel` event; only the last
  opened section stays open.

### C19-10 — Three kinds of form validation

- **Tier:** medium → `/elements/form-validation`
- **Task:** Submit each form empty, then fix it. In `[el-form-validation-custom-validity]` type two
  different passwords.
- **Expected:** the built-in form sends nothing until valid (no `[…-submitted]`); the
  `novalidate` form submits but shows the page's own errors (`[…-name-error]`) and then
  `[el-form-validation-novalidate-success]`; the mismatched passwords show `customError`.

---

## How to score your practice

- Base points by tier: easy = 1, medium = 2, hard = 3.
- Award only if the **expected outcome is verified**, not merely if a click occurred.
- Track per-capability pass rate to see which browser capabilities you (or your
  automation) handle weakly (e.g. native dialogs, windows vs tabs, shadow DOM, iframe
  context switching).
