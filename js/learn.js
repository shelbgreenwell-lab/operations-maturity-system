/*
 * Operations Maturity System
 * Learn — knowledge library engine.
 *
 * Responsible for:
 * - rendering the resource library
 * - filtering resources by operating layer
 * - progressive disclosure of full resource detail
 * - deep-linking a single resource via ?resource=<id>
 *
 * Resource content lives in /data/resources.json.
 */

(function (global) {
  'use strict';

  var LAYER_NAMES = {
    direction: 'Direction', design: 'Design', execution: 'Execution',
    management: 'Management', intelligence: 'Intelligence', evolution: 'Evolution'
  };
  var LAYER_ORDER = ['direction', 'design', 'execution', 'management', 'intelligence', 'evolution'];

  var resources = [];
  var activeFilter = 'all';
  var els = {};

  function byId(id) { return document.getElementById(id); }

  function renderFilters() {
    var pills = ['<button type="button" class="resource-filter is-active" data-filter="all">All</button>'];
    LAYER_ORDER.forEach(function (id) {
      pills.push('<button type="button" class="resource-filter" data-filter="' + id + '">' + LAYER_NAMES[id] + '</button>');
    });
    els.filters.innerHTML = pills.join('');

    els.filters.querySelectorAll('.resource-filter').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeFilter = btn.getAttribute('data-filter');
        els.filters.querySelectorAll('.resource-filter').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        renderGrid();
      });
    });
  }

  function renderGrid() {
    var visible = activeFilter === 'all' ? resources : resources.filter(function (r) { return r.layer === activeFilter; });
    els.grid.innerHTML = visible.map(function (r) {
      return '' +
        '<button type="button" class="card card--interactive resource-card" data-id="' + r.id + '" style="text-align:left">' +
          '<span class="badge badge--outline">' + LAYER_NAMES[r.layer] + '</span>' +
          '<h3>' + r.title + '</h3>' +
          '<p class="text-muted" style="font-size:var(--step--1)">' + r.definition + '</p>' +
        '</button>';
    }).join('');

    els.grid.querySelectorAll('.resource-card').forEach(function (card) {
      card.addEventListener('click', function () { openResource(card.getAttribute('data-id')); });
    });
  }

  function listBlock(title, items) {
    return '<div class="outcome-block"><h4>' + title + '</h4><ul>' +
      items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul></div>';
  }

  function openResource(id) {
    var resource = resources.filter(function (r) { return r.id === id; })[0];
    if (!resource) return;

    var relatedLinks = (resource.relatedConcepts || []).map(function (rid) {
      return { label: rid, type: 'resource', id: rid };
    });

    els.detail.innerHTML =
      '<span class="badge badge--accent">' + LAYER_NAMES[resource.layer] + '</span>' +
      '<h2 style="margin:var(--space-3) 0">' + resource.title + '</h2>' +
      '<p class="lede">' + resource.definition + '</p>' +
      '<div class="resource-detail__grid">' +
        '<div class="outcome-block"><h4>Why It Matters</h4><p class="text-muted">' + resource.whyItMatters + '</p></div>' +
        '<div class="outcome-block"><h4>Questions A Strong Operator Should Ask</h4><ul>' +
          resource.operatorQuestions.map(function (q) { return '<li class="operator-question">' + q + '</li>'; }).join('') + '</ul></div>' +
        '<div class="outcome-block"><h4>What Good Looks Like</h4><p class="text-muted">' + resource.goodLooksLike + '</p></div>' +
        '<div class="outcome-block"><h4>What Bad Looks Like</h4><p class="text-muted">' + resource.badLooksLike + '</p></div>' +
      '</div>' +
      listBlock('Common Failure Modes', resource.failureModes) +
      '<div style="margin-top:var(--space-5)">' +
        '<h4 style="font-family:var(--font-mono);font-size:var(--step--1);letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-dim);margin-bottom:var(--space-3)">Related Concepts</h4>' +
        '<div class="related-links">' + (global.OMSLinks ? global.OMSLinks.renderList(relatedLinks) : '') + '</div>' +
      '</div>' +
      '<button type="button" class="btn btn--ghost" id="close-resource" style="margin-top:var(--space-6)">Close</button>';

    els.detail.classList.add('is-open');
    els.detail.scrollIntoView({ behavior: 'smooth', block: 'start' });

    var closeBtn = byId('close-resource');
    if (closeBtn) closeBtn.addEventListener('click', function () { els.detail.classList.remove('is-open'); });
  }

  function init() {
    els.filters = byId('resource-filters');
    els.grid = byId('resource-grid');
    els.detail = byId('resource-detail');
    if (!els.grid) return;

    global.OMSData.load('resources.json').then(function (data) {
      resources = data.resources;
      renderFilters();
      renderGrid();

      var params = new URLSearchParams(global.location.search);
      var requested = params.get('resource');
      if (requested && resources.some(function (r) { return r.id === requested; })) {
        openResource(requested);
      }
    });
  }

  global.OMSLearn = { init: init };
})(window);
