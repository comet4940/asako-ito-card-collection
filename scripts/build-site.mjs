import { readFile, readdir, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(projectRoot, "dist");
const defaultSiteUrl = "https://pokechecklist.com";
const siteUrl = (process.env.POKECHECKLIST_SITE_URL || defaultSiteUrl).replace(/\/+$/, "");
const gaMeasurementId = (process.env.POKECHECKLIST_GA_MEASUREMENT_ID || "").trim();
if (gaMeasurementId && !/^G-[A-Z0-9]+$/i.test(gaMeasurementId)) {
  throw new Error("POKECHECKLIST_GA_MEASUREMENT_ID must be a GA4 web Measurement ID beginning with G-.");
}

// Materialize the text-encoded hero source as a JPEG in the deployable site output.
const akiraHeroBase64 = (await readFile(path.join(projectRoot, "site/akira-egawa-grand-canvases.jpg.base64"), "utf8")).trim();
if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(akiraHeroBase64)) {
  throw new Error("Akira Egawa hero image source is not valid base64.");
}
await writeFile(path.join(distDir, "assets/akira-egawa-grand-canvases.jpg"), Buffer.from(akiraHeroBase64, "base64"));

const akiraHeroWebpBase64 = (await readFile(path.join(projectRoot, "site/akira-egawa-grand-canvases-hero.webp.base64"), "utf8")).trim();
if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(akiraHeroWebpBase64)) {
  throw new Error("Akira Egawa transparent hero image source is not valid base64.");
}
await writeFile(path.join(distDir, "assets/akira-egawa-grand-canvases-hero.webp"), Buffer.from(akiraHeroWebpBase64, "base64"));

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function replaceTokens(template, values) {
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.split("{{" + key + "}}").join(String(value));
  }
  return output;
}

function readBrowserData(source, filename) {
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename, timeout: 1000 });
  return sandbox.window;
}

function renderTile(artist, cards) {
  const years = cards.map(card => Number(card.year)).filter(Number.isFinite);
  const firstYear = years.length ? Math.min(...years) : null;
  const lastYear = years.length ? Math.max(...years) : null;
  const yearRange = firstYear === null ? "" : firstYear === lastYear ? String(firstYear) : firstYear + "–" + lastYear;
  const cardIds = JSON.stringify(cards.map(card => card.id)).replace(/</g, "\\u003c");
  const isTheme = Boolean(artist.isTheme);
  const tileLabel = artist.tileLabel || artist.medium;
  const tileName = artist.tileName || artist.name;
  const tileSummary = isTheme ? cards.length + " cards in this theme" : yearRange;
  const tileSummaryLabel = isTheme ? cards.length + " reflection cards" : "Cards from " + (firstYear || "") + " to " + (lastYear || "");
  return [
    '<article class="artist-tile tile-' + escapeHtml(artist.mediumTone) + (isTheme ? ' reflection-theme-tile' : '') + '" data-artist-id="' + escapeHtml(artist.id) + '" data-card-ids="' + escapeHtml(cardIds) + '">',
      '<div class="tile-topline">',
        '<span class="tile-medium"><span aria-hidden="true">' + escapeHtml(artist.mediumIcon) + '</span> ' + escapeHtml(tileLabel) + '</span>',
        '<span class="tile-years" aria-label="' + escapeHtml(tileSummaryLabel) + '">' + escapeHtml(tileSummary) + '</span>',
      '</div>',
      '<h3 class="tile-name">' + escapeHtml(tileName) + '</h3>',
      '<p class="tile-description">' + escapeHtml(artist.description) + '</p>',
      '<div class="tile-progress" aria-label="Collection progress">',
        '<div class="tile-progress-numbers"><span><strong class="tile-owned-count">0</strong> / <span class="tile-total-count">' + cards.length + '</span> collected</span><strong class="tile-percent">0%</strong></div>',
        '<div class="tile-progress-track" role="progressbar" aria-label="' + escapeHtml(tileName) + ' collection progress" aria-valuemin="0" aria-valuemax="' + cards.length + '" aria-valuenow="0"><span class="tile-progress-fill"></span></div>',
      '</div>',
      '<div class="tile-footer">',
        '<a class="tile-action" href="' + escapeHtml(artist.id) + '/">' + (isTheme ? 'Explore theme checklist' : 'View collection checklist') + ' <span aria-hidden="true">→</span></a>',
      '</div>',
    '</article>'
  ].join("");
}

