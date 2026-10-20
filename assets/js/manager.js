/**
 * manager.js - Vertical Collapsible Manager Sidebar & Sub-Frames Module (#view-manager)
 */
window.HiperManager = (() => {
  "use strict";

  const { state, $, $$ } = window.HiperApi;

  let activeManagerTab = "sales"; // Default tab is Documents above Products

  function switchManagerTab(tabKey) {
    activeManagerTab = tabKey || "sales";
    $$(".mgr-nav-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.mgrTab === activeManagerTab);
    });
    $$(".mgr-subframe").forEach(frame => {
      frame.classList.toggle("hidden", frame.id !== `mgr-subframe-${activeManagerTab}`);
    });

    if (state.user) {
      if (activeManagerTab === "sales" && window.HiperDocuments) {
        window.HiperDocuments.renderNotebookTabs();
        window.HiperDocuments.renderSales();
      }
      if (activeManagerTab === "products" && window.HiperProducts) window.HiperProducts.renderProducts();
      if (activeManagerTab === "customers" && window.HiperCustomers) window.HiperCustomers.renderUsers();
      if (activeManagerTab === "promotions" && window.HiperTools) window.HiperTools.renderPromotions();
      if (activeManagerTab === "tools" && window.HiperTools) {
        window.HiperTools.renderTools();
      }
      if (activeManagerTab === "shop-settings" && window.HiperShopSettings) {
        window.HiperShopSettings.loadShopInfo();
        window.HiperShopSettings.renderExpenses();
        window.HiperShopSettings.renderMatrix();
        window.HiperShopSettings.renderWorkers();
        window.HiperShopSettings.renderOthers();
      }
    }
  }

  function bindManagerEvents() {
    $$(".mgr-nav-btn").forEach(btn => {
      btn.addEventListener("click", () => switchManagerTab(btn.dataset.mgrTab));
    });

    $("#mgr-menu-toggle-btn")?.addEventListener("click", () => {
      $("#manager-sidebar")?.classList.toggle("collapsed");
    });
  }

  return {
    switchManagerTab,
    bindManagerEvents
  };
})();
