(() => {
  const config = window.POKE_CHECKLIST_ANALYTICS || {};
  const measurementId = String(config.measurementId || "");
  const isProductionHost = ["pokechecklist.com", "www.pokechecklist.com"].includes(window.location.hostname);
  const debugMode = new URLSearchParams(window.location.search).get("analytics_debug") === "1";

  if (!/^G-[A-Z0-9]+$/i.test(measurementId) || (!isProductionHost && !debugMode)) return;

  const pageType = ["artist", "theme"].includes(config.pageType) ? config.pageType : "home";
  const artistId = typeof config.artistId === "string" && /^[a-z0-9-]{1,60}$/.test(config.artistId)
    ? config.artistId
    : "";
  const themeId = typeof config.themeId === "string" && /^[a-z0-9-]{1,60}$/.test(config.themeId)
    ? config.themeId
    : "";
  const pagePath = window.location.pathname || "/";
  const pageLocation = window.location.origin + pagePath;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());

  const configOptions = {
    send_page_view: false,
    page_location: pageLocation,
    page_title: document.title,
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  };
  if (debugMode) configOptions.debug_mode = true;
  window.gtag("config", measurementId, configOptions);

  const commonParams = {
    analytics_version: "pokechecklist_v2",
    page_type: pageType,
    page_path: pagePath
  };
  if (pageType === "artist" && artistId) commonParams.artist_id = artistId;
  if (pageType === "theme" && themeId) commonParams.theme_id = themeId;

  const validators = {
    target_artist_id: value => typeof value === "string" && /^[a-z0-9-]{1,60}$/.test(value),
    target_theme_id: value => typeof value === "string" && /^[a-z0-9-]{1,60}$/.test(value),
    action: value => ["added", "removed"].includes(value),
    filter_state: value => ["enabled", "disabled"].includes(value),
    sort_order: value => ["oldest_first", "newest_first"].includes(value),
    query_length_bucket: value => ["1-3", "4-7", "8+"].includes(value),
    file_format: value => ["csv", "txt"].includes(value),
    interaction_source: value => ["primary_button", "footer_note"].includes(value)
  };
  const allowedParams = {
    page_view: [],
    artist_tile_opened: ["target_artist_id"],
    theme_tile_opened: ["target_theme_id"],
    sleepy_pokemon_tile_opened: [],
    binder_card_toggled: ["action"],
    missing_filter_toggled: ["filter_state"],
    card_sort_changed: ["sort_order"],
    catalog_search_used: ["query_length_bucket"],
    catalog_search_cleared: [],
    missing_list_download_requested: ["file_format"],
    shopping_list_dialog_opened: ["interaction_source"],
    mass_entry_copy_requested: [],
    mass_entry_text_download_requested: ["file_format"],
    tcgplayer_mass_entry_requested: [],
    tcgplayer_card_search_requested: []
  };

  function track(eventName, params = {}) {
    const allowed = allowedParams[eventName];
    if (!allowed || typeof window.gtag !== "function") return;
    const payload = { ...commonParams };
    for (const key of allowed) {
      const value = params[key];
      if (validators[key] && validators[key](value)) payload[key] = value;
    }
    window.gtag("event", eventName, payload);
  }

  window.gtag("event", "page_view", {
    ...commonParams,
    page_location: pageLocation,
    page_title: document.title
  });

  const hasMissingCards = () =>
    Boolean(document.querySelector('#card-list input[type="checkbox"][data-card-id]:not(:checked)'));

  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const collectionLink = target.closest("a.tile-action");
    if (collectionLink) {
      const tile = collectionLink.closest(".artist-tile");
      if (tile?.dataset.collectionType === "theme") {
        track("theme_tile_opened", { target_theme_id: tile.dataset.themeId });
      } else if (tile) {
        track("artist_tile_opened", { target_artist_id: tile.dataset.artistId });
      }
    }
    if (target.closest("a.sleepy-promo-tile")) track("sleepy_pokemon_tile_opened");
    if (target.closest("#missing-filter-toggle")) {
      const enabled = document.getElementById("missing-filter-toggle")?.getAttribute("aria-pressed") === "true";
      track("missing_filter_toggled", { filter_state: enabled ? "enabled" : "disabled" });
    }
    if (target.closest("#sort-toggle")) {
      const newestFirst = document.getElementById("sort-label")?.textContent === "Newest first";
      track("card_sort_changed", { sort_order: newestFirst ? "newest_first" : "oldest_first" });
    }
    if (target.closest("#clear-search")) track("catalog_search_cleared");
    if (target.closest("#download-missing") && hasMissingCards()) {
      track("missing_list_download_requested", { file_format: "csv" });
    }
    if (target.closest("#open-shopping") && hasMissingCards()) {
      track("shopping_list_dialog_opened", { interaction_source: "primary_button" });
    }
    if (target.closest("#open-shopping-note") && hasMissingCards()) {
      track("shopping_list_dialog_opened", { interaction_source: "footer_note" });
    }
    if (target.closest("#copy-list") && hasMissingCards()) track("mass_entry_copy_requested");
    if (target.closest("#download-tcg-text") && hasMissingCards()) {
      track("mass_entry_text_download_requested", { file_format: "txt" });
    }
    if (target.closest("#open-tcg-mass-entry") && hasMissingCards()) {
      track("tcgplayer_mass_entry_requested");
    }
    if (target.closest('a[href*="tcgplayer.com/search/pokemon/product"]')) {
      track("tcgplayer_card_search_requested");
    }
  });

  document.addEventListener("change", event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.matches('#card-list input[type="checkbox"][data-card-id]')) return;
    track("binder_card_toggled", { action: target.checked ? "added" : "removed" });
  });

  let searchTimer = 0;
  document.addEventListener("input", event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.id !== "search") return;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      const queryLength = target.value.trim().length;
      if (!queryLength) return;
      const bucket = queryLength <= 3 ? "1-3" : queryLength <= 7 ? "4-7" : "8+";
      track("catalog_search_used", { query_length_bucket: bucket });
    }, 700);
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
  document.head.appendChild(script);
})();

