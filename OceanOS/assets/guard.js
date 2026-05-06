(function oceanosGuard() {
  const portalUrl = "/OceanOS/";
  const authUrl = "/OceanOS/api/auth.php";
  const notificationsUrl = "/OceanOS/api/notifications.php";
  const pushUrl = "/OceanOS/api/push.php";
  const pwaManifestUrl = "/OceanOS/manifest.webmanifest";
  const serviceWorkerUrl = "/oceanos-sw.js";
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
    pushPanel: null,
    pushStatus: null,
    pushEnableButton: null,
    pushDisableButton: null,
    pushAvailable: false,
    pushSubscribed: false,
    pushLoading: false,
    pushPublicKey: "",
    pushMessage: "",
    refreshListenerInstalled: false,
  };
  let serviceWorkerRegistrationPromise = null;

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

  function installPwaMetadata() {
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement("link");
      manifest.rel = "manifest";
      manifest.href = pwaManifestUrl;
      document.head.appendChild(manifest);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const icon = document.createElement("link");
      icon.rel = "apple-touch-icon";
      icon.href = "/OceanOS/assets/favicons/oceanos-180.png";
      document.head.appendChild(icon);
    }
    if (!document.querySelector('meta[name="theme-color"]')) {
      const theme = document.createElement("meta");
      theme.name = "theme-color";
      theme.content = "#071018";
      document.head.appendChild(theme);
    }
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const capable = document.createElement("meta");
      capable.name = "apple-mobile-web-app-capable";
      capable.content = "yes";
      document.head.appendChild(capable);
    }
    if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) {
      const title = document.createElement("meta");
      title.name = "apple-mobile-web-app-title";
      title.content = "OceanOS";
      document.head.appendChild(title);
    }
  }

  function pushSupported() {
    return "Notification" in window
      && "serviceWorker" in navigator
      && "PushManager" in window;
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) {
      return Promise.resolve(null);
    }
    if (!serviceWorkerRegistrationPromise) {
      serviceWorkerRegistrationPromise = navigator.serviceWorker
        .register(serviceWorkerUrl, { scope: "/" })
        .catch((error) => {
          serviceWorkerRegistrationPromise = null;
          throw error;
        });
    }
    return serviceWorkerRegistrationPromise;
  }

  function editableTextTargetFromEvent(event) {
    const rawTarget = event.composedPath && event.composedPath()[0] ? event.composedPath()[0] : event.target;
    const eventTarget = rawTarget && rawTarget.nodeType === 1 ? rawTarget : rawTarget?.parentElement;
    if (!eventTarget || !eventTarget.closest) return null;

    let target = eventTarget.closest('input, textarea, [contenteditable]:not([contenteditable="false"])');
    if (!target) {
      const label = eventTarget.closest("label");
      if (label) {
        target = label.control || (label.getAttribute("for") ? document.getElementById(label.getAttribute("for")) : null);
      }
    }
    if (!target || !target.focus || target.disabled || target.readOnly) return null;
    if (target.matches && target.matches('[contenteditable]:not([contenteditable="false"])')) return target;
    if (target.tagName === "TEXTAREA") return target;
    if (target.tagName !== "INPUT") return null;

    const type = String(target.type || "text").toLowerCase();
    const textTypes = new Set(["text", "search", "email", "password", "tel", "url", "number", "date", "datetime-local", "month", "time", "week"]);
    return textTypes.has(type) ? target : null;
  }

  function focusEditableTextTarget(event) {
    const target = editableTextTargetFromEvent(event);
    if (!target || document.activeElement === target) return;

    try {
      target.focus({ preventScroll: true });
    } catch (error) {
      target.focus();
    }
  }

  function installMobileTextInputBridge() {
    const hasTouch = "ontouchstart" in window || Number(navigator.maxTouchPoints || 0) > 0;
    if (!hasTouch || installMobileTextInputBridge.installed) return;
    installMobileTextInputBridge.installed = true;

    document.addEventListener("touchstart", focusEditableTextTarget, { capture: true, passive: true });
    document.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch") {
        focusEditableTextTarget(event);
      }
    }, { capture: true });
    document.addEventListener("click", focusEditableTextTarget, true);
  }

  function setDocumentClass(className, active) {
    document.documentElement.classList.toggle(className, active);
    if (document.body) {
      document.body.classList.toggle(className, active);
    }
  }

  function watchMediaQuery(query, callback) {
    if (!query) return;
    if (query.addEventListener) {
      query.addEventListener("change", callback);
      return;
    }
    if (query.addListener) {
      query.addListener(callback);
    }
  }

  function installMobileLayoutClasses() {
    if (installMobileLayoutClasses.installed) return;
    installMobileLayoutClasses.installed = true;

    const coarsePointerQuery = window.matchMedia ? window.matchMedia("(pointer: coarse)") : null;
    const compactViewportQuery = window.matchMedia ? window.matchMedia("(max-width: 820px)") : null;
    const standaloneQuery = window.matchMedia ? window.matchMedia("(display-mode: standalone)") : null;

    const update = () => {
      const hasTouch = Boolean(coarsePointerQuery?.matches)
        || "ontouchstart" in window
        || Number(navigator.maxTouchPoints || 0) > 0;
      const compactViewport = Boolean(compactViewportQuery?.matches) || window.innerWidth <= 820;
      const standalone = Boolean(standaloneQuery?.matches) || window.navigator.standalone === true;

      setDocumentClass("oceanos-touch-device", hasTouch);
      setDocumentClass("oceanos-mobile-viewport", compactViewport);
      setDocumentClass("oceanos-standalone-webapp", standalone);
      setDocumentClass("oceanos-mobile-webapp", hasTouch && compactViewport);

      const viewportHeight = Math.max(window.innerHeight || 0, 320);
      document.documentElement.style.setProperty("--oceanos-dvh", `${viewportHeight}px`);
    };

    update();
    watchMediaQuery(coarsePointerQuery, update);
    watchMediaQuery(compactViewportQuery, update);
    watchMediaQuery(standaloneQuery, update);
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("orientationchange", () => window.setTimeout(update, 80), { passive: true });
  }

  async function updateAppBadge(count) {
    if (!window.isSecureContext || !("setAppBadge" in navigator)) return;

    const badgeCount = Math.max(0, Math.floor(Number(count || 0)));
    try {
      if (badgeCount > 0) {
        await navigator.setAppBadge(badgeCount);
      } else if ("clearAppBadge" in navigator) {
        await navigator.clearAppBadge();
      } else {
        await navigator.setAppBadge(0);
      }
    } catch (error) {}
  }

  function urlBase64ToUint8Array(value) {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    const output = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) {
      output[index] = raw.charCodeAt(index);
    }
    return output;
  }

  function renderPushState() {
    if (!notificationState.pushPanel || !notificationState.pushStatus) return;

    const unsupported = !pushSupported();
    const insecure = !window.isSecureContext;
    const denied = pushSupported() && window.Notification.permission === "denied";
    const active = notificationState.pushSubscribed;
    notificationState.pushPanel.classList.toggle("is-active", active);

    let message = notificationState.pushMessage;
    if (!message) {
      if (unsupported) {
        message = "Notifications mobiles indisponibles sur ce navigateur.";
      } else if (insecure) {
        message = "HTTPS requis pour les notifications mobiles.";
      } else if (denied) {
        message = "Autorisation bloquee dans le navigateur.";
      } else if (active) {
        message = "Notifications mobiles actives sur cet appareil.";
      } else {
        message = "Notifications mobiles inactives sur cet appareil.";
      }
    }

    notificationState.pushStatus.textContent = message;
    if (notificationState.pushEnableButton) {
      notificationState.pushEnableButton.hidden = active;
      notificationState.pushEnableButton.disabled = notificationState.pushLoading || unsupported || insecure || denied;
      notificationState.pushEnableButton.textContent = notificationState.pushLoading ? "..." : "Activer";
    }
    if (notificationState.pushDisableButton) {
      notificationState.pushDisableButton.hidden = !active;
      notificationState.pushDisableButton.disabled = notificationState.pushLoading;
    }
  }

  async function refreshPushState() {
    if (!notificationState.pushPanel) return;
    notificationState.pushLoading = true;
    notificationState.pushMessage = "";
    renderPushState();

    try {
      const payload = await fetchJson(pushUrl);
      const push = payload.push && typeof payload.push === "object" ? payload.push : {};
      notificationState.pushAvailable = Boolean(push.available);
      notificationState.pushPublicKey = String(push.publicKey || "");

      if (!pushSupported() || !window.isSecureContext || !notificationState.pushAvailable) {
        notificationState.pushSubscribed = false;
        if (!notificationState.pushAvailable && pushSupported() && window.isSecureContext) {
          notificationState.pushMessage = "Configuration push indisponible sur le serveur.";
        }
        return;
      }

      const registration = await registerServiceWorker();
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      notificationState.pushSubscribed = Boolean(subscription);
      if (subscription && !push.subscribed) {
        await fetchJson(pushUrl, {
          method: "POST",
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        });
      }
    } catch (error) {
      notificationState.pushMessage = "Etat mobile indisponible.";
    } finally {
      notificationState.pushLoading = false;
      renderPushState();
    }
  }

  async function activatePushNotifications() {
    notificationState.pushLoading = true;
    notificationState.pushMessage = "";
    renderPushState();

    try {
      if (!pushSupported()) {
        throw new Error("Notifications mobiles indisponibles sur ce navigateur.");
      }
      if (!window.isSecureContext) {
        throw new Error("HTTPS requis pour les notifications mobiles.");
      }

      const payload = await fetchJson(pushUrl);
      const push = payload.push && typeof payload.push === "object" ? payload.push : {};
      const publicKey = String(push.publicKey || "");
      if (!push.available || !publicKey) {
        throw new Error("Configuration push indisponible sur le serveur.");
      }

      const permission = await window.Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Autorisation non accordee.");
      }

      const registration = await registerServiceWorker();
      if (!registration) {
        throw new Error("Service worker indisponible.");
      }

      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetchJson(pushUrl, {
        method: "POST",
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      notificationState.pushAvailable = true;
      notificationState.pushPublicKey = publicKey;
      notificationState.pushSubscribed = true;
      notificationState.pushMessage = "Notifications mobiles activees.";
    } catch (error) {
      notificationState.pushSubscribed = false;
      notificationState.pushMessage = error.message || "Activation impossible.";
    } finally {
      notificationState.pushLoading = false;
      renderPushState();
    }
  }

  async function deactivatePushNotifications() {
    notificationState.pushLoading = true;
    notificationState.pushMessage = "";
    renderPushState();

    try {
      const registration = await registerServiceWorker();
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      const endpoint = subscription ? subscription.endpoint : "";
      if (subscription) {
        await subscription.unsubscribe();
      }
      await fetchJson(pushUrl, {
        method: "DELETE",
        body: JSON.stringify({ endpoint }),
      });
      notificationState.pushSubscribed = false;
      notificationState.pushMessage = "Notifications mobiles desactivees.";
    } catch (error) {
      notificationState.pushMessage = "Desactivation impossible.";
    } finally {
      notificationState.pushLoading = false;
      renderPushState();
    }
  }

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris";

  function parseOceanDateTime(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const text = String(value).trim();
    if (!text) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const [year, month, day] = text.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
    const normalized = text.replace(" ", "T");
    const withTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
    const date = new Date(withTimezone);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatNotificationDate(value) {
    if (!value) return "";
    const date = parseOceanDateTime(value);
    if (!date) return "";
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: userTimeZone,
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
    if (notificationState.loaded) {
      void updateAppBadge(notificationState.unreadCount);
    }

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
          const targetUrl = notificationTargetUrl(notification);
          if (targetUrl) {
            window.location.href = targetUrl;
          }
        });
      });

      notificationState.list.appendChild(item);
    });
  }

  function notificationTargetUrl(notification) {
    const payload = notification && typeof notification.payload === "object" && notification.payload
      ? notification.payload
      : {};
    const messageId = Number(payload.messageId || 0);
    if ((notification.module === "NautiMail" || notification.type === "new_mail") && messageId > 0) {
      return `/NautiMail/?messageId=${encodeURIComponent(String(messageId))}`;
    }

    return notification.actionUrl || "";
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

    const pushPanel = document.createElement("div");
    pushPanel.className = "oceanos-push-panel";
    const pushStatus = document.createElement("p");
    pushStatus.className = "oceanos-push-status";
    const pushActions = document.createElement("div");
    pushActions.className = "oceanos-push-actions";
    const pushEnableButton = document.createElement("button");
    pushEnableButton.type = "button";
    pushEnableButton.textContent = "Activer";
    const pushDisableButton = document.createElement("button");
    pushDisableButton.type = "button";
    pushDisableButton.textContent = "Desactiver";
    pushDisableButton.hidden = true;
    pushActions.append(pushEnableButton, pushDisableButton);
    pushPanel.append(pushStatus, pushActions);

    const list = document.createElement("div");
    list.className = "oceanos-notification-list";
    panel.append(header, pushPanel, status, list);
    root.append(button, panel);
    document.body.appendChild(root);

    notificationState.root = root;
    notificationState.button = button;
    notificationState.badge = badge;
    notificationState.panel = panel;
    notificationState.list = list;
    notificationState.status = status;
    notificationState.pushPanel = pushPanel;
    notificationState.pushStatus = pushStatus;
    notificationState.pushEnableButton = pushEnableButton;
    notificationState.pushDisableButton = pushDisableButton;

    pushEnableButton.addEventListener("click", (event) => {
      event.preventDefault();
      void activatePushNotifications();
    });
    pushDisableButton.addEventListener("click", (event) => {
      event.preventDefault();
      void deactivatePushNotifications();
    });

    button.addEventListener("click", () => {
      notificationState.open = !notificationState.open;
      root.classList.toggle("is-open", notificationState.open);
      button.setAttribute("aria-expanded", notificationState.open ? "true" : "false");
      if (notificationState.open) {
        void refreshNotifications().catch(() => setNotificationStatus("Notifications indisponibles."));
        void refreshPushState();
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
    void refreshPushState();
    if (!notificationState.timer) {
      notificationState.timer = window.setInterval(() => {
        void refreshNotifications().catch(() => {});
      }, 10000);
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
      installPwaMetadata();
      installMobileLayoutClasses();
      installMobileTextInputBridge();
      void registerServiceWorker().catch(() => {});
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
