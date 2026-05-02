(function oceanosGuard() {
  const portalUrl = "/OceanOS/";
  const authUrl = "/OceanOS/api/auth.php";
  const notificationsUrl = "/OceanOS/api/notifications.php";
  const path = window.location.pathname;
  const isPortal = path.toLowerCase().startsWith("/oceanos/");
  const isMeetOcean = path.toLowerCase().startsWith("/meetocean/");
  const searchParams = new URLSearchParams(window.location.search);
  const isMeetOceanInvite = isMeetOcean
    && (searchParams.has("invite") || searchParams.has("token"))
    && (searchParams.has("room") || searchParams.has("code"));
  const modulePaths = [
    ["/agenda/", "agenda"],
    ["/flowcean/", "flowcean"],
    ["/invocean/", "invocean"],
    ["/devis/", "devis"],
    ["/commandes/", "commandes"],
    ["/sav/", "sav"],
    ["/stockcean/", "stockcean"],
    ["/tresorcean/", "tresorcean"],
    ["/nauticrm/", "nauticrm"],
    ["/nautimail/", "nautimail"],
    ["/nautipost/", "nautipost"],
    ["/nauticloud/", "nauticloud"],
    ["/formcean/", "formcean"],
    ["/nautisign/", "nautisign"],
    ["/naviplan/", "naviplan"],
    ["/seocean/", "visiocean"],
    ["/visiocean/", "visiocean"],
    ["/meetocean/", "meetocean"],
    ["/backup/", "backup"],
  ];
  const superOnlyModules = new Set(["backup"]);
  let portalAuthRetryTimer = null;
  const notificationState = {
    notifications: [],
    unreadCount: 0,
    loaded: false,
    open: false,
    timer: null,
    root: null,
    button: null,
    badge: null,
    panel: null,
    list: null,
    status: null,
    refreshListenerInstalled: false,
  };

  function nextUrl() {
    return window.location.pathname + window.location.search + window.location.hash;
  }

  function redirectToPortal() {
    if (isPortal) return;
    window.location.replace(`${portalUrl}?next=${encodeURIComponent(nextUrl())}`);
  }

  function currentModuleId() {
    const normalizedPath = path.toLowerCase();
    const match = modulePaths.find(([prefix]) => normalizedPath.startsWith(prefix));
    return match ? match[1] : "";
  }

  function moduleAllowedForUser(user) {
    const moduleId = currentModuleId();
    if (moduleId === "" || isPortal) return true;

    if (superOnlyModules.has(moduleId)) {
      return String(user?.role || "").toLowerCase() === "super";
    }

    if (!Array.isArray(user?.visibleModules)) return true;

    const visibleModules = user.visibleModules;
    if (visibleModules.length === 0) return false;
    return visibleModules.map((value) => String(value || "").toLowerCase()).includes(moduleId);
  }

  function installButton() {
    if (isPortal) return;
    if (document.querySelector(".oceanos-return-button")) return;

    const link = document.createElement("a");
    link.className = "oceanos-return-button";
    link.href = portalUrl;
    link.setAttribute("aria-label", "Retourner sur OceanOS");
    link.innerHTML = "<span>O</span><strong>OceanOS</strong>";
    document.body.appendChild(link);
  }

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }
    callback();
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  async function logoutThroughOceanOS() {
    try {
      await fetch(authUrl, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {}
    window.location.href = portalUrl;
  }

  function installLogoutBridge() {
    document.addEventListener("click", (event) => {
      const button = event.target && event.target.closest ? event.target.closest("button") : null;
      if (!button) return;

      const text = normalizeText(button.textContent);
      if (button.id === "logout-button" || text.includes("deconnexion")) {
        window.setTimeout(logoutThroughOceanOS, 0);
      }
    }, true);
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...(options || {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.message || payload.error || "Erreur OceanOS.");
    }
    return payload;
  }

  function formatNotificationDate(value) {
    if (!value) return "";
    const date = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function closeNotificationPanel() {
    notificationState.open = false;
    if (notificationState.root) {
      notificationState.root.classList.remove("is-open");
    }
    if (notificationState.button) {
      notificationState.button.setAttribute("aria-expanded", "false");
    }
  }

  function setNotificationStatus(message) {
    if (!notificationState.status) return;
    notificationState.status.textContent = message || "";
    notificationState.status.hidden = !message;
  }

  function renderNotificationHub() {
    if (!notificationState.root || !notificationState.list || !notificationState.badge) return;

    notificationState.badge.textContent = String(notificationState.unreadCount || 0);
    notificationState.badge.hidden = Number(notificationState.unreadCount || 0) <= 0;

    notificationState.list.innerHTML = "";
    if (!notificationState.loaded) {
      const empty = document.createElement("div");
      empty.className = "oceanos-notification-empty";
      empty.textContent = "Chargement des notifications...";
      notificationState.list.appendChild(empty);
      return;
    }

    if (notificationState.notifications.length === 0) {
      const empty = document.createElement("div");
      empty.className = "oceanos-notification-empty";
      empty.textContent = "Aucune notification.";
      notificationState.list.appendChild(empty);
      return;
    }

    notificationState.notifications.forEach((notification) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `oceanos-notification-item is-${notification.severity || "info"}`;
      if (!notification.read) item.classList.add("is-unread");

      const head = document.createElement("span");
      head.className = "oceanos-notification-head";

      const module = document.createElement("span");
      module.className = "oceanos-notification-module";
      module.textContent = notification.module || "OceanOS";

      const date = document.createElement("span");
      date.className = "oceanos-notification-date";
      date.textContent = formatNotificationDate(notification.updatedAt || notification.createdAt);
      head.append(module, date);

      const title = document.createElement("strong");
      title.textContent = notification.title || "Notification";

      item.append(head, title);
      if (notification.body) {
        const body = document.createElement("span");
        body.className = "oceanos-notification-body";
        body.textContent = notification.body;
        item.appendChild(body);
      }

      item.addEventListener("click", () => {
        void markNotificationRead(notification).finally(() => {
          if (notification.actionUrl) {
            window.location.href = notification.actionUrl;
          }
        });
      });

      notificationState.list.appendChild(item);
    });
  }

  async function refreshNotifications() {
    const payload = await fetchJson(notificationsUrl);
    notificationState.notifications = Array.isArray(payload.notifications) ? payload.notifications : [];
    notificationState.unreadCount = Number(payload.unreadCount || 0);
    notificationState.loaded = true;
    setNotificationStatus("");
    renderNotificationHub();
  }

  async function markNotificationRead(notification) {
    if (!notification || !notification.id) return;
    const payload = await fetchJson(notificationsUrl, {
      method: "POST",
      body: JSON.stringify({
        action: "mark_read",
        notificationId: notification.id,
      }),
    });
    notificationState.notifications = Array.isArray(payload.notifications) ? payload.notifications : [];
    notificationState.unreadCount = Number(payload.unreadCount || 0);
    notificationState.loaded = true;
    renderNotificationHub();
  }

  async function markAllNotificationsRead() {
    const payload = await fetchJson(notificationsUrl, {
      method: "POST",
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    notificationState.notifications = Array.isArray(payload.notifications) ? payload.notifications : [];
    notificationState.unreadCount = Number(payload.unreadCount || 0);
    notificationState.loaded = true;
    renderNotificationHub();
  }

  function installNotificationHub() {
    if (document.querySelector(".oceanos-notification-hub")) return;

    const root = document.createElement("section");
    root.className = "oceanos-notification-hub";
    root.setAttribute("aria-label", "Notifications OceanOS");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "oceanos-notification-button";
    button.setAttribute("aria-label", "Ouvrir les notifications");
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = '<span aria-hidden="true">!</span><strong>Notifications</strong>';

    const badge = document.createElement("span");
    badge.className = "oceanos-notification-badge";
    badge.hidden = true;
    button.appendChild(badge);

    const panel = document.createElement("div");
    panel.className = "oceanos-notification-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Notifications OceanOS");

    const header = document.createElement("div");
    header.className = "oceanos-notification-panel-head";
    const title = document.createElement("strong");
    title.textContent = "Notifications";
    const markAll = document.createElement("button");
    markAll.type = "button";
    markAll.textContent = "Tout lu";
    markAll.addEventListener("click", (event) => {
      event.preventDefault();
      void markAllNotificationsRead().catch(() => setNotificationStatus("Impossible de marquer comme lu."));
    });
    header.append(title, markAll);

    const status = document.createElement("p");
    status.className = "oceanos-notification-status";
    status.hidden = true;

    const list = document.createElement("div");
    list.className = "oceanos-notification-list";
    panel.append(header, status, list);
    root.append(button, panel);
    document.body.appendChild(root);

    notificationState.root = root;
    notificationState.button = button;
    notificationState.badge = badge;
    notificationState.panel = panel;
    notificationState.list = list;
    notificationState.status = status;

    button.addEventListener("click", () => {
      notificationState.open = !notificationState.open;
      root.classList.toggle("is-open", notificationState.open);
      button.setAttribute("aria-expanded", notificationState.open ? "true" : "false");
      if (notificationState.open) {
        void refreshNotifications().catch(() => setNotificationStatus("Notifications indisponibles."));
      }
    });

    document.addEventListener("click", (event) => {
      if (!notificationState.open || root.contains(event.target)) return;
      closeNotificationPanel();
    });

    renderNotificationHub();
    window.OceanOSNotifications = {
      refresh: () => refreshNotifications().catch(() => setNotificationStatus("Notifications indisponibles.")),
    };
    if (!notificationState.refreshListenerInstalled) {
      window.addEventListener("oceanos:notifications-refresh", () => {
        void refreshNotifications().catch(() => {});
      });
      notificationState.refreshListenerInstalled = true;
    }
    void refreshNotifications().catch(() => setNotificationStatus("Notifications indisponibles."));
    if (!notificationState.timer) {
      notificationState.timer = window.setInterval(() => {
        void refreshNotifications().catch(() => {});
      }, 30000);
    }
  }

  function retryPortalNotificationsAfterLogin() {
    if (!isPortal || portalAuthRetryTimer) return;
    portalAuthRetryTimer = window.setInterval(async () => {
      try {
        const payload = await fetchJson(authUrl);
        if (!payload.authenticated) return;
        window.clearInterval(portalAuthRetryTimer);
        portalAuthRetryTimer = null;
        onReady(installNotificationHub);
      } catch (error) {}
    }, 3000);
  }

  async function boot() {
    if (isMeetOceanInvite) return;

    onReady(() => {
      installButton();
      installLogoutBridge();
    });

    try {
      const payload = await fetchJson(authUrl);
      if (!payload.authenticated) {
        retryPortalNotificationsAfterLogin();
        redirectToPortal();
        return;
      }
      if (!moduleAllowedForUser(payload.user || null)) {
        window.location.replace(portalUrl);
        return;
      }
      onReady(installNotificationHub);
    } catch (error) {
      retryPortalNotificationsAfterLogin();
      redirectToPortal();
    }
  }

  boot();
})();
