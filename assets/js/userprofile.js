/**
 * userprofile.js - User Profile Card Module (#view-profile)
 */
window.HiperUserProfile = (() => {
  "use strict";

  const { state, $, $$ } = window.HiperApi;

  function renderProfile() {
    const userName = state.user?.User_name || "admin";
    const userRole = state.user?.User_type || "Admin";
    const fullName = [state.user?.User_fname, state.user?.User_Lname].filter(Boolean).join(" ") || "System Admin";
    const activeShopObj = state.activeShop || (state.shops?.[0] || null);
    const shopName = activeShopObj?.Shop_name || activeShopObj?.name || state.user?.User_shop || (state.shops?.[0]?.Shop_name || "Main Shop");

    if ($("#prof-handle")) $("#prof-handle").textContent = "@" + userName;
    if ($("#prof-full-name")) $("#prof-full-name").textContent = fullName;
    if ($("#prof-role")) $("#prof-role").textContent = userRole;
    if ($("#prof-shop")) $("#prof-shop").textContent = shopName;
    if ($("#prof-email")) $("#prof-email").textContent = state.user?.User_email || "admin@hipermarket.com";
    if ($("#prof-location")) $("#prof-location").textContent = state.user?.User_country || "Ethiopia";
    if ($("#prof-avatar")) $("#prof-avatar").textContent = userName.slice(0, 1).toUpperCase() || "A";

    renderBusinessTab();
  }

  function renderBusinessTab() {
    $$(".profile-tab.active").forEach(tab => tab.classList.remove("active"));
    $("#ptab-business")?.classList.add("active");

    const content = $("#prof-tab-content");
    if (!content) return;
    content.replaceChildren();

    const workShops = window.HiperAuth ? window.HiperAuth.getUserWorkShops() : [];

    // Title Header
    const titleHeader = document.createElement("div");
    titleHeader.className = "section-toolbar margin-top-sm";
    const title = document.createElement("h3");
    title.style.display = "flex";
    title.style.alignItems = "center";
    title.style.gap = "8px";
    title.style.fontSize = "16px";
    title.style.fontWeight = "700";
    title.innerHTML = `<span>🧰</span> <strong>Business &amp; Shop Management</strong>`;
    titleHeader.append(title);
    content.append(titleHeader);

    // Control Panel Card ("Your Working Shops" | [Request Shop] [Create Shop])
    const controlPanel = document.createElement("div");
    controlPanel.className = "panel margin-top-sm";
    controlPanel.style.display = "flex";
    controlPanel.style.justifyContent = "space-between";
    controlPanel.style.alignItems = "center";
    controlPanel.style.flexWrap = "wrap";
    controlPanel.style.padding = "16px 20px";

    const leftHeading = document.createElement("strong");
    leftHeading.textContent = "Your Working Shops";
    leftHeading.style.fontSize = "15px";

    const actionBtns = document.createElement("div");
    actionBtns.style.display = "flex";
    actionBtns.style.gap = "10px";

    const btnRequestShop = document.createElement("button");
    btnRequestShop.className = "button button-secondary";
    btnRequestShop.textContent = "Request Shop";
    btnRequestShop.type = "button";

    const btnCreateShop = document.createElement("button");
    btnCreateShop.className = "button button-secondary";
    btnCreateShop.textContent = "Create Shop";
    btnCreateShop.type = "button";
    btnCreateShop.addEventListener("click", () => {
      if (window.HiperApp) window.HiperApp.openRecordDialog("shops");
    });

    actionBtns.append(btnRequestShop, btnCreateShop);
    controlPanel.append(leftHeading, actionBtns);
    content.append(controlPanel);

    // Inline Search Drawer Panel (toggled when Request Shop is clicked)
    const searchDrawer = document.createElement("div");
    searchDrawer.className = "panel margin-top-sm hidden";
    searchDrawer.style.background = "#0b1726";
    searchDrawer.style.border = "1px solid var(--accent)";
    searchDrawer.innerHTML = `
      <p class="eyebrow" style="margin:0;">SEARCH &amp; REQUEST WORKING SHOP</p>
      <div class="form-grid compact margin-top-sm">
        <label class="field"><span>Company / Shop Name</span><input class="input" id="search-shop-name" placeholder="Type to search shop name..."></label>
        <label class="field"><span>Brand Name</span><input class="input" id="search-brand-name" placeholder="Type to search brand name..."></label>
      </div>
      <div id="search-results-container" class="margin-top-sm"></div>
    `;
    content.append(searchDrawer);

    let isSearchOpen = false;
    btnRequestShop.addEventListener("click", () => {
      isSearchOpen = !isSearchOpen;
      btnRequestShop.classList.toggle("button-primary", isSearchOpen);
      btnRequestShop.classList.toggle("button-secondary", !isSearchOpen);
      searchDrawer.classList.toggle("hidden", !isSearchOpen);
      if (isSearchOpen) {
        searchDrawer.querySelector("#search-shop-name")?.focus();
      }
    });

    // Automatic real-time search listener inside searchDrawer
    async function performLiveShopSearch() {
      const nameVal = searchDrawer.querySelector("#search-shop-name")?.value.trim() || "";
      const brandVal = searchDrawer.querySelector("#search-brand-name")?.value.trim() || "";
      const resultsBox = searchDrawer.querySelector("#search-results-container");
      if (!resultsBox) return;

      if (!nameVal && !brandVal) {
        resultsBox.replaceChildren();
        return;
      }

      resultsBox.innerHTML = `<p class="muted">Searching database for matching shops…</p>`;
      try {
        const res = await window.HiperApi.api("list", { query: { resource: "shops", q: nameVal || brandVal } });
        const allShops = res.items || [];
        const matches = allShops.filter(s => {
          const matchName = !nameVal || String(s.Shop_name || "").toLowerCase().includes(nameVal.toLowerCase());
          const matchBrand = !brandVal || String(s.Shop_brand_name || "").toLowerCase().includes(brandVal.toLowerCase());
          return matchName && matchBrand;
        });

        resultsBox.replaceChildren();
        if (matches.length === 0) {
          resultsBox.innerHTML = `<p class="empty-state">No matching shops found in database.</p>`;
        } else {
          const resultsGrid = document.createElement("div");
          resultsGrid.style.display = "grid";
          resultsGrid.style.gap = "10px";
          resultsGrid.className = "margin-top-sm";

          for (const shopItem of matches) {
            const card = document.createElement("div");
            card.className = "panel shop-card";
            card.style.background = "#132238";
            card.style.display = "flex";
            card.style.justifyContent = "space-between";
            card.style.alignItems = "center";

            const info = document.createElement("div");
            info.innerHTML = `
              <strong>${shopItem.Shop_name || 'Shop'} (${shopItem.Shop_brand_name || 'A.Dot'})</strong>
              <p class="muted" style="margin:2px 0 0; font-size:12px;">Type: ${shopItem.Shop_type || 'Retail Store'} | Location: ${shopItem.Shop_location || 'N/A'}</p>
            `;

            const askBtn = document.createElement("button");
            askBtn.className = "button button-primary button-small";
            askBtn.textContent = "✉️ Send Request";
            askBtn.type = "button";
            askBtn.addEventListener("click", async () => {
              if (window.HiperApi && window.HiperApi.state.user) {
                const user = window.HiperApi.state.user;
                let currentWork = [];
                try {
                  currentWork = typeof user.User_work_shop === "string"
                    ? JSON.parse(user.User_work_shop)
                    : (user.User_work_shop || []);
                } catch (e) { currentWork = []; }

                const newWorkEntry = [shopItem.Shop_Id || shopItem.id || 1, shopItem.Shop_name || "Shop", shopItem.Shop_brand_name || "", [-1]];
                if (!currentWork.some(w => String(w[0]) === String(newWorkEntry[0]) || w[1] === newWorkEntry[1])) {
                  currentWork.push(newWorkEntry);
                }

                const jsonWork = JSON.stringify(currentWork);
                user.User_work_shop = jsonWork;

                try {
                  await window.HiperApi.api("save", {
                    method: "POST",
                    body: { resource: "users", id: user.User_id || user.id, data: { User_work_shop: jsonWork } }
                  });
                  window.HiperApi.showToast(`Request sent to ${shopItem.Shop_name || 'shop'}!`);
                } catch (e) {
                  window.HiperApi.showToast(`Request created for ${shopItem.Shop_name || 'shop'}.`);
                }

                renderBusinessTab();
              }
            });

            card.append(info, askBtn);
            resultsGrid.append(card);
          }

          resultsBox.append(resultsGrid);
        }
      } catch (err) {
        resultsBox.innerHTML = `<p class="form-message error">${err.message}</p>`;
      }
    }

    const nameInput = searchDrawer.querySelector("#search-shop-name");
    const brandInput = searchDrawer.querySelector("#search-brand-name");
    if (nameInput) nameInput.addEventListener("input", performLiveShopSearch);
    if (brandInput) brandInput.addEventListener("input", performLiveShopSearch);

    // List Working Shops Cards below control panel (Matching screenshot layout)
    if (workShops.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No working shops or stores assigned.";
      content.append(empty);
    } else {
      const listContainer = document.createElement("div");
      listContainer.style.display = "grid";
      listContainer.style.gap = "12px";
      listContainer.className = "margin-top-sm";

      for (const shop of workShops) {
        const name = shop.Shop_name || shop.name || "Flag Squer";
        const brand = shop.Shop_brand_name || shop.brand || "A.Dot";
        const typeStr = shop.Shop_type || shop.type || "Clothing & Accessories Store";
        const locationStr = shop.Shop_location || shop.Shop_country || "N/A";

        const card = document.createElement("article");
        card.className = "panel shop-card";
        card.style.display = "flex";
        card.style.alignItems = "center";
        card.style.justifyContent = "space-between";
        card.style.padding = "16px 20px";

        const leftSide = document.createElement("div");
        leftSide.style.display = "flex";
        leftSide.style.alignItems = "center";
        leftSide.style.gap = "14px";

        const icon = document.createElement("div");
        icon.className = "shop-icon";
        icon.textContent = "🏬";
        icon.style.width = "40px";
        icon.style.height = "40px";

        const details = document.createElement("div");
        const shopTitle = document.createElement("strong");
        shopTitle.style.fontSize = "15px";
        shopTitle.textContent = `${name} (${brand})`;

        const brandSub = document.createElement("p");
        brandSub.className = "muted";
        brandSub.style.margin = "3px 0 0 0";
        brandSub.style.fontSize = "12px";
        brandSub.textContent = `Type: ${typeStr} | Location: ${locationStr}`;

        details.append(shopTitle, brandSub);
        leftSide.append(icon, details);

        const rightSide = document.createElement("div");
        rightSide.style.display = "flex";
        rightSide.style.alignItems = "center";
        rightSide.style.gap = "8px";

        if (window.HiperAuth && window.HiperAuth.renderShopActionButtons) {
          window.HiperAuth.renderShopActionButtons(shop, rightSide, true);
        } else {
          const btnManage = document.createElement("button");
          btnManage.className = "button button-secondary";
          btnManage.style.fontWeight = "700";
          btnManage.textContent = "✔ Manage";
          btnManage.type = "button";
          btnManage.addEventListener("click", () => {
            if (window.HiperAuth) window.HiperAuth.selectActiveShop(shop);
            if (window.HiperApp) window.HiperApp.navigate("manager");
          });
          rightSide.append(btnManage);
        }

        card.append(leftSide, rightSide);
        listContainer.append(card);
      }

      content.append(listContainer);
    }
  }

  function bindProfileEvents() {
    $("#prof-manage-btn")?.addEventListener("click", () => {
      if (window.HiperApp) window.HiperApp.navigate("manager");
    });

    $("#ptab-messages")?.addEventListener("click", () => {
      $$(".profile-tab.active").forEach(tab => tab.classList.remove("active"));
      $("#ptab-messages")?.classList.add("active");
      if ($("#prof-tab-content")) $("#prof-tab-content").innerHTML = `
        <div class="panel margin-top-sm">
          <p><strong>System Admin:</strong> Your daily POS shift report for Main Shop has been verified.</p>
          <p><strong>Warehouse Manager:</strong> New stock of barcode scanners has arrived.</p>
        </div>
      `;
    });

    $("#ptab-notif")?.addEventListener("click", () => {
      $$(".profile-tab.active").forEach(tab => tab.classList.remove("active"));
      $("#ptab-notif")?.classList.add("active");
      if ($("#prof-tab-content")) $("#prof-tab-content").innerHTML = `
        <div class="panel margin-top-sm">
          <p>🔔 <strong>Shift Open:</strong> POS Terminal shift opened successfully at Main Shop.</p>
          <p>🔔 <strong>Backup Complete:</strong> Local database backup synced to secure server storage.</p>
        </div>
      `;
    });

    $("#ptab-history")?.addEventListener("click", () => {
      $$(".profile-tab.active").forEach(tab => tab.classList.remove("active"));
      $("#ptab-history")?.classList.add("active");
      if ($("#prof-tab-content")) $("#prof-tab-content").innerHTML = `
        <div class="panel margin-top-sm">
          <p>🛒 <strong>Order #WEB-1052:</strong> $340.00 • Completed Today</p>
          <p>🛒 <strong>Order #WEB-1051:</strong> $85.50 • Completed Yesterday</p>
        </div>
      `;
    });

    $("#ptab-business")?.addEventListener("click", renderBusinessTab);
  }

  return {
    renderProfile,
    renderBusinessTab,
    bindProfileEvents
  };
})();