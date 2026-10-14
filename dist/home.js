(() => {
  const ownedStorageKey = "pokechecklist-owned-v1";
  const legacyAsakoKeys = [
    "asako-ito-card-collection-owned-v2",
    "asako-ito-card-collection-owned-v1"
  ];

  function readSaved() {
    try {
      const saved = JSON.parse(localStorage.getItem(ownedStorageKey) || "{}");
      return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch {
      return {};
    }
  }

  function readLegacyAsako(ids) {
    for (const key of legacyAsakoKeys) {
      try {
        const values = JSON.parse(localStorage.getItem(key) || "null");
        if (!Array.isArray(values)) continue;
        const matches = values.map(value => {
          if (typeof value !== "string") return null;
          if (ids.includes(value)) return value;
          const id = value.split(/[?#]/, 1)[0].split("/").filter(Boolean).pop();
          return ids.includes(id) ? id : null;
        }).filter(Boolean);
        if (matches.length || key === legacyAsakoKeys[0]) return matches;
      } catch {
        // Try the next older storage version.
      }
    }
    return [];
  }

  function updateProgress() {
    let saved = {};
    try {
      saved = readSaved();
    } catch {
      // Keep the directory usable when browser storage is unavailable.
    }

    document.querySelectorAll(".artist-tile[data-artist-id]").forEach(tile => {
      let ids = [];
      try {
        ids = JSON.parse(tile.dataset.cardIds || "[]");
      } catch {
        // Generated card IDs should be valid JSON; show empty progress if not.
      }
      if (!Array.isArray(ids)) ids = [];

      let values = saved[tile.dataset.artistId];
      if (!Array.isArray(values) && tile.dataset.artistId === "asako-ito") {
        values = readLegacyAsako(ids);
      }
      const owned = new Set(Array.isArray(values) ? values : []);
      const count = ids.reduce((total, id) => total + (owned.has(id) ? 1 : 0), 0);
      const total = ids.length;
      const percentage = total ? count / total * 100 : 0;
      const roundedPercentage = Math.round(percentage);

      tile.querySelector(".tile-owned-count").textContent = count;
      tile.querySelector(".tile-total-count").textContent = total;
      tile.querySelector(".tile-percent").textContent = roundedPercentage + "%";
      tile.querySelector(".tile-progress-fill").style.width = percentage + "%";
      const track = tile.querySelector(".tile-progress-track");
      track.setAttribute("aria-valuemax", total);
      track.setAttribute("aria-valuenow", count);
      track.setAttribute("aria-valuetext", count + " of " + total + " cards collected");
    });
  }

  updateProgress();
  window.addEventListener("storage", updateProgress);
  window.addEventListener("pageshow", updateProgress);
  window.addEventListener("focus", updateProgress);
})();
