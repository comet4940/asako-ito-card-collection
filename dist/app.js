(() => {
  const artists = window.ARTIST_REGISTRY || [];
  const firstArtist = artists[0];
  const ownedStorageKey = "pokechecklist-owned-v1";
  const legacyAsakoKeys = [
    "asako-ito-card-collection-owned-v2",
    "asako-ito-card-collection-owned-v1"
  ];
  const massEntryBaseUrl = window.AFFILIATE_MASS_ENTRY_URL || "https://www.tcgplayer.com/massentry";
  const loadedCards = new Map();
  let currentArtist = null;
  let cards = [];
  let owned = new Set();
  let activeFilter = "all";
  let searchTerm = "";
  let toastTimeout;
  let loadVersion = 0;

  const els = {
    list: document.getElementById("card-list"),
    empty: document.getElementById("empty-state"),
    search: document.getElementById("search"),
    dialog: document.getElementById("shopping-dialog"),
    massText: document.getElementById("mass-entry-text"),
    toast: document.getElementById("toast"),
    artistSelect: document.getElementById("artist-select"),
    artistHeading: document.getElementById("artist-heading-name"),
    heroIntro: document.getElementById("hero-intro"),
    progressTrack: document.querySelector(".progress-track")
  };

  function parseStoredMap() {
    try {
      const value = JSON.parse(localStorage.getItem(ownedStorageKey) || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function readLegacyAsakoOwned(asakoCards) {
    for (const key of legacyAsakoKeys) {
      try {
        const value = JSON.parse(localStorage.getItem(key) || "null");
        if (!Array.isArray(value)) continue;
        const migrated = value.map(item => {
          if (typeof item !== "string") return null;
          if (asakoCards.some(card => card.id === item)) return item;
          const id = item.split(/[?#]/, 1)[0].split("/").filter(Boolean).pop();
          return asakoCards.some(card => card.id === id) ? id : null;
        }).filter(Boolean);
        if (migrated.length || key === legacyAsakoKeys[0]) return migrated;
      } catch {
        // Try the next older storage version.
      }
    }
    return [];
  }

  function readOwned(artist, artistCards) {
    const saved = parseStoredMap();
    let values = saved[artist.id];
    if (!Array.isArray(values) && artist.id === "asako-ito") {
      values = readLegacyAsakoOwned(artistCards);
    }
    if (!Array.isArray(values)) return new Set();
    return new Set(values.filter(id => artistCards.some(card => card.id === id)));
  }

  function saveOwned() {
    try {
      const saved = parseStoredMap();
      saved[currentArtist.id] = Array.from(owned);
      localStorage.setItem(ownedStorageKey, JSON.stringify(saved));
    } catch {
      toast("Your browser couldn’t save this checklist on this device.");
    }
  }

  function missingCards() {
    return cards.filter(card => !owned.has(card.id));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function tcgSearchUrl(card) {
    const query = card.name + " " + card.set + " " + card.no.replace("#", "");
    return "https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=" +
      encodeURIComponent(query) + "&view=grid";
  }

  function makeMassEntryList(list) {
    return list.map(card => {
      const name = card.tcgMassEntryName || card.name;
      if (!card.tcgCode) return "1 " + name;
      if (!card.tcgNumber) return "1 " + name + " [" + card.tcgCode + "]";
      if (card.tcgDashNumber) return "1 " + name + " - " + card.tcgNumber + " [" + card.tcgCode + "]";
      if (card.tcgMassEntryName) return "1 " + name + " [" + card.tcgCode + "]";
      return "1 " + name + " [" + card.tcgCode + "] " + card.tcgNumber;
    }).join("\n");
  }

  function makePrefilledMassEntryUrl(list) {
    const url = new URL(massEntryBaseUrl, window.location.href);
    url.searchParams.set("productline", "Pokemon");
    url.searchParams.set("c", makeMassEntryList(list).split("\n").join("||"));
    return url.toString();
  }

  function renderCard(card) {
    const isOwned = owned.has(card.id);
    const imageAlt = card.name + " card from " + card.set;
    const image = card.image
      ? '<img class="card-image" src="' + escapeHtml(card.image) + '" alt="' + escapeHtml(imageAlt) + '" loading="lazy" decoding="async">'
      : '<span>Card image unavailable</span>';
    return '<article class="card-row ' + (isOwned ? "is-owned" : "") + '">' +
      '<label class="own-toggle card-own-toggle" aria-label="Mark ' + escapeHtml(card.name) + " as " + (isOwned ? "not owned" : "owned") + '">' +
        '<input type="checkbox" data-card-id="' + escapeHtml(card.id) + '" ' + (isOwned ? "checked" : "") + '>' +
        '<span class="checkmark" aria-hidden="true">' + (isOwned ? "✓" : "") + "</span>" +
      "</label>" +
      '<div class="card-image-frame' + (card.image ? '' : ' image-unavailable') + '">' + image + "</div>" +
      '<div class="card-info">' +
        '<div class="card-copy"><div class="card-title-line"><h3>' + escapeHtml(card.name) + '</h3><span class="owned-tag">' + (isOwned ? "In binder" : "Need") + "</span></div>" +
          "<p>" + escapeHtml(card.set) + ' <span class="row-dot">·</span> ' + escapeHtml(card.year) + "</p></div>" +
        '<div class="collector-number">' + escapeHtml(card.no) + "</div>" +
      "</div>" +
      '<div class="card-links">' +
        '<a href="' + escapeHtml(tcgSearchUrl(card)) + '" target="_blank" rel="noopener noreferrer" title="Shop for ' + escapeHtml(card.name) + ' on TCGplayer">Shop on TCGplayer <span aria-hidden="true">↗</span></a>' +
      "</div></article>";
  }

  function renderList() {
    const query = searchTerm.trim().toLocaleLowerCase();
    const filtered = cards.filter(card => {
      const isOwned = owned.has(card.id);
      const matchesFilter = activeFilter === "all" ||
        (activeFilter === "owned" && isOwned) ||
        (activeFilter === "missing" && !isOwned);
      const matchesSearch = !query ||
        (card.name + " " + card.set + " " + card.no).toLocaleLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });

    let currentYear = null;
    const chunks = [];
    for (const card of filtered) {
      if (card.year !== currentYear) {
        currentYear = card.year;
        chunks.push('<div class="year-heading"><span>' + escapeHtml(card.year) + "</span><i></i></div>");
      }
      chunks.push(renderCard(card));
    }
    els.list.innerHTML = chunks.join("");
    els.list.querySelectorAll(".card-image").forEach(image => {
      image.addEventListener("error", () => {
        const frame = image.closest(".card-image-frame");
        if (frame) {
          frame.classList.add("image-unavailable");
          frame.innerHTML = "<span>Card image unavailable</span>";
        }
      }, { once: true });
    });
    els.empty.hidden = filtered.length > 0;
    els.list.hidden = filtered.length === 0;
    els.list.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener("change", () => {
        const id = input.dataset.cardId;
        if (input.checked) owned.add(id);
        else owned.delete(id);
        saveOwned();
        updateProgress();
        renderList();
        toast(input.checked ? "Added to your binder." : "Moved back to your missing list.");
      });
    });
  }

  function updateProgress() {
    const total = cards.length;
    const count = cards.filter(card => owned.has(card.id)).length;
    const missing = total - count;
    const percentage = total ? Math.round((count / total) * 100) : 0;
    document.getElementById("owned-count").textContent = count;
    document.getElementById("total-count").textContent = total;
    document.getElementById("missing-count").textContent = missing + (missing === 1 ? " card still to find" : " cards still to find");
    document.getElementById("progress-percent").textContent = percentage + "%";
    document.getElementById("progress-fill").style.width = percentage + "%";
    els.progressTrack.setAttribute("aria-label", currentArtist.name + " collection progress");
    els.progressTrack.setAttribute("aria-valuemax", total);
    els.progressTrack.setAttribute("aria-valuenow", count);
    document.getElementById("all-filter-count").textContent = total;
    document.getElementById("need-filter-count").textContent = missing;
    document.getElementById("owned-filter-count").textContent = count;
    document.getElementById("master-count").textContent = total + (total === 1 ? " card" : " cards");
    document.getElementById("shopping-missing-count").textContent = missing;
    document.getElementById("affiliate-disclosure").hidden = !window.AFFILIATE_MASS_ENTRY_URL;
  }

  function downloadFile(filename, contents, type) {
    const blob = new Blob([contents], { type: type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function csvCell(value) {
    return '"' + String(value).replace(/"/g, '""') + '"';
  }

  function downloadMissingCsv() {
    const missing = missingCards();
    if (!missing.length) {
      toast("You have the full list. Lovely work!");
      return;
    }
    const rows = [
      ["Pokémon", "Set", "Collector number", "TCGplayer search URL"],
      ...missing.map(card => [card.name, card.set, card.no, tcgSearchUrl(card)])
    ];
    downloadFile(currentArtist.id + "-cards-still-missing.csv", rows.map(row => row.map(csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8");
    toast("Downloaded " + missing.length + " missing " + (missing.length === 1 ? "card." : "cards."));
  }

  function openShoppingDialog() {
    const missing = missingCards();
    if (!missing.length) {
      toast("You have the full list. No cards left to shop for.");
      return;
    }
    els.massText.textContent = makeMassEntryList(missing);
    document.getElementById("shopping-missing-count").textContent = missing.length;
    els.dialog.showModal();
  }

  async function copyMassEntry() {
    const text = makeMassEntryList(missingCards());
    try {
      await navigator.clipboard.writeText(text);
      toast("TCGplayer list copied. Paste it into Mass Entry.");
    } catch {
      downloadFile(currentArtist.id + "-tcgplayer-list.txt", text, "text/plain;charset=utf-8");
      toast("Downloaded your TCGplayer list.");
    }
  }

  function openTcgMassEntry() {
    const missing = missingCards();
    if (!missing.length) {
      toast("You have the full list. No cards left to shop for.");
      return;
    }
    const url = makePrefilledMassEntryUrl(missing);
    const popup = window.open(url, "_blank");
    if (popup) popup.opener = null;
    else window.location.href = url;
  }

  function toast(message) {
    clearTimeout(toastTimeout);
    els.toast.textContent = message;
    els.toast.classList.add("visible");
    toastTimeout = setTimeout(() => els.toast.classList.remove("visible"), 2600);
  }

  function updateArtistCopy(artist) {
    els.artistHeading.textContent = artist.name + "’s";
    els.heroIntro.textContent = "A handy checklist bringing " + artist.name + "’s Pokémon cards together in one place. Mark what’s in your binder, then send the cards you’re missing straight to TCGplayer.";
    document.title = "PokeChecklist — " + artist.name + " Card Collection";
    document.querySelector('meta[name="description"]').content = "Track the " + artist.name + " Pokémon TCG collection and send missing cards to TCGplayer.";
  }

  function loadArtistCards(artist) {
    if (loadedCards.has(artist.id)) return Promise.resolve(loadedCards.get(artist.id));
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = artist.dataFile;
      script.dataset.artistId = artist.id;
      script.onload = () => {
        const payload = window.ARTIST_CARD_DATA;
        if (!payload || payload.artistId !== artist.id || !Array.isArray(payload.cards)) {
          reject(new Error("The artist card file did not match the selected artist."));
          return;
        }
        loadedCards.set(artist.id, payload.cards);
        resolve(payload.cards);
      };
      script.onerror = () => reject(new Error("The artist card file could not be loaded."));
      document.head.append(script);
    });
  }

  function updateAddress(artist, addHistory) {
    const url = new URL(window.location.href);
    if (artist.id === firstArtist.id) url.searchParams.delete("artist");
    else url.searchParams.set("artist", artist.id);
    if (addHistory) window.history.pushState({}, "", url);
    else window.history.replaceState({}, "", url);
  }

  async function switchArtist(artist, options = {}) {
    if (!artist) return;
    const version = ++loadVersion;
    currentArtist = artist;
    els.artistSelect.value = artist.id;
    updateArtistCopy(artist);
    if (options.updateAddress !== false) updateAddress(artist, options.addHistory === true);
    activeFilter = "all";
    searchTerm = "";
    els.search.value = "";
    document.querySelectorAll(".filter-button").forEach(button => {
      button.classList.toggle("active", button.dataset.filter === "all");
    });
    cards = [];
    owned = new Set();
    els.empty.querySelector("h3").textContent = "No cards found";
    els.empty.querySelector("p").textContent = "Try another Pokémon or set name.";
    updateProgress();
    els.list.hidden = false;
    els.empty.hidden = true;
    els.list.innerHTML = '<p class="loading-message">Loading ' + escapeHtml(artist.name) + "’s cards…</p>";
    try {
      const artistCards = await loadArtistCards(artist);
      if (version !== loadVersion) return;
      cards = artistCards;
      owned = readOwned(artist, cards);
      updateProgress();
      renderList();
    } catch {
      if (version !== loadVersion) return;
      cards = [];
      owned = new Set();
      updateProgress();
      els.list.hidden = true;
      els.empty.hidden = false;
      els.empty.querySelector("h3").textContent = "Cards couldn’t be loaded";
      els.empty.querySelector("p").textContent = "Refresh the page and try again.";
    }
  }

  if (!artists.length) return;

  els.artistSelect.innerHTML = artists.map(artist =>
    '<option value="' + escapeHtml(artist.id) + '">' + escapeHtml(artist.name) + "</option>"
  ).join("");
  els.artistSelect.addEventListener("change", () => {
    const artist = artists.find(item => item.id === els.artistSelect.value);
    switchArtist(artist, { addHistory: true });
  });
  window.addEventListener("popstate", () => {
    const artistId = new URL(window.location.href).searchParams.get("artist");
    switchArtist(artists.find(item => item.id === artistId) || firstArtist, { updateAddress: false });
  });

  document.querySelectorAll(".filter-button").forEach(button => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll(".filter-button").forEach(item => item.classList.toggle("active", item === button));
      renderList();
    });
  });
  els.search.addEventListener("input", () => { searchTerm = els.search.value; renderList(); });
  document.getElementById("clear-search").addEventListener("click", () => {
    els.search.value = "";
    searchTerm = "";
    renderList();
    els.search.focus();
  });
  document.getElementById("download-missing").addEventListener("click", downloadMissingCsv);
  document.getElementById("open-shopping").addEventListener("click", openShoppingDialog);
  document.getElementById("open-shopping-note").addEventListener("click", openShoppingDialog);
  document.getElementById("copy-list").addEventListener("click", copyMassEntry);
  document.getElementById("open-tcg-mass-entry").addEventListener("click", openTcgMassEntry);
  document.getElementById("download-tcg-text").addEventListener("click", () => {
    const missing = missingCards();
    if (!missing.length) {
      toast("You have the full list. No cards left to shop for.");
      return;
    }
    downloadFile(currentArtist.id + "-tcgplayer-list.txt", makeMassEntryList(missing), "text/plain;charset=utf-8");
  });
  document.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      els.search.focus();
    }
  });

  const requestedArtist = new URL(window.location.href).searchParams.get("artist");
  const initialArtist = artists.find(artist => artist.id === requestedArtist) || firstArtist;
  switchArtist(initialArtist, { updateAddress: false });
})();
