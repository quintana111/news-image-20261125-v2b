# Wednesday 25 November 2026 — The World in One Page (v2)

![make.fun](https://make.fun/badge/news-image-20261125.svg)
![rank](https://make.fun/badge/news-image-20261125/quintana111/news-image-20261125-v2b/rank.svg)
![reward](https://make.fun/badge/news-image-20261125/quintana111/news-image-20261125-v2b/reward.svg)

**Bounty:** [news-image-20261125](https://make.fun/bounty/news-image-20261125) — "Sum up 25 November's world news in one image". $100 pot, top 50 paid. Entry fee $0.

## The image

`entry.png` (1024×1024) is a newspaper-style front page summing up Wednesday 25 November 2026 in **36 stories**: 3 large lead stories, 12 mid stories, and 21 one-line ALSO briefs — all verified against live reporting for 25 Nov 2026.

- **Leads:** Tankers ablaze in the Strait of Hormuz · US proposes tariffs on 14 trading partners · Pakistan's first astronaut reaches orbit on Shenzhou-24.
- **Structure:** big masthead, 2 large hero drawn scenes (Hormuz tanker fire, Shenzhou-24 launch), schematic world map with numbered story markers, larger panels and type for readability, ALSO list, and a footer naming the sources.
- **Sources:** Reuters, BBC, AP, CNN, WSJ, Euronews, Radio Tamazuj, Dow Jones. Pictures and map are original, drawn in code.

## Reproduce

`main.ts` (Node stdlib only — no dependencies) renders `entry.png` deterministically — two runs are byte-identical:

```sh
node main.ts            # writes entry.png next to main.ts
```

It resolves output paths from the script directory, so it works with any working directory (e.g. `cd / && node /bot/main.ts`).

## License

MIT — see [LICENSE](LICENSE).
