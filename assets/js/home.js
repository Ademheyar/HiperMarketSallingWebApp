/**
 * home.js - Overview / Home Feed Module (#view-overview - Instagram-Style E-Commerce Feed with Infinite Scroll)
 */
window.HiperHome = (() => {
  "use strict";

  const { state, $, $$, showToast } = window.HiperApi;

  let displayLimit = 6;
  const batchSize = 6;
  let isLoadingMore = false;
  let activeQuery = "";

  const defaultShops = [
    { Shop_name: "Main Store", Shop_brand_name: "Hiper", icon: "🏪" },
    { Shop_name: "Fashion Hub", Shop_brand_name: "Style", icon: "👗" },
    { Shop_name: "Tech Zone", Shop_brand_name: "Gadgets", icon: "📱" },
    { Shop_name: "Fresh Market", Shop_brand_name: "Organic", icon: "🍎" },
    { Shop_name: "Flag Squer", Shop_brand_name: "A.Dot", icon: "🏬" },
    { Shop_name: "Electronics Pro", Shop_brand_name: "Tech", icon: "💻" },
    { Shop_name: "Beauty Care", Shop_brand_name: "Glow", icon: "✨" }
  ];

  const defaultProducts = [
    { name: "Wireless Noise-Canceling Headphones", price: 129.99, at_shop: "Tech Zone", description: "Premium audio experience with active noise cancellation and 30-hour battery life.", image: "" },
    { name: "Smart Fitness Watch Series 5", price: 189.50, at_shop: "Tech Zone", description: "Track your daily heart rate, GPS workouts, sleep quality, and active notifications.", image: "" },
    { name: "Organic Espresso Beans (1kg)", price: 24.99, at_shop: "Fresh Market", description: "100% Arabica dark roast whole coffee beans roasted fresh daily.", image: "" },
    { name: "Classic Denim Jacket - Unisex", price: 68.00, at_shop: "Fashion Hub", description: "Timeless vintage denim jacket with durable stitching and modern fit.", image: "" },
    { name: "Genuine Leather Crossbody Bag", price: 85.00, at_shop: "Flag Squer", description: "Handcrafted genuine Italian leather messenger bag with multiple compartments.", image: "" },
    { name: "4K Ultra HD Waterproof Action Cam", price: 149.00, at_shop: "Electronics Pro", description: "Capture crisp 4K 60fps outdoor videos with stabilization and dual screens.", image: "" },
    { name: "Ergonomic Mesh Office Chair", price: 175.00, at_shop: "Main Store", description: "Breathable lumbar support chair with adjustable armrests for long work sessions.", image: "" },
    { name: "Portable Waterproof Bluetooth Speaker", price: 49.99, at_shop: "Tech Zone", description: "Deep bass 360-degree sound speaker perfect for beach, pool, and travel.", image: "" },
    { name: "Natural Glow Hydrating Face Serum", price: 32.50, at_shop: "Beauty Care", description: "Hyaluronic acid and Vitamin C formula for radiant, hydrated skin.", image: "" },
    { name: "Lightweight Breathable Running Shoes", price: 79.99, at_shop: "Fashion Hub", description: "Cushioned memory foam sneakers designed for daily training and running.", image: "" }
  ];

  function loadDashboard() {
    renderShopStories();
    renderProductsFeed("", true);
    bindHomeEvents();
    updateHeaderCartBadge();
  }

  function renderShopStories() {
    const slider = $("#home-shop-stories");
    if (!slider) return;
    slider.replaceChildren();

    const shops = (state.shops && state.shops.length > 0) ? state.shops : defaultShops;

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
        displayLimit = 6;
        renderProductsFeed(name, true);
      });
      slider.append(item);
    });
  }

  function renderProductsFeed(filterQuery = "", resetLimit = false) {
    const feedGrid = $("#home-products-feed");
    if (!feedGrid) return;

    if (resetLimit) {
      displayLimit = 6;
    }

    activeQuery = (filterQuery !== undefined ? filterQuery : $("#header-search-input")?.value || "").trim().toLowerCase();

    const availableProducts = (state.products && state.products.length > 0) ? state.products : defaultProducts;

    const filtered = availableProducts.filter(p => {
      if (!activeQuery) return true;
      const name = String(p.name || "").toLowerCase();
      const code = String(p.code || "").toLowerCase();
      const shop = String(p.at_shop || p.Shop_name || "").toLowerCase();
      const desc = String(p.description || "").toLowerCase();
      return name.includes(activeQuery) || code.includes(activeQuery) || shop.includes(activeQuery) || desc.includes(activeQuery);
    });

    feedGrid.replaceChildren();

    if (filtered.length === 0) {
      feedGrid.innerHTML = `<p class="empty-state">No marketplace products found matching "${activeQuery || 'search'}".</p>`;
      return;
    }

    // Sliced product list for infinite scroll batch
    const visibleProducts = filtered.slice(0, displayLimit);

    visibleProducts.forEach(p => {
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
          updateHeaderCartBadge();
          showToast(`Added ${pName} to Cart!`);
        }
      });

      feedGrid.append(post);
    });

    // Append Infinite Scroll Loading Trigger if more items exist
    if (displayLimit < filtered.length) {
      const scrollTrigger = document.createElement("div");
      scrollTrigger.id = "feed-scroll-trigger";
      scrollTrigger.className = "empty-state";
      scrollTrigger.style.gridColumn = "1 / -1";
      scrollTrigger.style.padding = "20px 10px";
      scrollTrigger.innerHTML = `<span>⏳ Loading more products (${visibleProducts.length} of ${filtered.length})...</span>`;
      feedGrid.append(scrollTrigger);
    }

    isLoadingMore = false;
  }

  function updateHeaderCartBadge() {
    const badge = $("#header-cart-badge");
    if (!badge) return;
    const count = (state.cart || []).reduce((sum, line) => sum + (line.quantity || 1), 0);
    badge.textContent = String(count);
  }

  function handleInfiniteScroll() {
    if (isLoadingMore || state.activeView !== "overview") return;

    const trigger = $("#feed-scroll-trigger");
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    if (triggerRect.top <= window.innerHeight + 200) {
      isLoadingMore = true;
      displayLimit += batchSize;
      setTimeout(() => {
        renderProductsFeed(activeQuery, false);
      }, 300);
    }
  }

  function bindHomeEvents() {
    $("#header-search-input")?.addEventListener("input", (e) => {
      displayLimit = 6;
      renderProductsFeed(e.target.value, true);
    });

    $$(".feed-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        $$(".feed-filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        displayLimit = 6;
        renderProductsFeed("", true);
      });
    });

    window.removeEventListener("scroll", handleInfiniteScroll);
    window.addEventListener("scroll", handleInfiniteScroll);
  }

  return {
    loadDashboard,
    renderShopStories,
    renderProductsFeed,
    updateHeaderCartBadge
  };
})();
