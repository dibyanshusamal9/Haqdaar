# Original media

`animation/haqdaar-hero-frames.zip` contains the original 160 PNG animation frames at 1920×1080.
It was relocated from the repository root without changing its content. Archives are ignored
by the existing `*.zip` rule; transfer this file separately when another developer needs to rebuild.

Run `apps/caller-site/scripts/import-scroll-frames.ps1` to extract to the ignored application
cache and encode lossless WebPs. The encoder verifies each frame against its original pixels.
Only encoded files in `apps/caller-site/public/scroll-frames` are served to visitors.
Preserve source-media provenance/licensing records when adding new assets; no license is inferred.
