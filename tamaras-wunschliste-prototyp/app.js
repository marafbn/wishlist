(function () {
  const D = window.WishlistData;
  const grid = document.querySelector("#wish-grid");
  const dialog = document.querySelector("#gift-dialog");
  const bagItems = document.querySelector("#bag-items");
  const bagCount = document.querySelector("#bag-count");

  const BAG_DETAILS_KEY = "tamaraWishlistBagDetails_v1";
  const RESERVATION_TOKEN_KEY = "tamaraWishlistReservationToken_v1";

  function getReservationToken() {
    let token = localStorage.getItem(RESERVATION_TOKEN_KEY);

    if (!token) {
      token =
        window.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

      localStorage.setItem(RESERVATION_TOKEN_KEY, token);
    }

    return token;
  }

  function getBagDetails() {
    try {
      const details = JSON.parse(localStorage.getItem(BAG_DETAILS_KEY) || "[]");
      return Array.isArray(details) ? details : [];
    } catch {
      return [];
    }
  }

  function saveBagDetails(details) {
    localStorage.setItem(BAG_DETAILS_KEY, JSON.stringify(details));
  }

  function wishCard(wish) {
    const visual = wish.image
      ? `<img src="${wish.image}" alt="${D.escapeHTML(wish.name)}">`
      : `<span class="symbol-placeholder" aria-hidden="true">${D.escapeHTML(wish.symbol || "GIFT")}</span>`;

    const shop = wish.link
      ? `<a class="shop-link" href="${D.escapeHTML(wish.link)}" target="_blank" rel="noopener noreferrer">Zum Shop &nearr;</a>`
      : "";

    return `
      <article class="wish-card">
        <div class="wish-visual">${visual}</div>
        <div class="wish-content">
          <div class="wish-card-top">
            <p class="wish-category">${D.escapeHTML(wish.category)}</p>
            <span class="status status-free">Verfügbar</span>
          </div>
          <h3>${D.escapeHTML(wish.name)}</h3>
          <p class="wish-description">${D.escapeHTML(wish.description || "")}</p>
          <div class="wish-card-bottom">
            <strong class="wish-price">${D.money(wish.price)}</strong>
            ${shop}
          </div>
          <button
            class="button button-primary reserve-button"
            type="button"
            data-reserve="${D.escapeHTML(wish.id)}">
            In Geschenk-Ablage reservieren
          </button>
        </div>
      </article>
    `;
  }

  function renderWishes() {
    if (!grid) return;

    const wishes = D.getWishes().filter(
      (wish) => wish.status === "available"
    );

    grid.innerHTML = wishes.length
      ? wishes.map(wishCard).join("")
      : `<p class="empty-state">Noch keine verfügbaren Wünsche eingetragen.</p>`;
  }

  function renderBag() {
    const bag = D.getBag();
    const details = getBagDetails();

    if (bagCount) {
      bagCount.textContent = String(bag.length);
    }

    if (!bagItems) return;

    const knownWishes = new Map();

    [...D.getWishes(), ...details].forEach((wish) => {
      knownWishes.set(String(wish.id), wish);
    });

    const items = bag
      .map((id) => knownWishes.get(String(id)))
      .filter(Boolean);

    bagItems.innerHTML = items.length
      ? items
          .map(
            (wish) => `
              <article class="bag-item">
                <div>
                  <strong>${D.escapeHTML(wish.name)}</strong>
                  <span>${D.money(wish.price)}</span>
                </div>
                <p>Dieser Wunsch ist in deiner Geschenk-Ablage reserviert.</p>
                <div class="bag-actions">
                  <a
                    class="shop-link"
                    href="${wish.link ? D.escapeHTML(wish.link) : "#"}"
                    ${wish.link ? 'target="_blank" rel="noopener noreferrer"' : 'aria-disabled="true"'}>
                    ${wish.link ? "Zum Shop" : "Noch kein Shop-Link"}
                  </a>
                  <button
                    type="button"
                    class="text-button"
                    data-release="${D.escapeHTML(wish.id)}">
                    Reservierung aufheben
                  </button>
                  <button
                    type="button"
                    class="text-button"
                    data-bought="${D.escapeHTML(wish.id)}">
                    Als gekauft markieren
                  </button>
                </div>
              </article>
            `
          )
          .join("")
      : `
          <div class="empty-state">
            <strong>Deine Ablage ist noch leer.</strong>
            <p>Wähle einen Wunsch und reserviere ihn hier.</p>
          </div>
        `;
  }

  async function reloadAvailableWishes() {
    await D.loadWishesFromSupabase();
    renderWishes();
    renderBag();
  }

  async function reserve(id) {
    if (!window.wishlistSupabase) {
      alert("Die Verbindung zur Datenbank wurde nicht gefunden.");
      return;
    }

    const wish = D.getWishes().find(
      (item) => String(item.id) === String(id)
    );

    if (!wish || wish.status !== "available") return;

    try {
      const { data, error } = await window.wishlistSupabase.rpc(
        "reserve_wish",
        {
          p_wish_id: id,
          p_reservation_token: getReservationToken()
        }
      );

      if (error) throw error;

      if (data !== true) {
        alert("Dieser Wunsch wurde gerade von jemand anderem reserviert.");
        await reloadAvailableWishes();
        return;
      }

      wish.status = "reserved";

      const bag = D.getBag();

      if (!bag.some((itemId) => String(itemId) === String(id))) {
        bag.push(id);
      }

      D.saveBag(bag);

      const details = getBagDetails().filter(
        (item) => String(item.id) !== String(id)
      );

      details.push(wish);
      saveBagDetails(details);

      renderWishes();
      renderBag();

      try {
        await reloadAvailableWishes();
      } catch (refreshError) {
        console.error(
          "Die Wunschliste konnte nicht aktualisiert werden:",
          refreshError
        );
      }

      window.dispatchEvent(new CustomEvent("wishlist:updated"));
    } catch (error) {
      console.error("Reservierung fehlgeschlagen:", error);
      alert(
        "Die Reservierung hat nicht geklappt. Bitte prüfe die Browser-Konsole."
      );
    }
  }

  async function changeReservation(id, action) {
    if (!window.wishlistSupabase) {
      alert("Die Verbindung zur Datenbank wurde nicht gefunden.");
      return;
    }

    const functionName =
      action === "release" ? "release_wish" : "mark_wish_gifted";

    try {
      const { data, error } = await window.wishlistSupabase.rpc(
        functionName,
        {
          p_wish_id: id,
          p_reservation_token: getReservationToken()
        }
      );

      if (error) throw error;

      if (data !== true) {
        alert(
          "Die Änderung ging nicht. Die Reservierung gehört möglicherweise nicht zu diesem Browser."
        );
        return;
      }

      D.saveBag(
        D.getBag().filter((itemId) => String(itemId) !== String(id))
      );

      saveBagDetails(
        getBagDetails().filter((wish) => String(wish.id) !== String(id))
      );

      renderBag();

      try {
        await reloadAvailableWishes();
      } catch (refreshError) {
        console.error(
          "Die Wunschliste konnte nicht aktualisiert werden:",
          refreshError
        );
      }

      window.dispatchEvent(new CustomEvent("wishlist:updated"));
    } catch (error) {
      console.error(
        "Die Änderung der Reservierung ist fehlgeschlagen:",
        error
      );
      alert(
        "Die Änderung hat nicht geklappt. Bitte prüfe die Browser-Konsole."
      );
    }
  }

  document.addEventListener("click", (event) => {
    const reserveButton = event.target.closest("[data-reserve]");
    if (reserveButton) reserve(reserveButton.dataset.reserve);

    const releaseButton = event.target.closest("[data-release]");
    if (releaseButton) {
      changeReservation(releaseButton.dataset.release, "release");
    }

    const boughtButton = event.target.closest("[data-bought]");
    if (boughtButton) {
      changeReservation(boughtButton.dataset.bought, "gifted");
    }
  });

  document.querySelector("#open-bag")?.addEventListener("click", () => {
    renderBag();
    dialog?.showModal();
  });

  document.querySelector("#close-bag")?.addEventListener("click", () => {
    dialog?.close();
  });

  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  window.addEventListener("wishlist:updated", renderBag);

  async function initializeWishlist() {
    if (grid && window.wishlistSupabase) {
      try {
        await D.loadWishesFromSupabase();
      } catch (error) {
        console.error("Wünsche konnten nicht geladen werden:", error);
        grid.innerHTML =
          '<p class="empty-state">Die Wünsche konnten gerade nicht geladen werden. Prüfe die Browser-Konsole.</p>';
        renderBag();
        return;
      }
    }

    renderWishes();
    renderBag();
  }

  initializeWishlist();

  window.WishlistUI = {
    wishCard,
    renderWishes,
    renderBag
  };
})();

document.querySelector("#copy-link")?.addEventListener("click", async () => {
  const message = document.querySelector("#copy-message");

  try {
    await navigator.clipboard.writeText(window.location.href);
    if (message) {
      message.textContent = "Link kopiert – du kannst ihn jetzt teilen.";
    }
  } catch {
    if (message) {
      message.textContent =
        "Kopieren nicht möglich. Bitte kopiere den Link aus der Adresszeile.";
    }
  }
});