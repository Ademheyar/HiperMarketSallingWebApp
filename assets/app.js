/**
 * app.js - Master App Orchestrator & View Switcher
 */
window.HiperApp = (() => {
  "use strict";

  const { state, $, $$, api, showToast, setMessage, formatMoney } = window.HiperApi;
  const { isManager, showLogin, signOut, updateAccountUi, restoreSession, login, checkAccess } = window.HiperAuth;

  async function loadWorkspace() {
    updateAccountUi();
    await Promise.all([
      window.HiperHome ? window.HiperHome.loadDashboard() : Promise.resolve(),
      window.HiperApi.api("list", { query: { resource: "products" } }).then(res => state.products = res.items || []),
      window.HiperApi.api("list", { query: { resource: "users" } }).then(res => state.users = res.items || []),
      window.HiperApi.api("list", { query: { resource: "shops" } }).then(res => state.shops = res.items || []),
      window.HiperApi.api("list", { query: { resource: "sales" } }).then(res => state.sales = res.items || []),
      window.HiperApi.api("shop_actions").then(res => state.shopActions = res.items || []),
      window.HiperReports ? window.HiperReports.loadReports() : Promise.resolve()
    ]);

    if (state.activeShop) {
      const activeId = state.activeShop.Shop_Id || state.activeShop.Shop_id || state.activeShop.id;
      const activeName = state.activeShop.Shop_name || state.activeShop.name;
      const refreshedShop = (state.shops || []).find(shop =>
        (activeId && String(shop.Shop_Id || shop.Shop_id || shop.id) === String(activeId)) ||
        (activeName && String(shop.Shop_name || shop.name) === String(activeName))
      );
      if (refreshedShop) state.activeShop = { ...state.activeShop, ...refreshedShop };
    }

    if (window.HiperProducts) window.HiperProducts.renderProducts();
    if (window.HiperCustomers) window.HiperCustomers.renderUsers();
    if (window.HiperDocuments) {
      window.HiperDocuments.renderNotebookTabs();
      window.HiperDocuments.renderSales();
    }
    if (window.HiperTools) {
      window.HiperTools.renderTools();
      window.HiperTools.renderPromotions();
    }
    if (window.HiperShopSettings) {
      window.HiperShopSettings.renderExpenses();
      window.HiperShopSettings.renderMatrix();
      window.HiperShopSettings.renderWorkers();
      window.HiperShopSettings.renderOthers();
    }
    if (window.HiperReports) window.HiperReports.renderReports();
    if (window.HiperPos) {
      window.HiperPos.renderShopOptions();
      if (state.activeView === "pos") window.HiperPos.renderProductSearch($("#pos-search")?.value || "");
    }
    if (window.HiperUserProfile) window.HiperUserProfile.renderProfile();
  }

  async function refreshWorkspace() {
    try {
      await loadWorkspace();
      showToast("Workspace refreshed.");
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function navigate(viewName) {
    if (window.HiperAuth && !window.HiperAuth.checkAccess(viewName)) {
      return;
    }

    const targetView = $(`#view-${viewName}`);
    if (!targetView) return;

    state.activeView = viewName;
    document.body.classList.toggle("pos-mode", viewName === "pos");
    $$(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${viewName}`));
    $$(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.view === viewName));

    const navButton = $(`.nav-link[data-view="${viewName}"]`);
    if ($("#page-title")) $("#page-title").textContent = navButton ? navButton.textContent.trim() : (viewName === "manager" ? "Manager Panel" : "Overview");
    if ($("#page-kicker")) $("#page-kicker").textContent = viewName === "pos" ? "CHECKOUT" : "HIPER MARKET";
    $("#sidebar")?.classList.remove("open");

    if (viewName === "overview" && window.HiperHome) {
      window.HiperHome.initHomeFeed();
    }
    if (viewName === "manager" && window.HiperManager) {
      window.HiperManager.switchManagerTab("sales");
    }
    if (viewName === "pos" && window.HiperPos) {
      window.HiperPos.renderProductSearch($("#pos-search")?.value || "");
    }
    if (viewName === "profile" && window.HiperUserProfile) {
      window.HiperUserProfile.renderProfile();
    }
  }

  const fieldsByResource = {
    products: [
      ["name", "Product name", "text", true], ["code", "Product code"], ["barcode", "Barcode"],
      ["at_shop", "Shop"], ["quantity", "Quantity", "number"], ["cost", "Cost", "number"],
      ["price", "Price", "number", true], ["description", "Description", "textarea", false, true]
    ],
    users: [
      ["User_fname", "First name"], ["User_Lname", "Last name"], ["User_name", "Username", "text", true],
      ["User_gender", "Gender", "gender"], ["User_country", "Country"], ["User_address", "City / address"],
      ["User_home_no", "Home number"], ["User_id_pp_num", "ID / passport number"],
      ["User_phone_num", "Phone"], ["User_email", "Email", "email"], ["User_type", "Role", "role"],
      ["User_password", "Password", "password"], ["User_about", "About", "textarea", false, true],
      ["User_shop", "Customer shops / followed shops"], ["User_work_shop", "Workplace assignments (JSON)", "textarea", false, true],
      ["User_access", "Access level"]
    ],
    shops: [
      ["Shop_name", "Shop name", "text", true], ["Shop_brand_name", "Brand name"], ["Shop_location", "Location"], ["Shop_currency", "Currency", "currency", true]
    ],
    tools: [
      ["name", "Tool Name", "text", true], ["type", "Type"], ["status", "Status"]
    ],
    promotions: [
      ["action_name", "Promotion Name", "text", true], ["discount", "Discount %"], ["status", "Status"]
    ]
  };

  function openRecordDialog(resource, item = null) {
    if (!isManager()) {
      showToast("Manager access required.", true);
      return;
    }
    state.editing = { resource, id: item?.id ?? item?.User_id ?? item?.Shop_Id ?? null };
    if ($("#record-title")) $("#record-title").textContent = `${item ? "Edit" : "Add"} ${resource.slice(0, -1)}`;
    const container = $("#record-fields");
    if (!container) return;
    container.replaceChildren();
    if (resource === "products") {
      renderProductRecordDialog(item, container);
      setMessage($("#record-message"), "");
      $("#record-dialog")?.showModal();
      return;
    }
    for (const [key, label, type = "text", required = false, wide = false] of fieldsByResource[resource] || []) {
      if (resource === "users" && key === "User_password" && item) continue;
      const field = document.createElement("label");
      field.className = `field${wide ? " wide" : ""}`;
      const caption = document.createElement("span");
      caption.textContent = label;
      const input = type === "textarea" ? document.createElement("textarea") : (["currency", "gender", "role"].includes(type) ? document.createElement("select") : document.createElement("input"));
      input.className = "input";
      input.name = key;
      if (type === "currency") {
        input.name = key;
        input.innerHTML = `<option value="ETB">ETB — Ethiopian Birr</option><option value="USD">USD — US Dollar</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — Pound Sterling</option><option value="KES">KES — Kenyan Shilling</option><option value="UGX">UGX — Ugandan Shilling</option><option value="TZS">TZS — Tanzanian Shilling</option><option value="ZAR">ZAR — South African Rand</option><option value="AED">AED — UAE Dirham</option><option value="SAR">SAR — Saudi Riyal</option><option value="INR">INR — Indian Rupee</option><option value="CNY">CNY — Chinese Yuan</option><option value="CAD">CAD — Canadian Dollar</option><option value="AUD">AUD — Australian Dollar</option>`;
        input.value = item?.[key] || "ETB";
      } else if (type === "gender" || type === "role") {
        const options = type === "gender" ? ["MALE", "FEMALE", "Prefer Not to Say"] : ["Customer", "Worker", "Seller", "Supervisor", "Manager", "Admin", "Owner"];
        input.innerHTML = `<option value="">Select ${type === "role" ? "role" : "gender"}</option>` + options.map(value => `<option value="${value}">${value}</option>`).join("");
        if (item?.[key] && !options.includes(String(item[key]))) input.add(new Option(String(item[key]), String(item[key])));
        input.value = item?.[key] || (type === "role" ? "Customer" : "");
      } else if (type === "textarea") {
        input.name = key;
        input.type = "text";
        input.rows = 3;
        input.value = String(item?.[key] ?? "");
      } else {
        input.name = key;
        input.type = type;
        input.value = item?.[key] == null ? "" : String(item[key]);
      }
      input.required = required;
      if (type === "number") input.step = "any";
      field.append(caption, input);
      container.append(field);
    }
    setMessage($("#record-message"), "");
    $("#record-dialog")?.showModal();
  }

  function renderProductRecordDialog(item, container) {
    const tabs = document.createElement("div"); tabs.className = "product-editor-tabs";
    const panes = document.createElement("div"); panes.className = "product-editor-panes";
    const definitions = [["main", "Main info"], ["stock", "Stock"], ["docs", "Doc info"]];
    const paneMap = {};
    definitions.forEach(([key, title], index) => {
      const button = document.createElement("button"); button.type = "button"; button.className = `button product-editor-tab${index === 0 ? " active" : ""}`; button.textContent = title;
      button.addEventListener("click", () => { tabs.querySelectorAll("button").forEach(tab => tab.classList.toggle("active", tab === button)); Object.entries(paneMap).forEach(([name, pane]) => pane.classList.toggle("hidden", name !== key)); });
      tabs.append(button); const pane = document.createElement("section"); pane.className = `product-editor-pane${index ? " hidden" : ""}`; paneMap[key] = pane; panes.append(pane);
    });
    container.append(tabs, panes);
    const field = (parent, key, label, type = "text", value = "", options = {}) => {
      const wrapper = document.createElement("label"); wrapper.className = `field${options.wide ? " wide" : ""}`;
      const caption = document.createElement("span"); caption.textContent = label; wrapper.append(caption);
      const input = type === "textarea" ? document.createElement("textarea") : type === "select" ? document.createElement("select") : document.createElement("input");
      input.className = "input"; input.name = key;
      if (type === "textarea") { input.rows = options.rows || 5; input.value = String(value ?? ""); }
      else if (type === "checkbox") { input.type = "checkbox"; input.checked = Boolean(Number(value)); wrapper.classList.add("tool-flag"); wrapper.append(input); parent.append(wrapper); return input; }
      else if (type === "select") { options.values.forEach(entry => input.add(new Option(entry.label, entry.value))); input.value = String(value ?? ""); }
      else { input.type = type; input.value = String(value ?? ""); if (type === "number") input.step = "any"; }
      if (options.required) input.required = true;
      wrapper.append(input); parent.append(wrapper); return input;
    };
    const main = paneMap.main; main.classList.add("form-grid");
    const shops = state.shops || []; const shopValue = String(item?.at_shop ?? state.activeShop?.Shop_Id ?? shops[0]?.Shop_Id ?? "");
    field(main, "name", "Name", "text", item?.name || "", { required: true }); field(main, "code", "Product code", "text", item?.code || ""); field(main, "barcode", "Barcode", "text", item?.barcode || "");
    field(main, "at_shop", "Shop", "select", shopValue, { required: true, values: shops.map(shop => ({ value: shop.Shop_Id ?? shop.Shop_id ?? shop.Shop_name, label: shop.Shop_name || shop.Shop_brand_name || String(shop.Shop_Id) })) });
    field(main, "cost", "Cost", "number", item?.cost ?? 0); field(main, "tax", "Tax", "number", item?.tax ?? 0); field(main, "price", "Price", "number", item?.price ?? 0, { required: true });
    field(main, "description", "Description", "textarea", item?.description || "", { wide: true, rows: 3 });
    field(main, "service", "Service", "checkbox", item?.service); field(main, "default_quantity", "Default Quantity", "checkbox", item?.default_quantity); field(main, "active", "Active", "checkbox", item?.active ?? 1); field(main, "include_tax", "Include Tax", "checkbox", item?.include_tax); field(main, "price_change", "Price Change", "checkbox", item?.price_change);
    const typeShop = shops.find(shop => String(shop.Shop_Id ?? shop.Shop_id ?? shop.Shop_name) === shopValue) || state.activeShop || shops[0];
    let tree = []; try { const decoded = JSON.parse(typeShop?.Shop_Items_type || "[]"); if (Array.isArray(decoded)) tree = decoded; } catch {}
    if (!tree.length) tree = window.HiperProductCategories || [];
    const typeLabel = document.createElement("div"); typeLabel.className = "field wide product-category-picker"; const typeCaption = document.createElement("span"); typeCaption.textContent = "Product categories"; typeLabel.append(typeCaption);
    const typeInput = document.createElement("input"); typeInput.type = "hidden"; typeInput.name = "type";
    let selectedTypePaths = []; try { selectedTypePaths = JSON.parse(item?.type || "[]"); if (!Array.isArray(selectedTypePaths)) selectedTypePaths = []; selectedTypePaths = selectedTypePaths.filter(Array.isArray); } catch {}
    let categoryPath = [];
    const pathBar = document.createElement("div"); pathBar.className = "product-category-path";
    const categoryButtons = document.createElement("div"); categoryButtons.className = "product-category-options";
    const selectedCategories = document.createElement("div"); selectedCategories.className = "product-category-selected";
    const getCategoryList = path => { let list = tree; for (const name of path) { const node = (list || []).find(entry => Array.isArray(entry) && String(entry[0]) === name); list = Array.isArray(node?.[1]) ? node[1] : []; } return list || []; };
    const renderCategoryPicker = () => {
      pathBar.replaceChildren(); const rootButton = document.createElement("button"); rootButton.type = "button"; rootButton.className = "text-button"; rootButton.textContent = "All categories"; rootButton.addEventListener("click", () => { categoryPath = []; renderCategoryPicker(); }); pathBar.append(rootButton);
      categoryPath.forEach((part, index) => { const separator = document.createElement("span"); separator.textContent = "›"; pathBar.append(separator); const crumb = document.createElement("button"); crumb.type = "button"; crumb.className = "text-button"; crumb.textContent = part; crumb.addEventListener("click", () => { categoryPath = categoryPath.slice(0, index + 1); renderCategoryPicker(); }); pathBar.append(crumb); });
      if (categoryPath.length) { const chooseCurrent = document.createElement("button"); chooseCurrent.type = "button"; chooseCurrent.className = "button button-primary"; chooseCurrent.textContent = "Select this path"; chooseCurrent.addEventListener("click", () => selectCategoryPath(categoryPath)); pathBar.append(chooseCurrent); }
      categoryButtons.replaceChildren(); const list = getCategoryList(categoryPath);
      if (categoryPath.length) { const back = document.createElement("button"); back.type = "button"; back.className = "button product-category-option"; back.textContent = "‹ Back"; back.addEventListener("click", () => { categoryPath.pop(); renderCategoryPicker(); }); categoryButtons.append(back); }
      if (!list.length) { const empty = document.createElement("span"); empty.className = "muted"; empty.textContent = "No subcategories in this path."; categoryButtons.append(empty); }
      list.forEach(node => { const button = document.createElement("button"); button.type = "button"; button.className = "button product-category-option"; button.textContent = `${node[0]}${node[1]?.length ? "  ›" : ""}`; button.addEventListener("click", () => { const next = [...categoryPath, String(node[0])]; if (node[1]?.length) { categoryPath = next; renderCategoryPicker(); } else selectCategoryPath(next); }); categoryButtons.append(button); });
      selectedCategories.replaceChildren(); if (!selectedTypePaths.length) { const empty = document.createElement("span"); empty.className = "muted"; empty.textContent = "No category selected"; selectedCategories.append(empty); }
      selectedTypePaths.forEach((selectedPath, index) => { const chip = document.createElement("span"); chip.className = "product-category-chip"; chip.textContent = selectedPath.join(" › "); const remove = document.createElement("button"); remove.type = "button"; remove.setAttribute("aria-label", `Remove ${chip.textContent}`); remove.textContent = "×"; remove.addEventListener("click", () => { selectedTypePaths.splice(index, 1); syncSelectedCategories(); renderCategoryPicker(); }); chip.append(remove); selectedCategories.append(chip); });
      typeInput.value = JSON.stringify(selectedTypePaths);
    };
    const syncSelectedCategories = () => { typeInput.value = JSON.stringify(selectedTypePaths); };
    const selectCategoryPath = path => { if (!selectedTypePaths.some(selected => JSON.stringify(selected) === JSON.stringify(path))) selectedTypePaths.push([...path]); syncSelectedCategories(); renderCategoryPicker(); };
    typeLabel.append(pathBar, categoryButtons, selectedCategories, typeInput); main.append(typeLabel); renderCategoryPicker();

    const stock = paneMap.stock; stock.classList.add("form-grid");
    const stockIntro = document.createElement("p"); stockIntro.className = "muted wide"; stockIntro.textContent = "Stock variants use the same nested shop → code → color → size → stock values structure as ProductEdtion.py. You can add rows here or edit the full legacy JSON."; stock.append(stockIntro);
    const variant = document.createElement("div"); variant.className = "form-grid wide product-variant-entry";
    const currentShopName = typeShop?.Shop_name || "";
    const stockShop = field(variant, "variant_shop", "Shop", "select", currentShopName, { values: shops.map(shop => ({ value: shop.Shop_name || "", label: shop.Shop_name || "Shop" })) });
    const variantCode = field(variant, "variant_code", "Code", "text", item?.code || ""); const variantColor = field(variant, "variant_color", "Color"); const variantSize = field(variant, "variant_size", "Size");
    const variantBarcode = field(variant, "variant_barcode", "Barcode"); const variantQty = field(variant, "variant_qty", "Quantity", "number", 0); const variantPrice = field(variant, "variant_price", "Single Price", "number", item?.price ?? 0);
    const variantAdd = document.createElement("button"); variantAdd.type = "button"; variantAdd.className = "button button-primary"; variantAdd.textContent = "Add Stock Variant"; variant.append(variantAdd); stock.append(variant);
    const moreInfo = field(stock, "more_info", "Full stock information (legacy JSON)", "textarea", item?.more_info || "[]", { wide: true, rows: 7 });
    const stockList = document.createElement("div"); stockList.className = "wide table-scroll"; stock.append(stockList);
    const drawStock = () => {
      stockList.replaceChildren(); const table = document.createElement("table"); table.innerHTML = "<thead><tr><th>Shop</th><th>Code</th><th>Color</th><th>Size</th><th>Barcode</th><th>Type</th><th>Price</th><th>Initial Qty</th><th>Current Qty</th></tr></thead>";
      const body = document.createElement("tbody"); let parsed = []; try { parsed = JSON.parse(moreInfo.value || "[]"); } catch {}
      const rows = []; const recurse = nodes => (nodes || []).forEach(node => { if (!Array.isArray(node)) return; if (node.length === 2 && Array.isArray(node[1])) { if (node[1].length && node[1][0]?.length === 2 && Array.isArray(node[1][0][1])) { recurse(node[1]); } else recurse(node[1]); } });
      const flatten = (nodes, path = []) => (nodes || []).forEach(node => { if (!Array.isArray(node) || node.length < 2 || !Array.isArray(node[1])) return; const children = node[1]; if (children.length && Array.isArray(children[0]) && children[0].length === 2 && Array.isArray(children[0][1])) flatten(children, [...path, node[0]]); else children.forEach(value => { if (Array.isArray(value)) rows.push([...path, node[0], value]); }); });
      flatten(parsed);
      rows.forEach(rowData => { const value = rowData[rowData.length - 1]; const row = document.createElement("tr"); [...rowData.slice(0, -1), value[0] || "", value[1] || "", value[2] || "", value[3] || "", value[4] || ""].forEach(value => { const cell = document.createElement("td"); cell.textContent = String(value ?? ""); row.append(cell); }); body.append(row); });
      if (!rows.length) { const row = document.createElement("tr"); row.innerHTML = '<td colspan="9" class="empty-state">No stock variants recorded.</td>'; body.append(row); }
      table.append(body); stockList.append(table);
    };
    drawStock(); moreInfo.addEventListener("input", drawStock);
    variantAdd.addEventListener("click", () => {
      let data; try { data = JSON.parse(moreInfo.value || "[]"); if (!Array.isArray(data)) throw new Error(); } catch { setMessage($("#record-message"), "Stock information must be valid JSON before adding a variant.", "error"); return; }
      const shopName = stockShop.value; const code = variantCode.value.trim() || item?.code || ""; const color = variantColor.value.trim(); const size = variantSize.value.trim();
      if (!code || !size) { setMessage($("#record-message"), "Enter a product code and size for this stock variant.", "error"); return; }
      const getNode = (list, name) => { let node = list.find(entry => Array.isArray(entry) && String(entry[0]) === name); if (!node) { node = [name, []]; list.push(node); } return node[1]; };
      const codes = getNode(data, shopName); const colors = getNode(codes, code); const sizes = getNode(colors, color || "Default"); const values = getNode(sizes, size);
      const today = new Date().toISOString().slice(0, 10); const stockType = selectedTypePaths;
      values.push([variantBarcode.value.trim() || code, JSON.stringify(stockType), variantPrice.value || "0", variantQty.value || "0", variantQty.value || "0", "", "", today, ""]);
      moreInfo.value = JSON.stringify(data); drawStock(); setMessage($("#record-message"), "");
    });

    const docs = paneMap.docs; const summary = document.createElement("div"); summary.className = "panel"; summary.innerHTML = `<h3>Product document history</h3><p class="muted">Stocked, restocked, sold, and updated documents linked to this product.</p>`; docs.append(summary);
    const docTable = document.createElement("div"); docTable.className = "table-scroll"; docs.append(docTable);
    const matches = (state.sales || []).filter(doc => { const raw = String(doc.item || ""); return raw.includes(String(item?.id ?? "__new__")) || (item?.code && raw.includes(item.code)); });
    const history = document.createElement("table"); history.innerHTML = "<thead><tr><th>Date</th><th>Type</th><th>Document</th><th>Quantity</th><th>Amount</th></tr></thead>"; const historyBody = document.createElement("tbody");
    matches.forEach(doc => { const row = document.createElement("tr"); [doc.doc_created_date, doc.type, doc.doc_barcode, doc.qty, formatMoney(doc.price, item?.at_shop)].forEach(value => { const cell = document.createElement("td"); cell.textContent = String(value ?? ""); row.append(cell); }); historyBody.append(row); });
    if (!matches.length) { const row = document.createElement("tr"); row.innerHTML = '<td colspan="5" class="empty-state">No linked documents found.</td>'; historyBody.append(row); } history.append(historyBody); docTable.append(history);
  }

  function productQuantity(value) {
    let parsed; try { parsed = typeof value === "string" ? JSON.parse(value || "[]") : value; } catch { return 0; }
    let total = 0; const walk = nodes => (nodes || []).forEach(node => { if (!Array.isArray(node)) return; if (node.length === 2 && Array.isArray(node[1])) { const children = node[1]; if (children.length && Array.isArray(children[0]) && children[0].length >= 7 && !Array.isArray(children[0][1])) children.forEach(stock => { const quantity = Number(stock[4]); if (Number.isFinite(quantity)) total += quantity; }); else walk(children); } }); walk(parsed); return total;
  }

  async function saveProductRecord(form) {
    const data = {};
    for (const [key, value] of new FormData(form).entries()) data[key] = value;
    for (const checkbox of form.querySelectorAll('input[type="checkbox"][name]')) data[checkbox.name] = checkbox.checked ? 1 : 0;
    let selectedTypes = []; try { selectedTypes = JSON.parse(form.querySelector('[name="type"]')?.value || "[]"); } catch {} data.type = JSON.stringify(selectedTypes);
    let more; try { more = JSON.parse(data.more_info || "[]"); if (!Array.isArray(more)) throw new Error(); } catch { throw new Error("Stock information must be valid JSON."); }
    data.more_info = JSON.stringify(more); data.quantity = productQuantity(data.more_info);
    for (const key of ["cost", "tax", "price", "quantity"]) data[key] = Number(data[key] || 0);
    const result = await api("save", { method: "POST", body: { resource: "products", id: state.editing.id, data } });
    const saved = result.item || { ...data, id: state.editing.id || Date.now() };
    if (!state.editing.id) {
      const shop = (state.shops || []).find(entry => String(entry.Shop_Id ?? entry.Shop_id ?? entry.Shop_name) === String(data.at_shop));
      if (shop) {
        let shopItems = []; try { shopItems = JSON.parse(shop.Shop_items || "[]"); } catch {}
        shopItems.push([saved.id, 1, new Date().toISOString(), new Date().toISOString(), new Date().toISOString()]);
        await api("save", { method: "POST", body: { resource: "shops", id: shop.Shop_Id ?? shop.Shop_id, data: { Shop_items: JSON.stringify(shopItems) } } });
      }
    }
  }

  async function saveRecord(event) {
    event.preventDefault();
    if (!state.editing) return;
    const form = event.currentTarget;
    const saveButton = form.querySelector('[type="submit"]');
    if (saveButton) saveButton.disabled = true;
    try {
      if (state.editing.resource === "products") {
        await saveProductRecord(form);
        $("#record-dialog")?.close(); showToast("Product saved."); await refreshWorkspace(); return;
      }
      const data = {};
      for (const [key, value] of new FormData(form).entries()) {
        if (value === "" && state.editing.resource !== "users") continue;
        const field = fieldsByResource[state.editing.resource]?.find((entry) => entry[0] === key);
        data[key] = field?.[2] === "number" ? Number(value) : value;
      }
      await api("save", {
        method: "POST",
        body: { resource: state.editing.resource, id: state.editing.id, data },
      });
      $("#record-dialog")?.close();
      showToast("Record saved.");
      await refreshWorkspace();
    } catch (error) {
      setMessage($("#record-message"), error.message, "error");
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  }

  function bindEvents() {
    $$(".nav-link").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.view)));
    $$("[data-open-view]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.view)));
    $$("[data-add]").forEach((button) => button.addEventListener("click", () => openRecordDialog(button.dataset.add)));
    $$("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog")?.close()));

    $("#login-form")?.addEventListener("submit", login);
    $("#open-register-btn")?.addEventListener("click", () => window.HiperAuth && window.HiperAuth.showRegister());
    $("#open-forgot-btn")?.addEventListener("click", () => window.HiperAuth && window.HiperAuth.showForgotPassword());
    $("#register-form")?.addEventListener("submit", (e) => window.HiperAuth && window.HiperAuth.registerUser(e));
    $("#btn-find-account")?.addEventListener("click", () => window.HiperAuth && window.HiperAuth.findUserForReset());
    $("#forgot-password-form")?.addEventListener("submit", (e) => window.HiperAuth && window.HiperAuth.resetPassword(e));
    $("#record-form")?.addEventListener("submit", saveRecord);

    $("#pos-search")?.addEventListener("input", (event) => window.HiperPos && window.HiperPos.renderProductSearch(event.target.value));
    $("#complete-sale")?.addEventListener("click", () => window.HiperPos && window.HiperPos.openPaymentDialog());
    $("#clear-cart")?.addEventListener("click", () => window.HiperPos && window.HiperPos.clearCart());

    $("#open-login-btn")?.addEventListener("click", showLogin);
    $("#topbar-shop-name")?.addEventListener("click", () => window.HiperAuth && window.HiperAuth.showShopSelector());
    $("#btn-open-create-shop")?.addEventListener("click", () => {
      $("#select-shop-dialog")?.close();
      openRecordDialog("shops");
    });
    $("#profile-signout-btn")?.addEventListener("click", () => {
      if (state.user) {
        signOut();
      } else {
        showLogin();
      }
    });

    $("#retry-health")?.addEventListener("click", () => window.HiperApi.checkHealth());
    $("#refresh-data")?.addEventListener("click", refreshWorkspace);
    $("#logout-button")?.addEventListener("click", () => signOut());
    $("#settings-logout")?.addEventListener("click", () => signOut());
    function toggleSidebar() {
      const sidebar = $("#sidebar");
      if (!sidebar) return;
      sidebar.classList.toggle("collapsed");
      document.body.classList.toggle("sidebar-collapsed", sidebar.classList.contains("collapsed"));
      localStorage.setItem("hiper_sidebar_collapsed", sidebar.classList.contains("collapsed") ? "true" : "false");
    }

    $("#menu-toggle")?.addEventListener("click", toggleSidebar);
    $("#sidebar-toggle-btn")?.addEventListener("click", toggleSidebar);

    // Restore sidebar collapse state
    if (localStorage.getItem("hiper_sidebar_collapsed") === "true") {
      $("#sidebar")?.classList.add("collapsed");
      document.body.classList.add("sidebar-collapsed");
    }
    $("#print-receipt")?.addEventListener("click", () => window.print());

    if (window.HiperPos) window.HiperPos.bindPosShopEvents();
    if (window.HiperUserProfile) window.HiperUserProfile.bindProfileEvents();
    if (window.HiperDocuments) window.HiperDocuments.bindDocEvents();
    if (window.HiperShopSettings) window.HiperShopSettings.bindShopSettingsEvents();
    if (window.HiperAppSettings) window.HiperAppSettings.bindAppSettingsEvents();
    if (window.HiperGetValue) window.HiperGetValue.bindKeypadEvents();
    if (window.HiperManager) window.HiperManager.bindManagerEvents();
    if (window.HiperTools) window.HiperTools.bindEvents();
    if (window.HiperCustomers) window.HiperCustomers.bindEvents();
    if (window.HiperProducts) window.HiperProducts.bindEvents();
  }

  function init() {
    bindEvents();
    if (window.HiperPos) window.HiperPos.renderCart();
    window.HiperApi.checkHealth();
    restoreSession();
  }

  return {
    init,
    loadWorkspace,
    refreshWorkspace,
    openRecordDialog,
    navigate
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  window.HiperApp.init();
});
