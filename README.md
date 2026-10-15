# PokeChecklist

**A binder of little worlds.** PokeChecklist is a fan-made Pokémon TCG checklist for exploring cards through the eyes of their illustrators. Browse artist pages, keep track of the cards in your binder, and make a list of the ones you are still looking for.

**Live site:** [pokechecklist.com](https://pokechecklist.com/)

## What you can do

- Browse a directory of illustrators, each with a shareable checklist page.
- Mark cards as collected and see binder progress update as you go.
- Search by Pokémon or set, filter to owned or missing cards, and sort by release date.
- Download a CSV of missing cards, copy or download a shopping list, or open it in TCGplayer Mass Entry.
- Share the homepage or an artist page with its own social preview and artist header image.

## Your binder and privacy

Binder progress is saved in local storage in the browser you use. It is not synced to an account or across devices; clearing that browser's site data can erase it.

The site uses Google Analytics 4 to understand aggregate use of the artist directory and collection tools. Its versioned event contract limits what the site sends: it does not send card IDs or names, set names, raw search text, collection contents, or shopping-list contents. See [ANALYTICS.md](ANALYTICS.md) for the event list and privacy rules.

## Card catalog

The catalog covers English physical Pokémon TCG cards and excludes the digital Pokémon TCG Pocket series. Card, illustrator, image, and set-date data are sourced from [TCGdex](https://tcgdex.dev/). Catalog files live in `dist/data/` and are registered in `dist/artists.js`.

Card identifiers are used to remember binder selections. Keep existing IDs stable when refreshing catalog data so collectors' saved progress continues to match their cards.

## Run a local preview

You need Node.js and Python 3. From the repository root, build the generated pages and serve `dist/`:

```sh
node scripts/build-site.mjs
python3 -m http.server 8000 --directory dist
```

Then open [http://localhost:8000](http://localhost:8000). The preview includes the homepage and generated artist routes. Analytics is disabled on local hosts by default; the production site uses the configured GA4 measurement ID.

## Project structure

```text
.github/workflows/deploy.yml  Builds and deploys the production site
ANALYTICS.md                  GA4 event and privacy contract
site/
  home-template.html       Homepage template
  artist-template.html     Artist checklist template
scripts/
  build-site.mjs           Generates artist pages, canonical URLs, and sitemap
dist/
  artists.js               Artist registry and page metadata
  data/                    Artist card catalogs
  assets/                  Illustrations, icons, and social preview images
  *.js, *.css              Browser app and styles
```

The build renders the homepage and one route per registered artist into `dist/`. Artist pages have stable, direct URLs such as `/asako-ito/` and are included in the generated sitemap.

## Add or update an artist

1. Add or update that artist's catalog in `dist/data/`.
2. Add the matching entry to `ARTIST_REGISTRY` in `dist/artists.js`, including the artist ID, name, description, and any header or social-preview assets.
3. Keep card IDs stable for existing cards so saved binder progress is preserved.
4. Run `node scripts/build-site.mjs` to regenerate the pages and sitemap.

Keep each artist addition focused in its own change. The homepage can hide an artist tile while that artist's page remains in the catalog.

## Deployment

GitHub Actions builds and deploys `dist/` to GitHub Pages when changes are pushed to `main`. The live custom domain is [pokechecklist.com](https://pokechecklist.com/), served over HTTPS. The workflow sets `POKECHECKLIST_SITE_URL` and `POKECHECKLIST_GA_MEASUREMENT_ID` for the production build.

## Shopping links and attribution

PokeChecklist prepares missing-card lists for TCGplayer, but it does not show live inventory or prices and never places an order. Card matches, seller options, shipping, and checkout are handled by TCGplayer. Any affiliate link must be configured with the approved Impact-generated destination; the site displays a disclosure when an affiliate link is active.

PokeChecklist is a fan-made project and is not affiliated with Pokémon or TCGplayer. Pokémon names and card artwork belong to their respective owners.
