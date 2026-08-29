/*
 * Operations Maturity System
 * Data access and loading layer.
 *
 * Responsible for:
 * - loading structured content from /data
 * - providing shared access to application data
 * - keeping content separate from application logic
 * - a single, reliable path-resolution strategy so the app
 *   works identically from the repository root (index.html)
 *   and from inside /pages on GitHub Pages
 * - a thin localStorage wrapper used to persist assessment
 *   results and other user state across pages
 *
 * Operational frameworks, assessments, scenarios,
 * diagnostics, resources, and maturity definitions
 * should live in /data rather than being hard-coded
 * into UI or feature logic.
 */

(function (global) {
  'use strict';

  /**
   * Base path resolution.
   *
   * Every page declares its own depth via <body data-base="./">
   * (root) or <body data-base="../"> (pages inside /pages). That
   * single explicit attribute is the source of truth, because it
   * has no dependency on hosting path, repo subpath on GitHub
   * Pages, or trailing slashes. If a page forgets to set it, fall
   * back to sniffing the URL for a "/pages/" segment.
   */
  function resolveBase() {
    var declared = document.body && document.body.getAttribute('data-base');
    if (declared) return declared;
    return /\/pages\//.test(global.location.pathname) ? '../' : './';
  }

  var BASE = resolveBase();
  var cache = {};

  /**
   * Loads a JSON file from /data by filename (e.g. "maturity.json").
   * Returns a cached promise so repeated calls across features
   * don't re-fetch the same file.
   */
  function load(filename) {
    if (cache[filename]) return cache[filename];
    var url = BASE + 'data/' + filename;
    cache[filename] = fetch(url).then(function (response) {
      if (!response.ok) {
        throw new Error('OMSData: failed to load ' + url + ' (' + response.status + ')');
      }
      return response.json();
    }).catch(function (err) {
      console.error(err);
      delete cache[filename];
      throw err;
    });
    return cache[filename];
  }

  function href(path) {
    return BASE + path;
  }

  var STORAGE_PREFIX = 'oms:';

  var storage = {
    get: function (key, fallback) {
      try {
        var raw = global.localStorage.getItem(STORAGE_PREFIX + key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        global.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
        return true;
      } catch (e) {
        console.warn('OMSData: could not persist "' + key + '"', e);
        return false;
      }
    },
    remove: function (key) {
      try {
        global.localStorage.removeItem(STORAGE_PREFIX + key);
      } catch (e) {
        /* ignore */
      }
    }
  };

  global.OMSData = {
    base: BASE,
    href: href,
    load: load,
    storage: storage
  };
})(window);
