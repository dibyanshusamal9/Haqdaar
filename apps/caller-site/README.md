# Haqdaar.ai citizen site

Next.js 16. The public Haqdaar.ai website:

- `/` the scroll story and how it works, with live corpus numbers
- `/check` speak or type, review the form, see matched schemes with reasons (UC-02..05)
- `/schemes`, `/schemes/[slug]` browse and read every scheme in the corpus
- `/examples` illustrative profiles that open the checker pre-filled
- `/help`, `/about`

The interface is in English and Hindi (`src/i18n`); voice input accepts the 11 languages Sarvam
AI transcribes.

## Run

    npm install
    npx next dev -p 3001

The API (`apps/api`) must be running; set its URL in `.env.local`:

    NEXT_PUBLIC_API_URL=http://localhost:4000

## Scroll animation assets

The homepage uses all 160 original frames at 1920×1080, encoded as lossless WebP.
Every generated frame is checked pixel for pixel against its source PNG. The complete
sequence is about 158 MiB; the player requests only a small window around the current
scroll position and retains at most 14 decoded frames. It starts on the first decoded
frame, holds the last available image during loading, and releases images on navigation.
Canvas resolution follows display density up to the detail available in the source.

To rebuild from the PNG ZIP at `assets/source/animation/haqdaar-hero-frames.zip`, run from this directory:

    .\scripts\import-scroll-frames.ps1

An alternate archive can be supplied with `-ArchivePath`. Original PNGs are extracted
under the ignored `.impeccable/source-frames` directory; generated WebPs belong in
`public/scroll-frames`. The encoder uses the Sharp package bundled with Next.js.

With the citizen site running on port 3001, verify captions and frame rendering:

    node --test tests/scroll-sequence.test.mjs

Set `TEST_SITE_URL` to use a different local server URL.

## Source organization

- `src/app`: route entry points and layouts.
- `src/features/home`: scroll film, frame loader, and home sections.
- `src/features/check`: profile entry, editable form, and results.
- `src/components/layout`: shared editorial wrappers and heroes.
- `src/components`: shared navigation, footer, markdown, and loader.
- `src/api`: typed API client and payloads.
- `src/i18n`: translations and language state.
- `src/styles`: global and scoped styles.
- `public`: files served directly to the browser.
- `scripts`: source-media import and encoding.
- `tests`: browser regression tests.

See the [development guide](../../docs/development/README.md).
