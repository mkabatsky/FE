// Service worker for the tab page: lets it open offline and pick up new versions when online.
// Bump CACHE (v2 -> v3 ...) whenever you upload a new index.html so tablets refresh.
// The three apps inside the tabs are looked after by their own service workers, not this one.
var CACHE = "apps-page-v2";
var CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(CORE.map(function(u){ return c.add(u).catch(function(){}); }));
  }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      // only this page's old caches: the apps on the same address keep theirs
      return Promise.all(keys.filter(function(k){ return k.indexOf("apps-page-") === 0 && k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // this page's own files, plus the site's config.js it reads the account type with:
  // network first so new versions arrive right away, cached copy when offline
  var mine = url.pathname.indexOf(new URL(self.registration.scope).pathname) === 0;
  if (!mine && !/\/config\.js$/.test(url.pathname)) return;
  e.respondWith(
    fetch(req, {cache: "no-cache"}).then(function(res){
      if (res && res.ok) {
        var copy = res.clone();
        var key = req.mode === "navigate" ? "./index.html" : req;
        caches.open(CACHE).then(function(c){ c.put(key, copy); });
      }
      return res;
    }).catch(function(){
      return caches.open(CACHE).then(function(c){
        return c.match(req).then(function(r){
          return r || (req.mode === "navigate" ? c.match("./index.html") : Response.error());
        });
      });
    })
  );
});