function renderSleepyPokemonTile() {
  return [
    '<a class="artist-tile sleepy-promo-tile" href="https://sleepypokemon.com/?utm_source=pokechecklist&amp;utm_medium=referral&amp;utm_campaign=sister_project&amp;utm_content=homepage_tile" target="_blank" rel="noopener" referrerpolicy="strict-origin-when-cross-origin" aria-label="Visit Sleepy Pokémon, a curated collection of Pokémon cards caught napping (opens in a new tab)">',
      '<div class="tile-topline">',
        '<span class="tile-medium"><span aria-hidden="true">🌙</span> Sleepy Pokémon</span>',
        '<span class="tile-years">Sister project</span>',
      '</div>',
      '<h3 class="tile-name">Cards caught napping</h3>',
      '<p class="tile-description">A cozy, hand-curated collection of Pokémon cards caught napping.</p>',
      '<div class="tile-footer">',
        '<span class="tile-action">Visit Sleepy Pokémon <span aria-hidden="true">↗</span></span>',
      '</div>',
    '</a>'
  ].join("");
}

function renderAlbumCards() {
  const cardImages = [
    "assets/home-album-altaria-asako-ito.png",
    "assets/home-album-brute-bonnet-tomokazu-komiya.png"
  ];
  const renderCard = image => '<div class="home-album-sleeve"><img src="' + escapeHtml(image) + '" alt="" loading="eager" decoding="async"></div>';
  return {
    left: renderCard(cardImages[0]),
    right: renderCard(cardImages[1])
  };
}

function renderStandardHero(artist, cards) {
  return [
    '<section class="hero">',
    '        <div class="hero-copy">',
    '          <p class="eyebrow"><span class="eyebrow-dot"></span> A Pokémon card checklist</p>',
    '          <h1><span>' + escapeHtml(artist.name) + '’s</span><br><em>little world</em></h1>',
    '          <p class="hero-intro">' + escapeHtml(artist.name) + '’s Pokémon card checklist, all in one place. Mark the cards in your binder, then send the ones you’re missing to TCGplayer.</p>',
    '          <div class="hero-meta"><span class="meta-spark" aria-hidden="true">✳</span><span id="master-count">' + cards.length + ' cards</span><span class="meta-divider">·</span><span>oldest to newest</span></div>',
    '        </div>',
    '        <div class="hero-art" aria-hidden="true">',
    '          <div class="yarn yarn-one"></div><div class="yarn yarn-two"></div>',
    '          <div class="needle needle-one"></div><div class="needle needle-two"></div>',
    '          <div class="art-label">collect a little<br><b>art &amp; joy</b></div>',
    '        </div>',
    '      </section>'
  ].join("\n");
}

function renderThemeHero(artist, cards) {
  const setCount = new Set(cards.map(card => card.set)).size;
  const clearCount = cards.filter(card => card.themeFit === "clear").length;
  const sceneCount = cards.length - clearCount;
  const featured = cards.find(card => card.themeFit === "clear" && card.image) || cards.find(card => card.image);
  const featuredImage = featured
    ? '<img class="profile-feature-image" src="' + escapeHtml(featured.image) + '" alt="" fetchpriority="high" decoding="async">'
    : '<div class="reflection-mirror" aria-hidden="true"></div>';
  return [
    '<section class="hero profile-hero reflection-theme-hero" aria-labelledby="artist-title">',
      '<div class="profile-copy">',
        '<nav class="profile-breadcrumbs" aria-label="Breadcrumb">',
          '<a href="./">Collections</a><span aria-hidden="true">/</span><span>' + escapeHtml(artist.pageCategory || "Community theme") + '</span><span aria-hidden="true">/</span><span aria-current="page">' + escapeHtml(artist.name) + '</span>',
        '</nav>',
        '<p class="eyebrow reflection-eyebrow"><span class="eyebrow-dot"></span> A community-curated checklist</p>',
        '<h1 id="artist-title"><span>Pokémon and</span><em>their reflections</em></h1>',
        '<p class="profile-intro">' + escapeHtml(artist.pageBlurb) + '</p>',
        '<div class="profile-badges">',
          '<span class="profile-badge">🪞 Clear reflections · ' + clearCount + '</span>',
          '<span class="profile-badge">💧 Related scenes · ' + sceneCount + '</span>',
          '<span class="profile-badge">🗂️ ' + cards.length + ' cards · ' + setCount + ' sets</span>',
        '</div>',
      '</div>',
      '<div class="profile-feature reflection-feature" aria-hidden="true">' + featuredImage + '<span class="reflection-feature-label">LOOK AGAIN</span></div>',
    '</section>'
  ].join("");
}

