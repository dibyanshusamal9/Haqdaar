# Officer dashboard restyle: plan and prompt

Goal: give the officer dashboard (`PROJECT/apps/web`) the look of the reference
"Sellora" CRM site: a soft lavender theme with purple accents and floating
white cards. Every page keeps exactly the same content, data, wording and
behaviour. Only the styling changes.

---

## 1. What to take from the reference

| Element | In the reference | In our dashboard |
|---|---|---|
| Canvas | Off-white page with a pastel lavender, pink and sky gradient behind the hero (a lavender-field photo) | The same gradient made with CSS only, in a band behind each page header; the rest of the page is near-white `#FAFAFC` |
| Primary colour | Vivid violet `#7C3AED` to `#8B5CF6`, used for buttons, active states and highlighted bars | Replaces `moss` (green) as the main accent |
| Cards | White, radius about 20px, hairline border `#ECEAF3`, very soft shadow, sitting on the gradient | All `.card` elements |
| Card header | Small title, grey date subtitle, and a round outlined button with ↗ at the top right | Stat and KPI cards; the ↗ appears only where the card already links somewhere |
| Numbers | Large tabular figures, with faded decimals in the same font (`$42,000.00`) | Stat values, opening counts |
| Change pills | Small green `+10%` and red `-5%` pills | Existing pass, fail and unknown tags become pills in the same style |
| Progress bars | Violet diagonal stripes on a light grey track | Funnel bars and gap bars |
| Bar charts | Grey striped bars with one solid violet bar and a value tooltip | Gap table bars and funnel (the highest or selected value is violet) |
| Eyebrow tags | Tiny uppercase mono label in a bordered pill, `• GET PAID FASTER` | Small labels above section headings (wording taken from existing text, no new copy) |
| Headings | Large, semibold, tight letter spacing (−0.02em), dark navy `#14112B` | `h1` and `h2` on every page |
| Primary button | Violet pill, white text, a white rounded square holding ↗ on the right | "Sign in", "Add openings", "Save" |
| Secondary button | White pill, hairline border, small icon | "Edit", "Keep", "Try again", filters |
| Tabs | Text tabs with small line icons, separated by thin dividers, the active one in a light pill | The All / Added-by-officers filter and any segmented control |
| App shell | The left sidebar in the "Dashboard Overview" mock: the active item is a violet pill | The top nav becomes a white floating bar like the reference's top bar; the active link is a violet pill |
| CTA banner | Full-width violet gradient band, white text, white button on the right | Optional on Home only, reusing existing text ("Add job openings") |
| Inputs | Not shown; derive from the card style: white, 12px radius, hairline border, violet focus ring | All form fields |

**Do not copy:** the logo, the brand name, the client-logo strip, the
testimonials, stock photos, the "NEW" announcement bar text or any other
marketing copy. The content must stay ours.

## 2. Design tokens (`tailwind.config.ts` and `globals.css`)

```
--bg:            #FAFAFC   page
--surface:       #FFFFFF   cards
--line:          #ECEAF3   hairline borders
--ink:           #14112B   headings and numbers
--ink-soft:      #5B5872   body text
--ink-faint:     #9A97AE   subtitles and dates
--violet-50:     #F5F1FF
--violet-100:    #EDE5FF
--violet-500:    #8B5CF6
--violet-600:    #7C3AED   primary
--violet-700:    #6D28D9   hover
--good:          #16A34A on #DCFCE7
--bad:           #EF4444 on #FEE2E2
--warn:          #D97706 on #FEF3C7
hero gradient:   radial-gradient(at 20% 0%, #E9DDFF, transparent 60%),
                 radial-gradient(at 80% 10%, #FBE4F3, transparent 55%),
                 radial-gradient(at 50% 100%, #DCE6FF, transparent 60%), #F6F3FF
stripes:         repeating-linear-gradient(135deg, #7C3AED 0 6px, #9F67FF 6px 12px)
grey stripes:    repeating-linear-gradient(135deg, #ECEAF3 0 4px, #F5F4FA 4px 8px)
radius:          card 20px, input 12px, pill 9999px
shadow:          0 1px 2px rgba(20,17,43,.04), 0 8px 24px rgba(124,58,237,.06)
font:            Inter (next/font/google); numbers use tabular-nums
mono:            JetBrains Mono or ui-monospace, for eyebrow tags only
```

