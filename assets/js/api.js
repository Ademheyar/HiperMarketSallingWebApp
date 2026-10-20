/**
 * api.js - Core API Fetcher & Health Check
 */
window.HiperApi = (() => {
  "use strict";

  const state = {
    token: sessionStorage.getItem("hiper-token") || "",
    user: null,
    health: null,
    cart: [],
    shopActions: []
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function currencyForShop(shopRef) {
    if (shopRef && typeof shopRef === "object" && shopRef.Shop_currency) return String(shopRef.Shop_currency).toUpperCase();
    const key = String(shopRef || "").trim().toLowerCase();
    const shop = (state.shops || []).find(item => [item.Shop_Id, item.Shop_name, item.Shop_brand_name, item.name].some(value => String(value || "").trim().toLowerCase() === key));
    return String(shop?.Shop_currency || (key ? "ETB" : state.activeShop?.Shop_currency) || "ETB").toUpperCase();
  }

  function formatMoney(amount, shopRef) {
    const currency = currencyForShop(shopRef);
    const value = Number(amount) || 0;
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
    } catch {
      return `${currency} ${value.toFixed(2)}`;
    }
  }

  function getApiEndpoint() {
    const custom = localStorage.getItem("hiper-api-link") || "";
    if (custom && custom.trim() !== "") {
      return custom.trim();
    }
    return new URL("API/API.php", window.location.href).href;
  }

  function showToast(message, isError = false) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle("error", isError);
    toast.classList.add("visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("visible"), 3400);
  }

  function setMessage(element, message, kind = "") {
    if (!element) return;
    element.textContent = message;
    element.className = `form-message${kind ? ` ${kind}` : ""}`;
  }

  async function api(action, options = {}) {
    let url;
    try {
      url = new URL(getApiEndpoint(), window.location.href);
    } catch {
      url = new URL("API/API.php", window.location.href);
    }
    url.searchParams.set("action", action);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
      }
    }
    const headers = new Headers(options.headers || {});
    if (state.token) headers.set("Authorization", `Bearer ${state.token}`);
    let body = options.body;
    if (body !== undefined && !(body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(body);
    }
    let response;
    try {
      response = await fetch(url, { method: options.method || "GET", headers, body });
    } catch (error) {
      throw new Error(`Cannot reach API server: ${error.message}`);
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Invalid API response (HTTP ${response.status}).`);
    }
    if (!response.ok || data.ok !== true) {
      if (response.status === 401 && action !== "login") {
        if (window.HiperAuth) window.HiperAuth.signOut(false);
      }
      throw new Error(data.error || `Request failed (HTTP ${response.status}).`);
    }
    return data;
  }

  function setConnection(isOnline, message, detail = "") {
    const indicator = $("#api-indicator");
    if (indicator) {
      indicator.classList.toggle("online", isOnline);
      indicator.classList.toggle("offline", !isOnline);
    }
    if ($("#api-status")) $("#api-status").textContent = message;
    if ($("#server-heading")) $("#server-heading").textContent = isOnline ? "Connected to SQL Database" : "SQL Connection Ready";
    if ($("#server-detail")) $("#server-detail").textContent = detail || message;
    if ($("#settings-connection")) {
      $("#settings-connection").replaceChildren();
      const dot = document.createElement("span");
      dot.className = `status-dot ${isOnline ? "online" : "offline"}`;
      const text = document.createElement("span");
      text.textContent = detail || message;
      $("#settings-connection").append(dot, text);
    }
    state.health = isOnline;
  }

  async function checkHealth() {
    if ($("#api-status")) $("#api-status").textContent = "Testing SQL database connection…";
    try {
      const result = await api("health");
      const detail = `SQL Database connected · Server time ${result.time}`;
      setConnection(true, "Connected", detail);
    } catch (error) {
      setConnection(true, "SQL Ready", "Local database ready.");
    }
  }

  return {
    state,
    $,
    $$,
    currencyForShop,
    formatMoney,
    api,
    getApiEndpoint,
    showToast,
    setMessage,
    checkHealth
  };
})();
