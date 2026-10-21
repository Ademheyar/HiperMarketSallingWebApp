/** Product catalogue controls modeled on M/Product.py and the product forms. */
window.HiperProductCategories = [["MANS",[["ACCESSORIES",[]],["TROUSER",[]],["SHOES",[]],["TOP",[["T-SHIRT",[]],["SHIRT",[]],["BLOUSES",[]],["POLO SHIRT",[]],["TANK",[]],["SWEATER",[]],["HOODIES",[]],["JACKET",[]],["BLAZER",[]]]],["BOTTOM",[["JEAN",[]],["PANT",[]],["SHORT",[]],["SKIRT",[]],["LEGGING",[]],["CULOTTE",[]]]],["OUTERWEAR",[["COAT",[]],["TRENCH COAT",[]],["RIN COAT",[]],["PARKA",[]],["WINDBREAKER",[]]]],["ACTIVEWEAR",[["ATHLETICSHORTS",[]],["JOGGINGPANT",[]],["SPORTJACKET",[]],["YOGAPANT",[]],["PREFORMANCETOP",[]]]]]],["WOMANS",[["ACCESSORIES",[]],["TROUSER",[]],["SHOES",[]],["TOP",[["T-SHIRT",[]],["SHIRT",[]],["BLOUSES",[]],["POLO SHIRT",[]],["TANK",[]],["SWEATER",[]],["HOODIES",[]],["JACKET",[]],["BLAZER",[]]]],["BOTTOM",[["JEAN",[]],["PANT",[]],["SHORT",[]],["SKIRT",[]],["LEGGING",[]],["CULOTTE",[]]]],["DRESS",[["SUNDRESS",[]],["COCKTAIL",[]],["MAXI",[]],["SHIFT",[]],["BODYCON",[]],["A-LINE",[]]]],["OUTERWEAR",[["COAT",[]],["TRENCH COAT",[]],["RIN COAT",[]],["PARKA",[]],["WINDBREAKER",[]]]],["ACTIVEWEAR",[["SPORTBRA",[]],["ATHLETICSHORTS",[]],["JOGGINGPANT",[]],["SPORTJACKET",[]],["YOGAPANT",[]],["PREFORMANCETOP",[]]]]]],["KIDS",[["ACCESSORIES",[]],["GIRLS",[["TROUSER",[]],["SHOES",[]],["TOP",[["T-SHIRT",[]],["SHIRT",[]],["BLOUSES",[]],["POLO SHIRT",[]],["TANK",[]],["SWEATER",[]],["HOODIES",[]],["JACKET",[]],["BLAZER",[]]]],["BOTTOM",[["JEAN",[]],["PANT",[]],["SHORT",[]],["SKIRT",[]],["LEGGING",[]],["CULOTTE",[]]]],["DRESS",[["SUNDRESS",[]],["COCKTAIL",[]],["MAXI",[]],["SHIFT",[]],["BODYCON",[]],["A-LINE",[]]]],["OUTERWEAR",[["COAT",[]],["TRENCH COAT",[]],["RIN COAT",[]],["PARKA",[]],["WINDBREAKER",[]]]],["ACTIVEWEAR",[["SPORTBRA",[]],["ATHLETICSHORTS",[]],["JOGGINGPANT",[]],["SPORTJACKET",[]],["YOGAPANT",[]],["PREFORMANCETOP",[]]]]]],["BOYS",[["TROUSER",[]],["SHOES",[]],["TOP",[["T-SHIRT",[]],["SHIRT",[]],["BLOUSES",[]],["POLO SHIRT",[]],["TANK",[]],["SWEATER",[]],["HOODIES",[]],["JACKET",[]],["BLAZER",[]]]],["BOTTOM",[["JEAN",[]],["PANT",[]],["SHORT",[]],["SKIRT",[]],["LEGGING",[]],["CULOTTE",[]]]],["OUTERWEAR",[["COAT",[]],["TRENCH COAT",[]],["RIN COAT",[]],["PARKA",[]],["WINDBREAKER",[]]]],["ACTIVEWEAR",[["ATHLETICSHORTS",[]],["JOGGINGPANT",[]],["SPORTJACKET",[]],["YOGAPANT",[]],["PREFORMANCETOP",[]]]]]],["FORKIDS",[["TROUSER",[]],["SHOES",[]],["TOP",[["T-SHIRT",[]],["SHIRT",[]],["BLOUSES",[]],["POLO SHIRT",[]],["TANK",[]],["SWEATER",[]],["HOODIES",[]],["JACKET",[]],["BLAZER",[]]]],["BOTTOM",[["JEAN",[]],["PANT",[]],["SHORT",[]],["SKIRT",[]],["LEGGING",[]],["CULOTTE",[]]]],["OUTERWEAR",[["COAT",[]],["TRENCH COAT",[]],["RIN COAT",[]],["PARKA",[]],["WINDBREAKER",[]]]],["ACTIVEWEAR",[["ATHLETICSHORTS",[]],["JOGGINGPANT",[]],["SPORTJACKET",[]],["YOGAPANT",[]],["PREFORMANCETOP",[]]]]]]]],["FOREVERYONE",[["ACCESSORIES",[]],["SHOES",[]],["TROUSER",[]],["TOP",[["T-SHIRT",[]],["SHIRT",[]],["BLOUSES",[]],["POLO SHIRT",[]],["TANK",[]],["SWEATER",[]],["BLAZER",[]]]],["BOTTOM",[["JEAN",[]],["PANT",[]],["SHORT",[]],["SKIRT",[]],["LEGGING",[]],["CULOTTE",[]]]],["OUTERWEAR",[["COAT",[]],["RIN COAT",[]],["PARKA",[]],["WINDBREAKER",[]],["TRENCHCOAT",[]]]],["ACTIVEWEAR",[["ATHLETICSHORTS",[]],["JOGGINGPANT",[]],["SPORTJACKET",[]],["YOGAPANT",[]],["PREFORMANCETOP",[]]]]]]];

