const CACHE_NAME = "oceanos-pwa-20260505-mobile-keyboard";
const CORE_ASSETS = [
  "/OceanOS/",
  "/OceanOS/manifest.webmanifest",
  "/OceanOS/assets/guard.css",
  "/OceanOS/assets/guard.js",
  "/OceanOS/assets/oceanos.css",
  "/OceanOS/assets/oceanos.js",
  "/OceanOS/assets/favicons/oceanos.svg",
  "/OceanOS/assets/favicons/oceanos-192.png",
  "/OceanOS/assets/favicons/oceanos-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => undefined)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key !== CACHE_NAME && key.startsWith("oceanos-pwa-"))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/OceanOS/"))
    );
    return;
  }

  const cacheKey = CORE_ASSETS.includes(url.pathname) ? url.pathname : "";
  if (!cacheKey && !url.pathname.startsWith("/OceanOS/assets/favicons/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(cacheKey || request))
  );
});

function oceanosNotificationUrl(value) {
  try {
    return new URL(value || "/OceanOS/", self.location.origin).href;
  } catch (error) {
    return new URL("/OceanOS/", self.location.origin).href;
  }
}

function oceanosBadgeCount(value) {
  const count = Math.floor(Number(value || 0));
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

function oceanosSetAppBadge(count) {
  const badgeCount = oceanosBadgeCount(count);
  const workerNavigator = self.navigator || {};
  if (!("setAppBadge" in workerNavigator)) {
    return Promise.resolve();
  }

  try {
    if (badgeCount > 0) {
      return workerNavigator.setAppBadge(badgeCount).catch(() => undefined);
    }
    if ("clearAppBadge" in workerNavigator) {
      return workerNavigator.clearAppBadge().catch(() => undefined);
    }
    return workerNavigator.setAppBadge(0).catch(() => undefined);
  } catch (error) {
    return Promise.resolve();
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {};
  }

  const title = data.title || "OceanOS";
  const options = {
    body: data.body || "",
    icon: data.icon || "/OceanOS/assets/favicons/oceanos-192.png",
    badge: data.badge || "/OceanOS/assets/favicons/oceanos-192.png",
    tag: data.tag || `oceanos-${Date.now()}`,
    data: {
      url: oceanosNotificationUrl(data.url),
      notificationId: Number(data.notificationId || 0),
    },
    requireInteraction: false,
  };

  event.waitUntil(Promise.all([
    oceanosSetAppBadge(data.badgeCount || data.unreadCount || 0),
    self.registration.showNotification(title, options),
  ]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = oceanosNotificationUrl(event.notification?.data?.url);

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    for (const client of windows) {
      const clientUrl = new URL(client.url);
      if (clientUrl.origin !== self.location.origin) continue;
      if ("focus" in client) await client.focus();
      if ("navigate" in client) return client.navigate(targetUrl);
      return undefined;
    }

    if (self.clients.openWindow) {
      return self.clients.openWindow(targetUrl);
    }
    return undefined;
  })());
});
