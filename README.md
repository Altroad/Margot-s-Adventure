# Margot's Adventure

A small browser game. Margot has been trying to call Daniel all day and cannot get a
free minute. One level, three controls, about a minute to finish.

**Play it:** https://altroad.github.io/Margot-s-Adventure/

## The day

One continuous side-scrolling level that runs through her day in order. The sky
moves from dawn to dusk as she goes.

| Stretch | What's in the way | What you do |
| --- | --- | --- |
| The 16 km run | A park bench, a puddle and a sleeping dog | Jump them, tick over to 16 km |
| Magpie season | Three magpies on a swooping cycle | Watch for the flashing patch, then time your run through it |
| Back-to-back | Three Teams windows blocking the corridor | Jump on top of each one to end the meeting |
| The birthday party | Three things the party needs | Collect all three; the archway won't open until you do |
| At last | Nothing | Reach the phone. Call Daniel. |

You cannot lose. Getting hit costs you two seconds and a stumble, nothing more —
the score is how fast Margot gets to the phone. Your best time is kept in the
browser.

## Controls

| | |
| --- | --- |
| Move | Arrow keys, or `A` / `D` |
| Jump | `Space`, `W`, or Up — hold longer to jump higher |
| Restart | `R` |
| Sound | `M` |

On a phone or tablet, touch controls appear automatically.

## Running it locally

No build step, no dependencies. Serve the folder with anything:

```sh
npx http-server -p 8080 .
# then open http://127.0.0.1:8080
```

Opening `index.html` directly from the filesystem works too.

## Hosting it

It's a static site — `index.html`, `game.js`, and nothing else. To publish it on
GitHub Pages: **Settings → Pages → Source: Deploy from a branch → `main` → `/ (root)`**,
then give it a minute.

## How it's put together

Two files, no framework and no image assets — every sprite is drawn with canvas
paths at runtime, so the whole thing is a couple of requests.

- `index.html` — page shell, styles, HUD, title and win screens
- `game.js` — the engine: level data at the top, then input, audio, physics,
  entities, rendering, and the main loop

The level is laid out in world pixels rather than a tile grid: the ground is a
flat line at `GROUND_Y` with a short list of platforms, hurdles, magpies, meeting
windows and party items positioned along it. `SEG` at the top of `game.js` defines
where each stretch of the day begins and ends; scenery, ground surface and sky
colour are all keyed off that, so moving a boundary moves the whole look with it.

Sound is a handful of WebAudio oscillator blips — there are no audio files either.
