/**
 * shops.js - Shops & Stores Module (#view-shops)
 */
window.HiperShops = (() => {
  "use strict";

  const { state, $, formatMoney } = window.HiperApi;

  function renderShops() {
    const grid = $("#shops-grid");
    if (!grid) return;
    grid.replaceChildren();

    const query = $(`[data-search="shops"]`)?.value.trim().toLowerCase() || "";
    const items = (state.shops || []).filter((item) =>
      !query || Object.values(item).some((value) => String(value ?? "").toLowerCase().includes(query))
    );

    for (const item of items) {
      const card = document.createElement("article");
      card.className = "panel shop-card";
      card.innerHTML = `
        <span class="shop-icon">🏬</span>
        <div>
          <h3>${item.Shop_name || "Main Shop"}</h3>
          <p class="muted">${item.Shop_brand_name || "BELLEMA FASHION"}</p>
          <p class="muted">${[item.Shop_location, item.Shop_country].filter(Boolean).join(" · ") || "Ethiopia"}</p>
          <p class="muted">Currency: ${item.Shop_currency || "ETB"}</p>
        </div>
      `;
      const actionCount = (state.shopActions || []).filter(action => String(action.shop_id) === String(item.Shop_Id)).length;
      const promoButton = document.createElement("button");
      promoButton.type = "button"; promoButton.className = "button button-secondary";
      promoButton.dataset.shopPromos = String(item.Shop_Id);
      promoButton.textContent = `Manage promotions (${actionCount})`;
      card.append(promoButton);
      grid.append(card);
    }

    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "panel empty-state";
      empty.textContent = "No shops match this search.";
      grid.append(empty);
    }
  }

  function bindEvents() {
    $("#shops-grid")?.addEventListener("click", event => {
      const button = event.target.closest("[data-shop-promos]"); if (!button) return;
      if (window.HiperApp) window.HiperApp.navigate("manager");
      window.HiperManager?.switchManagerTab("tools");
      const filter = $("#action-shop-filter"); if (filter) { filter.value = button.dataset.shopPromos; filter.dispatchEvent(new Event("change")); }
    });
  }

  return {
    renderShops,
    bindEvents
  };
})();
