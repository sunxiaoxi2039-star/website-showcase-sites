# Astra Works × Opus Copies (astra-vs-opus)

[中文](./README.md) · English

## Overview

In the launch week of GPT-6 Astra (OpenAI, released 2026-09-03), X filled up with "one sentence, one working 3D web page" demos.
This site picks **6** of those public works and has Claude Opus 5 **rewrite each one**, laid out side by side: the original's source and author on the left, the copy on the right, ready to run.

> **These are rewrites from descriptions, not pixel-perfect replicas.**
> While they were being made, the sandbox's outbound network blocked `x.com` and every demo domain, so there was no way to tune against the originals frame by frame.
> Each copy is based on the original post text and the community write-ups in `magiccreator-ai/awesome-gpt-6-astra`; all code was written from scratch.
> The "self-rated fidelity" on the page is a judgement of how complete my own implementation is, not a score for the original.

## The six pairs

| Copy | Original | Author | Post |
|---|---|---|---|
| `works/abyssal/` ABYSSAL: The Living Deep | ABYSSAL: The Living Deep | @emollick | `x.com/emollick/status/2095673885605630429` |
| `works/v8-engine/` Interactive V8 Engine | Interactive V8 Engine | @DilumSanjaya | `x.com/DilumSanjaya/status/2096280244663775423` |
| `works/seoul-atlas/` Seoul 3D Atlas | Seoul 3D Atlas | @synabreu | `x.com/synabreu/status/2096557555086725159` |
| `works/van-gogh-town/` Walk Through Van Gogh | Walk Through Van Gogh | @petergostev | `x.com/petergostev/status/2095776685807346105` |
| `works/orbital-core/` Orbital Core Showcase | Orbital Core Showcase | @oneruofeng | `x.com/oneruofeng/status/2096551010089263181` |
| `works/brandenburg-piano/` Brandenburg Piano | Brandenburg Piano | @DeryaTR_ | `x.com/DeryaTR_/status/2096090915790069857` |

## Case index (`cases/`)

`cases/index.html` indexes the launch-week works: **128 entries** (games 48 / web 51 / Blender·3D 23 / video 4 / painting 2, of which 52 have a live demo).
Filter by category and search by keyword; the 6 copied works carry a badge that jumps straight to this site's version. The data is inlined in the page — fully static, no requests.

- Data source: `github.com/magiccreator-ai/awesome-gpt-6-astra` (the repo lists 171 entries; 128 were transcribed this time). Titles and descriptions were rewritten in Chinese; links are kept as-is and **have not been checked one by one**.
- The page also has an "Official public demos" column (financial modelling / template decks / site building and front-end QA / Blender→UE5 / everyday computer use):
  **paraphrased from press coverage, not OpenAI's own text** — the sandbox's outbound network blocks `openai.com`, so the official pages couldn't be fetched. The column can be replaced with the original text as soon as official links or copy are available.

## Prompts

Every output comes with the prompt needed to produce it, copyable in one click:

- **The 6 copies**: the "prompt behind this copy" fold-out at the bottom of each card on the overview page — the full prompt I actually used to write that piece (geometry approach, interaction and panel parameters are all in it).
- **The 128 cases**: the "recreation prompt" on each card in the case index — **a starter reverse-engineered from the work's description, not the original author's prompt** (most authors never published theirs), generated from a different template per category (games / Blender·3D / web / video / painting).
- Each exhibit card on the aggregate site `website-gallery` carries the same prompt.

## Tech stack

- three.js **r128**, vendored at `assets/vendor/three.min.js` (no CDN dependency, no build step)
- Each work is a **self-contained single HTML file**, sharing the shell styles in `assets/work.css` (top bar / control panel / readouts)
- Purely procedural geometry: no external models or textures; window-light textures are drawn on a Canvas at runtime
- Audio (Brandenburg Piano) is synthesised with WebAudio and scheduled with a look-ahead scheduler

### URL parameters supported by each work (for screenshots and deep links)

| Work | Parameters |
|---|---|
| abyssal | `?depth=<metres>&seed=<string>&azim=<radians>` |
| v8-engine | `?rpm=<rpm>&yaw=<radians>&spin=0` |
| seoul-atlas | `?time=<0-1>&tour=0&go=<landmark index>` |
| van-gogh-town | `?x=&z=&yaw=&auto=0` |
| orbital-core | `?yaw=<radians>&explode=1` |
| brandenburg-piano | `?silent=1` (visuals only, no sound) |

## Published at

GitHub Pages: `https://sunxiaoxi2039-star.github.io/website-showcase-sites/ideas/astra-vs-opus/`
(The repo root already has `.nojekyll`; static files are served as-is.)

## Round 2: Opus 5.5 isolated-memory re-derivation (`works-v2/` + `compare/`)

Unhappy with the first version, we redid it with Opus 5.5. To truly "not look at the answers", each work went to a **subagent with a fresh context**: it could not see round 1's code, prompts, screenshots or conversation, only the original's public material. It chose its own stack and delivered the work + `NOTES.md` (approach and lessons) + `PROMPT.md`.

