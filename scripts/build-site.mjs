import { readFile, readdir, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(projectRoot, "dist");
const defaultSiteUrl = "https://comet4940.github.io/asako-ito-card-collection";
const siteUrl = (process.env.POKECHECKLIST_SITE_URL || defaultSiteUrl).replace(/\/+$/, "");

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
  return [
    '<article class="artist-tile tile-' + escapeHtml(artist.mediumTone) + '" data-artist-id="' + escapeHtml(artist.id) + '" data-card-ids="' + escapeHtml(cardIds) + '">',
      '<div class="tile-topline">',
        '<span class="tile-medium"><span aria-hidden="true">' + escapeHtml(artist.mediumIcon) + '</span> ' + escapeHtml(artist.medium) + '</span>',
        '<span class="tile-years" aria-label="Cards from ' + escapeHtml(firstYear || "") + ' to ' + escapeHtml(lastYear || "") + '">' + escapeHtml(yearRange) + '</span>',
      '</div>',
      '<h3 class="tile-name">' + escapeHtml(artist.name) + '</h3>',
      '<p class="tile-description">' + escapeHtml(artist.description) + '</p>',
      '<div class="tile-progress" aria-label="Collection progress">',
        '<div class="tile-progress-numbers"><span><strong class="tile-owned-count">0</strong> / <span class="tile-total-count">' + cards.length + '</span> collected</span><strong class="tile-percent">0%</strong></div>',
        '<div class="tile-progress-track" role="progressbar" aria-label="' + escapeHtml(artist.name) + ' collection progress" aria-valuemin="0" aria-valuemax="' + cards.length + '" aria-valuenow="0"><span class="tile-progress-fill"></span></div>',
      '</div>',
      '<div class="tile-footer">',
        '<a class="tile-action" href="' + escapeHtml(artist.id) + '/">View collection checklist <span aria-hidden="true">→</span></a>',
        '<a class="tile-tcg" href="' + escapeHtml(artist.id) + '/?shop=1" aria-label="Shop missing ' + escapeHtml(artist.name) + ' cards on TCGplayer">TCGplayer</a>',
      '</div>',
    '</article>'
  ].join("");
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

function renderAsakoHero(artist, cards) {
  const years = cards.map(card => Number(card.year)).filter(Number.isFinite);
  const earliestYear = years.length ? Math.min(...years) : "";
  const setCount = new Set(cards.map(card => card.set)).size;
  return [
    '<section class="hero asako-hero" aria-labelledby="artist-title">',
      '<div class="asako-copy">',
        '<nav class="asako-breadcrumbs" aria-label="Breadcrumb">',
          '<a href="../">Artists</a><span aria-hidden="true">/</span><span>Fiber &amp; Crochet</span><span aria-hidden="true">/</span><span aria-current="page">Asako Ito</span>',
        '</nav>',
        '<h1 id="artist-title"><span>Asako Ito’s</span><em>' + escapeHtml(artist.pageHeading || "Stitched Stories") + '</em></h1>',
        '<p class="asako-intro">' + escapeHtml(artist.pageBlurb) + '</p>',
        '<div class="asako-badges">',
          '<span class="asako-badge asako-badge-medium"><span aria-hidden="true">🧶</span> ' + escapeHtml(artist.pageMedium || "Amigurumi Crochet") + '</span>',
          '<span class="asako-badge"><span aria-hidden="true">📅</span> Cards since ' + escapeHtml(earliestYear) + '</span>',
          '<span class="asako-badge"><span aria-hidden="true">🗂️</span> ' + cards.length + ' cards across ' + setCount + ' sets</span>',
        '</div>',
      '</div>',
      '<div class="asako-feature" aria-hidden="true">',
        '<img class="asako-feature-image" src="assets/asako-ito-amigurumi.png" alt="" fetchpriority="high" decoding="async">',
      '</div>',
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
          '<span class="checkmark" aria-hidden="true"></span>',
        '</label>',
        '<div class="card-image-frame' + (card.image ? '' : ' image-unavailable') + '">' + image + '</div>',
        '<div class="card-info">',
          '<div class="card-copy"><div class="card-title-line"><h3>' + escapeHtml(card.name) + '</h3><span class="owned-tag">Need</span></div><p>' + escapeHtml(card.set) + ' <span class="row-dot">·</span> ' + escapeHtml(card.year) + '</p></div>',
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
const homePage = replaceTokens(homeTemplate, {
  CANONICAL_URL: escapeHtml(siteUrl + "/"),
  ARTIST_COUNT: catalogs.length,
  CARD_COUNT: totalCards,
  ARTIST_TILES: catalogs.map(item => renderTile(item.artist, item.cards)).join("\n          ")
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
  const pageTitle = artist.name + " Pokémon Card Checklist | PokeChecklist";
  const pageUrl = siteUrl + "/" + artist.id + "/";
  const outputDir = path.join(distDir, artist.id);
  await mkdir(outputDir, { recursive: true });
  const page = "<!-- Generated by PokeChecklist: " + artist.id + " -->\n" + replaceTokens(artistTemplate, {
    ARTIST_ID: escapeHtml(artist.id),
    ARTIST_NAME: escapeHtml(artist.name),
    ARTIST_HERO: artist.id === "asako-ito" ? renderAsakoHero(artist, cards) : renderStandardHero(artist, cards),
    CARD_COUNT: cards.length,
    CARD_LIST: renderCardIndex(cards),
    DESCRIPTION: escapeHtml(description),
    PAGE_TITLE: escapeHtml(pageTitle),
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

console.log("Built " + catalogs.length + " artist pages containing " + totalCards + " cards.");