Keep the token names `ink`, `sand`, `ember` and `moss`, but remap them:
`moss` becomes violet-600 and `sand` becomes violet-50. Existing class names
then pick up the new theme without code churn. Add a new `violet` scale for
the other shades.

## 3. Work order

1. **Tokens and base:** `tailwind.config.ts`, `app/globals.css` (restyle
   `.card`, `.chip` and `.tag-*`; add `.btn-primary`, `.btn-ghost`, `.eyebrow`,
   `.pill-up`, `.pill-down`, `.bar-stripes`, `.page-hero`), and Inter in
   `app/layout.tsx`.
2. **Shell:** `components/nav.tsx` becomes a floating white rounded bar with
   the active link highlighted (needs `usePathname`, so it becomes a small
   client component). It must still wrap on phones, with no sideways scroll.
3. **Home** (`app/page.tsx`): a gradient hero band holding the title and
   intro; KPI stat cards in the reference's style; the skills chips; district
   cards with ↗; and the four link cards. Optional: turn "Add job openings"
   into the violet CTA banner.
4. **District view** (`app/districts/[id]/page.tsx`, `components/gap-table.tsx`,
   `components/funnel.tsx`): striped violet and grey bars, pills for gaps, and
   the placement-scorecard placeholder card in the same style.
5. **Job openings** (`app/jobs/page.tsx`, `components/jobs-desk.tsx`): violet
   primary buttons with the ↗ square; the segmented filter styled as the
   reference's tabs; violet opening counts; origin badges as pills; the course
   dropdown with a 12px radius, a soft shadow and a violet-50 active row.
6. **Beneficiaries** (`app/beneficiaries/page.tsx`,
   `components/beneficiaries-view.tsx`): stat cards, a search box styled as a
   pill, and grouped list cards.
7. **Leads** (`app/leads/page.tsx`): a table inside a card, a header row in
   violet-50, and bucket pills (d2 amber, d7 orange, d30 red).
8. **Recommendation detail** (`app/recommendations/[id]/page.tsx`,
   `components/reason-tree.tsx`): score parts as striped bars, and turns as a
   timeline styled like the reference's "Activity" card.
9. **Check:** `tsc --noEmit`; view every page at 375px and 1280px; check that
   no text, number, link or behaviour changed (diff the visible text before and
   after); check that the contrast of body text on the gradient is at least
   4.5:1.

## 4. Rules

- Content is frozen: the same headings, sentences, labels, numbers, routes,
  API calls and form logic. Do not add sections, testimonials, logos or claims.
- Do not touch `lib/officer.ts`, `lib/utils.ts` or any data-fetching code,
  except where a component must become a client component for the active nav
  state.
- No new npm packages. Icons are inline SVG (↗ arrow and small line icons) or
  plain characters.
- Tailwind 3.4 and Next 14.2 (App Router), as installed.
- The layout stays responsive with a 16px side gutter on phones.
- Keep visible focus states (a violet ring) and keyboard behaviour (the course
  search combobox must still work with the arrow keys and Enter).

---

## 5. Prompt (paste this to the coding agent)

