# PokeChecklist

A fan-made Pokémon TCG checklist for collecting cards by illustrator. Browse artist pages, track your binder, download the cards you are missing, or send them to TCGplayer Mass Entry.

## Current behavior

- Browse artist checklists from the home page; every artist has a direct, shareable page and a separate saved binder.
- Check and uncheck owned cards; progress is saved in the visitor's browser with local storage. Card art appears beside each card's set and collector number.
- Search by Pokémon or set and filter to all, missing, or owned cards.
- Download a CSV containing only missing cards, with their set, collector number, and TCGplayer search link.
- Open TCGplayer Mass Entry with the missing-card list already filled in; copy and download the list are also available as fallbacks.
- Sort cards by set release date from oldest to newest.

## Artist data

The initial artists are Asako Ito, Yuka Morii, Akira Egawa, Tomokazu Komiya, and Shinji Kanda. English physical card catalogs use card, illustrator, image, and set-date data from [TCGdex](https://tcgdex.dev/), with the digital Pokémon TCG Pocket series excluded. Artist catalog files are kept separate in `dist/data/`; add an artist in its own change by adding one data file and one entry in `dist/artists.js`.

Asako Ito's existing card IDs remain stable so saved binder progress carries forward. Older local-storage values are migrated the first time her checklist is opened.

## Hosting

The public site is deployed to [pokechecklist.com](https://pokechecklist.com/) by GitHub Actions whenever a commit is pushed to `main`. The workflow runs `node scripts/build-site.mjs` with `POKECHECKLIST_SITE_URL=https://pokechecklist.com` to generate the artist pages, canonical URLs, `sitemap.xml`, and `robots.txt`, then deploys the `dist/` folder. The generated artist URLs work directly at paths such as `/asako-ito/`, including on refresh. To connect the domain, set `pokechecklist.com` as the custom domain in the repository's **Settings → Pages**. At the domain provider, point the apex (`@`) to GitHub Pages with A records `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, and `185.199.111.153`; point `www` to `comet4940.github.io` with a CNAME record. Once DNS is verified and GitHub Pages provisions the certificate, enable **Enforce HTTPS**.

To preview the generated static files locally, run `node scripts/build-site.mjs` and serve the `dist/` directory with any static file server.

## Shopping and affiliate setup

TCGplayer's [Mass Entry guide](https://help.tcgplayer.com/hc/en-us/articles/360055768913-Getting-Started-With-Mass-Entry) documents the list format and its card-set codes. The app hands the missing-card list to TCGplayer for inventory, condition, seller, and shipping choices.

After joining TCGplayer's Affiliate Program through Impact, set `AFFILIATE_MASS_ENTRY_URL` in `dist/artists.js` to the exact Impact-generated link whose destination is the Pokémon Mass Entry page. The shopping button will use that destination and display the affiliate disclosure. Do not use another site's tracking link.

## Data refresh

Artist card files are sorted by set release date. Add a new artist as a separate commit with a file under `dist/data/` and a matching registry entry in `dist/artists.js`.
