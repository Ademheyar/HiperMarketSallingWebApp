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
  let currentProduct = null;

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
        location,
        currency: found.Shop_currency || "ETB"
      };
    }

    // Default mapping for numeric IDs if shops list not loaded yet
    const defaultShops = {
      "1": { name: "Main Shop", brand: "BELLEMA FASHION", location: "Bole, Addis Ababa", currency: "ETB" },
      "2": { name: "Flag Squer", brand: "A.Dot", location: "Addis Ababa", currency: "ETB" },
      "3": { name: "Hiper Tech Store", brand: "Hiper Tech", location: "Kazanchis Tech Hub", currency: "ETB" },
      "4": { name: "Supermarket Central", brand: "Central Market", location: "4 Kilo Square", currency: "ETB" }
    };

    if (defaultShops[raw]) {
      const d = defaultShops[raw];
      return {
        name: d.name,
        brand: d.brand,
        displayName: `${d.name} (${d.brand})`,
        fullBrandLabel: `${d.name} · ${d.brand}`,
        location: d.location,
        currency: d.currency
      };
    }

    // If identifier is a string name
    if (raw && isNaN(Number(raw))) {
      return {
        name: raw,
        brand: "",
        displayName: raw,
        fullBrandLabel: raw,
        location: "Store Location",
        currency: "ETB"
      };
    }

    // Fallback
    return {
      name: "Main Shop",
      brand: "BELLEMA FASHION",
      displayName: "Main Shop (BELLEMA FASHION)",
      fullBrandLabel: "Main Shop · BELLEMA FASHION",
      location: "Bole, Addis Ababa",
      currency: "ETB"
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
    if ($("#shoppage-currency")) $("#shoppage-currency").textContent = `Currency: ${shopInfo.currency}`;
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

  function productImage(product) {
    const raw = product.images || product.image_urls || product.image_url || product.image || product.photo || product.image_path || [];
    const fromColumns = Array.isArray(raw) ? raw.filter(Boolean) : typeof raw === "string" ? (() => {
      try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed.filter(Boolean); } catch {}
      return raw.split(/[\n,;]/).map(value => value.trim()).filter(Boolean);
    })() : [];
    const fromVariants = getProductVariantInfo(product).variants.map(variant => variant.image).filter(value => value && value.trim());
    const images = [...new Set([...fromColumns, ...fromVariants])];
    if (images.length) return images;
    return [];
  }

  function optionList(value, fallback = []) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === "string" && value.trim()) {
      try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean); } catch {}
      return value.split(/[,|;]/).map(item => item.trim()).filter(Boolean);
    }
    return fallback;
  }

  function getProductVariantInfo(product) {
    const raw = product.more_info ?? product.More_info ?? product.moreInfo;
    let tree = raw;
    if (typeof raw === "string") {
      try { tree = JSON.parse(raw); } catch { return { variants: [], shops: [], codes: [], colors: [], sizes: [] }; }
    }
    const variants = [];
    const unique = values => [...new Set(values.filter(Boolean).map(String))];
    const findLeafValues = (node, path) => {
      if (!Array.isArray(node)) return;
      if (node.length >= 4 && node.every(value => value == null || ["string", "number", "boolean"].includes(typeof value))) {
        variants.push({ shop: path[0] || "", code: path[1] || "", color: path[2] || "", size: path[3] || "", barcode: String(node[0] ?? ""), quantity: Number(node[2]) || 0, image: String(node[4] ?? "") });
        return;
      }
      node.forEach(child => findLeafValues(child, path));
    };
    const walk = (node, path = []) => {
      if (!Array.isArray(node)) return;
      for (const entry of node) {
        if (Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string" && Array.isArray(entry[1])) {
          const nextPath = [...path, entry[0]];
          if (nextPath.length >= 4) findLeafValues(entry[1], nextPath);
          else walk(entry[1], nextPath);
        } else if (Array.isArray(entry)) {
          walk(entry, path);
        }
      }
    };
    walk(tree);
    return {
      variants,
      shops: unique(variants.map(item => item.shop)),
      codes: unique(variants.map(item => item.code)),
      colors: unique(variants.map(item => item.color)),
      sizes: unique(variants.map(item => item.size))
    };
  }

  function colorButtonStyle(button, value) {
    const swatch = button.querySelector(".product-color-swatch");
    if (!swatch) return;
    const named = { black: "#111", white: "#fff", red: "#dc2626", blue: "#2563eb", green: "#16a34a", yellow: "#eab308", orange: "#ea580c", purple: "#9333ea", pink: "#ec4899", brown: "#92400e", gray: "#6b7280", grey: "#6b7280", navy: "#1e3a8a", beige: "#d6c5a5", cream: "#fffdd0" };
    const normalized = String(value).trim().toLowerCase();
    swatch.style.backgroundColor = named[normalized] || (/^#[0-9a-f]{3,8}$/i.test(normalized) || /^(rgb|hsl)a?\(/i.test(normalized) ? normalized : "#6b7280");
    if (["white", "yellow", "beige", "cream"].includes(normalized)) swatch.classList.add("light-color");
  }

  function bindImageGallery(root, images, fallbackIcon) {
    const image = root.querySelector("img[data-gallery-image]");
    const count = root.querySelector("[data-gallery-count]");
    const prev = root.querySelector("[data-gallery-prev]");
    const next = root.querySelector("[data-gallery-next]");
    let index = 0;
    const update = () => {
      if (image && images.length) image.src = images[index];
      if (count) count.textContent = `${index + 1} / ${images.length}`;
      if (prev) prev.hidden = images.length < 2;
      if (next) next.hidden = images.length < 2;
    };
    prev?.addEventListener("click", event => { event.stopPropagation(); index = (index - 1 + images.length) % images.length; update(); });
    next?.addEventListener("click", event => { event.stopPropagation(); index = (index + 1) % images.length; update(); });
    if (!images.length) root.querySelector("[data-gallery-fallback]")?.replaceChildren(document.createTextNode(fallbackIcon));
    update();
  }

  function openProductPage(product) {
    if (!product) return;
    currentProduct = product;
    if (window.HiperApp) window.HiperApp.navigate("productpage");
    renderProductPage();
  }

  function renderProductPage() {
    const product = currentProduct;
    const content = $("#product-detail-content");
    if (!product || !content) return;
    const variantInfo = getProductVariantInfo(product);
    const shopInfo = getShopDetails(product.at_shop || variantInfo.shops[0]);
    const images = productImage(product);
    const sizesFromMoreInfo = variantInfo.sizes;
    const colorsFromMoreInfo = variantInfo.colors;
    const sizes = sizesFromMoreInfo.length ? sizesFromMoreInfo : optionList(product.sizes || product.size_options || product.available_sizes, []);
    const colors = colorsFromMoreInfo.length ? colorsFromMoreInfo : optionList(product.colors || product.color_options || product.available_colors, []);
    const delivery = optionList(product.delivery_options || product.delivery_methods, ["Standard delivery", "Store pickup"]);
    const productKey = String(product.id || product.code || product.name);
    const savedRating = Number(JSON.parse(localStorage.getItem("hiper_product_ratings") || "{}")[productKey]) || 0;
    const price = Number(product.price) || 0;
    const stock = Number(product.quantity) || 0;
    content.innerHTML = `
      <div class="product-detail-media product-gallery">${images.length ? `<img data-gallery-image src="" alt="${escapeHtml(product.name)}" onerror="this.hidden=true;this.parentElement.querySelector('[data-gallery-fallback]').hidden=false">` : ""}<span class="product-detail-fallback" data-gallery-fallback ${images.length ? "hidden" : ""}>${getProductIcon(product.name)}</span><button type="button" class="gallery-arrow gallery-prev" data-gallery-prev aria-label="Previous image">‹</button><span class="gallery-count" data-gallery-count></span><button type="button" class="gallery-arrow gallery-next" data-gallery-next aria-label="Next image">›</button></div>
      <div class="product-detail-info">
        <p class="eyebrow">${escapeHtml(shopInfo.fullBrandLabel)}</p>
        <h1>${escapeHtml(product.name || "Product")}</h1>
        <p class="product-detail-price">${window.HiperApi.formatMoney(price, product.at_shop || shopInfo.name)}</p>
        <p>${escapeHtml(product.description || "No product description is available.")}</p>
        <div class="product-detail-facts">
          <span id="product-detail-stock">${stock} in stock</span>${variantInfo.shops.length ? `<span>Shops: ${escapeHtml(variantInfo.shops.map(shop => getShopDetails(shop).displayName).join(", "))}</span>` : `<span>Shop: ${escapeHtml(product.at_shop || shopInfo.name)}</span>`}
          ${variantInfo.codes.length ? `<span>Code: ${escapeHtml(variantInfo.codes.join(", "))}</span>` : (product.code ? `<span>Code: ${escapeHtml(product.code)}</span>` : "")}
          <span id="product-detail-barcode">Barcode: ${escapeHtml(variantInfo.variants.find(v => v.barcode)?.barcode || product.barcode || "Not available")}</span>
          <span>${escapeHtml(shopInfo.location)}</span>
        </div>
        ${sizes.length ? `<fieldset class="product-choice"><legend>Size</legend><div class="product-option-buttons">${sizes.map((value, index) => `<button type="button" class="product-option-button ${index === 0 ? "selected" : ""}" data-option-group="size" data-option-value="${escapeHtml(value)}" aria-pressed="${index === 0}">${escapeHtml(value)}</button>`).join("")}</div></fieldset>` : ""}
        ${colors.length ? `<fieldset class="product-choice"><legend>Color</legend><div class="product-option-buttons">${colors.map((value, index) => `<button type="button" class="product-option-button product-color-button ${index === 0 ? "selected" : ""}" data-option-group="color" data-option-value="${escapeHtml(value)}" aria-pressed="${index === 0}"><span class="product-color-swatch" aria-hidden="true"></span>${escapeHtml(value)}</button>`).join("")}</div></fieldset>` : ""}
        <div class="product-delivery"><h3>Delivery</h3><label class="product-choice">Delivery option<select id="product-delivery-method" class="input">${delivery.map(value => `<option>${escapeHtml(value)}</option>`).join("")}</select></label><label class="product-choice">Destination<input id="product-delivery-destination" class="input" placeholder="Enter delivery address or pickup location"></label></div>
        <div class="product-rating"><strong>How would you rate this product?</strong><div class="rating-stars" role="group" aria-label="Rate this product">${[1,2,3,4,5].map(n => `<button type="button" data-rating="${n}" aria-label="${n} stars">${n <= savedRating ? "★" : "☆"}</button>`).join("")}</div><span id="product-rating-message">${savedRating ? `Your rating: ${savedRating} out of 5` : "Tap a star to leave a rating"}</span></div>
        <div class="product-detail-actions"><label>Quantity <input id="product-detail-quantity" class="input" type="number" min="1" max="${Math.max(stock, 1)}" value="1"></label>
          <button class="button button-primary" id="product-detail-add">Add to Cart</button>
          <button class="button button-secondary" id="product-detail-buy">Buy Now</button></div>
      </div>`;
    bindImageGallery(content.querySelector(".product-gallery"), images, getProductIcon(product.name));
    content.querySelectorAll('[data-option-group="color"]').forEach(button => colorButtonStyle(button, button.dataset.optionValue));
    content.querySelectorAll("[data-option-group]").forEach(button => button.addEventListener("click", () => {
      const group = button.dataset.optionGroup;
      content.querySelectorAll(`[data-option-group="${group}"]`).forEach(option => {
        const selected = option === button;
        option.classList.toggle("selected", selected);
        option.setAttribute("aria-pressed", String(selected));
      });
      if (group === "size" || group === "color") updateVariantBarcode(content, variantInfo, product);
    }));
    updateVariantBarcode(content, variantInfo, product);
    content.querySelectorAll("[data-rating]").forEach(button => button.addEventListener("click", () => {
      const rating = Number(button.dataset.rating);
      const ratings = JSON.parse(localStorage.getItem("hiper_product_ratings") || "{}");
      ratings[productKey] = rating;
      localStorage.setItem("hiper_product_ratings", JSON.stringify(ratings));
      content.querySelectorAll("[data-rating]").forEach(star => star.textContent = Number(star.dataset.rating) <= rating ? "★" : "☆");
      $("#product-rating-message").textContent = `Thanks for rating this product ${rating} out of 5.`;
    }));
    const add = (buyNow) => {
      if (!Array.isArray(state.cart)) state.cart = [];
      const qty = Math.max(1, Number($("#product-detail-quantity")?.value) || 1);
      const existing = state.cart.find(line => String(line.product.id) === String(product.id));
      const selected = {
        size: content.querySelector('[data-option-group="size"].selected')?.dataset.optionValue || "",
        color: content.querySelector('[data-option-group="color"].selected')?.dataset.optionValue || "",
        delivery: $("#product-delivery-method")?.value || "",
        destination: $("#product-delivery-destination")?.value.trim() || ""
      };
      const cartProduct = { ...product, ...selected };
      if (existing) { existing.quantity += qty; existing.product = { ...existing.product, ...selected }; }
      else state.cart.push({ product: cartProduct, quantity: qty, price });
      renderHomeCart();
      if (window.HiperPos) window.HiperPos.renderCart();
      if (buyNow && window.HiperApp) window.HiperApp.navigate("pos");
      else showToast(`Added "${product.name}" to cart.`);
    };
    $("#product-detail-add")?.addEventListener("click", () => add(false));
    $("#product-detail-buy")?.addEventListener("click", () => add(true));

    const all = (state.products || []).filter(p => String(p.id) !== String(product.id));
    const sameShop = all.filter(p => String(p.at_shop || "").toLowerCase() === String(product.at_shop || "").toLowerCase());
    const sameCategory = all.filter(p => getProductIcon(p.name) === getProductIcon(product.name));
    renderProductRecommendations("#product-suggestions", sameShop.length ? sameShop : all);
    renderProductRecommendations("#product-related", sameCategory.length ? sameCategory : all.filter(p => p.at_shop !== product.at_shop));
  }

  function updateVariantBarcode(content, info, product) {
    const selectedSize = content.querySelector('[data-option-group="size"].selected')?.dataset.optionValue;
    const selectedColor = content.querySelector('[data-option-group="color"].selected')?.dataset.optionValue;
    const shopName = getShopDetails(product.at_shop || info.shops[0]).name.toLowerCase();
    const candidates = info.variants.filter(variant => (!selectedSize || variant.size === selectedSize) && (!selectedColor || variant.color === selectedColor) && variant.barcode);
    const match = candidates.find(variant => getShopDetails(variant.shop).name.toLowerCase() === shopName && (!product.code || variant.code === String(product.code))) || candidates.find(variant => getShopDetails(variant.shop).name.toLowerCase() === shopName) || candidates[0];
    const barcode = content.querySelector("#product-detail-barcode");
    if (barcode) barcode.textContent = `Barcode: ${match?.barcode || product.barcode || "Not available"}`;
    const stock = content.querySelector("#product-detail-stock");
    if (stock && match) stock.textContent = `${match.quantity} in stock for selected size/color`;
  }

  function renderProductRecommendations(selector, products) {
    const container = $(selector);
    if (!container) return;
    container.replaceChildren();
    products.slice(0, 4).forEach(product => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "product-recommendation-card";
      const images = productImage(product);
      card.innerHTML = `${images.length ? `<img src="${escapeHtml(images[0])}" alt="">` : `<span>${getProductIcon(product.name)}</span>`}<strong>${escapeHtml(product.name)}</strong><small>${window.HiperApi.formatMoney(product.price, product.at_shop)}</small>`;
      card.addEventListener("click", () => openProductPage(product));
      container.append(card);
    });
    if (!products.length) container.innerHTML = `<p class="muted">More products will appear here as they become available.</p>`;
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
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `View ${product.name} details`);
      const icon = getProductIcon(product.name);
      const images = productImage(product);
      const priceFormatted = window.HiperApi.formatMoney(product.price, product.at_shop || shopInfo.name);

      card.innerHTML = `
        <div class="shop-product-image product-gallery">${images.length ? `<img data-gallery-image src="" alt="${escapeHtml(product.name)}"><span data-gallery-fallback hidden>${icon}</span>` : `<span data-gallery-fallback>${icon}</span>`}<button type="button" class="gallery-arrow gallery-prev" data-gallery-prev aria-label="Previous image">‹</button><span class="gallery-count" data-gallery-count></span><button type="button" class="gallery-arrow gallery-next" data-gallery-next aria-label="Next image">›</button></div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
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
      bindImageGallery(card.querySelector(".product-gallery"), images, icon);

      card.addEventListener("click", () => openProductPage(product));
      card.addEventListener("keydown", event => {
        if (event.target === card && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          openProductPage(product);
        }
      });

      card.querySelector(".btn-shop-cart")?.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!Array.isArray(state.cart)) state.cart = [];
        const existing = state.cart.find((line) => String(line.product.id) === String(product.id));
        if (existing) existing.quantity += 1;
        else state.cart.push({ product, quantity: 1, price: Number(product.price) || 0 });
        renderHomeCart();
        if (window.HiperPos) window.HiperPos.renderCart();
        showToast(`Added "${product.name}" to cart!`);
      });

      card.querySelector(".btn-shop-buy")?.addEventListener("click", (event) => {
        event.stopPropagation();
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
    const images = productImage(product);
    const priceFormatted = window.HiperApi.formatMoney(product.price, product.at_shop);
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

      <div class="post-media product-gallery">
        ${images.length ? `<img class="feed-product-image" data-gallery-image src="" alt="${escapeHtml(product.name)}">` : `<span class="product-media-icon" data-gallery-fallback>${icon}</span>`}
        ${images.length ? `<span class="product-media-icon" data-gallery-fallback hidden>${icon}</span>` : ""}
        <button type="button" class="gallery-arrow gallery-prev" data-gallery-prev aria-label="Previous image">‹</button><span class="gallery-count" data-gallery-count></span><button type="button" class="gallery-arrow gallery-next" data-gallery-next aria-label="Next image">›</button>
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
    bindImageGallery(media, images, icon);
    media?.addEventListener("click", (event) => {
      if (event.target.closest("[data-gallery-prev], [data-gallery-next]")) return;
      openProductPage(product);
    });
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
    const currencyTotals = new Map();
    state.cart.forEach(line => {
      const currency = window.HiperApi.currencyForShop(line.product.at_shop);
      currencyTotals.set(currency, (currencyTotals.get(currency) || 0) + line.quantity * line.price);
    });
    const cartTotalText = [...currencyTotals].map(([currency, amount]) => window.HiperApi.formatMoney(amount, { Shop_currency: currency })).join(" + ") || window.HiperApi.formatMoney(0);
    if (subtotalEl) subtotalEl.textContent = cartTotalText;
    if (totalEl) totalEl.textContent = cartTotalText;

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
          <span class="home-cart-item-price">${window.HiperApi.formatMoney(line.price, line.product.at_shop)} each</span>
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
    const cartCurrencies = new Set(state.cart.map(line => window.HiperApi.currencyForShop(line.product.at_shop)));
    if (cartCurrencies.size > 1) {
      if (message) setMessage(message, "Your cart has products in different currencies. Check out each currency separately.", "error");
      return;
    }
    const shopForSale = state.cart[0].product.at_shop || state.activeShop?.Shop_name || "Main Shop";
    if (checkoutBtn) checkoutBtn.disabled = true;
    if (message) setMessage(message, "Saving sale & updating stock...");

    try {
      const result = await api("sale", {
        method: "POST",
        body: {
          shop_id: shopForSale,
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
    const productBack = $("#productpage-back-btn");
    if (productBack) productBack.onclick = () => window.HiperApp?.navigate("shoppage");

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
