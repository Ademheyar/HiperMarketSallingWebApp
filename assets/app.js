/**
 * app.js - Master App Orchestrator & View Switcher
 */
window.HiperApp = (() => {
  "use strict";

  const { state, $, $$, api, showToast, setMessage } = window.HiperApi;
  const { isManager, showLogin, signOut, updateAccountUi, restoreSession, login, checkAccess } = window.HiperAuth;

  async function loadWorkspace() {
    updateAccountUi();
    await Promise.all([
      window.HiperHome ? window.HiperHome.loadDashboard() : Promise.resolve(),
      window.HiperApi.api("list", { query: { resource: "products" } }).then(res => state.products = res.items || []),
      window.HiperApi.api("list", { query: { resource: "users" } }).then(res => state.users = res.items || []),
      window.HiperApi.api("list", { query: { resource: "shops" } }).then(res => state.shops = res.items || []),
      window.HiperApi.api("list", { query: { resource: "sales" } }).then(res => state.sales = res.items || []),
      window.HiperReports ? window.HiperReports.loadReports() : Promise.resolve()
    ]);

    if (window.HiperHome) {
      window.HiperHome.renderShopStories();
      window.HiperHome.renderProductsFeed();
      window.HiperHome.updateHeaderCartBadge();
    }
    if (window.HiperProducts) window.HiperProducts.renderProducts();
    if (window.HiperCustomers) window.HiperCustomers.renderUsers();
    if (window.HiperShops) window.HiperShops.renderShops();
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
    $$(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${viewName}`));
    $$(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.view === viewName));

    const navButton = $(`.nav-link[data-view="${viewName}"]`);
    if ($("#page-title")) $("#page-title").textContent = navButton ? navButton.textContent.trim() : (viewName === "manager" ? "Manager Panel" : "Overview");
    if ($("#page-kicker")) $("#page-kicker").textContent = viewName === "pos" ? "CHECKOUT" : "HIPER MARKET";
    $("#sidebar")?.classList.remove("open");

    // Header Search Bar & Cart Button ONLY for Home View ("overview")
    const searchBox = $(".topbar-search-box");
    const cartBtn = $("#header-cart-btn");
    if (searchBox) searchBox.style.display = (viewName === "overview") ? "block" : "none";
    if (cartBtn) cartBtn.style.display = (viewName === "overview") ? "inline-flex" : "none";

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
      ["User_phone_num", "Phone"], ["User_email", "Email", "email"], ["User_type", "Role"], ["User_password", "Password", "password"]
    ],
    shops: [
      ["Shop_name", "Shop name", "text", true], ["Shop_brand_name", "Brand name"], ["Shop_location", "Location"]
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
    for (const [key, label, type = "text", required = false, wide = false] of fieldsByResource[resource] || []) {
      if (resource === "users" && key === "User_password" && item) continue;
      const field = document.createElement("label");
      field.className = `field${wide ? " wide" : ""}`;
      const caption = document.createElement("span");
      caption.textContent = label;
      const input = type === "textarea" ? document.createElement("textarea") : document.createElement("input");
      input.className = "input";
      input.name = key;
      input.type = type === "textarea" ? "text" : type;
      if (type === "textarea") {
        input.rows = 3;
        input.value = String(item?.[key] ?? "");
      } else {
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

  async function saveRecord(event) {
    event.preventDefault();
    if (!state.editing) return;
    const form = event.currentTarget;
    const saveButton = form.querySelector('[type="submit"]');
    if (saveButton) saveButton.disabled = true;
    try {
      const data = {};
      for (const [key, value] of new FormData(form).entries()) {
        if (value === "") continue;
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
    $("#complete-sale")?.addEventListener("click", () => window.HiperPos && window.HiperPos.completeSale());
    $("#clear-cart")?.addEventListener("click", () => { state.cart = []; window.HiperPos && window.HiperPos.renderCart(); });

    $("#open-login-btn")?.addEventListener("click", showLogin);
    $("#topbar-shop-name")?.addEventListener("click", () => window.HiperAuth && window.HiperAuth.showShopSelector());
    $("#btn-open-create-shop")?.addEventListener("click", () => {
      $("#select-shop-dialog")?.close();
      openRecordDialog("shops");
    });
    $("#profile-signout-btn")?.addEventListener("click", () => signOut());

    $("#retry-health")?.addEventListener("click", () => window.HiperApi.checkHealth());
    $("#refresh-data")?.addEventListener("click", refreshWorkspace);
    $("#logout-button")?.addEventListener("click", () => signOut());
    $("#settings-logout")?.addEventListener("click", () => signOut());
    $("#menu-toggle")?.addEventListener("click", () => $("#sidebar")?.classList.toggle("open"));
    $("#print-receipt")?.addEventListener("click", () => window.print());

    if (window.HiperPos) window.HiperPos.bindPosShopEvents();
    if (window.HiperUserProfile) window.HiperUserProfile.bindProfileEvents();
    if (window.HiperDocuments) window.HiperDocuments.bindDocEvents();
    if (window.HiperShopSettings) window.HiperShopSettings.bindShopSettingsEvents();
    if (window.HiperAppSettings) window.HiperAppSettings.bindAppSettingsEvents();
    if (window.HiperGetValue) window.HiperGetValue.bindKeypadEvents();
    if (window.HiperManager) window.HiperManager.bindManagerEvents();
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
