# PokeChecklist analytics contract

This document defines Google Analytics 4 events and privacy rules for PokeChecklist. Update it before changing event names, parameters, or collection behavior in `dist/analytics.js`.

## Purpose and activation

Measure aggregate use of the artist index and checklists so the project can improve navigation and collection tools.

The deploy workflow injects the verified GA4 web stream ID `G-BFDBZJF9KY` as build-time configuration. This identifier is public site configuration, not a password or secret. If the ID is unset or malformed in a build, the generated pages do not load the Google tag or send analytics events. To change the stream later, update `POKECHECKLIST_GA_MEASUREMENT_ID` in `.github/workflows/deploy.yml`.

Use a dedicated GA4 property for PokeChecklist and one web stream for `https://pokechecklist.com`. A separate property under an existing Analytics account keeps this site's reports separate from another website.

The Google tag loads only on `pokechecklist.com` and `www.pokechecklist.com`. Local previews stay quiet unless the URL includes `?analytics_debug=1`.

## Common fields

Every event sent by the site includes:

| Field | Meaning |
| --- | --- |
| `analytics_version` | Contract version, currently `pokechecklist_v1`. |
| `page_type` | `home` or `artist`. |
| `page_path` | Pathname only, without query string or fragment. |
| `artist_id` | Artist slug on artist pages only. |
| `page_location` | Origin plus pathname, without query string or fragment; used for page attribution. |

The Google tag also receives the static page title. Google Signals and ad-personalization signals are disabled.

## Event catalog

| Event | When it fires | Allowed event-specific fields |
| --- | --- | --- |
| `page_view` | Once when a tracked page loads. | None |
| `artist_tile_opened` | A visitor follows an artist checklist link on the homepage. | `target_artist_id` |
| `binder_card_toggled` | A visitor checks or unchecks a card. | `action`: `added` or `removed` |
| `missing_filter_toggled` | A visitor changes the missing-card filter. | `filter_state`: `enabled` or `disabled` |
| `card_sort_changed` | A visitor changes card ordering. | `sort_order`: `oldest_first` or `newest_first` |
| `catalog_search_used` | A non-empty search remains after 700 ms without typing. | `query_length_bucket`: `1-3`, `4-7`, or `8+` |
| `catalog_search_cleared` | A visitor selects the clear-search control. | None |
| `missing_list_download_requested` | A visitor requests a missing-card CSV while cards are missing. | `file_format`: `csv` |
| `shopping_list_dialog_opened` | A visitor opens the shopping list dialog while cards are missing. | `interaction_source`: `primary_button` or `footer_note` |
| `mass_entry_copy_requested` | A visitor selects the copy-list control while cards are missing. | None |
| `mass_entry_text_download_requested` | A visitor requests a text list while cards are missing. | `file_format`: `txt` |
| `tcgplayer_mass_entry_requested` | A visitor requests the TCGplayer mass-entry page while cards are missing. | None |
| `tcgplayer_card_search_requested` | A visitor opens a TCGplayer card-search link. | None |

## Data that must never be sent

Do not add or send names, email addresses, account IDs, user IDs, card IDs, card names, set names, collector numbers, raw search text, clipboard contents, shopping-list contents, outbound URLs, or query strings. Do not add user properties or ecommerce events. Do not place personal data in page titles, paths, or URLs.

Search tracking sends only a coarse query-length bucket, never typed text. Card checkboxes send only whether a card was added or removed, never which card. Shopping interactions send only the action and its source.

## Google Analytics stream settings

The tracker sends its own single page view with a sanitized page location; its Google tag configuration disables automatic page views. Turn off Enhanced Measurement for this web stream to prevent additional automatically captured page views and outbound-click events outside this contract. GA4 may also record its standard automatically collected events, such as session and engagement events.

Use the GA4 Realtime report after deployment to confirm that a visit reaches this property. Append `?analytics_debug=1` to a production URL to mark events for DebugView while checking the implementation; remove the parameter for ordinary visits.

## Change management

Keep event names stable. Before introducing or removing an event, changing an allowed parameter, or changing a privacy rule:

1. Update this contract.
2. Update the explicit event and parameter allowlist in `dist/analytics.js`.
3. Review that no prohibited data is added to the event payload.
4. Increment `analytics_version` when the event schema changes.
