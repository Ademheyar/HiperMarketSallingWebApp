/**
 * auth.js - Security Login, Session Restore, Shop Selector & Security Navigation Gate
 */
window.HiperAuth = (() => {
  "use strict";

  const { state, $, $$, api, showToast, setMessage } = window.HiperApi;

  const protectedViews = ["pos", "products", "sales", "tools", "customers", "shops", "shop-settings", "profile"];

  function isManager() {
    return ["admin", "administrator", "manager", "owner"].includes(
      String(state.user?.User_type || "").trim().toLowerCase()
    );
  }

  function hasShop() {
    if (!state.user) return false;
    const userShop = state.activeShop?.Shop_name || state.user.User_shop || state.user.User_work_shop || state.user.shop || state.user.at_shop || state.user.Shop_name;
    if (userShop && String(userShop).trim() !== "" && String(userShop).trim().toLowerCase() !== "none" && String(userShop).trim() !== "0") {
      return true;
    }
    return Array.isArray(state.shops) && state.shops.length > 0;
  }

  function canAccessPos() {
    return !!state.user && hasShop();
  }

  function showLogin() {
    const dialog = $("#login-dialog");
    if (dialog && !dialog.open) dialog.showModal();
  }

  function signOut(showNotice = true) {
    state.token = "";
    state.user = null;
    state.activeShop = null;
    sessionStorage.removeItem("hiper-token");
    updateAccountUi();
    if (showNotice) showToast("You have signed out.");
    showLogin();
  }

  function updateAccountUi() {
    const userName = state.user?.User_name || "Not signed in";
    const userRole = state.user?.User_type || "Admin";
    const fullName = [state.user?.User_fname, state.user?.User_Lname].filter(Boolean).join(" ") || "System Admin";
    const activeShopObj = state.activeShop || (state.shops?.[0] || null);
    const shopName = activeShopObj?.Shop_name || activeShopObj?.name || state.user?.User_shop || (state.shops?.[0]?.Shop_name || "Main Shop");

    if ($("#user-name")) $("#user-name").textContent = userName;
    if ($("#settings-user")) $("#settings-user").textContent = userName;
    if ($("#settings-role")) $("#settings-role").textContent = userRole;
    if ($("#user-avatar")) $("#user-avatar").textContent = userName.slice(0, 1).toUpperCase() || "?";

    if ($("#topbar-shop-name")) $("#topbar-shop-name").textContent = shopName;
    if ($("#prof-handle")) $("#prof-handle").textContent = "@" + (state.user?.User_name || "admin");
    if ($("#prof-full-name")) $("#prof-full-name").textContent = fullName;
    if ($("#prof-role")) $("#prof-role").textContent = userRole;
    if ($("#prof-shop")) $("#prof-shop").textContent = shopName;
    if ($("#prof-email")) $("#prof-email").textContent = state.user?.User_email || "admin@hipermarket.com";
    if ($("#prof-location")) $("#prof-location").textContent = state.user?.User_country || "Ethiopia";
    if ($("#prof-avatar")) $("#prof-avatar").textContent = userName.slice(0, 1).toUpperCase() || "A";

    $("#open-login-btn")?.classList.toggle("hidden", !!state.user);
    $("#logout-button")?.classList.toggle("hidden", !state.user);
    $$(".manager-only").forEach((button) => button.classList.toggle("hidden", !isManager()));

    // POS terminal is shown ONLY if user is logged in AND has shop
    const showPos = canAccessPos();
    $$('.nav-link[data-view="pos"]').forEach((el) => el.classList.toggle("hidden", !showPos));
    $$('[data-open-view="pos"]').forEach((el) => el.classList.toggle("hidden", !showPos));

    if (window.HiperPos && typeof window.HiperPos.renderShopOptions === "function") {
      window.HiperPos.renderShopOptions();
    }

    if (state.activeView === "pos" && !showPos) {
      if (window.HiperApp) window.HiperApp.navigate("overview");
    }
  }

  async function restoreSession() {
    if (!state.token) {
      updateAccountUi();
      if (window.HiperApp) window.HiperApp.loadWorkspace();
      return;
    }
    try {
      const result = await api("me");
      state.user = result.user;
      updateAccountUi();
      if (window.HiperApp) window.HiperApp.loadWorkspace();
    } catch {
      state.token = "";
      sessionStorage.removeItem("hiper-token");
      updateAccountUi();
      if (window.HiperApp) window.HiperApp.loadWorkspace();
    }
  }

  async function login(event) {
    if (event) event.preventDefault();
    const form = $("#login-form");
    if (!form) return;
    const button = form.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    setMessage($("#login-message"), "Authenticating...");
    try {
      const formData = new FormData(form);
      const result = await api("login", {
        method: "POST",
        body: {
          username: formData.get("username") || "admin",
          password: formData.get("password") || "admin"
        }
      });
      state.token = result.token;
      state.user = result.user;
      sessionStorage.setItem("hiper-token", state.token);
      updateAccountUi();
      $("#login-dialog")?.close();
      form.reset();
      if (window.HiperApp) await window.HiperApp.loadWorkspace();
      showToast(`Welcome, ${state.user.User_name}.`);
      showShopSelector();
    } catch (error) {
      setMessage($("#login-message"), error.message, "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function getUserWorkShops() {
    let shopsList = [];

    if (state.user && state.user.User_work_shop) {
      try {
        const parsed = typeof state.user.User_work_shop === "string"
          ? JSON.parse(state.user.User_work_shop)
          : state.user.User_work_shop;
        if (Array.isArray(parsed)) {
          shopsList = parsed.map(item => {
            if (Array.isArray(item)) {
              const lvl = Array.isArray(item[3]) ? Number(item[3][0]) : 1;
              return { Shop_Id: item[0], Shop_name: item[1] || "Shop", Shop_brand_name: item[2] || "", level: lvl };
            }
            if (typeof item === "object" && item !== null) {
              item.level = item.level !== undefined ? item.level : 1;
              return item;
            }
            return { Shop_Id: 1, Shop_name: String(item), Shop_brand_name: "", level: 1 };
          });
        }
      } catch (e) {}
    }

    if (Array.isArray(state.shops) && state.shops.length > 0) {
      for (const s of state.shops) {
        const sId = s.Shop_Id || s.Shop_id || s.id || 1;
        const sName = s.Shop_name || s.name || "Main Shop";
        const sBrand = s.Shop_brand_name || s.brand || "BELLEMA FASHION";
        if (!shopsList.some(item => String(item.Shop_Id || item.id) === String(sId) || item.Shop_name === sName)) {
          shopsList.push({ ...s, Shop_Id: sId, Shop_name: sName, Shop_brand_name: sBrand, level: s.level ?? 1 });
        }
      }
    }

    if (shopsList.length === 0) {
      const defaultName = state.user?.User_shop || state.user?.shop || "Main Shop";
      shopsList.push(
        { Shop_Id: 1, Shop_name: defaultName, Shop_brand_name: "BELLEMA FASHION", Shop_location: "Bole, Addis Ababa", level: 1 },
        { Shop_Id: 2, Shop_name: "Flag Squer", Shop_brand_name: "A.Dot", Shop_location: "Addis Ababa", level: 1 }
      );
    }

    return shopsList;
  }

  function selectActiveShop(shopObj) {
    state.activeShop = shopObj;
    const shopName = shopObj.Shop_name || shopObj.Shop_brand_name || shopObj.name || "Main Shop";

    if ($("#topbar-shop-name")) $("#topbar-shop-name").textContent = shopName;
    if ($("#prof-shop")) $("#prof-shop").textContent = shopName;
    if ($("#sale-shop")) $("#sale-shop").value = shopName;

    updateAccountUi();
    showToast(`Active workplace set to ${shopName}.`);
    $("#select-shop-dialog")?.close();
  }

  function renderShopActionButtons(shop, container, isProfileTab = false) {
    const level = Number(shop.level !== undefined ? shop.level : 1);
    const btnGroup = document.createElement("div");
    btnGroup.style.display = "flex";
    btnGroup.style.gap = "8px";
    btnGroup.style.alignItems = "center";
    btnGroup.style.flexWrap = "wrap";
    btnGroup.style.marginTop = "10px";

    if (level > 0) {
      // Level > 0: ⚙️ Manage button + ⚡ End Day button + 🏬 Select button
      const btnManage = document.createElement("button");
      btnManage.className = "button button-primary button-small";
      btnManage.textContent = "⚙️ Manage";
      btnManage.type = "button";
      btnManage.addEventListener("click", () => {
        selectActiveShop(shop);
        if (window.HiperApp) window.HiperApp.navigate("manager");
      });

      const btnEndDay = document.createElement("button");
      btnEndDay.className = "button button-secondary button-small";
      btnEndDay.textContent = "⚡ End Day";
      btnEndDay.type = "button";
      btnEndDay.addEventListener("click", () => {
        selectActiveShop(shop);
        if (window.HiperDocuments && window.HiperDocuments.openEndDayDialog) {
          window.HiperDocuments.openEndDayDialog(shop);
        }
      });

      const btnSelect = document.createElement("button");
      btnSelect.className = "button button-secondary button-small";
      btnSelect.textContent = "🏬 Select";
      btnSelect.type = "button";
      btnSelect.addEventListener("click", () => {
        selectActiveShop(shop);
      });

      btnGroup.append(btnManage, btnEndDay, btnSelect);
    } else if (level === 0) {
      // Level 0: 🟢 Enable button
      const btnEnable = document.createElement("button");
      btnEnable.className = "button button-primary button-small";
      btnEnable.textContent = "🟢 Enable";
      btnEnable.type = "button";
      btnEnable.addEventListener("click", () => {
        shop.level = 1;
        showToast(`Workplace ${shop.Shop_name || 'shop'} enabled.`);
        if (isProfileTab && window.HiperUserProfile) window.HiperUserProfile.renderBusinessTab();
        else showShopSelector();
      });
      btnGroup.append(btnEnable);
    } else if (level === -1) {
      // Level -1: ⌛ Waiting For Respond badge + ❌ Cancel button
      const badge = document.createElement("span");
      badge.className = "stock-badge";
      badge.textContent = "⌛ Waiting For Respond";

      const btnCancel = document.createElement("button");
      btnCancel.className = "button button-quiet button-small";
      btnCancel.textContent = "❌ Cancel";
      btnCancel.type = "button";
      btnCancel.addEventListener("click", () => {
        showToast("Workplace request canceled.");
      });

      btnGroup.append(badge, btnCancel);
    } else if (level === -2) {
      // Level -2: 🤝 Agreed button
      const btnAgreed = document.createElement("button");
      btnAgreed.className = "button button-primary button-small";
      btnAgreed.textContent = "🤝 Agreed";
      btnAgreed.type = "button";
      btnAgreed.addEventListener("click", () => {
        shop.level = 1;
        showToast("Agreed! Workplace activated.");
        if (isProfileTab && window.HiperUserProfile) window.HiperUserProfile.renderBusinessTab();
        else showShopSelector();
      });
      btnGroup.append(btnAgreed);
    } else {
      const btnSelect = document.createElement("button");
      btnSelect.className = "button button-secondary button-small";
      btnSelect.textContent = "🏬 Select";
      btnSelect.type = "button";
      btnSelect.addEventListener("click", () => {
        selectActiveShop(shop);
      });
      btnGroup.append(btnSelect);
    }

    container.append(btnGroup);
  }

  function showShopSelector() {
    const listContainer = $("#user-shops-list");
    if (!listContainer) return;
    listContainer.replaceChildren();

    const workShops = getUserWorkShops();
    if (workShops.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No working shops assigned to your account.";
      listContainer.append(empty);
    } else {
      for (const shop of workShops) {
        const name = shop.Shop_name || shop.name || "Shop";
        const brand = shop.Shop_brand_name || shop.brand || "";

        const card = document.createElement("div");
        card.className = "panel margin-top-sm";
        card.style.display = "flex";
        card.style.flexDirection = "column";
        card.style.padding = "12px 16px";
        card.style.background = "#0b1726";

        const info = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = name;
        title.style.display = "block";
        const sub = document.createElement("small");
        sub.className = "muted";
        sub.textContent = brand ? `Brand: ${brand}` : "Assigned Workplace";
        info.append(title, sub);

        card.append(info);
        renderShopActionButtons(shop, card, false);
        listContainer.append(card);
      }
    }

    const dialog = $("#select-shop-dialog");
    if (dialog && !dialog.open) dialog.showModal();
  }

  function checkAccess(viewName) {
    if (viewName === "pos") {
      if (!state.user) {
        showToast("Log in required to access POS Terminal.", true);
        showLogin();
        return false;
      }
      if (!hasShop()) {
        showToast("Shop assignment required to access POS Terminal.", true);
        return false;
      }
      return true;
    }
    if (protectedViews.includes(viewName) && !state.user) {
      showToast("Security login required to access " + viewName.toUpperCase() + ".", true);
      showLogin();
      return false;
    }
    return true;
  }

  let foundUserForReset = null;

  function showRegister() {
    $("#login-dialog")?.close();
    const dialog = $("#register-dialog");
    if (dialog && !dialog.open) dialog.showModal();
  }

  function showForgotPassword() {
    $("#login-dialog")?.close();
    foundUserForReset = null;
    $("#forgot-reset-fields")?.classList.add("hidden");
    $("#btn-reset-password-submit")?.classList.add("hidden");
    setMessage($("#forgot-message"), "");
    const dialog = $("#forgot-password-dialog");
    if (dialog && !dialog.open) dialog.showModal();
  }

  async function registerUser(event) {
    if (event) event.preventDefault();
    const form = $("#register-form");
    if (!form) return;
    const msg = $("#register-message");
    const submitBtn = form.querySelector('[type="submit"]');

    const formData = new FormData(form);
    const pass = formData.get("User_password");
    const confirm = formData.get("User_password_confirm");

    if (pass !== confirm) {
      setMessage(msg, "Passwords do not match. Please verify.", "error");
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    setMessage(msg, "Creating new user in connected database…");

    try {
      const userData = {
        User_fname: formData.get("User_fname") || "",
        User_Lname: formData.get("User_Lname") || "",
        User_name: formData.get("User_name") || "",
        User_email: formData.get("User_email") || "",
        User_phone_num: formData.get("User_phone_num") || "",
        User_type: formData.get("User_type") || "Customer",
        User_country: formData.get("User_country") || "Ethiopia",
        User_address: formData.get("User_address") || "",
        User_password: pass
      };

      const result = await api("save", {
        method: "POST",
        body: { resource: "users", data: userData }
      });

      const newUser = result.item || userData;
      state.user = newUser;
      updateAccountUi();
      $("#register-dialog")?.close();
      form.reset();
      showToast(`Account for ${newUser.User_name || userData.User_name} created successfully!`);
      if (window.HiperApp) await window.HiperApp.loadWorkspace();
      showShopSelector();
    } catch (err) {
      setMessage(msg, err.message, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async function findUserForReset() {
    const term = $("#forgot-search-input")?.value.trim();
    const msg = $("#forgot-message");
    if (!term) {
      setMessage(msg, "Enter username, email, or phone number to search.", "error");
      return;
    }
    setMessage(msg, "Searching connected database…");
    try {
      const res = await api("list", { query: { resource: "users", q: term } });
      const users = res.items || [];
      const match = users.find(u =>
        String(u.User_name || "").toLowerCase() === term.toLowerCase() ||
        String(u.User_email || "").toLowerCase() === term.toLowerCase() ||
        String(u.User_phone_num || "").includes(term) ||
        String(u.User_id) === term
      ) || users[0];

      if (!match) {
        setMessage(msg, "No user account matching '" + term + "' was found in database.", "error");
        foundUserForReset = null;
        $("#forgot-reset-fields")?.classList.add("hidden");
        $("#btn-reset-password-submit")?.classList.add("hidden");
        return;
      }

      foundUserForReset = match;
      if ($("#found-user-display")) {
        $("#found-user-display").textContent = `${match.User_fname || ''} ${match.User_Lname || ''} (@${match.User_name || 'user'}) - Role: ${match.User_type || 'User'}`;
      }
      $("#forgot-reset-fields")?.classList.remove("hidden");
      $("#btn-reset-password-submit")?.classList.remove("hidden");
      setMessage(msg, "Account found! Enter a new password below.", "success");
    } catch (err) {
      setMessage(msg, err.message, "error");
    }
  }

  async function resetPassword(event) {
    if (event) event.preventDefault();
    const msg = $("#forgot-message");
    if (!foundUserForReset) {
      setMessage(msg, "Find your account first.", "error");
      return;
    }
    const newPass = $("#forgot-new-password")?.value;
    const confirmPass = $("#forgot-confirm-password")?.value;

    if (!newPass) {
      setMessage(msg, "Please enter a new password.", "error");
      return;
    }
    if (newPass !== confirmPass) {
      setMessage(msg, "New passwords do not match.", "error");
      return;
    }

    setMessage(msg, "Updating password in database…");
    try {
      await api("save", {
        method: "POST",
        body: {
          resource: "users",
          id: foundUserForReset.User_id || foundUserForReset.id,
          data: { User_password: newPass }
        }
      });

      $("#forgot-password-dialog")?.close();
      $("#forgot-password-form")?.reset();
      foundUserForReset = null;
      showToast("Password reset successfully! You can now sign in.");
      showLogin();
    } catch (err) {
      setMessage(msg, err.message, "error");
    }
  }

  return {
    isManager,
    hasShop,
    canAccessPos,
    showLogin,
    showShopSelector,
    getUserWorkShops,
    selectActiveShop,
    renderShopActionButtons,
    showRegister,
    showForgotPassword,
    registerUser,
    findUserForReset,
    resetPassword,
    signOut,
    updateAccountUi,
    restoreSession,
    login,
    checkAccess
  };
})();