function renderProfileHero(artist, cards) {
  if (artist.isTheme) return renderThemeHero(artist, cards);
  const years = cards.map(card => Number(card.year)).filter(Number.isFinite);
  const earliestYear = years.length ? Math.min(...years) : "";
  const setCount = new Set(cards.map(card => card.set)).size;
  const profileClass = "artist-profile--" + escapeHtml(artist.id);
  const mediumIcon = artist.pageMediumIcon || artist.mediumIcon;
  return [
    '<section class="hero profile-hero ' + profileClass + '" aria-labelledby="artist-title">',
      '<div class="profile-copy">',
        '<nav class="profile-breadcrumbs" aria-label="Breadcrumb">',
          '<a href="./">Artists</a><span aria-hidden="true">/</span><span>' + escapeHtml(artist.pageCategory || artist.medium) + '</span><span aria-hidden="true">/</span><span aria-current="page">' + escapeHtml(artist.name) + '</span>',
        '</nav>',
        '<h1 id="artist-title"><span>' + escapeHtml(artist.name) + '’s</span><em>' + escapeHtml(artist.pageHeading) + '</em></h1>',
        '<p class="profile-intro">' + escapeHtml(artist.pageBlurb) + '</p>',
        '<div class="profile-badges">',
          '<span class="profile-badge profile-badge-medium"><span aria-hidden="true">' + escapeHtml(mediumIcon) + '</span> ' + escapeHtml(artist.pageMedium || artist.medium) + '</span>',
          '<span class="profile-badge"><span aria-hidden="true">📅</span> Cards since ' + escapeHtml(earliestYear) + '</span>',
          '<span class="profile-badge"><span aria-hidden="true">🗂️</span> ' + cards.length + ' cards across ' + setCount + ' sets</span>',
        '</div>',
      '</div>',
      '<div class="profile-feature">',
        '<img class="profile-feature-image" src="' + escapeHtml(artist.pageHeroAsset) + '" alt="' + escapeHtml(artist.pageHeroAlt || "") + '" fetchpriority="high" decoding="async">',
      '</div>',
    '</section>'
  ].join("");
}

function renderThemeScope() {
  return [
    '<section class="reflection-scope" aria-labelledby="reflection-scope-title">',
      '<div class="reflection-scope-heading"><p class="eyebrow muted">HOW THIS CHECKLIST IS CURATED</p><h2 id="reflection-scope-title">Two ways reflections appear</h2></div>',
      '<div class="reflection-scope-grid">',
        '<p><strong>Clear self-reflections</strong><br>The Pokémon’s own image is visible in a mirror, glass, or reflective water.</p>',
        '<p><strong>Related reflection scenes</strong><br>Reflections shape the art, but the Pokémon’s own image may not be clearly shown.</p>',
      '</div>',
      '<p class="reflection-sources">A visual, community-built list inspired by a <a href="https://www.threads.com/share/_8oPxnQs4/" target="_blank" rel="noopener noreferrer">collector’s reflection-card post on Threads</a>, with more ideas from the <a href="https://staiz.io/collection/reflections" target="_blank" rel="noopener noreferrer">Staiz Reflections gallery</a> and <a href="https://www.reddit.com/r/PokemonTCG/comments/1m7xzs5/any_more_cards_with_a_pokemon_reflection_in_water/" target="_blank" rel="noopener noreferrer">collector discussion</a>. Card fit is subjective; a card name, set, and number make future additions easier to verify.</p>',
    '</section>'
  ].join("");
}

