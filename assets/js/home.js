/**
 * home.js - Overview / Home Feed Module (#view-overview - Instagram-Style Online Catalog)
 */
window.HiperHome = (() => {
  "use strict";

  const { state, $, $$, showToast } = window.HiperApi;

  function loadDashboard() {
    renderShopStories();
    renderProductsFeed();
    bindHomeEvents();
  }

  function renderShopStories() {
    const slider = $("#home-shop-stories");
    if (!slider) return;
    slider.replaceChildren();

    const shops = (state.shops && state.shops.length > 0) ? state.shops : [
      { Shop_name: "Main Store", Shop_brand_name: "Hiper", icon: "🏪" },
      { Shop_name: "Fashion Hub", Shop_brand_name: "Style", icon: "👗" },
      { Shop_name: "Tech Zone", Shop_brand_name: "Gadgets", icon: "📱" },
      { Shop_name: "Fresh Market", Shop_brand_name: "Organic", icon: "🍎" },
      { Shop_name: "Flag Squer", Shop_brand_name: "A.Dot", icon: "🏬" }
    ];

    shops.forEach(sh => {
      const name = sh.Shop_name || sh.name || "Store";
      const item = document.createElement("div");
      item.className = "shop-story-item";
      item.innerHTML = `
        <div class="story-avatar-ring">
          <div class="story-avatar-inner">${sh.icon || name.slice(0, 1).toUpperCase()}</div>
        </div>
        <span class="story-shop-name">${name}</span>
      `;
      item.addEventListener("click", () => {
        if ($("#header-search-input")) $("#header-search-input").value = name;
        renderProductsFeed(name);
      });
      slider.append(item);
    });
  }

  function renderProductsFeed(filterQuery = "") {
    const feedGrid = $("#home-products-feed");
    if (!feedGrid) return;
    feedGrid.replaceChildren();

    const query = (filterQuery || $("#header-search-input")?.value || "").trim().toLowerCase();
    const products = (state.products || []).filter(p => {
      if (!query) return true;
      const name = String(p.name || "").toLowerCase();
      const code = String(p.code || "").toLowerCase();
      const shop = String(p.at_shop || p.Shop_name || "").toLowerCase();
      const desc = String(p.description || "").toLowerCase();
      return name.includes(query) || code.includes(query) || shop.includes(query) || desc.includes(query);
    });

    if (products.length === 0) {
      feedGrid.innerHTML = `<p class="empty-state">No marketplace products found matching "${query || 'search'}".</p>`;
      return;
    }

    products.forEach(p => {
      const pName = p.name || "Product Item";
      const pPrice = parseFloat(p.price) || 0;
      const pShop = p.at_shop || p.Shop_name || "Hiper Store";
      const pDesc = p.description || "High quality product from our verified marketplace catalog.";
      const pImg = p.image || p.img_url || "";

      const post = document.createElement("article");
      post.className = "product-post-card";

      post.innerHTML = `
        <div class="post-header">
          <div class="post-author-info">
            <div class="post-author-avatar">${pShop.slice(0, 1).toUpperCase()}</div>
            <div class="post-author-title">
              <strong>${pShop}</strong>
              <small>Verified Merchant • Official Store</small>
            </div>
          </div>
          <button class="icon-button" style="width:28px; height:28px; font-size:14px; border:0; background:transparent;">⋮</button>
        </div>

        <div class="post-media-box">
          ${pImg ? `<img src="${pImg}" alt="${pName}">` : `<div style="font-size: 56px;">📦</div>`}
          <span class="post-price-badge">$${pPrice.toFixed(2)}</span>
        </div>

        <div class="post-action-bar">
          <div class="post-actions-left">
            <button class="post-action-icon btn-like" title="Like">🤍</button>
            <button class="post-action-icon btn-comment" title="Comment">💬</button>
            <button class="post-action-icon btn-share" title="Share">✈️</button>
          </div>
          <button class="button button-primary button-small btn-add-cart">🛍️ Add to Cart</button>
        </div>

        <div class="post-caption-box">
          <span class="post-caption-title">${pName}</span>
          <p class="post-caption-desc">${pDesc}</p>
        </div>
      `;

      // Like toggle
      const likeBtn = post.querySelector(".btn-like");
      likeBtn?.addEventListener("click", () => {
        likeBtn.classList.toggle("liked");
        likeBtn.textContent = likeBtn.classList.contains("liked") ? "❤️" : "🤍";
      });

      // Add to cart action
      const cartBtn = post.querySelector(".btn-add-cart");
      cartBtn?.addEventListener("click", () => {
        if (window.HiperPos) {
          window.HiperPos.addToCart(p);
          showToast(`Added ${pName} to Cart!`);
        }
      });

      feedGrid.append(post);
    });
  }

  function bindHomeEvents() {
    $("#header-search-input")?.addEventListener("input", (e) => {
      renderProductsFeed(e.target.value);
    });

    $$(".feed-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        $$(".feed-filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderProductsFeed();
      });
    });
  }

  return {
    loadDashboard,
    renderShopStories,
    renderProductsFeed
  };
})();
