// Service worker: lets the app open offline and pick up new versions when online.
// Bump CACHE (v2 -> v3 ...) whenever you upload a new index.html so tablets refresh.
var CACHE = "field-eng-v3";
var CORE = ["./", "./index.html", "./config.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
// only these outside sites are ever cached; the database (supabase.co) must never be
var CACHEABLE_HOSTS = ["cdn.jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", function(e){
  // each file on its own, so one that is missing (config.js not copied yet) doesn't stop the rest
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(CORE.map(function(u){ return c.add(u).catch(function(){}); }));
  }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      // only this app's old caches: other apps on the same address keep theirs
      return Promise.all(keys.filter(function(k){ return k.indexOf("field-eng-") === 0 && k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // our own files: network first so new versions arrive right away, cached copy when offline
  if (url.origin === self.location.origin) {
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
    return;
  }

  // libraries and fonts from known sites: cached copy first, then network and remember it
  if (CACHEABLE_HOSTS.indexOf(url.hostname) !== -1) {
    e.respondWith(
      caches.open(CACHE).then(function(c){
        return c.match(req).then(function(hit){
          if (hit) return hit;
          return fetch(req).then(function(res){
            if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
            return res;
          });
        });
      })
    );
  }
  // anything else (the database, sign-in) goes straight to the network, never cached
});
