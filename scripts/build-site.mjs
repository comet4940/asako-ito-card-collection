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

function renderTile(artist, cards, index) {
  const sampleIndexes = [0, Math.floor((cards.length - 1) / 2), cards.length - 1];
  const samples = [...new Set(sampleIndexes)].map(cardIndex => cards[cardIndex]).filter(card => card && card.image);
  const preview = samples.map((card, cardIndex) =>
    '<img class="tile-card tile-card-' + (cardIndex + 1) + '" src="' + escapeHtml(card.image) + '" alt="" loading="lazy" decoding="async">'
  ).join("");
  const color = ["sage", "rose", "lilac", "gold", "sky"][index % 5];
  return [
    '<a class="artist-tile tile-' + color + '" href="' + escapeHtml(artist.id) + '/" aria-label="Explore ' + escapeHtml(artist.name) + '’s checklist, ' + cards.length + ' cards">',
      '<span class="tile-art" aria-hidden="true">' + preview + '</span>',
      '<span class="tile-copy">',
        '<span class="tile-eyebrow">ILLUSTRATOR CHECKLIST</span>',
        '<span class="tile-name">' + escapeHtml(artist.name) + '</span>',
        '<span class="tile-count">' + cards.length + (cards.length === 1 ? ' card' : ' cards') + '</span>',
        '<span class="tile-action">View collection <span aria-hidden="true">→</span></span>',
      '</span>',
      '<span class="tile-arrow" aria-hidden="true">↗</span>',
    '</a>'
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
    pieces.push([
      '<article class="card-row">',
        '<div class="card-image-frame' + (card.image ? '' : ' image-unavailable') + '">' + image + '</div>',
        '<div class="card-info">',
          '<div class="card-copy"><h3>' + escapeHtml(card.name) + '</h3><p>' + escapeHtml(card.set) + ' <span class="row-dot">·</span> ' + escapeHtml(card.year) + '</p></div>',
          '<div class="collector-number">' + escapeHtml(card.no) + '</div>',
        '</div>',
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
  ARTIST_TILES: catalogs.map((item, index) => renderTile(item.artist, item.cards, index)).join("\n          ")
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
  const description = "Browse the " + artist.name + " Pokémon card checklist with " + cards.length + " cards. Track your collection and make a list of the cards you still need.";
  const pageTitle = artist.name + " Pokémon Card Checklist | PokeChecklist";
  const pageUrl = siteUrl + "/" + artist.id + "/";
  const outputDir = path.join(distDir, artist.id);
  await mkdir(outputDir, { recursive: true });
  const page = "<!-- Generated by PokeChecklist: " + artist.id + " -->\n" + replaceTokens(artistTemplate, {
    ARTIST_ID: escapeHtml(artist.id),
    ARTIST_NAME: escapeHtml(artist.name),
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
