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
    state.editing = { resource, id: item?.id ?? item?.User_id ?? item?.Shop_Id ?? null };
    if ($("#record-title")) $("#record-title").textContent = `${item ? "Edit" : "Add"} ${resource.slice(0, -1)}`;
    const container = $("#record-fields");
    if (!container) return;
    container.replaceChildren();
    if (resource === "products") {
      renderProductRecordDialog(item, container);
      setMessage($("#record-message"), "");
      const dialog = $("#record-dialog");
      if (dialog) {
        if (typeof dialog.showModal === "function") {
          try { dialog.showModal(); } catch { dialog.setAttribute("open", ""); }
        } else {
          dialog.setAttribute("open", "");
        }
      }
      return;
    }
    if (!isManager()) {
      showToast("Manager access required.", true);
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
    const definitions = [["main", "📝 Main info"], ["stock", "📦 Stock"], ["docs", "📄 Doc info"]];
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
      if (options.list) input.setAttribute("list", options.list);
      wrapper.append(input); parent.append(wrapper); return input;
    };

    const shops = state.shops || []; const shopValue = String(item?.at_shop ?? state.activeShop?.Shop_Id ?? shops[0]?.Shop_Id ?? "");

    // 1. MAIN INFO TAB
    const main = paneMap.main; main.classList.add("form-grid");

    // Add Name Suggestions Datalist
    let datalist = document.getElementById("product-name-suggestions");
    if (!datalist) {
      datalist = document.createElement("datalist");
      datalist.id = "product-name-suggestions";
      document.body.append(datalist);
    }
    const uniqueNames = [...new Set((state.products || []).map(p => p.name).filter(Boolean))];
    datalist.replaceChildren(...uniqueNames.map(name => new Option(name, name)));

    field(main, "name", "Name", "text", item?.name || "", { required: true, wide: true, list: "product-name-suggestions" });

    // Cost, Mark (Markup), Price, Tax
    const initialCost = Number(item?.cost) || 0;
    const initialPrice = Number(item?.price) || 0;
    const initialMark = initialPrice && initialCost ? initialPrice - initialCost : 0;

    const costInput = field(main, "cost", "Cost", "number", initialCost);
    const markInput = field(main, "mark", "Mark (Markup)", "number", initialMark);
    const priceInput = field(main, "price", "Price", "number", initialPrice, { required: true });
    field(main, "tax", "Tax", "number", item?.tax ?? 0);

    costInput.addEventListener("input", () => {
      const cost = Number(costInput.value) || 0;
      const mark = Number(markInput.value) || 0;
      priceInput.value = String(cost + mark);
    });
    markInput.addEventListener("input", () => {
      const cost = Number(costInput.value) || 0;
      const mark = Number(markInput.value) || 0;
      priceInput.value = String(cost + mark);
    });
    priceInput.addEventListener("input", () => {
      const cost = Number(costInput.value) || 0;
      const price = Number(priceInput.value) || 0;
      markInput.value = String(price - cost);
    });

    field(main, "description", "Description", "textarea", item?.description || "", { wide: true, rows: 3 });
    field(main, "service", "Service", "checkbox", item?.service);
    field(main, "default_quantity", "Default Quantity", "checkbox", item?.default_quantity);
    field(main, "active", "Active", "checkbox", item?.active ?? 1);
    field(main, "include_tax", "Include Tax", "checkbox", item?.include_tax);
    field(main, "price_change", "Price Change", "checkbox", item?.price_change);


    // 2. STOCK TAB
    const stock = paneMap.stock; stock.classList.add("form-grid");

    // AT VERY TOP OF STOCK TAB:
    // 1) Stock Variants Treeview / Table
    // 2) Full Stock Information (Legacy JSON)
    const stockIntro = document.createElement("p"); stockIntro.className = "muted wide"; stockIntro.textContent = "Stock variants treeview & legacy JSON structure at top of Stock tab."; stock.append(stockIntro);

    const stockList = document.createElement("div"); stockList.className = "wide table-scroll"; stock.append(stockList);
    const moreInfo = field(stock, "more_info", "Full Stock Information (Legacy JSON)", "textarea", item?.more_info || "[]", { wide: true, rows: 5 });

    // Product Categories (in Stock Tab)
    const typeShop = shops.find(shop => String(shop.Shop_Id ?? shop.Shop_id ?? shop.Shop_name) === shopValue) || state.activeShop || shops[0];
    let tree = []; try { const decoded = JSON.parse(typeShop?.Shop_Items_type || "[]"); if (Array.isArray(decoded)) tree = decoded; } catch {}
    if (!tree.length) tree = window.HiperProductCategories || [];

    const typeLabel = document.createElement("div"); typeLabel.className = "field wide product-category-picker"; const typeCaption = document.createElement("span"); typeCaption.textContent = "Product categories (Hierarchical)"; typeLabel.append(typeCaption);
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
    typeLabel.append(pathBar, categoryButtons, selectedCategories, typeInput); renderCategoryPicker();

    // Product Image Avatar & Uploader
    const avatarBox = document.createElement("div"); avatarBox.className = "wide product-avatar-box";
    avatarBox.style.cssText = "display:flex;align-items:center;gap:12px;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--panel-raised);";
    const avatarImg = document.createElement("img");
    avatarImg.style.cssText = "width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid var(--line);background:var(--panel);";
    let rawImg = item?.images || item?.image_url || item?.image || "";
    if (Array.isArray(rawImg)) rawImg = rawImg[0] || "";
    avatarImg.src = rawImg || "assets/images/no_Product_Image.jpg";
    avatarImg.onerror = () => { avatarImg.src = ""; avatarImg.alt = "No Image"; };

    const fileInput = document.createElement("input"); fileInput.type = "file"; fileInput.accept = "image/jpeg,image/png,image/webp,image/gif"; fileInput.style.display = "none";
    const uploadBtn = document.createElement("button"); uploadBtn.type = "button"; uploadBtn.className = "button button-secondary"; uploadBtn.textContent = "Change Product Image";
    uploadBtn.addEventListener("click", () => fileInput.click());

    const imagesHidden = document.createElement("input"); imagesHidden.type = "hidden"; imagesHidden.name = "images"; imagesHidden.value = String(rawImg || "");

    fileInput.addEventListener("change", async (event) => {
      const file = event.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          uploadBtn.disabled = true; uploadBtn.textContent = "Uploading…";
          const res = await api("upload", { method: "POST", body: { base64: reader.result } });
          imagesHidden.value = res.file.path; avatarImg.src = res.file.path; showToast("Product image uploaded.");
        } catch (err) { showToast(err.message, true); }
        finally { uploadBtn.disabled = false; uploadBtn.textContent = "Change Product Image"; }
      };
      reader.readAsDataURL(file);
    });
    avatarBox.append(avatarImg, uploadBtn, fileInput, imagesHidden); stock.append(avatarBox);

    // Sizing Form Generator (Trouser Sizes, Clothing Sizes, Shoe Sizes)
    const sizingBox = document.createElement("div"); sizingBox.className = "wide product-sizing-box";
    sizingBox.style.cssText = "padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--panel-raised);display:grid;gap:8px;";
    const sizingHeading = document.createElement("strong"); sizingHeading.textContent = "Multi Sizing Form Generator";
    const sizingRow = document.createElement("div"); sizingRow.style.cssText = "display:flex;gap:10px;align-items:center;flex-wrap:wrap;";
    const sizingSelect = document.createElement("select"); sizingSelect.className = "input";
    sizingSelect.add(new Option("Select Sizing Type", ""));
    ["Trouser Sizes", "Clothing Sizes", "Shoe Sizes"].forEach(opt => sizingSelect.add(new Option(opt, opt)));

    const sizeArea = document.createElement("textarea"); sizeArea.className = "input"; sizeArea.rows = 2; sizeArea.placeholder = "Generated sizes: e.g. M:5, L:10"; sizeArea.style.width = "100%";
    const genBtn = document.createElement("button"); genBtn.type = "button"; genBtn.className = "button button-secondary"; genBtn.textContent = "Generate Sizes";

    sizingSelect.addEventListener("change", () => {
      const val = sizingSelect.value;
      if (val === "Trouser Sizes") sizeArea.value = Array.from({length: 25}, (_, i) => `${i + 21}:0`).join(", ");
      else if (val === "Clothing Sizes") sizeArea.value = ["XS:0", "S:0", "M:0", "L:0", "XL:0", "2XL:0", "3XL:0", "4XL:0", "5XL:0"].join(", ");
      else if (val === "Shoe Sizes") sizeArea.value = Array.from({length: 12}, (_, i) => `${i + 1}:0`).concat(Array.from({length: 15}, (_, i) => `${i + 30}:0`)).join(", ");
    });

    sizingRow.append(sizingSelect, genBtn); sizingBox.append(sizingHeading, sizingRow, sizeArea); stock.append(sizingBox);

    // Variant Entry Controls (matching ProductFullEditionForm tab3_frame)
    const variant = document.createElement("div"); variant.className = "form-grid wide product-variant-entry";
    const currentShopName = typeShop?.Shop_name || "";
    const stockShop = field(variant, "variant_shop", "Shop", "select", currentShopName, { required: true, values: shops.map(shop => ({ value: shop.Shop_name || "", label: shop.Shop_name || "Shop" })) });
    const variantCode = field(variant, "variant_code", "Code", "text", item?.code || "");
    const variantColor = field(variant, "variant_color", "Color", "text", "Default");
    const variantSize = field(variant, "variant_size", "Size", "text", "DEF_SIZE");
    const variantBarcode = field(variant, "variant_barcode", "Barcode", "text", item?.barcode || "");
    variant.append(typeLabel);
    const variantQty = field(variant, "variant_qty", "Quantity", "number", 0);
    const variantPrice = field(variant, "variant_price", "Single Price", "number", item?.price ?? 0);

    const btnRow = document.createElement("div"); btnRow.style.cssText = "grid-column: 1 / -1; display: flex; gap: 8px; flex-wrap: wrap;";
    const variantAdd = document.createElement("button"); variantAdd.type = "button"; variantAdd.className = "button button-primary"; variantAdd.textContent = "Add Variant";
    const variantChange = document.createElement("button"); variantChange.type = "button"; variantChange.className = "button button-secondary"; variantChange.textContent = "Change Selected";
    const variantRemove = document.createElement("button"); variantRemove.type = "button"; variantRemove.className = "button button-danger"; variantRemove.textContent = "Remove Selected";
    const variantClear = document.createElement("button"); variantClear.type = "button"; variantClear.className = "button"; variantClear.textContent = "Clear Selection";
    btnRow.append(variantAdd, variantChange, variantRemove, variantClear); variant.append(btnRow); stock.append(variant);

    let selectedRowPath = null;

    const getNode = (list, name) => { let node = list.find(entry => Array.isArray(entry) && String(entry[0]) === name); if (!node) { node = [name, []]; list.push(node); } return node[1]; };

    const addOrUpdateVariant = (isUpdate = false) => {
      let data; try { data = JSON.parse(moreInfo.value || "[]"); if (!Array.isArray(data)) throw new Error(); } catch { setMessage($("#record-message"), "Stock JSON must be valid before editing variants.", "error"); return; }
      const sName = stockShop.value; const code = variantCode.value.trim() || item?.code || ""; const color = variantColor.value.trim() || "Default"; const size = variantSize.value.trim() || "DEF_SIZE";
      if (!code || !size) { setMessage($("#record-message"), "Enter a product code and size.", "error"); return; }

      const codes = getNode(data, sName); const colors = getNode(codes, code); const sizes = getNode(colors, color); const values = getNode(sizes, size);
      const today = new Date().toISOString().slice(0, 10); const stockType = selectedTypePaths;
      const newEntry = [variantBarcode.value.trim() || code, JSON.stringify(stockType), variantPrice.value || "0", variantQty.value || "0", variantQty.value || "0", "", "", today, ""];

      if (isUpdate && selectedRowPath) {
        values.length = 0;
        values.push(newEntry);
      } else {
        values.push(newEntry);
      }
      moreInfo.value = JSON.stringify(data); drawStock(); setMessage($("#record-message"), "");
    };

    variantAdd.addEventListener("click", () => addOrUpdateVariant(false));
    variantChange.addEventListener("click", () => addOrUpdateVariant(true));

    variantRemove.addEventListener("click", () => {
      if (!selectedRowPath) return showToast("Select a variant row to remove.", true);
      let data; try { data = JSON.parse(moreInfo.value || "[]"); } catch { return; }
      const [sName, code, color, size] = selectedRowPath;
      const codes = data.find(e => e[0] === sName)?.[1];
      const colors = codes?.find(e => e[0] === code)?.[1];
      const sizes = colors?.find(e => e[0] === color)?.[1];
      if (sizes) {
        const idx = sizes.findIndex(e => e[0] === size);
        if (idx !== -1) sizes.splice(idx, 1);
      }
      moreInfo.value = JSON.stringify(data); selectedRowPath = null; drawStock(); showToast("Variant removed.");
    });

    variantClear.addEventListener("click", () => {
      selectedRowPath = null;
      variantColor.value = "Default"; variantSize.value = "DEF_SIZE"; variantQty.value = "0";
      drawStock();
    });

    genBtn.addEventListener("click", () => {
      const text = sizeArea.value.trim(); if (!text) return;
      let data; try { data = JSON.parse(moreInfo.value || "[]"); if (!Array.isArray(data)) throw new Error(); } catch { data = []; }
      const sName = stockShop.value; const code = variantCode.value.trim() || item?.code || "CODE"; const color = variantColor.value.trim() || "Default";
      const pairs = text.split(",").map(s => s.trim().split(":")).filter(p => p.length === 2 && p[1].trim() !== "0");
      if (!pairs.length) return showToast("No non-zero quantities specified in sizes.", true);

      const today = new Date().toISOString().slice(0, 10); const stockType = selectedTypePaths;
      pairs.forEach(([sz, q]) => {
        const codes = getNode(data, sName); const colors = getNode(codes, code); const sizes = getNode(colors, color); const values = getNode(sizes, sz.trim());
        values.push([variantBarcode.value.trim() || code, JSON.stringify(stockType), variantPrice.value || "0", q.trim(), q.trim(), "", "", today, ""]);
      });
      moreInfo.value = JSON.stringify(data); drawStock(); showToast(`${pairs.length} size variant(s) generated.`);
    });

    const drawStock = () => {
      stockList.replaceChildren(); const table = document.createElement("table"); table.innerHTML = "<thead><tr><th>Shop</th><th>Code</th><th>Color</th><th>Size</th><th>Barcode</th><th>Type</th><th>Price</th><th>Initial Qty</th><th>Current Qty</th></tr></thead>";
      const body = document.createElement("tbody"); let parsed = []; try { parsed = JSON.parse(moreInfo.value || "[]"); } catch {}
      const rows = [];
      const flatten = (nodes, path = []) => (nodes || []).forEach(node => {
        if (!Array.isArray(node) || node.length < 2 || !Array.isArray(node[1])) return;
        const children = node[1];
        if (children.length && Array.isArray(children[0]) && children[0].length === 2 && Array.isArray(children[0][1])) flatten(children, [...path, node[0]]);
        else children.forEach(value => { if (Array.isArray(value)) rows.push([...path, node[0], value]); });
      });
      flatten(parsed);

      rows.forEach(rowData => {
        const value = rowData[rowData.length - 1]; const row = document.createElement("tr"); row.style.cursor = "pointer";
        const pathKey = rowData.slice(0, 4);
        if (selectedRowPath && JSON.stringify(selectedRowPath) === JSON.stringify(pathKey)) row.className = "manager-selected-row";

        row.addEventListener("click", () => {
          selectedRowPath = pathKey;
          stockShop.value = rowData[0] || ""; variantCode.value = rowData[1] || ""; variantColor.value = rowData[2] || ""; variantSize.value = rowData[3] || "";
          variantBarcode.value = value[0] || ""; variantPrice.value = value[2] || "0"; variantQty.value = value[4] || "0";
          drawStock();
        });

        [...rowData.slice(0, -1), value[0] || "", value[1] || "", value[2] || "", value[3] || "", value[4] || ""].forEach(val => { const cell = document.createElement("td"); cell.textContent = String(val ?? ""); row.append(cell); });
        body.append(row);
      });
      if (!rows.length) { const row = document.createElement("tr"); row.innerHTML = '<td colspan="9" class="empty-state">No stock variants recorded.</td>'; body.append(row); }
      table.append(body); stockList.append(table);
    };
    drawStock(); moreInfo.addEventListener("input", drawStock);

    // 3. DOC INFO TAB (Matching ProductFullEditionForm doc_details_frame & perform_doc_search)
    const docs = paneMap.docs;
    const today = new Date().toISOString().slice(0, 10);
    const docToolbar = document.createElement("div"); docToolbar.style.cssText = "display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--panel-raised);";
    const dateFrom = document.createElement("input"); dateFrom.type = "date"; dateFrom.className = "input"; dateFrom.value = today;
    const dateTo = document.createElement("input"); dateTo.type = "date"; dateTo.className = "input"; dateTo.value = today;
    const refreshDocsBtn = document.createElement("button"); refreshDocsBtn.type = "button"; refreshDocsBtn.className = "button button-primary"; refreshDocsBtn.textContent = "Filter Documents";
    const docCountSummary = document.createElement("strong"); docCountSummary.style.marginLeft = "auto";
    docToolbar.append(document.createTextNode("From:"), dateFrom, document.createTextNode("To:"), dateTo, refreshDocsBtn, docCountSummary); docs.append(docToolbar);

    const docTable = document.createElement("div"); docTable.className = "table-scroll"; docs.append(docTable);

    const renderDocHistory = () => {
      docTable.replaceChildren();
      const fromVal = dateFrom.value; const toVal = dateTo.value;
      const matches = (state.sales || []).filter(doc => {
        const dDate = String(doc.doc_created_date || "").slice(0, 10);
        const matchDate = (!fromVal || dDate >= fromVal) && (!toVal || dDate <= toVal);
        const raw = String(doc.item || "");
        const matchProduct = raw.includes(String(item?.id ?? "__new__")) || (item?.code && raw.includes(item.code)) || (item?.name && raw.includes(item.name));
        return matchDate && matchProduct;
      });

      docCountSummary.textContent = `Total Documents: ${matches.length}`;
      const history = document.createElement("table"); history.innerHTML = "<thead><tr><th>Date</th><th>Type</th><th>Barcode</th><th>Quantity</th><th>Total Amount</th></tr></thead>"; const historyBody = document.createElement("tbody");
      matches.forEach(doc => { const row = document.createElement("tr"); [doc.doc_created_date, doc.type, doc.doc_barcode, doc.qty, formatMoney(doc.price, item?.at_shop)].forEach(value => { const cell = document.createElement("td"); cell.textContent = String(value ?? ""); row.append(cell); }); historyBody.append(row); });
      if (!matches.length) { const row = document.createElement("tr"); row.innerHTML = '<td colspan="5" class="empty-state">No linked documents found for this date range.</td>'; historyBody.append(row); }
      history.append(historyBody); docTable.append(history);
    };

    refreshDocsBtn.addEventListener("click", renderDocHistory);
    renderDocHistory();
  }

  function productQuantity(value) {
    let parsed; try { parsed = typeof value === "string" ? JSON.parse(value || "[]") : value; } catch { return 0; }
    let total = 0; const walk = nodes => (nodes || []).forEach(node => { if (!Array.isArray(node)) return; if (node.length === 2 && Array.isArray(node[1])) { const children = node[1]; if (children.length && Array.isArray(children[0]) && children[0].length >= 7 && !Array.isArray(children[0][1])) children.forEach(stock => { const quantity = Number(stock[4]); if (Number.isFinite(quantity)) total += quantity; }); else walk(children); } }); walk(parsed); return total;
  }

  async function saveProductRecord(form) {
    const data = {};
    for (const [key, value] of new FormData(form).entries()) data[key] = value;
    for (const checkbox of form.querySelectorAll('input[type="checkbox"][name]')) data[checkbox.name] = checkbox.checked ? 1 : 0;
    const variantShopName = String(data.variant_shop || "");
    const selectedShop = (state.shops || []).find(shop => String(shop.Shop_name || "") === variantShopName);
    const editingProduct = (state.products || []).find(product => String(product.id) === String(state.editing?.id));
    data.at_shop = selectedShop?.Shop_Id ?? selectedShop?.Shop_id ?? selectedShop?.Shop_name ?? editingProduct?.at_shop ?? state.activeShop?.Shop_Id ?? "";
    data.code = String(data.variant_code || editingProduct?.code || "").trim();
    data.barcode = String(data.variant_barcode || editingProduct?.barcode || "").trim();
    for (const key of ["variant_shop", "variant_code", "variant_color", "variant_size", "variant_barcode", "variant_qty", "variant_price"]) delete data[key];
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
