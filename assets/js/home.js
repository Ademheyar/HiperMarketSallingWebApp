/**
 * home.js - Instagram-Style Feed, Stories Bar, Shop Page & Home Cart Drawer (#view-overview / #view-shoppage)
 */
window.HiperHome = (() => {
  "use strict";

  const { state, $, $$, api, showToast, setMessage } = window.HiperApi;

  // Feed & Pagination state
  let currentPage = 1;
  const pageSize = 5;
  let isLoading = false;
  let hasMore = true;
  let searchQuery = "";
  let searchDebounceTimer = null;
  let scrollObserver = null;
  let isInitialized = false;

  // Active Story & Shop Page State
  let activeStoryShop = "";
  let activeShopPageTab = "for-you";
  let activeShopCategory = "all";
  let currentShopObj = null;

  // Local persistent preferences
  const followedShops = new Set(JSON.parse(localStorage.getItem("hiper_followed_shops") || "[]"));
  const likedProducts = new Set(JSON.parse(localStorage.getItem("hiper_liked_products") || "[]"));

  // Product category icons
  const productIcons = {
    scanner: "📷",
    printer: "🖨️",
    drawer: "💵",
    jacket: "🧥",
    shirt: "👕",
    sneaker: "👟",
    terminal: "💻",
    dress: "👗",
    chair: "🪑",
    coffee: "☕",
    headset: "🎧",
    mouse: "🖱️",
    phone: "📱",
    laptop: "💻",
    default: "🛍️"
  };

  function getProductIcon(name = "") {
    const lower = name.toLowerCase();
    for (const [key, icon] of Object.entries(productIcons)) {
      if (lower.includes(key)) return icon;
    }
    return productIcons.default;
  }

  function getShopDetails(shopIdentifier) {
    const shops = state.shops || [];
    const raw = String(shopIdentifier || "").trim();
    const val = raw.toLowerCase();

    // 1. Try matching by Shop_Id / id
    let found = shops.find(s => String(s.Shop_Id || s.id || "") === raw);
    if (!found) {
      // 2. Try matching by Shop_name
      found = shops.find(s => String(s.Shop_name || s.name || "").toLowerCase() === val);
    }
    if (!found) {
      // 3. Try matching by Shop_brand_name
      found = shops.find(s => String(s.Shop_brand_name || "").toLowerCase() === val);
    }

    if (found) {
      const name = found.Shop_name || found.name || "Main Shop";
      const brand = found.Shop_brand_name || "";
      const location = [found.Shop_location, found.Shop_country].filter(Boolean).join(" · ") || "Store Location";
      return {
        name,
        brand,
        displayName: brand ? `${name} (${brand})` : name,
        fullBrandLabel: brand ? `${name} · ${brand}` : name,
        location
      };
    }

    // Default mapping for numeric IDs if shops list not loaded yet
    const defaultShops = {
      "1": { name: "Main Shop", brand: "BELLEMA FASHION", location: "Bole, Addis Ababa" },
      "2": { name: "Flag Squer", brand: "A.Dot", location: "Addis Ababa" },
      "3": { name: "Hiper Tech Store", brand: "Hiper Tech", location: "Kazanchis Tech Hub" },
      "4": { name: "Supermarket Central", brand: "Central Market", location: "4 Kilo Square" }
    };

    if (defaultShops[raw]) {
      const d = defaultShops[raw];
      return {
        name: d.name,
        brand: d.brand,
        displayName: `${d.name} (${d.brand})`,
        fullBrandLabel: `${d.name} · ${d.brand}`,
        location: d.location
      };
    }

    // If identifier is a string name
    if (raw && isNaN(Number(raw))) {
      return {
        name: raw,
        brand: "",
        displayName: raw,
        fullBrandLabel: raw,
        location: "Store Location"
      };
    }

    // Fallback
    return {
      name: "Main Shop",
      brand: "BELLEMA FASHION",
      displayName: "Main Shop (BELLEMA FASHION)",
      fullBrandLabel: "Main Shop · BELLEMA FASHION",
      location: "Bole, Addis Ababa"
    };
  }

  function getShopAvatar(shopName = "") {
    const words = shopName.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return (shopName.substring(0, 2) || "HM").toUpperCase();
  }

  function saveFollowedShops() {
    localStorage.setItem("hiper_followed_shops", JSON.stringify([...followedShops]));
  }

  function saveLikedProducts() {
    localStorage.setItem("hiper_liked_products", JSON.stringify([...likedProducts]));
  }

  function renderShopStories() {
    const container = $("#home-stories");
    if (!container) return;
    container.replaceChildren();

    // 1. "All Shops" Story Circle
    const allItem = document.createElement("div");
    allItem.className = `story-item ${!activeStoryShop ? "selected-shop" : ""}`;
    allItem.innerHTML = `
      <div class="story-ring-large add-story ${!activeStoryShop ? "active-filter" : ""}">
        <div class="story-avatar-lg">🏬</div>
        <div class="add-badge">+</div>
      </div>
      <span class="story-label">All Shops</span>
    `;
    allItem.addEventListener("click", () => {
      activeStoryShop = "";
      searchQuery = "";
      const input = $("#header-search");
      if (input) input.value = "";
      const clearBtn = $("#header-search-clear");
      if (clearBtn) clearBtn.style.display = "none";
      resetAndReloadFeed();
      renderShopStories();
      showToast("Showing posts from all shops.");
    });
    container.append(allItem);

    // Get List of Shops (Keep all shop story circles visible!)
    let shopList = state.shops || [];
    if (!shopList || shopList.length === 0) {
      shopList = [
        { Shop_name: "Main Shop", Shop_brand_name: "BELLEMA FASHION", Shop_location: "Bole, Addis Ababa" },
        { Shop_name: "Flag Squer", Shop_brand_name: "A.Dot", Shop_location: "Addis Ababa" },
        { Shop_name: "Hiper Tech Store", Shop_brand_name: "Hiper Tech", Shop_location: "Kazanchis Tech Hub" },
        { Shop_name: "Supermarket Central", Shop_brand_name: "Central Market", Shop_location: "4 Kilo Square" }
      ];
    }

    shopList.forEach(shop => {
      const name = shop.Shop_name || shop.name || "Shop";
      const brand = shop.Shop_brand_name || shop.brand || name;
      const avatar = getShopAvatar(name);
      const isSelected = (activeStoryShop.toLowerCase() === name.toLowerCase());

      const item = document.createElement("div");
      item.className = `story-item ${isSelected ? "selected-shop" : ""}`;
      item.innerHTML = `
        <div class="story-ring-large ${isSelected ? "active-filter" : ""}">
          <div class="story-avatar-lg">${avatar}</div>
        </div>
        <span class="story-label">${escapeHtml(brand)}</span>
      `;

      item.addEventListener("click", () => {
        if (isSelected) {
          // Pressed AGAIN -> Go to dedicated Shop Page!
          openShopPage(shop);
        } else {
          // First Press -> Bold compare to others, filter feed, DO NOT hide other stories!
          activeStoryShop = name;
          searchQuery = name;
          const input = $("#header-search");
          if (input) input.value = name;
          const clearBtn = $("#header-search-clear");
          if (clearBtn) clearBtn.style.display = "block";
          resetAndReloadFeed();
          renderShopStories();
          showToast(`Selected ${brand}. Click again to visit Shop Page.`);
        }
      });

      container.append(item);
    });
  }

  /* DEDICATED SHOP PAGE LOGIC (#view-shoppage) */
  function openShopPage(shop) {
    currentShopObj = shop;
    const shopInfo = getShopDetails(shop.Shop_name || shop.name || shop);

    if (window.HiperApp) {
      window.HiperApp.navigate("shoppage");
    }

    if ($("#shoppage-name")) $("#shoppage-name").textContent = shopInfo.name;
    if ($("#shoppage-brand")) $("#shoppage-brand").textContent = shopInfo.brand || shopInfo.name;
    if ($("#shoppage-location")) $("#shoppage-location").textContent = "📍 " + shopInfo.location;
    if ($("#shoppage-avatar")) $("#shoppage-avatar").textContent = getShopAvatar(shopInfo.name);

    const followBtn = $("#shoppage-follow-btn");
    if (followBtn) {
      const isFollowing = followedShops.has(shopInfo.name) || followedShops.has(shopInfo.fullBrandLabel);
      followBtn.className = `btn-follow ${isFollowing ? "following" : "not-following"}`;
      followBtn.textContent = isFollowing ? "Following" : "Follow";

      followBtn.onclick = () => {
        if (followedShops.has(shopInfo.name) || followedShops.has(shopInfo.fullBrandLabel)) {
          followedShops.delete(shopInfo.name);
          followedShops.delete(shopInfo.fullBrandLabel);
          followBtn.className = "btn-follow not-following";
          followBtn.textContent = "Follow";
          updateShopFollowButtons(shopInfo.name, false);
          showToast(`Unfollowed ${shopInfo.name}`);
        } else {
          followedShops.add(shopInfo.name);
          followedShops.add(shopInfo.fullBrandLabel);
          followBtn.className = "btn-follow following";
          followBtn.textContent = "Following";
          updateShopFollowButtons(shopInfo.name, true);
          showToast(`You are now following ${shopInfo.name}`);
        }
        saveFollowedShops();
      };
    }

    bindShopPageEvents();
    renderShopPageProducts();
    showToast(`Welcome to ${shopInfo.brand || shopInfo.name} Shop Page!`);
  }

  function bindShopPageEvents() {
    $("#shoppage-back-btn")?.removeEventListener("click", onShopBack);
    $("#shoppage-back-btn")?.addEventListener("click", onShopBack);

    $$(".shoppage-tab").forEach(tab => {
      tab.onclick = () => {
        $$(".shoppage-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        activeShopPageTab = tab.dataset.shopTab;

        const catBar = $("#shoppage-categories-bar");
        if (catBar) {
          if (activeShopPageTab === "categories") catBar.classList.remove("hidden");
          else catBar.classList.add("hidden");
        }

        renderShopPageProducts();
      };
    });

    $$(".cat-pill").forEach(pill => {
      pill.onclick = () => {
        $$(".cat-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        activeShopCategory = pill.dataset.cat;
        renderShopPageProducts();
      };
    });
  }

  function onShopBack() {
    if (window.HiperApp) {
      window.HiperApp.navigate("overview");
    }
  }

  function renderShopPageProducts() {
    const grid = $("#shoppage-products-grid");
    if (!grid || !currentShopObj) return;
    grid.replaceChildren();

    const shopInfo = getShopDetails(currentShopObj.Shop_name || currentShopObj.name || currentShopObj);
    const shopNameLower = shopInfo.name.toLowerCase();

    let items = (state.products || []).filter(p => {
      const pShop = getShopDetails(p.at_shop).name.toLowerCase();
      return pShop === shopNameLower || pShop.includes(shopNameLower) || shopNameLower.includes(pShop);
    });

    // Fallback if empty in state
    if (items.length === 0) {
      items = [
        { id: 101, name: `${shopInfo.brand || shopInfo.name} Featured Item A`, price: 120, at_shop: shopInfo.name, quantity: 15, description: "Featured arrival product in stock." },
        { id: 102, name: `${shopInfo.brand || shopInfo.name} Best Seller B`, price: 85, at_shop: shopInfo.name, quantity: 8, description: "Popular item on special sale." },
        { id: 103, name: `${shopInfo.brand || shopInfo.name} Exclusive Model C`, price: 210, at_shop: shopInfo.name, quantity: 20, description: "Exclusive store collection." }
      ];
    }

    // Filter by Active Tab (For You, New Arrivals, Shop Sales, Categories)
    if (activeShopPageTab === "sales") {
      items = items.filter(p => Number(p.price) < 150 || p.discount);
    } else if (activeShopPageTab === "new-arrivals") {
      items = [...items].reverse();
    } else if (activeShopPageTab === "categories" && activeShopCategory !== "all") {
      items = items.filter(p => p.name.toLowerCase().includes(activeShopCategory) || activeShopCategory === "all");
    }

    if (items.length === 0) {
      grid.innerHTML = `<div class="panel empty-state" style="grid-column: 1 / -1;"><p>No products found in this section.</p></div>`;
      return;
    }

    items.forEach(product => {
      const card = document.createElement("article");
      card.className = "shoppage-product-card";
      const icon = getProductIcon(product.name);
      const priceFormatted = "$" + (Number(product.price) || 0).toFixed(2);

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <span style="font-size: 42px;">${icon}</span>
          <span class="post-price-badge" style="position: static;">${priceFormatted}</span>
        </div>
        <div>
          <strong style="font-size: 15px; display: block; color: var(--text);">${escapeHtml(product.name)}</strong>
          <p class="muted" style="font-size: 12px; margin-top: 4px;">${escapeHtml(product.description || "High quality product available at store.")}</p>
        </div>
        <div style="display: flex; gap: 8px; margin-top: auto; padding-top: 8px; border-top: 1px solid var(--line);">
          <button class="button button-secondary full-width btn-shop-cart" style="font-size: 11px;">🛒 Add to Cart</button>
          <button class="button button-primary full-width btn-shop-buy" style="font-size: 11px;">⚡ Buy Now</button>
        </div>
      `;

      card.querySelector(".btn-shop-cart")?.addEventListener("click", () => {
        if (!Array.isArray(state.cart)) state.cart = [];
        const existing = state.cart.find((line) => String(line.product.id) === String(product.id));
        if (existing) existing.quantity += 1;
        else state.cart.push({ product, quantity: 1, price: Number(product.price) || 0 });
        renderHomeCart();
        if (window.HiperPos) window.HiperPos.renderCart();
        showToast(`Added "${product.name}" to cart!`);
      });

      card.querySelector(".btn-shop-buy")?.addEventListener("click", () => {
        if (!Array.isArray(state.cart)) state.cart = [];
        const existing = state.cart.find((line) => String(line.product.id) === String(product.id));
        if (existing) existing.quantity += 1;
        else state.cart.push({ product, quantity: 1, price: Number(product.price) || 0 });
        renderHomeCart();
        if (window.HiperPos) window.HiperPos.renderCart();
        if (window.HiperApp) window.HiperApp.navigate("pos");
      });

      grid.append(card);
    });
  }

  function bindHeaderSearch() {
    const searchInput = $("#header-search");
    const clearBtn = $("#header-search-clear");
    if (!searchInput) return;

    searchInput.removeEventListener("input", onSearchInput);
    searchInput.addEventListener("input", onSearchInput);

    if (clearBtn) {
      clearBtn.onclick = () => {
        searchInput.value = "";
        clearBtn.style.display = "none";
        searchQuery = "";
        activeStoryShop = "";
        resetAndReloadFeed();
        renderShopStories();
        searchInput.focus();
      };
    }
  }

  function onSearchInput(e) {
    const val = e.target.value.trim();
    const clearBtn = $("#header-search-clear");
    if (clearBtn) clearBtn.style.display = val ? "block" : "none";

    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(() => {
      searchQuery = val;
      activeStoryShop = val;
      resetAndReloadFeed();
      renderShopStories();
    }, 300);
  }

  function resetAndReloadFeed() {
    currentPage = 1;
    hasMore = true;
    isLoading = false;

    const feedContainer = $("#home-feed");
    if (feedContainer) feedContainer.replaceChildren();

    // Ensure user views Home feed when searching
    if (state.activeView !== "overview" && state.activeView !== "shoppage" && window.HiperApp) {
      window.HiperApp.navigate("overview");
    }

    loadNextFeedBatch();
  }

  function setupInfiniteScroll() {
    const loader = $("#feed-loader");
    if (!loader) return;

    if (scrollObserver) scrollObserver.disconnect();

    if ("IntersectionObserver" in window) {
      scrollObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore) {
          loadNextFeedBatch();
        }
      }, { rootMargin: "250px" });

      scrollObserver.observe(loader);
    } else {
      // Scroll listener fallback
      window.addEventListener("scroll", () => {
        if (isLoading || !hasMore) return;
        const scrollPosition = window.innerHeight + window.scrollY;
        const threshold = document.body.offsetHeight - 400;
        if (scrollPosition >= threshold) {
          loadNextFeedBatch();
        }
      });
    }
  }

  async function loadNextFeedBatch() {
    if (isLoading || !hasMore) return;
    isLoading = true;

    const loader = $("#feed-loader");
    if (loader) {
      loader.style.display = "flex";
      loader.innerHTML = `<div class="feed-spinner"></div><span>Loading more products...</span>`;
    }

    try {
      const res = await api("list", {
        query: {
          resource: "products",
          q: searchQuery,
          page: currentPage,
          limit: pageSize
        }
      });

      const items = res.items || [];
      hasMore = res.has_more !== undefined ? res.has_more : (items.length >= pageSize);

      renderFeedItems(items);
      currentPage++;
    } catch (err) {
      console.warn("API feed error, falling back to local products state:", err);
      if (currentPage === 1 && state.products) {
        let filtered = state.products;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(p =>
            (p.name && p.name.toLowerCase().includes(q)) ||
            (p.at_shop && p.at_shop.toLowerCase().includes(q)) ||
            (p.code && p.code.toLowerCase().includes(q))
          );
        }
        const start = (currentPage - 1) * pageSize;
        const batch = filtered.slice(start, start + pageSize);
        hasMore = (start + pageSize) < filtered.length;
        renderFeedItems(batch);
        currentPage++;
      }
    } finally {
      isLoading = false;
      if (loader) {
        if (!hasMore) {
          loader.innerHTML = `<div class="end-feed-message">🎉 You've reached the end of the feed</div>`;
        }
      }
    }
  }

  function renderFeedItems(items) {
    const feedContainer = $("#home-feed");
    if (!feedContainer) return;

    if (currentPage === 1 && items.length === 0) {
      feedContainer.innerHTML = `
        <div class="panel empty-state" style="margin-top: 30px;">
          <p style="font-size: 32px; margin-bottom: 8px;">🔍</p>
          <h3>No products found</h3>
          <p class="muted">Try searching with another product name or shop.</p>
        </div>
      `;
      return;
    }

    for (const item of items) {
      const postCard = createInstaPostElement(item);
      feedContainer.append(postCard);
    }
  }

  function createInstaPostElement(product) {
    const card = document.createElement("article");
    card.className = "insta-post";
    card.dataset.productId = product.id;

    // Resolve full shop details (Name & Brand, no IDs or numbers)
    const shopInfo = getShopDetails(product.at_shop);
    const shopName = shopInfo.name;
    const shopBrand = shopInfo.brand;
    const shopLabel = shopInfo.fullBrandLabel; // "Main Shop · BELLEMA FASHION"
    const shopAvatar = getShopAvatar(shopName);

    const isFollowing = followedShops.has(shopName) || followedShops.has(shopLabel);
    const isLiked = likedProducts.has(String(product.id));
    const icon = getProductIcon(product.name);
    const priceFormatted = "$" + (Number(product.price) || 0).toFixed(2);
    const baseLikes = 18 + ((Number(product.id || 1) * 31) % 190);
    const currentLikes = isLiked ? baseLikes + 1 : baseLikes;

    card.innerHTML = `
      <div class="post-header">
        <div class="post-shop-info">
          <div class="story-ring">
            <div class="shop-avatar">${shopAvatar}</div>
          </div>
          <div class="shop-meta">
            <div class="shop-name-row">
              <span class="shop-name">${escapeHtml(shopLabel)}</span>
              <span class="verified-badge">✓</span>
            </div>
            <span class="shop-location">${escapeHtml(shopInfo.location)}</span>
          </div>
        </div>
        <button class="btn-follow ${isFollowing ? "following" : "not-following"}" data-shop="${escapeHtml(shopName)}">
          ${isFollowing ? "Following" : "Follow"}
        </button>
      </div>

      <div class="post-media">
        <span class="product-media-icon">${icon}</span>
        <span class="post-media-tag">
          ${product.service ? "⚡ Service" : `📦 ${product.quantity || 0} in stock`}
        </span>
        <span class="post-price-badge">${priceFormatted}</span>
        <div class="heart-overlay">❤️</div>
      </div>

      <div class="post-actions">
        <div class="actions-left">
          <button class="action-btn btn-like ${isLiked ? "liked" : ""}" aria-label="Like post">
            ${isLiked ? "❤️" : "🤍"}
          </button>
          <button class="action-btn btn-cart" aria-label="Add to cart">
            🛒
          </button>
          <button class="action-btn btn-share" aria-label="Share product">
            🔗
          </button>
        </div>
        <button class="btn-quick-buy">
          ⚡ Quick Buy
        </button>
      </div>

      <div class="post-body">
        <div class="likes-counter">${currentLikes} likes</div>
        <div class="post-caption">
          <strong>${escapeHtml(shopLabel)}</strong>
          <span>${escapeHtml(product.name)}</span> —
          <span class="muted">${escapeHtml(product.description || "High quality product available at store.")}</span>
        </div>
        <div class="post-code-meta">
          <span class="code-pill">🏬 Shop: ${escapeHtml(shopLabel)}</span>
          ${product.code ? `<span class="code-pill">Code: ${escapeHtml(product.code)}</span>` : ""}
          ${product.barcode ? `<span class="code-pill">Barcode: ${escapeHtml(product.barcode)}</span>` : ""}
        </div>
      </div>
    `;

    // Follow Button Handler
    const followBtn = card.querySelector(".btn-follow");
    followBtn?.addEventListener("click", () => {
      if (followedShops.has(shopName) || followedShops.has(shopLabel)) {
        followedShops.delete(shopName);
        followedShops.delete(shopLabel);
        updateShopFollowButtons(shopName, false);
        showToast(`Unfollowed ${shopName}`);
      } else {
        followedShops.add(shopName);
        followedShops.add(shopLabel);
        updateShopFollowButtons(shopName, true);
        showToast(`You are now following ${shopName}`);
      }
      saveFollowedShops();
    });

    // Like Button & Double Tap Media Handler
    const likeBtn = card.querySelector(".btn-like");
    const heartOverlay = card.querySelector(".heart-overlay");
    const likesCounter = card.querySelector(".likes-counter");

    function toggleLike() {
      const pid = String(product.id);
      if (likedProducts.has(pid)) {
        likedProducts.delete(pid);
        likeBtn?.classList.remove("liked");
        if (likeBtn) likeBtn.textContent = "🤍";
        if (likesCounter) likesCounter.textContent = `${baseLikes} likes`;
      } else {
        likedProducts.add(pid);
        likeBtn?.classList.add("liked");
        if (likeBtn) likeBtn.textContent = "❤️";
        if (likesCounter) likesCounter.textContent = `${baseLikes + 1} likes`;

        if (heartOverlay) {
          heartOverlay.classList.add("animate");
          setTimeout(() => heartOverlay.classList.remove("animate"), 600);
        }
      }
      saveLikedProducts();
    }

    likeBtn?.addEventListener("click", toggleLike);

    const media = card.querySelector(".post-media");
    media?.addEventListener("dblclick", toggleLike);

    // Cart & Quick Buy Handlers
    const cartBtn = card.querySelector(".btn-cart");
    const buyBtn = card.querySelector(".btn-quick-buy");

    function addProductToCart() {
      if (!Array.isArray(state.cart)) state.cart = [];
      const existing = state.cart.find((line) => String(line.product.id) === String(product.id));
      if (existing) {
        existing.quantity += 1;
      } else {
        state.cart.push({ product, quantity: 1, price: Number(product.price) || 0 });
      }
      renderHomeCart();
      if (window.HiperPos) window.HiperPos.renderCart();
      showToast(`Added "${product.name}" to cart!`);
    }

    cartBtn?.addEventListener("click", addProductToCart);
    buyBtn?.addEventListener("click", () => {
      addProductToCart();
      const drawer = $("#home-cart-drawer");
      if (drawer) drawer.classList.add("open");
    });

    // Share Link Handler
    const shareBtn = card.querySelector(".btn-share");
    shareBtn?.addEventListener("click", () => {
      showToast(`Copied link for "${product.name}"!`);
    });

    return card;
  }

  function renderHomeCart() {
    if (!Array.isArray(state.cart)) state.cart = [];

    const container = $("#home-cart-items");
    const badge = $("#header-cart-badge");
    const countPill = $("#home-cart-count");
    const subtotalEl = $("#home-cart-subtotal");
    const totalEl = $("#home-cart-total");

    const totalQty = state.cart.reduce((sum, line) => sum + line.quantity, 0);
    const totalPrice = state.cart.reduce((sum, line) => sum + (line.quantity * line.price), 0);

    if (badge) badge.textContent = String(totalQty);
    if (countPill) countPill.textContent = String(totalQty);
    if (subtotalEl) subtotalEl.textContent = "$" + totalPrice.toFixed(2);
    if (totalEl) totalEl.textContent = "$" + totalPrice.toFixed(2);

    if (!container) return;
    container.replaceChildren();

    if (state.cart.length === 0) {
      container.innerHTML = `<p class="empty-state">Your active cart is empty.</p>`;
      return;
    }

    state.cart.forEach((line, index) => {
      const row = document.createElement("div");
      row.className = "home-cart-row";
      row.innerHTML = `
        <div class="home-cart-item-info">
          <span class="home-cart-item-title">${escapeHtml(line.product.name)}</span>
          <span class="home-cart-item-price">$${Number(line.price).toFixed(2)} each</span>
        </div>
        <div class="home-cart-qty-ctrl">
          <button class="qty-btn btn-minus" data-index="${index}">-</button>
          <span class="qty-val">${line.quantity}</span>
          <button class="qty-btn btn-plus" data-index="${index}">+</button>
        </div>
        <button class="home-cart-remove" data-index="${index}" title="Remove item">✕</button>
      `;

      row.querySelector(".btn-minus")?.addEventListener("click", () => {
        if (line.quantity > 1) {
          line.quantity--;
        } else {
          state.cart.splice(index, 1);
        }
        renderHomeCart();
        if (window.HiperPos) window.HiperPos.renderCart();
      });

      row.querySelector(".btn-plus")?.addEventListener("click", () => {
        line.quantity++;
        renderHomeCart();
        if (window.HiperPos) window.HiperPos.renderCart();
      });

      row.querySelector(".home-cart-remove")?.addEventListener("click", () => {
        state.cart.splice(index, 1);
        renderHomeCart();
        if (window.HiperPos) window.HiperPos.renderCart();
      });

      container.append(row);
    });
  }

  function bindHeaderCartAndEvents() {
    const cartBtn = $("#header-cart-btn");
    const drawer = $("#home-cart-drawer");
    const closeBtn = $("#close-home-cart");
    const checkoutBtn = $("#home-cart-checkout");
    const clearBtn = $("#home-cart-clear");

    if (cartBtn) {
      cartBtn.onclick = () => {
        if (state.activeView !== "overview" && state.activeView !== "shoppage" && window.HiperApp) {
          window.HiperApp.navigate("overview");
        }
        if (drawer) {
          drawer.classList.toggle("open");
        }
      };
    }

    if (closeBtn && drawer) {
      closeBtn.onclick = () => {
        drawer.classList.remove("open");
      };
    }

    if (checkoutBtn) {
      checkoutBtn.onclick = completeHomeCartCheckout;
    }

    if (clearBtn) {
      clearBtn.onclick = () => {
        state.cart = [];
        renderHomeCart();
        if (window.HiperPos) window.HiperPos.renderCart();
        showToast("Cart cleared.");
      };
    }
  }

  async function completeHomeCartCheckout() {
    const message = $("#home-cart-message");
    const checkoutBtn = $("#home-cart-checkout");

    if (!Array.isArray(state.cart) || state.cart.length === 0) {
      if (message) setMessage(message, "Your cart is empty.", "error");
      return;
    }

    const total = state.cart.reduce((sum, line) => sum + line.quantity * line.price, 0);
    if (checkoutBtn) checkoutBtn.disabled = true;
    if (message) setMessage(message, "Saving sale & updating stock...");

    try {
      const result = await api("sale", {
        method: "POST",
        body: {
          shop_id: "Main Shop",
          customer_id: "Walk-in Customer",
          received: total,
          payments: [["Cash", "Cash", total]],
          items: state.cart.map((line) => ({
            product_id: line.product.id,
            quantity: line.quantity,
            price: line.price,
            name: line.product.name
          }))
        }
      });

      state.cart = [];
      renderHomeCart();
      if (window.HiperPos) window.HiperPos.renderCart();

      if (message) setMessage(message, `Sale ${result.sale.doc_barcode} completed successfully!`, "success");
      showToast(`Sale ${result.sale.doc_barcode} completed!`);

      if (window.HiperApp) await window.HiperApp.refreshWorkspace();
    } catch (err) {
      if (message) setMessage(message, err.message, "error");
      showToast(err.message, true);
    } finally {
      if (checkoutBtn) checkoutBtn.disabled = false;
    }
  }

  function updateShopFollowButtons(targetShop, isFollowing) {
    $$(`.btn-follow[data-shop="${targetShop}"]`).forEach(btn => {
      btn.className = `btn-follow ${isFollowing ? "following" : "not-following"}`;
      btn.textContent = isFollowing ? "Following" : "Follow";
    });
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function initHomeFeed() {
    bindHeaderSearch();
    bindHeaderCartAndEvents();
    setupInfiniteScroll();
    renderShopStories();
    renderHomeCart();

    if (!isInitialized) {
      isInitialized = true;
      loadNextFeedBatch();
    }
  }

  return {
    loadDashboard: initHomeFeed,
    initHomeFeed,
    resetAndReloadFeed,
    renderHomeCart,
    renderShopStories,
    openShopPage
  };
})();
