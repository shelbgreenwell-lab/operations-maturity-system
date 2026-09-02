/*
 * Operations Maturity System
 * Dependency Map — a focused lookup over an Organization Blueprint's
 * relationship graph. Pick one object and see, in plain categories,
 * what it depends on, what it enables, what measures it, what governs
 * it, and who owns it. All of this reads live from js/blueprint-core.js —
 * nothing here is a separate dataset.
 */
(function (global) {
  'use strict';

  var BP = null;
  var els = {};
  var state = { blueprintId: null, target: null };

  function byId(id) { return document.getElementById(id); }

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var OWNED_RELATIONS = { owns: true, contains: true };
  var GOVERNED_RELATIONS = { oversees: true, governedIn: true, hosts: true };
  var MEASURED_RELATIONS = { measuredBy: true, feeds: true, informs: true };

  function classify(relation) {
    if (OWNED_RELATIONS[relation]) return 'owned';
    if (GOVERNED_RELATIONS[relation]) return 'governed';
    if (MEASURED_RELATIONS[relation]) return 'measured';
    return 'depends';
  }

  function nameOf(data, type, id) {
    var item = BP.byId(data[type], id);
    return item ? BP.entityName(type, item) : null;
  }

  /* ----------------------------------------------------------
     Section 49 — risk overlays. Read-only, reusing js/risk-core.js
     and js/resilience-core.js directly; nothing new is stored here.
     ---------------------------------------------------------- */

  function riskOverlayBadges(type, id) {
    var Risk = global.OMSRisk;
    var Res = global.OMSResilience;
    if (!Risk) return '';
    var models = Risk.store.list().filter(function (m) {
      return m.data.relatedBlueprintProjectId === state.blueprintId && m.data.relatedBlueprintType === type && m.data.relatedBlueprintId === id;
    });
    if (!models.length) return '';
    var badges = [];
    models.forEach(function (m) {
      if (Risk.singlePointsOfFailure(m).length) badges.push('SPOF');
      if ((m.data.dependencies || []).some(function (d) { return d.concentrationDescription; })) badges.push('Concentration');
      if (m.data.criticality === 'Critical' || m.data.criticality === 'High') badges.push('Critical Dependency');
    });
    if (Res) {
      var riskIds = models.map(function (m) { return m.id; });
      Res.store.list().filter(function (rm) { return riskIds.indexOf(rm.data.relatedRiskModelId) !== -1; }).forEach(function (rm) {
        var overall = Res.overallHealth(rm);
        if (overall.status === 'Weak' || overall.status === 'Critical') badges.push('Weak Resilience');
      });
    }
    badges = badges.filter(function (b, i) { return badges.indexOf(b) === i; });
    if (!badges.length) return '';
    return badges.map(function (b) { return '<span class="badge badge--outline" style="border-color:var(--color-critical);color:var(--color-critical);margin-left:4px" title="From a linked Risk or Resilience Model">' + esc(b) + '</span>'; }).join('');
  }

  function nodeHtml(n) {
    var bp = BP.store.get(state.blueprintId);
    var name = nameOf(bp.data, n.node.type, n.node.id) || BP.ENTITY_META[n.node.type].label;
    return '<button type="button" class="trace-node" data-node-type="' + n.node.type + '" data-node-id="' + n.node.id + '">' +
      '<span>' + esc(name) + riskOverlayBadges(n.node.type, n.node.id) + '</span>' +
      '<span class="trace-node__relation">' + esc(n.relation) + '</span>' +
    '</button>';
  }

  function group(title, nodes, emptyText) {
    return '<div class="trace-tier">' +
      '<span class="trace-tier__label">' + esc(title) + '</span>' +
      (nodes.length ? '<div class="trace-node-list">' + nodes.map(nodeHtml).join('') + '</div>' : '<p class="text-dim">' + esc(emptyText) + '</p>') +
    '</div>';
  }

  function populateBlueprintSelect() {
    var list = BP.store.list().slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
    if (!list.length) {
      els.empty.hidden = false;
      els.picker.hidden = true;
      return false;
    }
    els.empty.hidden = true;
    els.picker.hidden = false;
    if (!state.blueprintId || !list.some(function (b) { return b.id === state.blueprintId; })) {
      state.blueprintId = list[0].id;
    }
    els.blueprintSelect.innerHTML = list.map(function (b) {
      return '<option value="' + b.id + '"' + (b.id === state.blueprintId ? ' selected' : '') + '>' + esc(b.name) + (b.isSample ? ' (Sample Organization)' : '') + '</option>';
    }).join('');
    return true;
  }

  function populateObjectSelect() {
    var bp = BP.store.get(state.blueprintId);
    var opts = [];
    BP.ENTITY_ORDER.forEach(function (type) {
      (bp.data[type] || []).forEach(function (item) {
        opts.push({ type: type, id: item.id, label: BP.ENTITY_META[type].label + ': ' + BP.entityName(type, item) });
      });
    });
    if (!opts.length) {
      els.objectSelect.innerHTML = '<option value="">No objects mapped in this Blueprint yet</option>';
      els.results.innerHTML = '<p class="text-dim">Add some objects to this Blueprint first, then come back here.</p>';
      state.target = null;
      return;
    }
    if (!state.target || !opts.some(function (o) { return o.type === state.target.type && o.id === state.target.id; })) {
      state.target = { type: opts[0].type, id: opts[0].id };
    }
    els.objectSelect.innerHTML = opts.map(function (o) {
      return '<option value="' + o.type + ':' + o.id + '"' + (o.type === state.target.type && o.id === state.target.id ? ' selected' : '') + '>' + esc(o.label) + '</option>';
    }).join('');
    renderResults();
  }

  function renderResults() {
    var bp = BP.store.get(state.blueprintId);
    var type = state.target.type, id = state.target.id;
    var name = nameOf(bp.data, type, id) || 'Untitled';

    var deps = BP.directDependencies(bp, type, id);
    var enables = BP.directlyEnables(bp, type, id);
    var owned = deps.filter(function (d) { return classify(d.relation) === 'owned'; });
    var governed = deps.filter(function (d) { return classify(d.relation) === 'governed'; });
    var measured = deps.filter(function (d) { return classify(d.relation) === 'measured'; });
    var dependsOn = deps.filter(function (d) { return classify(d.relation) === 'depends'; });

    els.results.innerHTML =
      '<p class="lede" style="margin-bottom:var(--space-5)">Focused on <strong>' + esc(name) + '</strong> (' + esc(BP.ENTITY_META[type].label) + ')' + riskOverlayBadges(type, id) + '</p>' +
      group('Depends On', dependsOn, 'Nothing explicitly linked yet.') +
      group('Enables', enables, 'Nothing explicitly linked yet.') +
      group('Measured By', measured, 'No metric or data source is linked to this yet.') +
      group('Governed By', governed, 'No governance mechanism or operating rhythm is linked to this yet.') +
      group('Owned By', owned, 'No role or team explicitly owns this yet.') +
      '<div style="margin-top:var(--space-5)">' +
        '<a class="btn btn--secondary" href="blueprint.html?blueprint=' + encodeURIComponent(state.blueprintId) + '&focusType=' + encodeURIComponent(type) + '">Open in Blueprint &rarr;</a>' +
      '</div>';

    els.results.querySelectorAll('[data-node-type]').forEach(function (el) {
      el.addEventListener('click', function () {
        state.target = { type: el.getAttribute('data-node-type'), id: el.getAttribute('data-node-id') };
        var opt = els.objectSelect.querySelector('option[value="' + state.target.type + ':' + state.target.id + '"]');
        if (opt) els.objectSelect.value = opt.value;
        renderResults();
      });
    });
  }

  function init() {
    BP = global.OMSBlueprint;
    els.empty = byId('dm-empty');
    els.picker = byId('dm-picker');
    els.blueprintSelect = byId('dm-blueprint-select');
    els.objectSelect = byId('dm-object-select');
    els.results = byId('dm-results');

    if (!populateBlueprintSelect()) return;
    populateObjectSelect();

    els.blueprintSelect.addEventListener('change', function (e) {
      state.blueprintId = e.target.value;
      state.target = null;
      populateObjectSelect();
    });
    els.objectSelect.addEventListener('change', function (e) {
      var idx = e.target.value.indexOf(':');
      state.target = { type: e.target.value.slice(0, idx), id: e.target.value.slice(idx + 1) };
      renderResults();
    });
  }

  global.OMSDependencyMap = { init: init };
})(window);
