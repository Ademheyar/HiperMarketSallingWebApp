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

    const btnUpgrade = document.createElement("button");
    btnUpgrade.className = "button button-primary";
    btnUpgrade.textContent = "Upgrade";
    btnUpgrade.type = "button";
    btnUpgrade.addEventListener("click", openUpgradeDialog);

    actionBtns.append(btnRequestShop, btnCreateShop, btnUpgrade);
    controlPanel.append(leftHeading, actionBtns);
    content.append(controlPanel);

    const subscriptionStatus = document.createElement("p");
    subscriptionStatus.className = "muted margin-top-sm";
    subscriptionStatus.textContent = "Loading package access…";
    content.append(subscriptionStatus);
    window.HiperApi.api("subscription").then(({ subscription }) => {
      const planName = String(subscription.plan_id || "free").replace(/^./, c => c.toUpperCase());
      subscriptionStatus.textContent = `Current package: ${planName} · ${subscription.status === "paid" ? "Paid access active" : subscription.status === "pending" ? "Payment verification pending" : "Free access · 20 orders/month"}`;
    }).catch(() => { subscriptionStatus.textContent = "Package access status unavailable."; });

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
              <p class="muted" style="margin:2px 0 0; font-size:12px;">Type: ${shopItem.Shop_type || 'Retail Store'} | Location: ${shopItem.Shop_location || 'N/A'} | Currency: ${shopItem.Shop_currency || 'ETB'}</p>
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
        brandSub.textContent = `Type: ${typeStr} | Location: ${locationStr} | Currency: ${shop.Shop_currency || "ETB"}`;

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
          btnManage.textContent = "⚙️ Manage";
          btnManage.type = "button";
          btnManage.addEventListener("click", () => {
            if (window.HiperAuth) window.HiperAuth.selectActiveShop(shop);
            if (window.HiperApp) window.HiperApp.navigate("manager");
          });

          const btnEndDay = document.createElement("button");
          btnEndDay.className = "button button-primary";
          btnEndDay.style.fontWeight = "700";
          btnEndDay.textContent = "📊 Daily Report";
          btnEndDay.type = "button";
          btnEndDay.addEventListener("click", () => {
            if (window.HiperAuth) window.HiperAuth.selectActiveShop(shop);
            if (window.HiperDocuments && typeof window.HiperDocuments.performEndDay === "function") {
              window.HiperDocuments.performEndDay(true);
            }
          });

          rightSide.append(btnManage, btnEndDay);
        }

        card.append(leftSide, rightSide);
        listContainer.append(card);
      }

      content.append(listContainer);
    }
  }

  function openUpgradeDialog() {
    let dialog = $("#profile-upgrade-dialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "profile-upgrade-dialog";
      dialog.className = "dialog profile-upgrade-dialog";
      dialog.innerHTML = `
        <form method="dialog" class="upgrade-dialog-form">
          <div class="dialog-heading"><div><p class="eyebrow">HIPERMARKET PLANS</p><h2>Upgrade your business</h2></div><button class="icon-button" type="submit" aria-label="Close">×</button></div>
          <div class="upgrade-step-indicator"><span class="active">1 <small>Plan</small></span><i></i><span>2 <small>Payment</small></span><i></i><span>3 <small>Details</small></span></div>
          <div class="upgrade-viewport"><div class="upgrade-track">
            <section class="upgrade-step" aria-label="Choose a plan">
              <p class="muted">Compare package features and monthly order allowances. Ask your administrator for current fees.</p>
              <div class="upgrade-plan-grid" role="group" aria-label="Subscription plan">
                <button class="upgrade-plan" type="button" data-plan="starter"><strong>Starter</strong><span class="upgrade-price">Fee set by admin</span><small>1 shop · 100 orders/month · POS and sales reports</small></button>
                <button class="upgrade-plan selected" type="button" data-plan="business"><strong>Business</strong><span class="upgrade-price">Fee set by admin</span><small>3 shops · 500 orders/month · Staff access and inventory</small></button>
                <button class="upgrade-plan" type="button" data-plan="growth"><strong>Growth</strong><span class="upgrade-price">Fee set by admin</span><small>10 shops · 2,000 orders/month · Advanced reports and team tools</small></button>
                <button class="upgrade-plan" type="button" data-plan="enterprise"><strong>Enterprise</strong><span class="upgrade-price">Contact admin</span><small>Unlimited orders · Multi shop controls · Priority support</small></button>
              </div>
            </section>
            <section class="upgrade-step" aria-label="Choose payment method">
              <p class="muted">Select how you want to pay.</p>
              <div class="upgrade-method-grid" role="group" aria-label="Payment method">
                <button class="upgrade-method selected" type="button" data-method="paypal"><span class="upgrade-method-icon">P</span><span><strong>PayPal</strong><small>Continue with your PayPal account</small></span><b>✓</b></button>
                <button class="upgrade-method" type="button" data-method="card"><span class="upgrade-method-icon">▤</span><span><strong>Credit or debit card</strong><small>Visa, Mastercard and supported cards</small></span><b>✓</b></button>
              </div>
            </section>
            <section class="upgrade-step" aria-label="Billing details">
              <p class="muted" data-details-intro>Enter the billing information for your selected payment method.</p>
              <div class="form-grid compact">
                <label class="field card-only" hidden><span>Billing name</span><input class="input" name="billing_name" autocomplete="name"></label>
                <label class="field"><span data-email-label>PayPal account email</span><input class="input" name="billing_email" type="email" autocomplete="email" value="${String(state.user?.User_email || "").replace(/[&<>"']/g, "")}" required></label>
                <label class="field card-only" hidden><span>Billing country</span><input class="input" name="billing_country" autocomplete="country-name" value="${String(state.user?.User_country || "").replace(/[&<>"']/g, "")}"></label>
                <label class="field card-only" hidden><span>Postal / ZIP code</span><input class="input" name="billing_postal" autocomplete="postal-code"></label>
              </div>
              <p class="upgrade-secure-note">Card number and security code are entered on the payment provider’s secure checkout page. This app does not collect or store card details.</p>
              <p class="upgrade-checkout-message form-message" role="status"></p>
            </section>
          </div></div>
          <div class="dialog-actions upgrade-navigation"><button class="button button-secondary" type="submit">Cancel</button><button class="button button-secondary" type="button" data-upgrade-back hidden>Back</button><button class="button button-primary" type="button" data-upgrade-next>Next</button></div>
        </form>`;
      document.body.append(dialog);
      let selectedPlan = dialog.querySelector(".upgrade-plan.selected");
      let selectedMethod = dialog.querySelector(".upgrade-method.selected");
      let currentStep = 0;
      const stepLabels = [...dialog.querySelectorAll(".upgrade-step-indicator span")];
      const updateWizard = () => {
        dialog.querySelector(".upgrade-track").style.transform = `translateX(-${currentStep * 33.3333}%)`;
        dialog.dataset.step = String(currentStep);
        stepLabels.forEach((label, index) => label.classList.toggle("active", index === currentStep));
        dialog.querySelector("[data-upgrade-back]").hidden = currentStep === 0;
        dialog.querySelector("[data-upgrade-next]").textContent = currentStep === 2 ? "Request package" : "Next";
      };
      dialog.querySelectorAll(".upgrade-plan").forEach(button => button.addEventListener("click", () => {
        selectedPlan?.classList.remove("selected");
        selectedPlan = button;
        button.classList.add("selected");
        dialog.dataset.plan = button.dataset.plan;
      }));
      dialog.querySelectorAll(".upgrade-method").forEach(button => button.addEventListener("click", () => {
        selectedMethod?.classList.remove("selected");
        selectedMethod = button;
        button.classList.add("selected");
        dialog.dataset.method = button.dataset.method;
        const cardSelected = button.dataset.method === "card";
        dialog.querySelectorAll(".card-only").forEach(field => {
          field.hidden = !cardSelected;
          const input = field.querySelector("input");
          input.required = cardSelected;
        });
        dialog.querySelector("[data-email-label]").textContent = cardSelected ? "Receipt email" : "PayPal account email";
        dialog.querySelector("[data-details-intro]").textContent = cardSelected
          ? "Add your billing address. You’ll enter card details securely with the payment provider."
          : "Enter the email linked to your PayPal account.";
      }));
      dialog.dataset.plan = selectedPlan?.dataset.plan || "business";
      dialog.dataset.method = selectedMethod?.dataset.method || "paypal";
      dialog.querySelector("[data-upgrade-back]").addEventListener("click", () => {
        currentStep = Math.max(0, currentStep - 1);
        updateWizard();
      });
      dialog.querySelector("[data-upgrade-next]").addEventListener("click", () => {
        if (currentStep < 2) {
          currentStep += 1;
          updateWizard();
          return;
        }
        const form = dialog.querySelector("form");
        const message = dialog.querySelector(".upgrade-checkout-message");
        const email = form.elements.billing_email;
        if (!email.reportValidity()) return;
        if (dialog.dataset.method === "card" && ![form.elements.billing_name, form.elements.billing_country, form.elements.billing_postal].every(input => input.reportValidity())) return;
        message.classList.remove("error", "success");
        message.textContent = "Saving your package request…";
        window.HiperApi.api("subscription_request", {
          method: "POST",
          body: { plan_id: dialog.dataset.plan, payment_method: dialog.dataset.method, billing_email: email.value.trim() }
        }).then(result => {
          message.textContent = result.message;
          message.classList.add("success");
        }).catch(error => {
          message.textContent = error.message;
          message.classList.add("error");
        });
      });
      updateWizard();
    }
    dialog.showModal();
  }

  function bindProfileEvents() {
    $("#prof-end-day-btn")?.addEventListener("click", () => {
      if (window.HiperDocuments && typeof window.HiperDocuments.performEndDay === "function") {
        window.HiperDocuments.performEndDay(true);
      } else {
        if (window.HiperApi) window.HiperApi.showToast("End Day module is loading...", true);
      }
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
          <p>🛒 <strong>Order #WEB-1052:</strong> ${window.HiperApi.formatMoney(340, state.activeShop)} • Completed Today</p>
          <p>🛒 <strong>Order #WEB-1051:</strong> ${window.HiperApi.formatMoney(85.5, state.activeShop)} • Completed Yesterday</p>
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