> Restyle the officer dashboard in `PROJECT/apps/web` (Next.js 14.2 App Router,
> Tailwind 3.4, TypeScript) to match the attached reference design (the
> "Sellora" CRM landing page and its dashboard mock). **Change only the visual
> theme. Every page must keep exactly the same content, wording, numbers,
> routes, data fetching and behaviour.**
>
> **Theme to reproduce:**
> - A near-white page (`#FAFAFC`). Each page header sits on a soft pastel band
>   of lavender, pink and sky blue, built from layered radial gradients in CSS.
>   Do not use photos.
> - Violet is the single accent: primary `#7C3AED`, hover `#6D28D9`, tints
>   `#F5F1FF` and `#EDE5FF`. Headings and numbers are in dark navy `#14112B`,
>   body text `#5B5872`, subtitles `#9A97AE`.
> - Cards are white with a 20px radius, a 1px border in `#ECEAF3` and a very
>   soft violet-tinted shadow. Where a card links somewhere, it shows a round
>   outlined ↗ button at the top right.
> - Typography is Inter (via `next/font/google`). Large headings are
>   semibold with letter spacing of −0.02em. Numbers use `tabular-nums`.
>   Small eyebrow labels are uppercase mono text inside a bordered pill with a
>   dot, e.g. `• JOB OPENINGS`; take the label text from existing headings or
>   copy.
> - The primary button is a violet pill with white text and a white rounded
>   square holding a violet ↗ on its right. The secondary button is a white pill
>   with a hairline border.
> - Change indicators and status tags are small rounded pills: green
>   (`#16A34A` on `#DCFCE7`), red (`#EF4444` on `#FEE2E2`) and amber
>   (`#D97706` on `#FEF3C7`).
> - Bars and progress are diagonal violet stripes on a light grey track. Bar
>   charts use grey striped bars, with the highest or key bar solid violet.
> - Segmented filters and tabs are text with small line icons and thin
>   dividers; the active one sits in a light violet pill.
> - The top nav is a floating white rounded bar inside the page width: the
>   brand on the left, links on the right, and the current page's link in a
>   violet pill (use `usePathname`). It must wrap on phones, with no horizontal
>   scroll.
> - Inputs and selects are white with a 12px radius, a hairline border and a
>   violet focus ring.
>
> **How to do it:**
> 1. Put the tokens in `tailwind.config.ts` and `app/globals.css`. Remap the
>    existing tokens (`moss` to violet-600, `sand` to violet-50, `ink` to
>    `#14112B`) and add a `violet` scale. Restyle `.card`, `.chip` and `.tag-*`,
>    and add `.btn-primary`, `.btn-ghost`, `.eyebrow`, `.pill-up`,
>    `.pill-down`, `.bar-stripes` and `.page-hero` utilities.
> 2. Restyle `components/nav.tsx` and `app/layout.tsx`.
> 3. Restyle each page and component in turn: `app/page.tsx`;
>    `app/districts/[id]/page.tsx` with `components/gap-table.tsx` and
>    `components/funnel.tsx`; `app/jobs/page.tsx` with
>    `components/jobs-desk.tsx`; `app/beneficiaries/page.tsx` with
>    `components/beneficiaries-view.tsx`; `app/leads/page.tsx`; and
>    `app/recommendations/[id]/page.tsx` with `components/reason-tree.tsx`.
>    Read each file fully before editing it.
>
> **Hard rules:**
> - Do not add or remove text, sections, links, numbers or features. Do not
>   add the reference's logos, testimonials, stock photos, announcement bar or
>   marketing copy.
> - Do not change `lib/officer.ts`, `lib/utils.ts`, API calls, props, state or
>   form logic. The course-search combobox must keep working with the
>   keyboard.
> - Add no npm packages. Use inline SVG for icons.
> - Keep pages responsive: 16px side gutter, no horizontal scroll at 375px.
>   Keep visible focus states and body-text contrast of at least 4.5:1.
>
> **Done when:**
> - `node_modules/.bin/tsc --noEmit` passes.
> - Every page (`/`, `/jobs`, `/beneficiaries`, `/leads`, `/districts/Nalanda`,
>   and a `/recommendations/<id>`) loads with HTTP 200 and looks right at
>   375px and 1280px.
> - The visible text of each page is unchanged from before the restyle.
