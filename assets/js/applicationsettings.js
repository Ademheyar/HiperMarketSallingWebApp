/**
 * applicationsettings.js - App Preferences & Image Uploads Module (#view-settings)
 */
window.HiperAppSettings = (() => {
  "use strict";

  const { $, api, setMessage, showToast } = window.HiperApi;

  function applyTheme(themeName) {
    document.documentElement.setAttribute("data-theme", themeName);
    localStorage.setItem("hiper-theme", themeName);
    const select = $("#theme-select");
    if (select) select.value = themeName;
  }

  function initTheme() {
    const savedTheme = localStorage.getItem("hiper-theme") || "dark";
    applyTheme(savedTheme);
  }

  function loadApiLink() {
    const saved = localStorage.getItem("hiper-api-link") || "";
    if ($("#settings-api-link")) {
      const defaultUrl = new URL("API/API.php", window.location.href).href;
      $("#settings-api-link").value = saved || defaultUrl;
      $("#settings-api-link").placeholder = defaultUrl;
    }
  }

  function saveApiLink() {
    const link = $("#settings-api-link")?.value.trim() || "";
    const defaultUrl = new URL("API/API.php", window.location.href).href;
    if (link && link !== defaultUrl) {
      localStorage.setItem("hiper-api-link", link);
    } else {
      localStorage.removeItem("hiper-api-link");
      if ($("#settings-api-link")) $("#settings-api-link").value = defaultUrl;
    }
  }

  function toggleDbFields(type) {
    const isMysql = type === "mysql";
    $("#mysql-fields")?.classList.toggle("hidden", !isMysql);
    $("#sqlite-fields")?.classList.toggle("hidden", isMysql);
    if (!isMysql) {
      const dbPathInput = $("#db-path");
      if (dbPathInput && (!dbPathInput.value || dbPathInput.value.trim() === "")) {
        dbPathInput.value = "data/my_database.db";
      }
    }
  }

  function fillDefaultFields() {
    if ($("#db-type")) $("#db-type").value = "mysql";
    if ($("#db-host")) $("#db-host").value = "sql104.infinityfree.com";
    if ($("#db-port")) $("#db-port").value = "3306";
    if ($("#db-name")) $("#db-name").value = "if0_43150087_HiperMarket_db";
    if ($("#db-user")) $("#db-user").value = "if0_43150087";
    if ($("#db-password")) $("#db-password").value = "A097200m";
    if ($("#db-path")) $("#db-path").value = "data/my_database.db";
    if ($("#db-secret")) $("#db-secret").value = "default-hipermarket-secret-key-2026";
    toggleDbFields("mysql");
  }

  async function loadDbConfig() {
    fillDefaultFields();
    loadApiLink();
    try {
      const res = await api("get_db_config");
      if (!res || !res.config) return;
      const cfg = res.config;
      if ($("#db-type")) $("#db-type").value = cfg.db_type || "mysql";
      if ($("#db-path")) $("#db-path").value = cfg.db_path || "data/my_database.db";
      if ($("#db-host")) $("#db-host").value = cfg.db_host || "sql104.infinityfree.com";
      if ($("#db-port")) $("#db-port").value = cfg.db_port || "3306";
      if ($("#db-name")) $("#db-name").value = cfg.db_name || "if0_43150087_HiperMarket_db";
      if ($("#db-user")) $("#db-user").value = cfg.db_user || "if0_43150087";
      if ($("#db-secret")) $("#db-secret").value = cfg.token_secret || "default-hipermarket-secret-key-2026";
      toggleDbFields(cfg.db_type || "mysql");
    } catch (e) {
      fillDefaultFields();
    }
  }

  async function saveDbConfig(event) {
    if (event) event.preventDefault();
    saveApiLink();
    const msg = $("#db-config-message");
    setMessage(msg, "Saving and testing database configuration…");
    try {
      const payload = {
        db_type: $("#db-type")?.value || "mysql",
        db_path: $("#db-path")?.value || "data/my_database.db",
        db_host: $("#db-host")?.value || "sql104.infinityfree.com",
        db_port: $("#db-port")?.value || "3306",
        db_name: $("#db-name")?.value || "if0_43150087_HiperMarket_db",
        db_user: $("#db-user")?.value || "if0_43150087",
        db_password: $("#db-password")?.value || "",
        token_secret: $("#db-secret")?.value || "default-hipermarket-secret-key-2026"
      };
      const res = await api("save_db_config", { method: "POST", body: payload });
      setMessage(msg, res.message || "Database configuration saved successfully!", "success");
      showToast("Database configuration updated.");
      if (window.HiperApi) window.HiperApi.checkHealth();
    } catch (err) {
      setMessage(msg, err.message, "error");
    }
  }

  async function resetDefaultSettings() {
    const msg = $("#db-config-message");
    setMessage(msg, "Resetting database and theme settings to default…");
    localStorage.removeItem("hiper-api-link");
    fillDefaultFields();
    loadApiLink();
    try {
      applyTheme("dark");
      await api("reset_db_config", { method: "POST" });
      await loadDbConfig();
      setMessage(msg, "All settings reset and filled with default InfinityFree MySQL configuration successfully!", "success");
      showToast("Reset to default configuration.");
      if (window.HiperApi) window.HiperApi.checkHealth();
    } catch (err) {
      fillDefaultFields();
      setMessage(msg, "Form filled with default InfinityFree MySQL settings.", "success");
    }
  }

  async function testDbConnection() {
    const msg = $("#db-config-message");
    setMessage(msg, "Testing SQL Database connection…");
    try {
      const res = await api("health");
      if (res.ok && res.database === "connected") {
        setMessage(msg, "SQL Server and Database connected successfully!", "success");
        showToast("Database connection verified.");
      } else {
        setMessage(msg, "Database connection failed.", "error");
      }
    } catch (err) {
      setMessage(msg, err.message, "error");
    }
  }

  async function uploadImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const message = $("#upload-message");
    if (file.size > 5 * 1024 * 1024) {
      setMessage(message, "Images must be 5 MB or smaller.", "error");
      event.target.value = "";
      return;
    }
    setMessage(message, "Uploading image…");

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = await api("upload", {
          method: "POST",
          body: { base64: reader.result }
        });
        setMessage(message, `Uploaded. Save this image path in record: ${result.file.path}`, "success");
        showToast("Image uploaded successfully.");
      } catch (error) {
        setMessage(message, error.message, "error");
      } finally {
        event.target.value = "";
      }
    };
    reader.onerror = () => {
      setMessage(message, "Failed to read image file.", "error");
      event.target.value = "";
    };
    reader.readAsDataURL(file);
  }

  function bindAppSettingsEvents() {
    initTheme();
    loadDbConfig();

    $("#btn-browse-db-path")?.addEventListener("click", () => {
      $("#db-file-picker")?.click();
    });

    $("#db-file-picker")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const fileName = file.name;
        const newPath = (file.path && file.path.trim() !== "") ? file.path : `data/${fileName}`;
        const input = $("#db-path");
        if (input) {
          input.value = newPath;
        }
        showToast(`Selected database file path: ${newPath}`);
      }
    });

    $("#theme-select")?.addEventListener("change", (e) => applyTheme(e.target.value));
    $("#db-type")?.addEventListener("change", (e) => toggleDbFields(e.target.value));
    $("#db-config-form")?.addEventListener("submit", saveDbConfig);
    $("#reset-db-btn")?.addEventListener("click", resetDefaultSettings);
    $("#test-db-btn")?.addEventListener("click", testDbConnection);
    $("#image-upload")?.addEventListener("change", uploadImage);
    $("#refresh-data")?.addEventListener("click", () => {
      if (window.HiperApp) window.HiperApp.refreshWorkspace();
    });
  }

  return {
    applyTheme,
    initTheme,
    resetDefaultSettings,
    fillDefaultFields,
    bindAppSettingsEvents
  };
})();