function renderCardIndex(cards) {
  let previousYear = null;
  return cards.map(card => {
    const pieces = [];
    if (card.year !== previousYear) {
      previousYear = card.year;
      pieces.push('<div class="year-heading"><span>' + escapeHtml(card.year) + '</span><i></i></div>');
    }
    const image = card.image
      ? '<img class="card-image" src="' + escapeHtml(card.image) + '" alt="' + escapeHtml(card.name + ' Pokémon card from ' + card.set) + '" loading="lazy" decoding="async">'
      : '<span>Card image unavailable</span>';
    const searchQuery = card.name + " " + card.set + " " + card.no.replace("#", "");
    const shopUrl = "https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=" + encodeURIComponent(searchQuery) + "&view=grid";
    pieces.push([
      '<article class="card-row">',
        '<label class="own-toggle card-own-toggle" aria-label="Mark ' + escapeHtml(card.name) + ' as owned">',
          '<input type="checkbox" data-card-id="' + escapeHtml(card.id) + '">',
          '<span class="checkmark" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M4.8 12.4c1.8 1.1 3.4 3.2 4.8 4.8 2.8-4.5 5.6-7.8 10.2-10.1"></path></svg></span>',
        '</label>',
        '<div class="card-image-frame' + (card.image ? '' : ' image-unavailable') + '">' + image + '</div>',
        '<div class="card-info">',
          '<div class="card-copy"><div class="card-title-line"><h3>' + escapeHtml(card.name) + '</h3><span class="owned-tag">Not in binder</span></div><p>' + escapeHtml(card.set) + ' <span class="row-dot">·</span> ' + escapeHtml(card.year) + (card.illustrator ? ' <span class="row-dot">·</span> ' + escapeHtml(card.illustrator) : '') + '</p>' + (card.themeFit ? '<p class="theme-card-note"><span class="reflection-fit reflection-fit--' + escapeHtml(card.themeFit) + '">' + (card.themeFit === "clear" ? 'Clear self-reflection' : 'Related reflection scene') + '</span> · ' + escapeHtml(card.reflectionNote || "") + '</p>' : '') + '</div>',
          '<div class="collector-number">' + escapeHtml(card.no) + '</div>',
        '</div>',
        '<div class="card-links"><a href="' + escapeHtml(shopUrl) + '" target="_blank" rel="noopener noreferrer" title="Shop for ' + escapeHtml(card.name) + ' on TCGplayer">Shop on TCGplayer <span aria-hidden="true">↗</span></a></div>',
      '</article>'
    ].join(""));
    return pieces.join("");
  }).join("");
}

const registrySource = await readFile(path.join(distDir, "artists.js"), "utf8");
const registry = readBrowserData(registrySource, "dist/artists.js");
const artists = registry.ARTIST_REGISTRY || [];
if (!artists.length) throw new Error("No artists are registered in dist/artists.js.");

const homeTemplate = await readFile(path.join(projectRoot, "site/home-template.html"), "utf8");
const artistTemplate = await readFile(path.join(projectRoot, "site/artist-template.html"), "utf8");
const catalogs = [];
for (const artist of artists) {
  const source = await readFile(path.join(distDir, artist.dataFile), "utf8");
  const data = readBrowserData(source, "dist/" + artist.dataFile).ARTIST_CARD_DATA;
  if (!data || data.artistId !== artist.id || !Array.isArray(data.cards)) {
    throw new Error("Card catalog does not match registered artist " + artist.id + ".");
  }
  catalogs.push({ artist, cards: data.cards });
}

