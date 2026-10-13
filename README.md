# Asako Ito Card Collection

A buildless static collection checklist based on the 37 cards listed on [PkmnCards](https://pkmncards.com/artist/asako-ito/) as of October 12, 2026.

## Current behavior

- Check and uncheck owned cards; progress is saved in the visitor's browser with local storage.
- Search by Pokémon or set and filter to all, missing, or owned cards.
- Download a CSV containing only missing cards, with their set, collector number, and PkmnCards URL.
- Open TCGplayer Mass Entry with the missing-card list already filled in; copy and download the list are also available as fallbacks.
- Review the matches, choose Near Mint, add them, and compare seller and shipping options with Cart Optimizer.
- Pokémon Mass Entry lines include the complete collector number (including the set total); cards whose names repeat in a set use TCGplayer's disambiguated name-number order.
- The card list is ordered by set release from oldest to newest.

## Hosting

The public site is deployed to [GitHub Pages](https://comet4940.github.io/asako-ito-card-collection/) by GitHub Actions from the `dist/` folder whenever a commit is pushed to `main`. The site is buildless: edit the static files in `dist/`, commit, and push. The workflow is in `.github/workflows/deploy.yml`.

## Shopping and affiliate setup

TCGplayer documents Mass Entry and its Cart Optimizer as the buyer-facing route for bulk lists. New TCGplayer developer API keys are not currently being granted, so this version hands the matched list to TCGplayer for its own inventory, condition, seller, and shipping choices.

After joining TCGplayer's Affiliate Program through Impact, set AFFILIATE_MASS_ENTRY_URL in dist/cards.js to the exact Impact-generated link whose destination is the Pokémon Mass Entry page. The shopping button will use that destination and display the affiliate disclosure. Do not use another site's tracking link.

## Data refresh

The master list is a dated snapshot. Recheck the linked PkmnCards artist page before adding later releases; keep cards sorted by expansion release date.
