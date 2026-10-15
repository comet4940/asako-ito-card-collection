(() => {
  const artists = window.ARTIST_REGISTRY || [];
  const ownedStorageKey = "pokechecklist-owned-v1";
  const legacyAsakoKeys = [
    "asako-ito-card-collection-owned-v2",
    "asako-ito-card-collection-owned-v1"
  ];
  const massEntryBaseUrl = window.AFFILIATE_MASS_ENTRY_URL || "https://www.tcgplayer.com/massentry";
  let currentArtist = null;
  let cards = [];
  let owned = new Set();
  let showMissingOnly = false;
  let newestFirst = false;
  let searchTerm = "";
  let toastTimeout;

  const els = {
    list: document.getElementById("card-list"),
    empty: document.getElementById("empty-state"),
    search: document.getElementById("search"),
    dialog: document.getElementById("shopping-dialog"),
    massText: document.getElementById("mass-entry-text"),
    toast: document.getElementById("toast"),
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

  function renderCaughtStamp() {
    return '<span class="owned-stamp caught-stamp" aria-hidden="true"><svg viewBox="0 0 100 100" focusable="false"><path class="ball-top" d="M14 50a36 36 0 0 1 72 0H14Z"></path><g class="ball-wear"><circle cx="25" cy="31" r="1.6"></circle><circle cx="34" cy="21" r="1.1"></circle><circle cx="46" cy="17" r="1.4"></circle><circle cx="68" cy="20" r="1.5"></circle><circle cx="78" cy="29" r="1.1"></circle><circle cx="19" cy="41" r="1"></circle><circle cx="60" cy="29" r="1"></circle><circle cx="39" cy="36" r=".8"></circle><path d="M28 26l2-1m31-8 2 1m13 14 2-1M45 22l1-2m-25 18 1-1"></path></g><path class="ball-band" d="M14 50h72"></path><path class="ball-outline" d="M50 14c20 0 36 16 36 36 0 19-16 36-36 36S14 69 14 50c0-20 16-36 36-36Z"></path><circle class="ball-button-ring" cx="50" cy="50" r="11"></circle><circle class="ball-button" cx="50" cy="50" r="4.5"></circle></svg></span>';
  }

  function renderCard(card) {
    const isOwned = owned.has(card.id);
    const hasOwnedStamp = Boolean(currentArtist.hasOwnedStamp);
    const imageAlt = card.name + " card from " + card.set;
    const image = card.image
      ? '<img class="card-image" src="' + escapeHtml(card.image) + '" alt="' + escapeHtml(imageAlt) + '" loading="lazy" decoding="async">'
      : '<span>Card image unavailable</span>';
    const ownedStamp = hasOwnedStamp && isOwned
      ? renderCaughtStamp()
      : "";
    return '<article class="card-row ' + (isOwned ? "is-owned" : "") + '">' +
      '<label class="own-toggle card-own-toggle" aria-label="Mark ' + escapeHtml(card.name) + " as " + (isOwned ? "not owned" : "owned") + '">' +
        '<input type="checkbox" data-card-id="' + escapeHtml(card.id) + '" ' + (isOwned ? "checked" : "") + '>' +
        '<span class="checkmark" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M4.8 12.4c1.8 1.1 3.4 3.2 4.8 4.8 2.8-4.5 5.6-7.8 10.2-10.1"></path></svg></span>' +
      "</label>" +
      '<div class="card-image-frame' + (card.image ? '' : ' image-unavailable') + '">' + image + ownedStamp + "</div>" +
      '<div class="card-info">' +
        '<div class="card-copy"><div class="card-title-line"><h3>' + escapeHtml(card.name) + '</h3><span class="owned-tag">' + (isOwned ? "In binder" : "Not in binder") + "</span></div>" +
          "<p>" + escapeHtml(card.set) + ' <span class="row-dot">·</span> ' + escapeHtml(card.year) + "</p></div>" +
        '<div class="collector-number">' + escapeHtml(card.no) + "</div>" +
      "</div>" +
      '<div class="card-links">' +
        '<a href="' + escapeHtml(tcgSearchUrl(card)) + '" target="_blank" rel="noopener noreferrer" title="Shop for ' + escapeHtml(card.name) + ' on TCGplayer">Shop on TCGplayer <span aria-hidden="true">↗</span></a>' +
      "</div></article>";
  }

  function renderList() {
    const query = searchTerm.trim().toLocaleLowerCase();
    const orderedCards = newestFirst ? cards.slice().reverse() : cards;
    const filtered = orderedCards.filter(card => {
      const isOwned = owned.has(card.id);
      const matchesFilter = !showMissingOnly || !isOwned;
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
    const noCardsToFind = showMissingOnly && missingCards().length === 0 && !query;
    els.empty.querySelector("h3").textContent = noCardsToFind ? "All caught up!" : "No cards found";
    els.empty.querySelector("p").textContent = noCardsToFind
      ? "Every card in this collection is in your binder."
      : "Try another Pokémon or set name.";
    document.getElementById("clear-search").hidden = noCardsToFind || !query;
  }

  els.list.addEventListener("change", event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.matches('input[type="checkbox"][data-card-id]')) return;
    const id = input.dataset.cardId;
    const card = cards.find(item => item.id === id);
    if (input.checked) owned.add(id);
    else owned.delete(id);
    saveOwned();
    updateProgress();

    const row = input.closest(".card-row");
    if (row && card) {
      row.classList.toggle("is-owned", input.checked);
      const toggle = input.closest(".own-toggle");
      if (toggle) toggle.setAttribute("aria-label", "Mark " + card.name + " as " + (input.checked ? "not owned" : "owned"));
      const status = row.querySelector(".owned-tag");
      if (status) status.textContent = input.checked ? "In binder" : "Not in binder";
      if (currentArtist.hasOwnedStamp) {
        const frame = row.querySelector(".card-image-frame");
        const stamp = frame && frame.querySelector(".owned-stamp");
        if (input.checked && frame && !stamp) {
          frame.insertAdjacentHTML("beforeend", renderCaughtStamp());
        } else if (!input.checked && stamp) {
          stamp.remove();
        }
      }
    }

    const matchesFilter = !showMissingOnly || !input.checked;
    if (!matchesFilter) renderList();
    toast(input.checked ? "Added to your binder." : "Moved back to your missing list.");
  });

  function updateProgress() {
    const total = cards.length;
    const count = cards.filter(card => owned.has(card.id)).length;
    const missing = total - count;
    const percentage = total ? Math.round((count / total) * 100) : 0;
    document.getElementById("owned-count").textContent = count;
    document.getElementById("total-count").textContent = total;
    const filterButton = document.getElementById("missing-filter-toggle");
    document.getElementById("missing-filter-label").textContent = showMissingOnly ? "Show all cards" : "Show cards not in my binder";
    document.getElementById("missing-filter-count").textContent = showMissingOnly ? total : missing;
    filterButton.setAttribute("aria-pressed", String(showMissingOnly));
    filterButton.setAttribute("aria-label", showMissingOnly
      ? "Show all " + total + " cards"
      : "Show only the " + missing + " cards not in my binder");
    filterButton.disabled = missing === 0 && !showMissingOnly;
    document.getElementById("progress-percent").textContent = percentage + "%";
    document.getElementById("progress-fill").style.width = percentage + "%";
    els.progressTrack.setAttribute("aria-label", currentArtist.name + " collection progress");
    els.progressTrack.setAttribute("aria-valuemax", total);
    els.progressTrack.setAttribute("aria-valuenow", count);
    const masterCount = document.getElementById("master-count");
    if (masterCount) masterCount.textContent = total + (total === 1 ? " card" : " cards");
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

  document.getElementById("missing-filter-toggle").addEventListener("click", () => {
    showMissingOnly = !showMissingOnly;
    updateProgress();
    renderList();
  });
  document.getElementById("sort-toggle").addEventListener("click", event => {
    newestFirst = !newestFirst;
    const currentDirection = newestFirst ? "newest to oldest" : "oldest to newest";
    const nextDirection = newestFirst ? "oldest to newest" : "newest to oldest";
    document.getElementById("sort-label").textContent = newestFirst ? "Newest first" : "Oldest first";
    event.currentTarget.setAttribute("aria-label", "Cards are sorted " + currentDirection + ". Activate to sort " + nextDirection + ".");
    event.currentTarget.title = "Sort " + nextDirection;
    renderList();
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

  currentArtist = artists.find(artist => artist.id === window.CURRENT_ARTIST_ID);
  const catalog = window.ARTIST_CARD_DATA;
  if (!currentArtist || !catalog || catalog.artistId !== currentArtist.id || !Array.isArray(catalog.cards)) {
    els.list.hidden = true;
    els.empty.hidden = false;
    els.empty.querySelector("h3").textContent = "This checklist isn’t available";
    els.empty.querySelector("p").textContent = "Return to the artist directory and choose another collection.";
  } else {
    cards = catalog.cards;
    owned = readOwned(currentArtist, cards);
    updateProgress();
    renderList();
    if (new URLSearchParams(window.location.search).get("shop") === "1") openShoppingDialog();
  }
})();
