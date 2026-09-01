/*
 * Operations Maturity System
 * OMS Glossary — a searchable, filterable list of terms specific to
 * how OMS models an operating system. Data lives in data/glossary.json.
 */
(function (global) {
  'use strict';

  var data = null;
  var els = {};
  var state = { query: '', category: '' };

  var CATEGORY_LABELS = { core: 'Core', diagnostic: 'Diagnose', blueprint: 'Blueprint', workbench: 'Workbench', maturity: 'Maturity' };

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderFilters() {
    var categories = [];
    data.terms.forEach(function (t) { if (t.category && categories.indexOf(t.category) === -1) categories.push(t.category); });
    var options = [{ value: '', label: 'All Terms' }].concat(categories.map(function (c) { return { value: c, label: CATEGORY_LABELS[c] || c }; }));
    els.filters.innerHTML = options.map(function (opt) {
      return '<button type="button" class="resource-filter' + (opt.value === state.category ? ' is-active' : '') + '" data-value="' + opt.value + '">' + esc(opt.label) + '</button>';
    }).join('');
    els.filters.querySelectorAll('.resource-filter').forEach(function (btn) {
      btn.addEventListener('click', function () { state.category = btn.getAttribute('data-value'); renderFilters(); renderList(); });
    });
  }

  function renderList() {
    var q = state.query.trim().toLowerCase();
    var terms = data.terms.filter(function (t) {
      if (state.category && t.category !== state.category) return false;
      if (!q) return true;
      return (t.term + ' ' + t.definition).toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return a.term.localeCompare(b.term); });

    if (!terms.length) {
      els.list.innerHTML = '<p class="text-dim">No terms match this search.</p>';
      return;
    }

    els.list.innerHTML = terms.map(function (t) {
      return '' +
        '<div class="card" id="term-' + t.id + '" style="margin-bottom:var(--space-4)">' +
          '<div class="card__eyebrow">' + esc(CATEGORY_LABELS[t.category] || t.category || '') + '</div>' +
          '<h3 style="margin:var(--space-1) 0 var(--space-3)">' + esc(t.term) + '</h3>' +
          '<p>' + esc(t.definition) + '</p>' +
          (t.whatThisIsNot ? '<div class="callout" style="margin-top:var(--space-3)"><strong style="display:block;margin-bottom:var(--space-1);font-family:var(--font-mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--color-accent)">What This Is Not</strong>' + esc(t.whatThisIsNot) + '</div>' : '') +
        '</div>';
    }).join('');
  }

  function init() {
    els.search = document.getElementById('glossary-search');
    els.filters = document.getElementById('glossary-filters');
    els.list = document.getElementById('glossary-list');

    els.search.addEventListener('input', function (e) { state.query = e.target.value; renderList(); });

    global.OMSData.load('glossary.json').then(function (json) {
      data = json;
      renderFilters();

      var params = new URLSearchParams(global.location.search);
      var requestedTerm = params.get('term');
      if (requestedTerm) {
        var match = data.terms.filter(function (t) { return t.id === requestedTerm; })[0];
        if (match) state.query = match.term;
        els.search.value = state.query;
      }

      renderList();

      if (requestedTerm) {
        var el = document.getElementById('term-' + requestedTerm);
        if (el) el.scrollIntoView({ block: 'center' });
      }
    });
  }

  global.OMSGlossary = { init: init };
})(window);