- `compare/index.html` — the three-way comparison page: each work in three columns side by side (Astra original / Opus 5 round 1 / Opus 5.5 re-derivation), a "theatre" mode that runs all three full-screen at once, 5.5's notes and prompt below, and a "starting line" note for each work.
- `compare/originals/` — screenshots of the originals: Orbital Core (captured by running the author's public repo locally) and Abyssal (taken from the original repo's docs/media, MIT, © Token-Gremlin).

The starting lines differ from work to work — keep this in mind when comparing:

| Work | What the subagent had | Notes |
|---|---|---|
| Walk Through Van Gogh | Text description only | The cleanest blind test |
| Interactive V8 Engine | Text description only (no public demo) | |
| Abyssal | The original repo's README + repo screenshots | Source not read |
| Seoul 3D Atlas | The original repo's README text | Source not read; switched to real geographic data |
| Orbital Core | The original's public source + GLB model (read and run locally) | Neither code nor model reused; plus one search-snippet leak (see its notes) |
| Brandenburg Piano | Text description only | **Not published for now**, see below |

Data and licensing:

- **Seoul**: buildings / roads / water come from Overture Maps (mostly derived from OSM); derived data is shared alike under **ODbL 1.0**. Terrain comes from AWS Terrain Tiles. See `works-v2/seoul-atlas/data/DATA-LICENSE.md`.
- **Brandenburg Piano**: uses the **real full scores** of Bach's six Brandenburg Concertos (the MuseData/Humdrum digital edition from Stanford's CCARH), but CCARH's license is limited to single-user personal and academic research use, prohibits public performance and embedding in distributed material, so the work's files **were not committed to the repo**; only its notes, prompt and one attributed screenshot are public on the comparison page. The repo owner cannot apply to CCARH for a license, so this piece is **definitively not being published** (the comparison page states why). To publish it in future, it would have to be rebuilt from public-domain scores such as Mutopia.
- Third-party libraries in each `vendor/` folder (three.js, fonts, Salamander piano samples, etc.) ship with their own LICENSE files.

## Round 3: 20 original Astra prompts, head to head (`battle/`)

- **Prompts**: 20 Astra works **that come with their original prompts**, picked from public repos — 17 from MiaAI-Lab's "GPT-6 Astra 100 HTML Files", Ayi1337's Melon Lab (瓜体实验室) and Mosswing, and Thunderfall (雷霆战机) as collected by MartinDelophy (CC0).
- **Blind builds**: each prompt went to a fresh-context Opus 5.5 subagent, word for word (any follow-up feedback from the original author was passed on verbatim too), with the same format constraints as the original, and it was forbidden to look at the original.
- **Identical screenshots**: both sides were captured on the same machine, by the same script, at 1400×875, 4 seconds after load (`battle/originals/`, `battle/shots/`).
- **Blind judging**: both works were copied as anonymous "Work A / B" with signatures scrubbed and sides randomly assigned; a new judge agent actually ran and operated them, then scored five criteria at 10 points each; a total gap of ≤ 1 point counts as a tie. Five prompts were re-judged by another new judge with A/B swapped.
- **Results**: see the scoreboard on the battle page. The page opens with where the contest is unfair (batch generation vs. a single polished piece, the judge is Claude too, Thunderfall's original went through several iterations) and scores the "heavyweight 3" separately from the "batch 17".
- **Copyright**: the MiaAI-Lab and Ayi1337 repos declare no license, so this site only shows screenshots we captured ourselves, for comparison and commentary, with attribution and links to the originals; none of their code is copied.
- **Generation scripts** (kept in the session's temp directory, not committed): `make_brief.py` (battle briefs), `make_judge.py` (anonymous A/B and judging briefs), `finalize_judge.py` (un-blinding A/B), `build_battle.py` (builds the battle page).

## Recent updates

2026-09-26 — Round 3: 20 original Astra prompts head to head + blind judging + swapped-label rechecks (`battle/`); Brandenburg Piano confirmed as not being published.
2026-09-24 — Round 2: Opus 5.5 isolated-memory re-derivation of 5 works (Brandenburg held back) + the three-way comparison page.
2026-09-13 — Site launched with 6 copies, the comparison overview page and cover images.

## Notes

- **Sources**: titles / authors / posts / demo links of the originals all come from `github.com/magiccreator-ai/awesome-gpt-6-astra`; work descriptions come from the public text of the original posts.
- **Copyright**: all copy code is written from scratch; the originals remain the copyright of their authors, and this site is for learning and comparison only.
- **About Brandenburg Piano (round 1)**: the built-in passage is a Bach-style piece generated from the texture of BWV 1048, movement I (running sixteenth notes + walking bass), **not a transcription of the score** — the page says so too.
- **Next up**: candidates to add — @ashebytes's Exploded Male Anatomy, @blueemi99's iPhone chronicle, and @ashebytes's Navier–Stokes visual paper.

## Category

- Type: Website design — ideas (copy-style / comparative study)
