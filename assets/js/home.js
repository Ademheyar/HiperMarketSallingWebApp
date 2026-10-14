/**
 * home.js - Overview / Home Feed Module (#view-overview - Instagram-Style E-Commerce Feed with Product Details & Suggestions)
 */
window.HiperHome = (() => {
  "use strict";

  const { state, $, $$, showToast } = window.HiperApi;

  let displayLimit = 6;
  const batchSize = 6;
  let isLoadingMore = false;
  let activeQuery = "";
  let currentProductDetail = null;
  let selectedColor = "Default";
  let selectedSize = "Standard";
  let currentQty = 1;

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
    { id: "p1", name: "Wireless Noise-Canceling Headphones", price: 129.99, at_shop: "Tech Zone", description: "Premium audio experience with active noise cancellation, deep bass, and 30-hour battery life.", image: "", colors: ["Black", "Silver", "Navy Blue"], sizes: ["Standard"] },
    { id: "p2", name: "Smart Fitness Watch Series 5", price: 189.50, at_shop: "Tech Zone", description: "Track your daily heart rate, GPS workouts, sleep quality, and active notifications.", image: "", colors: ["Space Gray", "Rose Gold", "Midnight Black"], sizes: ["40mm", "44mm"] },
    { id: "p3", name: "Organic Espresso Beans (1kg)", price: 24.99, at_shop: "Fresh Market", description: "100% Arabica dark roast whole coffee beans roasted fresh daily.", image: "", colors: ["Dark Roast", "Medium Roast"], sizes: ["500g", "1kg"] },
    { id: "p4", name: "Classic Denim Jacket - Unisex", price: 68.00, at_shop: "Fashion Hub", description: "Timeless vintage denim jacket with durable double-stitching and modern fit.", image: "", colors: ["Vintage Blue", "Washed Black", "Light Indigo"], sizes: ["S", "M", "L", "XL", "XXL"] },
    { id: "p5", name: "Genuine Leather Crossbody Bag", price: 85.00, at_shop: "Flag Squer", description: "Handcrafted genuine Italian leather messenger bag with multiple zipped compartments.", image: "", colors: ["Tan Brown", "Chestnut", "Classic Black"], sizes: ["Standard"] },
    { id: "p6", name: "4K Ultra HD Waterproof Action Cam", price: 149.00, at_shop: "Electronics Pro", description: "Capture crisp 4K 60fps outdoor videos with gyro stabilization and dual screens.", image: "", colors: ["Matte Black", "Silver Gray"], sizes: ["Standard"] },
    { id: "p7", name: "Ergonomic Mesh Office Chair", price: 175.00, at_shop: "Main Store", description: "Breathable lumbar support chair with adjustable armrests and smooth rolling casters.", image: "", colors: ["All Black", "Gray/White"], sizes: ["Standard"] },
    { id: "p8", name: "Portable Waterproof Bluetooth Speaker", price: 49.99, at_shop: "Tech Zone", description: "Deep bass 360-degree sound speaker perfect for beach, pool, and travel.", image: "", colors: ["Teal Blue", "Lava Red", "Midnight Black"], sizes: ["Mini", "Standard"] },
    { id: "p9", name: "Natural Glow Hydrating Face Serum", price: 32.50, at_shop: "Beauty Care", description: "Hyaluronic acid and Vitamin C formula for radiant, deeply hydrated skin.", image: "", colors: ["Natural Formula"], sizes: ["30ml", "50ml"] },
    { id: "p10", name: "Lightweight Breathable Running Shoes", price: 79.99, at_shop: "Fashion Hub", description: "Cushioned memory foam sneakers designed for daily training and running comfort.", image: "", colors: ["Triple Black", "White/Red", "Neon Blue"], sizes: ["38", "39", "40", "41", "42", "43"] }
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
      post.style.cursor = "pointer";

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
      likeBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        likeBtn.classList.toggle("liked");
        likeBtn.textContent = likeBtn.classList.contains("liked") ? "❤️" : "🤍";
      });

      // Quick Add to cart action
      const cartBtn = post.querySelector(".btn-add-cart");
      cartBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (window.HiperPos) {
          window.HiperPos.addToCart(p);
          updateHeaderCartBadge();
          showToast(`Added ${pName} to Cart!`);
        }
      });

      // Clicking card opens full product details dialog
      post.addEventListener("click", () => {
        openProductDetail(p);
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

  // INTERACTIVE PRODUCT DETAIL MODAL (Color, Size, Quantity, Total Price, Suggestions)
  function openProductDetail(product) {
    if (!product) return;
    currentProductDetail = product;
    currentQty = 1;

    const dialog = $("#product-detail-dialog");
    if (!dialog) return;

    const pName = product.name || "Product Item";
    const pPrice = parseFloat(product.price) || 0;
    const pShop = product.at_shop || product.Shop_name || "Hiper Store";
    const pDesc = product.description || "High quality product from our verified marketplace catalog.";

    if ($("#pdetail-title")) $("#pdetail-title").textContent = pName;
    if ($("#pdetail-shop-name")) $("#pdetail-shop-name").textContent = `${pShop.toUpperCase()} • VERIFIED MERCHANT`;
    if ($("#pdetail-price-badge")) $("#pdetail-price-badge").textContent = "$" + pPrice.toFixed(2);
    if ($("#pdetail-desc")) $("#pdetail-desc").textContent = pDesc;

    const imgDisplay = $("#pdetail-img-display");
    if (imgDisplay) {
      if (product.image || product.img_url) {
        imgDisplay.innerHTML = `<img src="${product.image || product.img_url}" alt="${pName}" style="width:100%; height:100%; object-fit:cover;">`;
      } else {
        imgDisplay.innerHTML = "📦";
      }
    }

    // Colors
    const colorList = product.colors || ["Black", "Navy Blue", "Silver Gray", "Crimson Red", "Emerald Green"];
    selectedColor = colorList[0] || "Default";
    if ($("#selected-color-name")) $("#selected-color-name").textContent = selectedColor;

    const colorsRow = $("#pdetail-colors-row");
    if (colorsRow) {
      colorsRow.replaceChildren();
      colorList.forEach((colName, cIdx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `feed-filter-btn ${cIdx === 0 ? 'active' : ''}`;
        btn.textContent = colName;
        btn.addEventListener("click", () => {
          $$(".feed-filter-btn", colorsRow).forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          selectedColor = colName;
          if ($("#selected-color-name")) $("#selected-color-name").textContent = selectedColor;
        });
        colorsRow.append(btn);
      });
    }

    // Sizes
    const sizeList = product.sizes || ["S", "M", "L", "XL", "XXL"];
    selectedSize = sizeList[0] || "Standard";
    if ($("#selected-size-name")) $("#selected-size-name").textContent = selectedSize;

    const sizesRow = $("#pdetail-sizes-row");
    if (sizesRow) {
      sizesRow.replaceChildren();
      sizeList.forEach((szName, sIdx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `feed-filter-btn ${sIdx === 0 ? 'active' : ''}`;
        btn.textContent = szName;
        btn.addEventListener("click", () => {
          $$(".feed-filter-btn", sizesRow).forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          selectedSize = szName;
          if ($("#selected-size-name")) $("#selected-size-name").textContent = selectedSize;
        });
        sizesRow.append(btn);
      });
    }

    // Quantity & Total calculation
    const qtyInput = $("#pdetail-qty-input");
    if (qtyInput) qtyInput.value = "1";

    function updateCalcTotal() {
      const q = Math.max(1, Number($("#pdetail-qty-input")?.value) || 1);
      currentQty = q;
      const total = pPrice * q;
      if ($("#pdetail-calc-total")) $("#pdetail-calc-total").textContent = "$" + total.toFixed(2);
    }
    updateCalcTotal();

    $("#btn-qty-minus")!.onclick = () => {
      if (qtyInput) {
        qtyInput.value = String(Math.max(1, (Number(qtyInput.value) || 1) - 1));
        updateCalcTotal();
      }
    };

    $("#btn-qty-plus")!.onclick = () => {
      if (qtyInput) {
        qtyInput.value = String((Number(qtyInput.value) || 1) + 1);
        updateCalcTotal();
      }
    };

    qtyInput?.addEventListener("input", updateCalcTotal);

    // Add to Cart
    $("#btn-pdetail-add-cart")!.onclick = () => {
      if (window.HiperPos) {
        window.HiperPos.addToCart({
          ...product,
          name: `${pName} (${selectedColor}, ${selectedSize})`,
          quantity: currentQty
        });
        updateHeaderCartBadge();
        showToast(`Added ${pName} (${selectedColor}, ${selectedSize}) to Cart!`);
        dialog.close();
      }
    };

    // Buy Now
    $("#btn-pdetail-buy-now")!.onclick = () => {
      if (window.HiperPos) {
        window.HiperPos.addToCart({
          ...product,
          name: `${pName} (${selectedColor}, ${selectedSize})`,
          quantity: currentQty
        });
        updateHeaderCartBadge();
        dialog.close();
        if (window.HiperApp) window.HiperApp.navigate("pos");
      }
    };

    // Render Suggestions
    renderProductSuggestions(product);

    $("#close-pdetail-dialog")!.onclick = () => dialog.close();

    if (typeof dialog.showModal === "function" && !dialog.open) {
      dialog.showModal();
    }
  }

  function renderProductSuggestions(activeProduct) {
    const suggestionsGrid = $("#pdetail-suggestions-grid");
    if (!suggestionsGrid) return;
    suggestionsGrid.replaceChildren();

    const allProds = (state.products && state.products.length > 0) ? state.products : defaultProducts;
    const suggested = allProds.filter(p => (p.id || p.name) !== (activeProduct.id || activeProduct.name)).slice(0, 6);

    suggested.forEach(sp => {
      const sName = sp.name || "Suggested Item";
      const sPrice = parseFloat(sp.price) || 0;

      const card = document.createElement("div");
      card.className = "panel";
      card.style.padding = "8px";
      card.style.cursor = "pointer";
      card.style.fontSize = "11px";
      card.style.background = "#08111e";
      card.style.border = "1px solid var(--line)";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.gap = "4px";

      card.innerHTML = `
        <div style="width:100%; height:70px; background:#0f233f; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:24px;">📦</div>
        <strong style="color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sName}</strong>
        <span style="color:var(--success); font-weight:800;">$${sPrice.toFixed(2)}</span>
      `;

      card.addEventListener("click", () => {
        openProductDetail(sp);
      });

      suggestionsGrid.append(card);
    });
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
    openProductDetail,
    updateHeaderCartBadge
  };
})();
