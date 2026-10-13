(() => {
  const cards = window.ASAKO_CARDS || [];
  const storageKey = "asako-ito-card-collection-owned-v2";
  const previousStorageKey = "asako-ito-card-collection-owned-v1";
  const massEntryBaseUrl = window.AFFILIATE_MASS_ENTRY_URL || "https://www.tcgplayer.com/massentry";
  const owned = new Set(readOwned());
  let activeFilter = "all";
  let searchTerm = "";
  let toastTimeout;

  const els = {
    list: document.getElementById("card-list"),
    empty: document.getElementById("empty-state"),
    search: document.getElementById("search"),
    dialog: document.getElementById("shopping-dialog"),
    massText: document.getElementById("mass-entry-text"),
    toast: document.getElementById("toast")
  };

  function readOwned() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        const value = JSON.parse(saved);
        return Array.isArray(value) ? value.filter(id => cards.some(card => card.id === id)) : [];
      }
      const previous = JSON.parse(localStorage.getItem(previousStorageKey) || "[]");
      if (!Array.isArray(previous)) return [];
      const migrated = previous.map(value => {
        if (typeof value !== "string") return null;
        const id = value.split(/[?#]/, 1)[0].split("/").filter(Boolean).pop();
        return cards.some(card => card.id === id) ? id : null;
      }).filter(Boolean);
      localStorage.setItem(storageKey, JSON.stringify(migrated));
      return migrated;
    } catch {
      return [];
    }
  }

  function saveOwned() {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(owned)));
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
      if (card.tcgMassEntryName) return "1 " + card.tcgMassEntryName + " [" + card.tcgCode + "]";
      if (!card.tcgNumber) return "1 " + card.name + " [" + card.tcgCode + "]";
      if (card.tcgDashNumber) return "1 " + card.name + " - " + card.tcgNumber + " [" + card.tcgCode + "]";
      return "1 " + card.name + " [" + card.tcgCode + "] " + card.tcgNumber;
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
    return '<article class="card-row ' + (isOwned ? "is-owned" : "") + '">' +
      '<label class="own-toggle card-own-toggle" aria-label="Mark ' + escapeHtml(card.name) + " as " + (isOwned ? "not owned" : "owned") + '">' +
        '<input type="checkbox" data-card-id="' + escapeHtml(card.id) + '" ' + (isOwned ? "checked" : "") + '>' +
        '<span class="checkmark" aria-hidden="true">' + (isOwned ? "✓" : "") + "</span>" +
      "</label>" +
      '<div class="card-image-frame"><img class="card-image" src="' + escapeHtml(card.image) + '" alt="' + escapeHtml(imageAlt) + '" loading="lazy" decoding="async"></div>' +
      '<div class="card-info">' +
        '<div class="card-copy"><div class="card-title-line"><h3>' + escapeHtml(card.name) + '</h3><span class="owned-tag">' + (isOwned ? "In binder" : "Need") + "</span></div>" +
          "<p>" + escapeHtml(card.set) + ' <span class="row-dot">·</span> ' + card.year + "</p></div>" +
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
        chunks.push('<div class="year-heading"><span>' + card.year + "</span><i></i></div>");
      }
      chunks.push(renderCard(card));
    }
    els.list.innerHTML = chunks.join("");
    els.list.querySelectorAll(".card-image").forEach(image => {
      image.addEventListener("error", () => {
        const frame = image.closest(".card-image-frame");
        if (frame) {
          frame.classList.add("image-unavailable");
          frame.innerHTML = '<span>Card image unavailable</span>';
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
    const bar = document.querySelector(".progress-track");
    bar.setAttribute("aria-valuemax", total);
    bar.setAttribute("aria-valuenow", count);
    document.getElementById("all-filter-count").textContent = total;
    document.getElementById("need-filter-count").textContent = missing;
    document.getElementById("owned-filter-count").textContent = count;
    document.getElementById("master-count").textContent = total + " cards";
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
    downloadFile("asako-ito-cards-still-missing.csv", rows.map(row => row.map(csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8");
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
      downloadFile("asako-ito-tcgplayer-list.txt", text, "text/plain;charset=utf-8");
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
    if (popup) {
      popup.opener = null;
    } else {
      window.location.href = url;
    }
  }

  function toast(message) {
    clearTimeout(toastTimeout);
    els.toast.textContent = message;
    els.toast.classList.add("visible");
    toastTimeout = setTimeout(() => els.toast.classList.remove("visible"), 2600);
  }

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
    downloadFile("asako-ito-tcgplayer-list.txt", makeMassEntryList(missing), "text/plain;charset=utf-8");
  });
  document.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      els.search.focus();
    }
  });

  updateProgress();
  renderList();
})();
