(function () {
  const D = window.WishlistData;
  const grid = document.querySelector("#wish-grid");
  const dialog = document.querySelector("#gift-dialog");
  const bagItems = document.querySelector("#bag-items");
  const bagCount = document.querySelector("#bag-count");

  function wishCard(wish) {
    const available = wish.status === "available";
    const visual = wish.image
      ? `<img src="${wish.image}" alt="${D.escapeHTML(wish.name)}">`
      : `<span class="symbol-placeholder" aria-hidden="true">${D.escapeHTML(wish.symbol || "GIFT")}</span>`;
    const shop = wish.link ? `<a class="shop-link" href="${D.escapeHTML(wish.link)}" target="_blank" rel="noopener noreferrer">Zum Shop &nearr;</a>` : "";
    return `<article class="wish-card">
      <div class="wish-visual">${visual}</div>
      <div class="wish-content">
        <div class="wish-card-top"><p class="wish-category">${D.escapeHTML(wish.category)}</p><span class="status ${available ? "status-free" : "status-taken"}">${available ? "Verfügbar" : wish.status === "gifted" ? "Schon verschenkt" : "Reserviert"}</span></div>
        <h3>${D.escapeHTML(wish.name)}</h3>
        <p class="wish-description">${D.escapeHTML(wish.description || "")}</p>
        <div class="wish-card-bottom"><strong class="wish-price">${D.money(wish.price)}</strong>${shop}</div>
        <button class="button ${available ? "button-primary" : "button-disabled"} reserve-button" type="button" data-reserve="${D.escapeHTML(wish.id)}" ${available ? "" : "disabled"}>${available ? "In Geschenk-Ablage reservieren" : "Nicht mehr verfügbar"}</button>
      </div>
    </article>`;
  }

  function renderWishes() {
    if (!grid) return;
    const wishes = D.getWishes();
    grid.innerHTML = wishes.length ? wishes.map(wishCard).join("") : `<p class="empty-state">Noch keine Wünsche eingetragen.</p>`;
  }

  function renderBag() {
    const wishes = D.getWishes();
    const bag = D.getBag();
    if (bagCount) bagCount.textContent = String(bag.length);
    if (!bagItems) return;
    const items = bag.map(id => wishes.find(wish => wish.id === id)).filter(Boolean);
    bagItems.innerHTML = items.length ? items.map(wish => `<article class="bag-item">
      <div><strong>${D.escapeHTML(wish.name)}</strong><span>${D.money(wish.price)}</span></div>
      <p>Dieser Wunsch ist in deiner Geschenk-Ablage reserviert.</p>
      <div class="bag-actions"><a class="shop-link" href="${wish.link ? D.escapeHTML(wish.link) : "#"}" ${wish.link ? 'target="_blank" rel="noopener noreferrer"' : "aria-disabled=\"true\""}>${wish.link ? "Zum Shop" : "Noch kein Shop-Link"}</a><button type="button" class="text-button" data-release="${D.escapeHTML(wish.id)}">Reservierung aufheben</button><button type="button" class="text-button" data-bought="${D.escapeHTML(wish.id)}">Als gekauft markieren</button></div>
    </article>`).join("") : `<div class="empty-state"><strong>Deine Ablage ist noch leer.</strong><p>Wähle einen Wunsch und reserviere ihn hier.</p></div>`;
  }

  function reserve(id) {
    const wishes = D.getWishes();
    const wish = wishes.find(item => item.id === id);
    if (!wish || wish.status !== "available") return;
    wish.status = "reserved";
    D.saveWishes(wishes);
    const bag = D.getBag();
    if (!bag.includes(id)) bag.push(id);
    D.saveBag(bag);
    renderWishes();
    renderBag();
    window.dispatchEvent(new CustomEvent("wishlist:updated"));
  }

  function changeReservation(id, status) {
    const wishes = D.getWishes();
    const wish = wishes.find(item => item.id === id);
    if (!wish) return;
    wish.status = status;
    D.saveWishes(wishes);
    D.saveBag(D.getBag().filter(itemId => itemId !== id));
    renderWishes();
    renderBag();
    window.dispatchEvent(new CustomEvent("wishlist:updated"));
  }

  document.addEventListener("click", event => {
    const reserveButton = event.target.closest("[data-reserve]");
    if (reserveButton) reserve(reserveButton.dataset.reserve);
    const releaseButton = event.target.closest("[data-release]");
    if (releaseButton) changeReservation(releaseButton.dataset.release, "available");
    const boughtButton = event.target.closest("[data-bought]");
    if (boughtButton) changeReservation(boughtButton.dataset.bought, "gifted");
  });
  document.querySelector("#open-bag")?.addEventListener("click", () => { renderBag(); dialog?.showModal(); });
  document.querySelector("#close-bag")?.addEventListener("click", () => dialog?.close());
  dialog?.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  window.addEventListener("wishlist:updated", renderBag);
  renderWishes();
  renderBag();

  window.WishlistUI = { wishCard, renderWishes, renderBag };
})();


document.querySelector("#copy-link")?.addEventListener("click", async () => {
  const message = document.querySelector("#copy-message");

  try {
    await navigator.clipboard.writeText(window.location.href);
    message.textContent = "Link kopiert – du kannst ihn jetzt teilen.";
  } catch {
    message.textContent =
      "Kopieren nicht möglich. Bitte kopiere den Link aus der Adresszeile.";
  }
});