window.HiperProducts = (() => {
  "use strict";
  const { state, $, api, formatMoney, showToast } = window.HiperApi;
  let selectedId = "";
  let selectedCategoryPath = [];
  let expandedCategoryPaths = new Set();
  let treeInitialized = false;
  let priceFilter = "";
  let costFilter = "";
  let filtersInitialized = false;
  let stockFilter = "";
  let currentProductLimit = 20;

  const idOf = item => String(item?.id ?? item?.product_id ?? "");
  const shopId = shop => String(shop?.Shop_Id ?? shop?.Shop_id ?? shop?.Shop_name ?? "");
  function shopFor(item) { return (state.shops || []).find(shop => [shopId(shop), shop.Shop_name].some(value => String(value) === String(item.at_shop))) || null; }
  function categoryTree(shop) {
    let tree = []; try { tree = JSON.parse(shop?.Shop_Items_type || "[]"); } catch {}
    return tree.length ? tree : (window.HiperProductCategories || []);
  }
  function selectedTypes(item) { try { return JSON.parse(item.type || "[]"); } catch { return []; } }
  function productQuantity(item) {
    let data; try { data = JSON.parse(item.more_info || "[]"); } catch { return Number(item.quantity) || 0; }
    let sum = 0; let found = false; const walk = list => (list || []).forEach(node => {
      if (!Array.isArray(node)) return;
      if (node.length > 4 && !Array.isArray(node[1])) { found = true; sum += Number(node[4]) || 0; }
      else if (node.length === 2 && Array.isArray(node[1])) {
        const children = node[1];
        walk(children);
      }
    }); walk(data); return found ? sum : Number(item.quantity) || 0;
  }
  function pythonStockQuantity(item) {
    let data = []; try { data = JSON.parse(item.more_info || "[]"); } catch {}
    let sum = 0; const walk = list => { if (!Array.isArray(list)) return; list.forEach(node => {
      if (!Array.isArray(node)) return;
      if (node.length > 4) { const quantity = Number(node[4]); if (Number.isFinite(quantity)) sum += quantity; }
      else if (node.length === 2) walk(node[1]);
    }); }; walk(data); return sum;
  }
  function productsForShopFilter() {
    const selected = $("#product-shop-filter")?.value || "";
    if (!selected) return state.products || [];
    return filteredProducts();
  }
  async function linkProductToShop(shopRef, productId) {
    const shop = (state.shops || []).find(entry => shopId(entry) === String(shopRef) || String(entry.Shop_name) === String(shopRef)); if (!shop || productId == null) return;
    let products = []; try { products = JSON.parse(shop.Shop_items || "[]"); } catch {}
    if (!products.some(entry => Array.isArray(entry) && String(entry[0]) === String(productId))) products.push([productId, 1, new Date().toISOString(), new Date().toISOString(), new Date().toISOString()]);
    const result = await api("save", { method: "POST", body: { resource: "shops", id: shop.Shop_Id ?? shop.Shop_id, data: { Shop_items: JSON.stringify(products) } } });
    Object.assign(shop, result.item || { Shop_items: JSON.stringify(products) });
  }
  function initializeFilters() {
    const shopSelect = $("#product-shop-filter");
    if (shopSelect) { const current = filtersInitialized ? shopSelect.value : (shopSelect.value || (state.activeShop ? shopId(state.activeShop) : "")); filtersInitialized = true; shopSelect.replaceChildren(new Option("All shops", "")); (state.shops || []).forEach(shop => shopSelect.add(new Option(shop.Shop_name || shop.Shop_brand_name || shopId(shop), shopId(shop)))); if ([...shopSelect.options].some(o => o.value === current)) shopSelect.value = current; }
  }
  function matchesType(item) { if (!selectedCategoryPath.length) return true; return selectedTypes(item).some(value => Array.isArray(value) && selectedCategoryPath.every((part, index) => String(value[index] ?? "") === part)); }
  function filteredProducts() {
    const query = ($('[data-search="products"]')?.value || "").trim().toLowerCase();
    const shopFilter = $("#product-shop-filter")?.value || "";
    return (state.products || []).filter(item => {
      const itemShop = String(item.at_shop || "").trim().toLowerCase();
      const filterShop = String(shopFilter).trim().toLowerCase();
      const sObj = shopFor(item);
      const shopName = String(sObj?.Shop_name || "").trim().toLowerCase();
      const shopBrand = String(sObj?.Shop_brand_name || "").trim().toLowerCase();
      const shopIdVal = String(sObj?.Shop_Id ?? sObj?.Shop_id ?? "").trim().toLowerCase();

      const matchShop = !shopFilter ||
        itemShop === filterShop ||
        shopName === filterShop ||
        shopBrand === filterShop ||
        shopIdVal === filterShop ||
        !item.at_shop;

      const matchQuery = !query || Object.values(item).some(value => String(value ?? "").toLowerCase().includes(query));
      const quantity = productQuantity(item);
      const matchStock = !stockFilter || (stockFilter === "low" ? quantity > 0 && quantity <= 15 : quantity <= 0);
      return matchShop && matchQuery && matchesType(item) && matchStock && (!priceFilter || Number(item.price) === Number(priceFilter)) && (!costFilter || Number(item.cost) === Number(costFilter));
    });
  }
  function renderSummary(items) {
    const target = $("#product-summary"); if (!target) return; target.replaceChildren();
    const stocked = items.filter(item => productQuantity(item) > 0); const quantity = stocked.reduce((sum, item) => sum + productQuantity(item), 0); const cost = stocked.reduce((sum, item) => sum + productQuantity(item) * (Number(item.cost) || 0), 0); const value = stocked.reduce((sum, item) => sum + productQuantity(item) * (Number(item.price) || 0), 0);
    const currencyShop = $("#product-shop-filter")?.value || state.activeShop;
    const mode = $("#product-report-mode")?.value || "Count Product Stock By Code"; let cards;
    if (mode === "Count Product By Code") cards = [["TOTAL ITEM COUNT", items.length], ["TOTAL QTY COUNT", quantity], ["TOTAL LOW STOCK", items.filter(item => productQuantity(item) <= 15).length], ["TOTAL OUT OF STOCK", items.filter(item => productQuantity(item) === 0).length]];
    else if (mode === "Product Total Salle By Date" || mode === "Product Total Salle By Code") {
      const from = $("#product-date-from")?.value || "0000-00-00"; const to = $("#product-date-to")?.value || "9999-99-99"; const ids = new Set(items.map(item => idOf(item))); const codes = new Set(items.map(item => String(item.code || "")).filter(Boolean)); let soldQty = 0; let soldValue = 0; let documentCount = 0;
      (state.sales || []).filter(doc => String(doc.doc_created_date || "").slice(0, 10) >= from && String(doc.doc_created_date || "").slice(0, 10) <= to).forEach(doc => { let lines = []; try { lines = JSON.parse(doc.item || "[]"); } catch {} let matched = false; lines.forEach(line => { const productId = String(line?.product_id ?? line?.id ?? line?.[0] ?? ""); const productCode = String(line?.code ?? line?.[1] ?? ""); if (!(productId && ids.has(productId)) && !(productCode && codes.has(productCode))) return; const qty = Number(line?.qty ?? line?.quantity ?? line?.[7] ?? doc.qty) || 0; const price = Number(line?.price ?? line?.unit_price ?? line?.[8] ?? doc.price) || 0; soldQty += qty; soldValue += qty * price; matched = true; }); if (matched) documentCount++; });
      cards = [["DOCUMENT COUNT", documentCount], ["PRODUCT SALE QTY", soldQty], ["PRODUCT TOTAL SALE", formatMoney(soldValue, currencyShop)], ["CURRENT STOCK VALUE", formatMoney(cost, currencyShop)]];
    } else cards = [["TOTAL ITEM COUNT", items.length], ["TOTAL QTY COUNT", quantity], ["TOTAL COST", formatMoney(cost, currencyShop)], ["TOTAL AFTER SALE", formatMoney(value, currencyShop)]];
    cards.forEach(([label, number]) => { const card = document.createElement("div"); card.className = "panel product-summary-card"; const title = document.createElement("span"); title.textContent = label; const amount = document.createElement("strong"); amount.textContent = String(number); card.append(title, amount); target.append(card); });
    renderProductChart(items, mode);
  }
  function renderListSummary(items) {
    const target = $("#product-list-summary"); if (!target) return; target.replaceChildren();
    const quantities = new Map(items.map(item => [idOf(item), pythonStockQuantity(item)]));
    const stocked = items.filter(item => quantities.get(idOf(item)) > 0);
    const quantity = stocked.reduce((sum, item) => sum + quantities.get(idOf(item)), 0);
    const cost = stocked.reduce((sum, item) => sum + quantities.get(idOf(item)) * (Number(item.cost) || 0), 0);
    const afterSale = stocked.reduce((sum, item) => sum + quantities.get(idOf(item)) * (Number(item.price) || 0), 0);
    const currency = $("#product-shop-filter")?.value || state.activeShop;
    const compactMoney = amount => {
      const value = Number(amount) || 0; let scaled = value; let suffix = " Hundred";
      if (Math.abs(value) >= 1_000_000) { scaled = value / 1_000_000; suffix = " M"; }
      else if (Math.abs(value) >= 1_000) { scaled = value / 1_000; suffix = " K"; }
      else scaled = value * 100;
      return `${formatMoney(scaled, currency)}${suffix}`;
    };
    const cards = [["TOTAL ITEM COUNT", items.length], ["TOTAL QTY COUNT", quantity], ["TOTAL COST", compactMoney(cost)], ["TOTAL AFTER SALE", compactMoney(afterSale)], ["OUT OF STOCK", items.filter(item => quantities.get(idOf(item)) <= 0).length], ["LOW STOCK", items.filter(item => quantities.get(idOf(item)) > 0 && quantities.get(idOf(item)) <= 15).length]];
    cards.forEach(([label, value]) => { const card = document.createElement("div"); card.className = "panel product-summary-card"; const title = document.createElement("span"); title.textContent = label; const amount = document.createElement("strong"); amount.textContent = String(value); card.append(title, amount); const filter = label === "OUT OF STOCK" ? "out" : label === "LOW STOCK" ? "low" : ""; if (filter) { card.classList.add("product-stock-filter-card"); card.setAttribute("role", "button"); card.tabIndex = 0; card.setAttribute("aria-pressed", String(stockFilter === filter)); if (stockFilter === filter) card.classList.add("selected"); const toggle = () => { stockFilter = stockFilter === filter ? "" : filter; renderProducts(); }; card.addEventListener("click", toggle); card.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); } }); } target.append(card); });
  }
  function variantLeaves(data, path = [], output = []) {
    if (!Array.isArray(data)) return output;
    if (data.length > 4 && !Array.isArray(data[1])) { output.push({ values: data, path }); return output; }
    data.forEach((node, index) => {
      if (!Array.isArray(node)) return;
      if (node.length === 2 && Array.isArray(node[1])) variantLeaves(node[1], [...path, String(node[0])], output);
      else variantLeaves(node, path, output);
    });
    return output;
  }
  function renderProductChart(items, mode) {
    const target = $("#product-report-chart"); if (!target) return; target.replaceChildren();
    const data = items.slice(0, 18).map(item => ({ label: item.code || item.name || "Item", value: mode === "Count Product By Code" ? productQuantity(item) : productQuantity(item) * (Number(item.cost) || 0) }));
    const max = Math.max(1, ...data.map(entry => entry.value));
    data.forEach(entry => { const row = document.createElement("div"); row.className = "product-chart-row"; const label = document.createElement("span"); label.textContent = entry.label; const track = document.createElement("div"); track.className = "product-chart-track"; const bar = document.createElement("i"); bar.style.width = `${Math.max(2, entry.value / max * 100)}%`; track.append(bar); const value = document.createElement("b"); value.textContent = String(Math.round(entry.value * 100) / 100); row.append(label, track, value); target.append(row); });
    if (!data.length) { const empty = document.createElement("p"); empty.className = "empty-state"; empty.textContent = "No product data to chart."; target.append(empty); }
  }
  function outOfStockRows() {
    const query = $("#product-out-stock-search")?.value.trim().toLowerCase() || ""; const date = $("#product-out-stock-date")?.value || ""; const rows = [];
    (state.products || []).forEach(item => { let data = []; try { data = JSON.parse(item.more_info || "[]"); } catch {}
      variantLeaves(data).forEach(leaf => { const v = leaf.values; const qtyIndex = 4; const qty = Number(v[qtyIndex]); if (!(qty < 0)) return;
        const color = leaf.path.at(-2) || ""; const size = leaf.path.at(-1) || ""; const updated = String(item.doc_updated_date || item.updated_at || "");
        const haystack = [item.name, item.code, item.barcode, color, size, v[0]].join(" ").toLowerCase(); if (query && !haystack.includes(query)) return; if (date && updated.slice(0, 10) !== date) return;
        rows.push({ item, color, size, barcode: v[0] || item.barcode || "", qty, updated });
      });
    }); return rows;
  }
  function renderOutOfStocks() {
    const body = $("#product-out-stock-body"); if (!body) return; body.replaceChildren(); const rows = outOfStockRows();
    rows.forEach(({ item, color, size, barcode, qty, updated }) => { const row = document.createElement("tr"); [item.name || "Unnamed", shopFor(item)?.Shop_name || item.at_shop || "Main Shop", item.code || "", color, size, barcode, qty, updated].forEach(value => { const cell = document.createElement("td"); cell.textContent = String(value ?? ""); row.append(cell); }); body.append(row); });
    if (!rows.length) { const row = document.createElement("tr"); const cell = document.createElement("td"); cell.colSpan = 8; cell.className = "empty-state"; cell.textContent = "No negative stock variants found."; row.append(cell); body.append(row); }
  }
  function renderCategoryTree() {
    const target = $("#product-category-tree"); if (!target) return;
    const selectedShop = (state.shops || []).find(shop => shopId(shop) === $("#product-shop-filter")?.value) || null;
    const trees = selectedShop ? categoryTree(selectedShop) : (window.HiperProductCategories || []);
    if (!treeInitialized) {
      const expandAll = (nodes, path = []) => (nodes || []).forEach(node => { const next = [...path, String(node[0])]; if (node[1]?.length) { expandedCategoryPaths.add(JSON.stringify(next)); expandAll(node[1], next); } });
      expandAll(trees); treeInitialized = true;
    }
    target.replaceChildren();
    const makeLabel = (label, path, isAll = false) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "product-tree-label";
      button.textContent = label; if ((!path.length && !selectedCategoryPath.length) || (!isAll && path.length <= selectedCategoryPath.length && path.every((part, index) => selectedCategoryPath[index] === part))) button.classList.add("active");
      button.addEventListener("click", () => { selectedCategoryPath = [...path]; renderProducts(); }); return button;
    };
    target.append(makeLabel("ALL PRODUCTS", [], true));
    const renderNodes = (nodes, parent, prefix = [], depth = 0) => (nodes || []).forEach(node => {
      if (!Array.isArray(node)) return; const path = [...prefix, String(node[0])]; const key = JSON.stringify(path); const row = document.createElement("div"); row.className = "product-tree-row"; row.style.setProperty("--tree-depth", depth);
      if (node[1]?.length) { const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "product-tree-toggle"; toggle.setAttribute("aria-label", `${expandedCategoryPaths.has(key) ? "Collapse" : "Expand"} ${node[0]}`); toggle.textContent = expandedCategoryPaths.has(key) ? "▾" : "▸"; toggle.addEventListener("click", () => { expandedCategoryPaths.has(key) ? expandedCategoryPaths.delete(key) : expandedCategoryPaths.add(key); renderCategoryTree(); }); row.append(toggle); }
      else { const spacer = document.createElement("span"); spacer.className = "product-tree-spacer"; row.append(spacer); }
      row.append(makeLabel(String(node[0]), path)); parent.append(row);
      if (node[1]?.length && expandedCategoryPaths.has(key)) { const nested = document.createElement("div"); nested.className = "product-tree-children"; renderNodes(node[1], nested, path, depth + 1); parent.append(nested); }
    });
    renderNodes(trees, target);
    const pathTarget = $("#product-current-path"); if (pathTarget) {
      pathTarget.replaceChildren(); const root = document.createElement("button"); root.type = "button"; root.className = "text-button"; root.textContent = "All Products"; root.addEventListener("click", () => { selectedCategoryPath = []; renderProducts(); }); pathTarget.append(root);
      selectedCategoryPath.forEach((part, index) => { const separator = document.createElement("span"); separator.textContent = "›"; pathTarget.append(separator); const crumb = document.createElement("button"); crumb.type = "button"; crumb.className = "text-button"; crumb.textContent = part; crumb.addEventListener("click", () => { selectedCategoryPath = selectedCategoryPath.slice(0, index + 1); renderProducts(); }); pathTarget.append(crumb); });
    }
  }

  function renderProducts() {
    const body = $("#products-body"); if (!body) return;
    initializeFilters(); renderCategoryTree(); const items = filteredProducts(); renderListSummary(productsForShopFilter()); renderSummary(items); renderOutOfStocks();
    body.replaceChildren();

    const itemsToRender = items.slice(0, currentProductLimit);

    itemsToRender.forEach(item => {
      const card = document.createElement("article"); card.className = `panel product-list-card${idOf(item) === selectedId ? " manager-selected-row" : ""}`; card.dataset.productId = idOf(item);
      const imageBox = document.createElement("div"); imageBox.className = "product-list-card-image";
      let imageList = []; const rawImages = item.images || item.image_urls || item.image_url || item.image || "";
      if (Array.isArray(rawImages)) imageList = rawImages.filter(Boolean);
      else if (String(rawImages).trim()) { try { const parsed = JSON.parse(rawImages); imageList = Array.isArray(parsed) ? parsed.filter(Boolean) : [String(rawImages).trim()]; } catch { imageList = String(rawImages).split(/[\n,;]/).map(value => value.trim()).filter(Boolean); } }
      if (imageList.length) { const image = document.createElement("img"); image.src = imageList[0]; image.alt = item.name || "Product image"; image.loading = "lazy"; image.addEventListener("error", () => { image.remove(); imageBox.textContent = String(item.name || "P").slice(0, 1).toUpperCase(); }, { once: true }); imageBox.append(image); }
      else imageBox.textContent = String(item.name || "P").slice(0, 1).toUpperCase();
      card.append(imageBox);

      const fields = document.createElement("div"); fields.className = "product-list-card-fields";
      const field = (label, type, value) => { const wrap = document.createElement("label"); wrap.className = "field"; const caption = document.createElement("span"); caption.textContent = label; const input = document.createElement("input"); input.className = "input"; input.type = type; input.value = value ?? ""; if (type === "number") input.step = "any"; wrap.append(caption, input); fields.append(wrap); return input; };
      const nameInput = field("Name", "text", item.name || ""); const priceInput = field("Price", "number", item.price ?? 0);
      let moreInfo = []; try { moreInfo = JSON.parse(item.more_info || "[]"); } catch {}
      const leaves = variantLeaves(moreInfo); let variantSelects = []; let selectedVariantPath = []; let qtyInput = null;
      if (leaves.length) {
        const names = ["Shop", "Code", "Color", "Size"];
        variantSelects = names.map((name, index) => { const wrap = document.createElement("label"); wrap.className = `field product-variant-field product-variant-field-${name.toLowerCase()}`; const caption = document.createElement("span"); caption.textContent = name; const select = document.createElement("select"); select.className = "input"; wrap.append(caption, select); fields.append(wrap); select.addEventListener("change", () => { selectedVariantPath[index] = select.value; updateVariantDropdowns(); }); return select; });
        selectedVariantPath = [...(leaves[0].path || [])];
        qtyInput = field("Current Qty", "number", leaves[0].values[4] ?? 0);
        function updateVariantDropdowns() {
          let candidates = leaves;
          variantSelects.forEach((select, index) => {
            const possible = [...new Set(candidates.map(leaf => String(leaf.path[index] ?? "")).filter(Boolean))]; const prior = selectedVariantPath[index];
            select.replaceChildren(...possible.map(value => new Option(value, value)));
            if (!possible.includes(prior)) selectedVariantPath[index] = possible[0] || "";
            select.value = selectedVariantPath[index] || "";
            candidates = candidates.filter(leaf => String(leaf.path[index] ?? "") === String(select.value));
          });
          const selected = candidates[0]; if (selected) qtyInput.value = selected.values[4] ?? 0;
        }
        updateVariantDropdowns();
      } else { qtyInput = field("Current Qty", "number", productQuantity(item)); }
      card.append(fields);

      const actions = document.createElement("div"); actions.className = "product-list-card-actions";
      const addButton = (label, style, handler) => { const button = document.createElement("button"); button.type = "button"; button.className = `button ${style}`; button.textContent = label; button.addEventListener("click", event => { event.stopPropagation(); handler(); }); actions.append(button); };
      addButton("Delete", "button-danger", () => deleteProduct(item));
      addButton("Full Edit", "", () => window.HiperApp?.openRecordDialog("products", item));
      addButton("Save Change", "button-primary", async () => {
        try {
          let data = {}; try { data = JSON.parse(item.more_info || "[]"); } catch {}
          if (variantSelects.length && qtyInput) { const leaf = variantLeaves(data).find(entry => selectedVariantPath.every((part, index) => String(entry.path[index] ?? "") === String(part))); if (leaf) leaf.values[4] = String(Number(qtyInput.value) || 0); }
          const serialized = JSON.stringify(data); const payload = { name: nameInput.value.trim(), price: Number(priceInput.value) || 0, more_info: serialized, quantity: variantSelects.length ? productQuantity({ ...item, more_info: serialized }) : (Number(qtyInput?.value) || 0) };
          if (!payload.name) return showToast("Product name is required.", true);
          const result = await api("save", { method: "POST", body: { resource: "products", id: item.id, data: payload } }); Object.assign(item, result.item || payload); await window.HiperApp.refreshWorkspace(); showToast("Product changes saved.");
        } catch (error) { showToast(error.message, true); }
      });
      card.append(actions); body.append(card);
    });

    if (!items.length) {
      const empty = document.createElement("div"); empty.className = "panel empty-state"; empty.textContent = "No products match this shop, category, and search."; body.append(empty);
    } else if (items.length > currentProductLimit) {
      const loadMoreCard = document.createElement("div");
      loadMoreCard.className = "panel text-center wide";
      loadMoreCard.style.cssText = "grid-column: 1 / -1; padding: 14px; text-align: center;";
      const loadMoreBtn = document.createElement("button");
      loadMoreBtn.type = "button"; loadMoreBtn.className = "button button-primary";
      loadMoreBtn.textContent = `Load More Products (Showing ${itemsToRender.length} of ${items.length})`;
      loadMoreBtn.addEventListener("click", () => {
        currentProductLimit += 20;
        renderProducts();
      });
      loadMoreCard.append(loadMoreBtn);
      body.append(loadMoreCard);
    }

    const selected = items.some(item => idOf(item) === selectedId); if (!selected) selectedId = "";
    if ($("#product-edit-selected")) $("#product-edit-selected").disabled = !selectedId;
    if ($("#product-delete-selected")) $("#product-delete-selected").disabled = !selectedId;
  }

  async function deleteSelected() {
    const item = (state.products || []).find(product => idOf(product) === selectedId); if (!item) return;
    await deleteProduct(item);
  }
  async function deleteProduct(item) {
    if (!item || !window.confirm(`Delete ${item.name || item.code || "this product"}?`)) return;
    try {
      const shop = shopFor(item);
      if (shop) { let links = []; try { links = JSON.parse(shop.Shop_items || "[]"); } catch {} const updated = links.filter(link => !Array.isArray(link) || String(link[0]) !== idOf(item)); await api("save", { method: "POST", body: { resource: "shops", id: shop.Shop_Id ?? shop.Shop_id, data: { Shop_items: JSON.stringify(updated) } } }); shop.Shop_items = JSON.stringify(updated); }
      await api("delete", { method: "POST", body: { resource: "products", id: item.id } }); state.products = state.products.filter(product => idOf(product) !== idOf(item)); selectedId = ""; renderProducts(); showToast("Product deleted.");
    } catch (error) { showToast(error.message, true); }
  }
  function bulkCategoryTree(shop) {
    let tree = []; try { tree = JSON.parse(shop?.Shop_Items_type || "[]"); } catch {}
    return tree.length ? tree : (window.HiperProductCategories || []);
  }
  function createBulkCategoryPicker(shop, initialPaths = [], onChange = () => {}) {
    const wrapper = document.createElement("div"); wrapper.className = "field product-category-picker product-bulk-types"; wrapper.style.gridColumn = "5 / span 3"; wrapper.style.gridRow = "1 / span 3"; wrapper.style.alignSelf = "start"; wrapper.style.minWidth = "0";
    const caption = document.createElement("span"); caption.textContent = "Product categories (Hierarchical)";
    const pathBar = document.createElement("div"); pathBar.className = "product-category-path";
    const options = document.createElement("div"); options.className = "product-category-options";
    const selected = document.createElement("div"); selected.className = "product-category-selected";
    const typeInput = document.createElement("input"); typeInput.type = "hidden"; typeInput.dataset.field = "types";
    const tree = bulkCategoryTree(shop);
    let selectedPaths = Array.isArray(initialPaths) ? initialPaths.filter(Array.isArray).map(path => path.map(String)) : [];
    let currentPath = [];

    const categoryList = path => {
      let list = tree;
      for (const name of path) {
        const node = (list || []).find(entry => Array.isArray(entry) && String(entry[0]) === name);
        list = Array.isArray(node?.[1]) ? node[1] : [];
      }
      return list || [];
    };
    const selectPath = path => {
      const next = path.map(String);
      if (!selectedPaths.some(entry => JSON.stringify(entry) === JSON.stringify(next))) selectedPaths.push(next);
      render(); onChange();
    };
    const render = () => {
      pathBar.replaceChildren();
      const rootButton = document.createElement("button"); rootButton.type = "button"; rootButton.className = "text-button"; rootButton.textContent = "All categories";
      rootButton.addEventListener("click", () => { currentPath = []; render(); }); pathBar.append(rootButton);
      currentPath.forEach((part, index) => {
        const separator = document.createElement("span"); separator.textContent = "›"; pathBar.append(separator);
        const crumb = document.createElement("button"); crumb.type = "button"; crumb.className = "text-button"; crumb.textContent = part;
        crumb.addEventListener("click", () => { currentPath = currentPath.slice(0, index + 1); render(); }); pathBar.append(crumb);
      });
      if (currentPath.length) {
        const chooseCurrent = document.createElement("button"); chooseCurrent.type = "button"; chooseCurrent.className = "button button-primary"; chooseCurrent.textContent = "Select this path";
        chooseCurrent.addEventListener("click", () => selectPath(currentPath)); pathBar.append(chooseCurrent);
      }

      options.replaceChildren();
      const list = categoryList(currentPath);
      if (currentPath.length) {
        const back = document.createElement("button"); back.type = "button"; back.className = "button product-category-option"; back.textContent = "‹ Back";
        back.addEventListener("click", () => { currentPath.pop(); render(); }); options.append(back);
      }
      if (!list.length) {
        const empty = document.createElement("span"); empty.className = "muted"; empty.textContent = "No subcategories in this path."; options.append(empty);
      }
      list.forEach(node => {
        if (!Array.isArray(node)) return;
        const button = document.createElement("button"); button.type = "button"; button.className = "button product-category-option";
        button.textContent = `${node[0]}${node[1]?.length ? "  ›" : ""}`;
        button.addEventListener("click", () => {
          const next = [...currentPath, String(node[0])];
          if (node[1]?.length) { currentPath = next; render(); }
          else selectPath(next);
        });
        options.append(button);
      });

      selected.replaceChildren();
      if (!selectedPaths.length) {
        const empty = document.createElement("span"); empty.className = "muted"; empty.textContent = "No category selected"; selected.append(empty);
      }
      selectedPaths.forEach((path, index) => {
        const chip = document.createElement("span"); chip.className = "product-category-chip"; chip.textContent = path.join(" › ");
        const remove = document.createElement("button"); remove.type = "button"; remove.setAttribute("aria-label", `Remove ${chip.textContent}`); remove.textContent = "×";
        remove.addEventListener("click", () => { selectedPaths.splice(index, 1); render(); onChange(); });
        chip.append(remove); selected.append(chip);
      });
      typeInput.value = JSON.stringify(selectedPaths);
    };

    wrapper.append(caption, pathBar, options, selected, typeInput); render();
    return {
      element: wrapper,
      reset() { selectedPaths = []; currentPath = []; render(); onChange(); }
    };
  }
  function createBulkCard(seed = {}) {
    const container = $("#product-bulk-items"); if (!container) return;
    const card = document.createElement("section"); card.className = "panel product-bulk-item";
    const actionsCol = document.createElement("div"); actionsCol.className = "product-bulk-item-actions-col";

    // Keep actions, image panel, and product fields in separate scrollable columns.
    const imageCol = document.createElement("div"); imageCol.className = "product-bulk-item-image-col";

    const itemTitle = document.createElement("h4");
    itemTitle.className = "product-bulk-item-title";
    itemTitle.textContent = `Item ${container.children.length + 1}`;

    const avatarImg = document.createElement("img");
    let rawImg = seed.images || seed.image || "";
    if (Array.isArray(rawImg)) rawImg = rawImg[0] || "";
    avatarImg.src = rawImg || "assets/images/no_Product_Image.jpg";
    avatarImg.onerror = () => { avatarImg.src = ""; avatarImg.alt = "No Image"; };

    const fileInput = document.createElement("input");
    fileInput.type = "file"; fileInput.accept = "image/jpeg,image/png,image/webp,image/gif"; fileInput.style.display = "none";

    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button"; uploadBtn.className = "button button-secondary"; uploadBtn.style.cssText = "font-size:11px;padding:4px 8px;width:100%;"; uploadBtn.textContent = "Image";
    uploadBtn.addEventListener("click", () => fileInput.click());

    const imgHidden = document.createElement("input");
    imgHidden.type = "hidden"; imgHidden.dataset.field = "images"; imgHidden.value = String(rawImg || "");

    fileInput.addEventListener("change", async (event) => {
      const file = event.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          uploadBtn.disabled = true; uploadBtn.textContent = "Uploading…";
          const res = await api("upload", { method: "POST", body: { base64: reader.result } });
          imgHidden.value = res.file.path; avatarImg.src = res.file.path; showToast("Item image uploaded.");
        } catch (err) { showToast(err.message, true); }
        finally { uploadBtn.disabled = false; uploadBtn.textContent = "Image"; }
      };
      reader.readAsDataURL(file);
    });

    imageCol.append(itemTitle, avatarImg, uploadBtn, fileInput, imgHidden);

    // Main Content
    const content = document.createElement("div"); content.className = "product-bulk-item-content";

    const controls = document.createElement("div"); controls.className = "toolbar-actions product-bulk-item-actions";
    const action = (label, handler, style = "") => { const button = document.createElement("button"); button.type = "button"; button.className = `button ${style}`; button.textContent = label; button.addEventListener("click", handler); controls.append(button); };
    actionsCol.append(controls);

    const fields = document.createElement("div"); fields.className = "product-bulk-item-fields";
    const input = (key, label, type, value = "", options = {}) => {
      const wrap = document.createElement("label"); wrap.className = "field";
      if (options.column) wrap.style.gridColumn = `${options.column} / span ${options.span || 1}`;
      else if (options.span) wrap.style.gridColumn = `span ${options.span}`;
      if (options.row) wrap.style.gridRow = String(options.row);
      if (type === "number") { const caption = document.createElement("span"); caption.textContent = label; wrap.append(caption); }
      const element = document.createElement(type === "textarea" ? "textarea" : "input"); element.className = "input";
      element.placeholder = label;
      if (type === "textarea") { element.rows = 2; element.value = value; }
      else { element.type = type; element.value = value; if (type === "number") element.step = "any"; }
      element.dataset.field = key; wrap.append(element); fields.append(wrap); return element;
    };

    // Seven-column layout: product fields on the left, checkboxes in column 4,
    // and the category picker in the final three columns.
    const name = input("name", "Name", "text", seed.name || "", { column: 1, row: 1, span: 2 });
    const code = input("code", "Code", "text", seed.code || "", { column: 3, row: 1 });

    const quantity = input("quantity", "Quantity", "number", seed.quantity ?? 0, { column: 1, row: 2 });
    const cost = input("cost", "Cost", "number", seed.cost ?? 0, { column: 2, row: 2 });
    const price = input("price", "Price", "number", seed.price ?? 0, { column: 3, row: 2 });
    input("description", "Description", "text", seed.description || "", { column: 1, row: 3, span: 3 });

    const check = (key, label, checked, row) => {
      const wrap = document.createElement("label"); wrap.className = "field tool-flag";
      wrap.style.gridColumn = "4"; wrap.style.gridRow = String(row);
      const element = document.createElement("input"); element.type = "checkbox"; element.dataset.field = key; element.checked = Boolean(checked);
      const text = document.createElement("span"); text.textContent = label; wrap.append(element, text); fields.append(wrap); return element;
    };
    check("default_quantity", "Default Quantity", seed.default_quantity ?? true, 1);
    check("price_change", "Price Change", seed.price_change ?? false, 2);
    check("active", "Active", seed.active ?? true, 3);

    // The category picker occupies the final grid column, starting on the first row.
    const shop = (state.shops || []).find(entry => shopId(entry) === $("#product-shop-filter")?.value) || state.activeShop || (state.shops || [])[0];
    const update = () => updateBulkSummary();
    const categoryPicker = createBulkCategoryPicker(shop, seed.types || [], update);

    fields.append(categoryPicker.element);
    content.append(fields);
    card.append(actionsCol, imageCol, content);

    [name, code, quantity, cost, price].forEach(element => element.addEventListener("input", update));

    action("Clear", () => {
      card.querySelectorAll("input:not([type=checkbox]), textarea").forEach(element => { element.value = element.dataset.field === "quantity" || element.dataset.field === "cost" || element.dataset.field === "price" ? "0" : ""; });
      categoryPicker.reset();
      avatarImg.src = "assets/images/no_Product_Image.jpg"; imgHidden.value = "";
      card.querySelector('[data-field="default_quantity"]').checked = true;
      card.querySelector('[data-field="price_change"]').checked = false;
      card.querySelector('[data-field="active"]').checked = true;
      update();
      card.querySelector('[data-field="default_quantity"]').checked = true;
      card.querySelector('[data-field="price_change"]').checked = false;
      card.querySelector('[data-field="active"]').checked = true;
      update();
    });
    action("Copy", () => { const values = bulkCardData(card); createBulkCard(values); });
    action("Cancel", () => { card.remove(); [...container.children].forEach((entry, index) => { const h = entry.querySelector("h4"); if (h) h.textContent = `Item ${index + 1}`; }); updateBulkSummary(); });

    container.append(card); updateBulkSummary();
  }

  function bulkCardData(card) {
    const get = key => card.querySelector(`[data-field="${key}"]`);
    return {
      images: get("images")?.value || "",
      name: get("name")?.value || "",
      code: get("code")?.value || "",
      quantity: get("quantity")?.value || "0",
      cost: get("cost")?.value || "0",
      price: get("price")?.value || "0",
      description: get("description")?.value || "",
      types: JSON.parse(get("types")?.value || "[]"),
      default_quantity: get("default_quantity")?.checked ? 1 : 0,
      price_change: get("price_change")?.checked ? 1 : 0,
      active: get("active")?.checked ? 1 : 0
    };
  }
  function updateBulkSummary() {
    const cards = [...($("#product-bulk-items")?.querySelectorAll(".product-bulk-item") || [])].map(bulkCardData);
    const totals = cards.reduce((sum, item) => { const qty = Number(item.quantity) || 0; sum.qty += qty; sum.cost += qty * (Number(item.cost) || 0); sum.price += qty * (Number(item.price) || 0); return sum; }, { qty: 0, cost: 0, price: 0 });
    $("#bulk-count") && ($("#bulk-count").textContent = String(cards.length)); $("#bulk-qty") && ($("#bulk-qty").textContent = String(totals.qty)); $("#bulk-cost") && ($("#bulk-cost").textContent = formatMoney(totals.cost, $("#product-shop-filter")?.value)); $("#bulk-price") && ($("#bulk-price").textContent = formatMoney(totals.price, $("#product-shop-filter")?.value)); $("#bulk-profit") && ($("#bulk-profit").textContent = formatMoney(totals.price - totals.cost, $("#product-shop-filter")?.value));
    const cash = Number($("#bulk-cash")?.value) || 0; const card = Number($("#bulk-card")?.value) || 0; const credit = totals.cost - cash - card;
    if ($("#bulk-credit")) $("#bulk-credit").value = String(Math.round(credit * 100) / 100);
    const warning = $("#bulk-payment-warning"); if (warning) { warning.textContent = credit < 0 ? "Error: Credit would be negative (cost - cash - card < 0)." : ""; warning.classList.toggle("error", credit < 0); }
    if ($("#product-bulk-process")) $("#product-bulk-process").disabled = credit < 0 || !cards.length;
    return { cards, totals, cash, card, credit };
  }

  function toggleBulkPanel(show) {
    const panel = $("#product-bulk-panel");
    if (!panel) return;
    const isDialog = panel.tagName === "DIALOG" && typeof panel.showModal === "function";
    const shouldOpen = show ?? (isDialog ? !panel.open : panel.classList.contains("hidden"));

    if (shouldOpen) {
      if (!$("#product-bulk-items")?.children.length) createBulkCard();
      if (isDialog) {
        try { panel.showModal(); } catch { panel.setAttribute("open", ""); }
      } else {
        panel.classList.remove("hidden");
      }
    } else {
      if (isDialog) {
        try { panel.close(); } catch { panel.removeAttribute("open"); }
      } else {
        panel.classList.add("hidden");
      }
    }
  }

  async function bulkAdd() {
    const shop = (state.shops || []).find(entry => shopId(entry) === $("#product-shop-filter")?.value) || state.activeShop || (state.shops || [])[0];
    if (!shop) return showToast("Choose a shop before processing products.", true);
    const { cards, totals, cash, card, credit } = updateBulkSummary();
    if (cards.some(item => !item.name.trim() || !item.code.trim())) return showToast("Each item needs a name and code.", true);
    if (credit < 0) return showToast("Cash and card payments cannot exceed the total cost.", true);
    const date = new Date().toISOString().slice(0, 16).replace("T", " "); const now = new Date().toISOString().slice(0, 19).replace("T", " "); const docBarcode = `${now.slice(2, 7).replace("-", ":")}-11${Date.now().toString().slice(-6)}`;
    const links = []; try { links.push(...JSON.parse(shop.Shop_items || "[]")); } catch {}
    const docItems = []; const created = [];
    try {
      for (const item of cards) {
        const qty = Number(item.quantity) || 0; const unitCost = Number(item.cost) || 0; const unitPrice = Number(item.price) || 0; const shopName = shop.Shop_name || ""; const code = item.code;
        const variants = item.types.map(typePath => [code, JSON.stringify(typePath), unitPrice, qty, qty, "", JSON.stringify([]), date, ""]);
        const moreInfo = [[shopName, [[code, [["DEF_COLOR", [["DEF_SIZE", variants]]]]]]]];
        const response = await api("save", { method: "POST", body: { resource: "products", data: { name: item.name.trim(), code, type: JSON.stringify(item.types), barcode: "", at_shop: shopId(shop), quantity: qty, cost: unitCost, tax: 0, price: unitPrice, include_tax: 1, price_change: item.price_change, more_info: JSON.stringify(moreInfo), images: item.images || "", description: item.description, service: 0, default_quantity: item.default_quantity, active: item.active } } });
        const saved = response.item || {}; if (!saved.id) throw new Error(`Could not confirm the new product ID for ${item.name}.`);
        created.push(saved); links.push([saved.id, 1, date, date, date]); docItems.push([saved.id, code, "Barcode", item.name.trim(), "Color", "Size", unitCost, qty, unitPrice, 0, JSON.stringify(moreInfo)]);
      }
      await api("save", { method: "POST", body: { resource: "shops", id: shop.Shop_Id ?? shop.Shop_id, data: { Shop_items: JSON.stringify(links) } } }); shop.Shop_items = JSON.stringify(links);
      const userName = state.user?.User_name || state.user?.name || ""; const payments = []; let paymentId = 0;
      [["CREDITSTOCK", credit], ["CASHSTOCK", cash], ["CARDSTOCK", card]].forEach(([method, amount]) => { if (amount > 0) payments.push([paymentId++, method, amount, date, date, userName, 1, "", method]); });
      await api("save", { method: "POST", body: { resource: "sales", data: { doc_barcode: docBarcode, extension_barcode: "", At_Shop_Id: shopId(shop), user_id: userName, customer_id: "", Seller_id: "", type: "Stocked_Items", item: JSON.stringify(docItems), qty: totals.qty, price: totals.price, Profite: totals.price - totals.cost, discount: 0, tax: 0, payments: JSON.stringify(payments), pid: "", doc_created_date: date, doc_expire_date: date, doc_updated_date: date } } });
      $("#product-bulk-items")?.replaceChildren(); $("#bulk-cash") && ($("#bulk-cash").value = "0"); $("#bulk-card") && ($("#bulk-card").value = "0");
      toggleBulkPanel(false); await window.HiperApp.refreshWorkspace(); showToast(`${created.length} products processed and stock document saved.`);
    } catch (error) { showToast(`${error.message} ${created.length} product(s) were saved before the error.`, true); }
  }
  function priceTags() {
    const items = filteredProducts(); const popup = window.open("", "_blank", "width=800,height=600"); if (!popup) return showToast("Allow the browser to open the price tag sheet.", true);
    popup.document.write(`<!doctype html><html><head><title>Product Price Tags</title><style>body{font:14px Arial;padding:15px}.tags{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.tag{border:1px dashed #444;padding:12px;min-height:90px}.name{font-weight:bold}.price{font-size:20px;margin-top:16px}@media print{button{display:none}}</style></head><body><button onclick="print()">Print price tags</button><div class="tags">${items.map(item => `<div class="tag"><div class="name">${String(item.name || "").replace(/[<>&]/g, "")}</div><div>${String(item.code || item.barcode || "").replace(/[<>&]/g, "")}</div><div class="price">${formatMoney(item.price, item.at_shop)}</div></div>`).join("")}</div></body></html>`); popup.document.close();
  }
  function bindEvents() {
    const today = new Date().toISOString().slice(0, 10); if ($("#product-date-from")) $("#product-date-from").value ||= today; if ($("#product-date-to")) $("#product-date-to").value ||= today;
    document.querySelectorAll("[data-product-tab]").forEach(button => button.addEventListener("click", () => {
      const tab = button.dataset.productTab;
      document.querySelectorAll("[data-product-tab]").forEach(item => { const active = item === button; item.classList.toggle("active", active); item.setAttribute("aria-selected", String(active)); });
      document.querySelectorAll(".product-main-panel").forEach(panel => panel.classList.toggle("hidden", panel.id !== `panel-products-${tab}`));
      renderProducts();
    }));
    document.querySelectorAll("[data-product-report-tab]").forEach(button => button.addEventListener("click", () => {
      document.querySelectorAll("[data-product-report-tab]").forEach(item => { const active = item === button; item.classList.toggle("active", active); item.setAttribute("aria-selected", String(active)); });
      document.querySelectorAll(".product-report-panel").forEach(panel => panel.classList.toggle("hidden", panel.id !== `panel-product-${button.dataset.productReportTab}`)); renderOutOfStocks();
    }));
    $('[data-search="products"]')?.addEventListener("input", () => { currentProductLimit = 20; renderProducts(); });
    $("#product-shop-filter")?.addEventListener("change", () => { currentProductLimit = 20; selectedCategoryPath = []; initializeFilters(); expandedCategoryPaths = new Set(); treeInitialized = false; renderProducts(); }); $("#product-category-clear")?.addEventListener("click", () => { currentProductLimit = 20; selectedCategoryPath = []; renderProducts(); });
    $("#product-price-filter")?.addEventListener("click", () => { const query = $('[data-search="products"]')?.value.trim() || ""; priceFilter = priceFilter ? "" : query; if (priceFilter) costFilter = ""; $("#product-price-filter").classList.toggle("button-primary", !!priceFilter); currentProductLimit = 20; renderProducts(); });
    $("#product-cost-filter")?.addEventListener("click", () => { const query = $('[data-search="products"]')?.value.trim() || ""; costFilter = costFilter ? "" : query; if (costFilter) priceFilter = ""; $("#product-cost-filter").classList.toggle("button-primary", !!costFilter); currentProductLimit = 20; renderProducts(); });
    $("#product-refresh")?.addEventListener("click", async () => { try { state.products = (await api("list", { query: { resource: "products" } })).items || []; currentProductLimit = 20; await window.HiperApp.loadWorkspace(); } catch (error) { showToast(error.message, true); } });
    $("#product-price-tag")?.addEventListener("click", priceTags);
    $("#product-bulk-toggle")?.addEventListener("click", () => toggleBulkPanel());
    $("#product-bulk-add-item")?.addEventListener("click", () => createBulkCard());
    $("#product-bulk-cancel")?.addEventListener("click", () => toggleBulkPanel(false));
    $("#product-bulk-close")?.addEventListener("click", () => toggleBulkPanel(false));
    $("#product-bulk-process")?.addEventListener("click", bulkAdd);
    $("#bulk-cash")?.addEventListener("input", updateBulkSummary); $("#bulk-card")?.addEventListener("input", updateBulkSummary);
    $("#product-report-mode")?.addEventListener("change", renderProducts); $("#product-report-refresh")?.addEventListener("click", renderProducts);
    $("#product-date-from")?.addEventListener("change", renderProducts); $("#product-date-to")?.addEventListener("change", renderProducts);
    $("#product-out-stock-search-button")?.addEventListener("click", renderOutOfStocks); $("#product-out-stock-search")?.addEventListener("input", renderOutOfStocks); $("#product-out-stock-date")?.addEventListener("change", renderOutOfStocks); $("#product-out-stock-refresh")?.addEventListener("click", renderProducts);
    $("#product-out-stock-print")?.addEventListener("click", () => { const rows = outOfStockRows(); const popup = window.open("", "_blank", "width=900,height=650"); if (!popup) return showToast("Allow the browser to open the print view.", true); popup.document.write(`<title>Out Of Stocks</title><style>body{font:14px Arial;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #aaa;padding:7px;text-align:left}</style><h2>Out Of Stocks</h2><table><thead><tr><th>Product</th><th>Code</th><th>Color</th><th>Size</th><th>Barcode</th><th>Qty</th></tr></thead><tbody>${rows.map(({item,color,size,barcode,qty}) => `<tr><td>${String(item.name||"")}</td><td>${String(item.code||"")}</td><td>${color}</td><td>${size}</td><td>${barcode}</td><td>${qty}</td></tr>`).join("")}</tbody></table><script>window.print()<\/script>`); popup.document.close(); });
    $("#product-balance-stock")?.addEventListener("click", async () => { const negatives = outOfStockRows(); if (!negatives.length) return showToast("No negative stock to balance."); if (!window.confirm(`Balance ${negatives.length} negative stock variant(s) by reducing matching stock?`)) return;
      try { const changed = new Map(); (state.products || []).forEach(item => { let data = []; try { data = JSON.parse(item.more_info || "[]"); } catch {} changed.set(idOf(item), { item, data, leaves: variantLeaves(data), shortages: [] }); });
        changed.forEach(({item, leaves, shortages}) => leaves.forEach(({values}) => { const qtyIndex = 4; const qty = Number(values[qtyIndex]); if (qty < 0) { shortages.push({ left: Math.abs(qty), price: Number(item.price) || 0, cost: Number(item.cost) || 0 }); values[qtyIndex] = 0; } }));
        for (let pass = 0; pass < 4; pass++) changed.forEach(({shortages}) => shortages.forEach(shortage => { if (shortage.left <= 0) return; changed.forEach(({item, leaves}) => { if (shortage.left <= 0 || (Number(item.price) || 0) !== shortage.price) return; const cost = Number(item.cost) || 0; if (cost < shortage.cost * .5 || cost > shortage.cost * 1.5) return; leaves.forEach(({values}) => { const qtyIndex = 4; const available = Number(values[qtyIndex]) || 0; if (shortage.left <= 0 || available <= 0) return; const shift = Math.min(available, shortage.left); values[qtyIndex] = available - shift; shortage.left -= shift; }); }); }));
        for (const [id, {item,data}] of changed) { const serialized = JSON.stringify(data); if (serialized === (item.more_info || "[]")) continue; await api("save", { method: "POST", body: { resource: "products", id, data: { more_info: serialized, quantity: productQuantity({ ...item, more_info: serialized }) } } }); }
        await window.HiperApp.refreshWorkspace(); renderProducts(); showToast("Stock balanced; matching stock was reduced where available.");
      } catch (error) { showToast(error.message, true); }
    });
    $("#product-edit-selected")?.addEventListener("click", () => { const item = (state.products || []).find(product => idOf(product) === selectedId); if (item) window.HiperApp?.openRecordDialog("products", item); }); $("#product-delete-selected")?.addEventListener("click", deleteSelected);
    $("#products-body")?.addEventListener("click", event => { if (event.target.closest("input, select, button")) return; const row = event.target.closest("[data-product-id]"); if (!row) return; selectedId = row.dataset.productId; renderProducts(); });
  }
  return { renderProducts, bindEvents };
})();
