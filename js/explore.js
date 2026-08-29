/*
 * Operations Maturity System
 * Explore the System engine.
 *
 * Responsible for:
 * - rendering the six operating layers as a connected system, in
 *   both a List View (accordion) and a System View (a simple SVG
 *   node graph of the six layers and their dependency chain)
 * - drilling into a layer's operational domains
 * - opening a domain's resource detail (full flagship template or
 *   the lightweight panel for domains not yet fully developed)
 * - breadcrumb and lateral prev/next navigation between domains
 * - deep-linking via ?layer=<id> and &domain=<id>
 *
 * Layer and domain content lives in /data/operating-layers.json;
 * flagship resource depth lives in /data/resources.json. Rendering
 * of the resource/domain panel itself is shared with Learn via
 * js/resource-detail.js.
 */

(function (global) {
  'use strict';

  var LAYER_COLOR_VAR = {
    direction: '--layer-direction', design: '--layer-design', execution: '--layer-execution',
    management: '--layer-management', intelligence: '--layer-intelligence', evolution: '--layer-evolution'
  };

  var knowledge = null; // { layers, domains, resourcesById }
  var els = {};
  var state = { view: 'list', layerId: null, domainId: null };

  function byId(id) { return document.getElementById(id); }

  function layerById(id) {
    return knowledge.layers.filter(function (l) { return l.id === id; })[0];
  }

  function domainById(layerId, domainId) {
    var layer = layerById(layerId);
    if (!layer) return null;
    return layer.domains.filter(function (d) { return d.id === domainId; })[0] || null;
  }

  function updateUrl() {
    var params = new URLSearchParams();
    if (state.layerId) params.set('layer', state.layerId);
    if (state.domainId) params.set('domain', state.domainId);
    var qs = params.toString();
    var newUrl = global.location.pathname + (qs ? '?' + qs : '');
    global.history.replaceState(null, '', newUrl);
  }

  /* ----------------------------------------------------------
     View toggle
     ---------------------------------------------------------- */

  function renderViewToggle() {
    if (!els.viewToggle) return;
    els.viewToggle.innerHTML =
      '<button type="button" data-view="list" class="' + (state.view === 'list' ? 'is-active' : '') + '">List View</button>' +
      '<button type="button" data-view="system" class="' + (state.view === 'system' ? 'is-active' : '') + '">System View</button>';

    els.viewToggle.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.view = btn.getAttribute('data-view');
        renderViewToggle();
        renderActiveView();
      });
    });
  }

  function renderActiveView() {
    if (state.view === 'list') {
      els.listView.hidden = false;
      els.systemView.hidden = true;
      renderListView();
    } else {
      els.listView.hidden = true;
      els.systemView.hidden = false;
      renderSystemMap();
    }
  }

  /* ----------------------------------------------------------
     List view (accordion of six layers)
     ---------------------------------------------------------- */

  function renderListView() {
    els.layerStack.innerHTML = knowledge.layers.map(function (layer) {
      var isOpen = layer.id === state.layerId;
      return '' +
        '<button type="button" class="layer-row' + (isOpen ? ' is-active' : '') + '" data-layer="' + layer.id +
          '" style="--layer-color:var(' + LAYER_COLOR_VAR[layer.id] + ')">' +
          '<span class="layer-row__number">' + layer.number + '</span>' +
          '<span class="layer-row__name">' + layer.name + '</span>' +
          '<span class="layer-row__question">' + layer.question + '</span>' +
          '<span class="layer-row__toggle">+</span>' +
        '</button>' +
        '<div class="layer-detail' + (isOpen ? ' is-open' : '') + '" data-layer-panel="' + layer.id + '">' +
          (isOpen ? renderLayerPanel(layer) : '') +
        '</div>';
    }).join('');

    els.layerStack.querySelectorAll('.layer-row').forEach(function (row) {
      row.addEventListener('click', function () {
        var id = row.getAttribute('data-layer');
        selectLayer(state.layerId === id ? null : id, { keepDomain: false });
      });
    });

    bindDomainGrid(els.layerStack);
  }

  function renderLayerPanel(layer) {
    return '' +
      '<p class="lede" style="max-width:70ch">' + layer.purpose + '</p>' +
      (layer.highlight ? '<div class="callout" style="margin:var(--space-5) 0">' + layer.highlight + '</div>' : '') +
      renderDomainGrid(layer);
  }

  /* ----------------------------------------------------------
     Domain grid (shared between List View and System View)
     ---------------------------------------------------------- */

  function renderDomainGrid(layer) {
    var cards = layer.domains.map(function (domain) {
      var flagshipBadge = domain.isFlagship ? '<span class="badge badge--accent">Flagship</span>' : '<span class="badge badge--outline">Foundational</span>';
      return '' +
        '<button type="button" class="card card--interactive domain-card" data-layer="' + layer.id + '" data-domain="' + domain.id + '" style="text-align:left">' +
          flagshipBadge +
          '<h4 style="margin:var(--space-2) 0 0">' + domain.name + '</h4>' +
        '</button>';
    }).join('');
    return '<div class="card-grid" style="margin-top:var(--space-5)">' + cards + '</div>';
  }

  function bindDomainGrid(container) {
    container.querySelectorAll('.domain-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        e.stopPropagation();
        selectDomain(card.getAttribute('data-layer'), card.getAttribute('data-domain'));
      });
    });
  }

  /* ----------------------------------------------------------
     System view: a simple SVG ring of the six layers
     ---------------------------------------------------------- */

  function renderSystemMap() {
    var order = ['direction', 'design', 'execution', 'management', 'intelligence', 'evolution'];
    var size = 420;
    var center = size / 2;
    var radius = 150;

    var positions = {};
    order.forEach(function (id, i) {
      var angle = (Math.PI * 2 * i) / order.length - Math.PI / 2;
      positions[id] = { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
    });

    var edges = order.map(function (id, i) {
      var next = order[(i + 1) % order.length];
      return { from: id, to: next };
    });

    var edgeSvg = edges.map(function (edge) {
      var a = positions[edge.from];
      var b = positions[edge.to];
      var highlighted = state.layerId && (edge.from === state.layerId || edge.to === state.layerId);
      return '<line class="system-map__edge' + (highlighted ? ' is-highlighted' : '') + '" x1="' + a.x + '" y1="' + a.y +
        '" x2="' + b.x + '" y2="' + b.y + '" marker-end="url(#arrow)"></line>';
    }).join('');

    var nodeSvg = order.map(function (id) {
      var layer = layerById(id);
      var pos = positions[id];
      var isActive = state.layerId === id;
      return '' +
        '<g class="system-map__node' + (isActive ? ' is-active' : '') + '" data-layer="' + id + '" transform="translate(' + pos.x + ',' + pos.y + ')">' +
          '<circle r="34"></circle>' +
          '<text dy="-4">' + layer.number + '</text>' +
          '<text dy="14">' + layer.name.toUpperCase() + '</text>' +
        '</g>';
    }).join('');

    els.systemMap.innerHTML =
      '<svg class="system-map" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="System map of the six operating layers">' +
        '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
          '<path d="M0,0 L10,5 L0,10 z" fill="var(--color-border-strong)"></path>' +
        '</marker></defs>' +
        edgeSvg + nodeSvg +
      '</svg>';

    els.systemMap.querySelectorAll('.system-map__node').forEach(function (node) {
      node.addEventListener('click', function () {
        var id = node.getAttribute('data-layer');
        selectLayer(state.layerId === id ? null : id, { keepDomain: false });
        renderSystemMap();
        renderSystemDomainGrid();
      });
    });

    renderSystemDomainGrid();
  }

  function renderSystemDomainGrid() {
    if (!els.systemDomainGrid) return;
    if (!state.layerId) {
      els.systemDomainGrid.innerHTML = '<p class="text-muted" style="text-align:center">Select a layer above to see its operational domains.</p>';
      return;
    }
    var layer = layerById(state.layerId);
    els.systemDomainGrid.innerHTML =
      '<div class="section-head" style="margin-top:var(--space-6)"><span class="eyebrow">' + layer.number + ' &mdash; ' + layer.name + '</span><p class="lede">' + layer.purpose + '</p></div>' +
      renderDomainGrid(layer);
    bindDomainGrid(els.systemDomainGrid);
  }

  /* ----------------------------------------------------------
     Selection + resource panel
     ---------------------------------------------------------- */

  function selectLayer(layerId, opts) {
    state.layerId = layerId;
    if (!opts || !opts.keepDomain) state.domainId = null;
    updateUrl();
    if (!state.domainId) hideResourcePanel();
    if (state.view === 'list') renderListView();
  }

  function selectDomain(layerId, domainId) {
    state.layerId = layerId;
    state.domainId = domainId;
    updateUrl();
    renderResourcePanel();
    if (els.resourcePanel) els.resourcePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hideResourcePanel() {
    if (els.resourcePanel) els.resourcePanel.hidden = true;
  }

  function renderResourcePanel() {
    var layer = layerById(state.layerId);
    var domain = domainById(state.layerId, state.domainId);
    if (!layer || !domain) return;

    els.resourcePanel.hidden = false;

    global.OMSResourceDetail.renderBreadcrumb(els.breadcrumb, [
      { label: 'Operating System', href: global.OMSData.href('pages/explore.html') },
      { label: layer.name, href: global.OMSData.href('pages/explore.html?layer=' + layer.id) },
      { label: domain.name }
    ]);

    if (domain.isFlagship) {
      var resource = knowledge.resourcesById[domain.resourceId];
      global.OMSResourceDetail.renderFlagship(resource, els.resourceDetail);
    } else {
      global.OMSResourceDetail.renderLight(Object.assign({ layerName: layer.name }, domain), els.resourceDetail);
    }

    var domains = layer.domains;
    var idx = domains.findIndex(function (d) { return d.id === domain.id; });
    var prevDomain = domains[(idx - 1 + domains.length) % domains.length];
    var nextDomain = domains[(idx + 1) % domains.length];

    global.OMSResourceDetail.renderDomainNav(els.domainNav,
      { name: prevDomain.name, onClick: function () { selectDomain(layer.id, prevDomain.id); } },
      { name: nextDomain.name, onClick: function () { selectDomain(layer.id, nextDomain.id); } }
    );
  }

  /* ----------------------------------------------------------
     Init
     ---------------------------------------------------------- */

  function init() {
    els.viewToggle = byId('explore-view-toggle');
    els.listView = byId('explore-list-view');
    els.systemView = byId('explore-system-view');
    els.layerStack = byId('layer-stack-mount');
    els.systemMap = byId('system-map-mount');
    els.systemDomainGrid = byId('system-domain-grid-mount');
    els.resourcePanel = byId('resource-panel');
    els.breadcrumb = byId('explore-breadcrumb');
    els.resourceDetail = byId('resource-detail-mount');
    els.domainNav = byId('domain-nav-mount');

    if (!els.layerStack) return;

    global.OMSData.loadKnowledge().then(function (k) {
      knowledge = k;

      var params = new URLSearchParams(global.location.search);
      var requestedLayer = params.get('layer');
      var requestedDomain = params.get('domain');

      if (requestedLayer && layerById(requestedLayer)) {
        state.layerId = requestedLayer;
        if (requestedDomain && domainById(requestedLayer, requestedDomain)) {
          state.domainId = requestedDomain;
        }
      }

      renderViewToggle();
      renderActiveView();

      if (state.domainId) renderResourcePanel();
    });
  }

  global.OMSExplore = { init: init };
})(window);