const totalCards = catalogs.reduce((total, item) => total + item.cards.length, 0);
const homepageCatalogs = catalogs.filter(item => !item.artist.hideFromHomepage);
const homepageArtists = homepageCatalogs.filter(item => !item.artist.isTheme);
const homepageThemes = homepageCatalogs.filter(item => item.artist.isTheme);
const homepageCardCount = homepageArtists.reduce((total, item) => total + item.cards.length, 0);
const homeAlbumCards = renderAlbumCards();
const homePage = replaceTokens(homeTemplate, {
  CANONICAL_URL: escapeHtml(siteUrl + "/"),
  GA_MEASUREMENT_ID: gaMeasurementId,
  SOCIAL_PREVIEW_URL: escapeHtml(siteUrl + "/assets/pokechecklist-social-preview.jpg"),
  ARTIST_COUNT: homepageArtists.length,
  THEME_COUNT_LABEL: `${homepageThemes.length} community theme${homepageThemes.length === 1 ? "" : "s"}`,
  CARD_COUNT: homepageCardCount,
  ARTIST_TILES: [...homepageCatalogs.map(item => renderTile(item.artist, item.cards)), renderSleepyPokemonTile()].join("\n          "),
  HOME_ALBUM_LEFT: homeAlbumCards.left,
  HOME_ALBUM_RIGHT: homeAlbumCards.right
});
await writeFile(path.join(distDir, "index.html"), homePage);

const oldEntries = await readdir(distDir, { withFileTypes: true });
for (const entry of oldEntries) {
  if (!entry.isDirectory() || entry.name === "data") continue;
  const marker = path.join(distDir, entry.name, ".generated-by-pokechecklist");
  try {
    await readFile(marker);
    await rm(path.join(distDir, entry.name), { recursive: true, force: true });
  } catch {
    try {
      const oldPage = await readFile(path.join(distDir, entry.name, "index.html"), "utf8");
      if (oldPage.startsWith("<!-- Generated by PokeChecklist:")) {
        await rm(path.join(distDir, entry.name), { recursive: true, force: true });
      }
    } catch {
      // Leave hand-maintained directories alone.
    }
  }
}

for (const { artist, cards } of catalogs) {
  const description = artist.pageBlurb || ("Browse the " + artist.name + " Pokémon card checklist with " + cards.length + " cards. Track your collection and make a list of the cards you still need.");
  const pageTitle = artist.pageTitle || artist.name + " Pokémon Card Checklist | PokeChecklist";
  const pageUrl = siteUrl + "/" + artist.id + "/";
  const outputDir = path.join(distDir, artist.id);
  await mkdir(outputDir, { recursive: true });
  const page = "<!-- Generated by PokeChecklist: " + artist.id + " -->\n" + replaceTokens(artistTemplate, {
    ARTIST_ID: escapeHtml(artist.id),
    GA_MEASUREMENT_ID: gaMeasurementId,
    ARTIST_NAME: escapeHtml(artist.name),
    ARTIST_HERO: artist.isTheme ? renderThemeHero(artist, cards) : artist.pageHeroAsset ? renderProfileHero(artist, cards) : renderStandardHero(artist, cards),
    COLLECTION_NOTE: artist.isTheme ? renderThemeScope() : "",
    CARD_COUNT: cards.length,
    CARD_LIST: renderCardIndex(cards),
    DESCRIPTION: escapeHtml(description),
    PAGE_TITLE: escapeHtml(pageTitle),
    SOCIAL_PREVIEW_URL: escapeHtml(siteUrl + "/" + (artist.pageSocialAsset || "assets/pokechecklist-social-preview.jpg")),
    SOCIAL_PREVIEW_ALT: escapeHtml(artist.pageSocialAlt || (artist.pageSocialAsset ? artist.name + "’s " + artist.pageHeading + " artist page header." : "A binder of little worlds with Pokémon cards in the artist index.")),
    CANONICAL_URL: escapeHtml(pageUrl)
  });
  await writeFile(path.join(outputDir, "index.html"), page);
}

const sitemapUrls = [siteUrl + "/", ...catalogs.map(item => siteUrl + "/" + item.artist.id + "/")];
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  sitemapUrls.map(url => '  <url><loc>' + escapeHtml(url) + '</loc></url>').join("\n") +
  '\n</urlset>\n';
await writeFile(path.join(distDir, "sitemap.xml"), sitemap);
await writeFile(path.join(distDir, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: " + siteUrl + "/sitemap.xml\n");

console.log("Built " + catalogs.filter(item => !item.artist.isTheme).length + " artist pages and " + catalogs.filter(item => item.artist.isTheme).length + " theme pages containing " + totalCards + " checklist entries.");
