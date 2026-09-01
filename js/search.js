/*
 * Operations Maturity System
 * Product-wide search.
 *
 * Always searches the static knowledge base (Resources, Anti-Patterns,
 * Diagnostic Symptoms, Glossary) since that's available on every page
 * via a plain fetch. When Builder/Blueprint/Workbench data is already
 * loaded on the current page (their *-core.js scripts are present),
 * search also includes live user data — Builder projects, Blueprint
 * objects, and Workbench items — without requiring every page to load
 * every engine just so search can reach it everywhere identically.
 *
 * Reuses the modal shell from js/navigation.js rather than building
 * its own overlay.
 */
(function (global) {
  'use strict';

  var staticIndexPromise = null;
  var BUILDER_HREF = { 'operating-model': 'pages/operating-model.html', 'decision-rights': 'pages/decision-rights.html', process: 'pages/process-architect.html' };
  var BUILDER_LABEL = { 'operating-model': 'Operating Model Designer', 'decision-rights': 'Decision Rights Architect', process: 'Process Architect' };

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function href(path) { return global.OMSData ? global.OMSData.href(path) : path; }

  function buildStaticIndex() {
    if (staticIndexPromise) return staticIndexPromise;
    staticIndexPromise = Promise.all([
      global.OMSData.load('resources.json'),
      global.OMSData.load('anti-patterns.json'),
      global.OMSData.load('diagnostics.json'),
      global.OMSData.load('glossary.json'),
      global.OMSData.loadKnowledge()
    ]).then(function (arr) {
      var resources = arr[0].resources || [];
      var antiPatterns = arr[1].antiPatterns || [];
      var diagnostics = arr[2].diagnostics || [];
      var glossary = arr[3].terms || [];
      var knowledge = arr[4];

      var resourceLink = {};
      (knowledge.domains || []).forEach(function (d) {
        if (d.resourceId) resourceLink[d.resourceId] = href('pages/explore.html') + '?layer=' + encodeURIComponent(d.layerId) + '&domain=' + encodeURIComponent(d.id);
      });

      var items = [];
      resources.forEach(function (r) {
        items.push({ type: 'Resource', title: r.title, subtitle: r.question || '', url: resourceLink[r.id] || href('pages/explore.html'), text: [r.title, r.question, r.whatItIs].join(' ').toLowerCase() });
      });
      antiPatterns.forEach(function (p) {
        items.push({ type: 'Anti-Pattern', title: p.name, subtitle: p.looksLike || '', url: href('pages/anti-patterns.html') + '?pattern=' + encodeURIComponent(p.id), text: [p.name, p.looksLike, p.whyItHappens].join(' ').toLowerCase() });
      });
      diagnostics.forEach(function (d) {
        items.push({ type: 'Diagnostic Symptom', title: d.symptom, subtitle: d.description || '', url: href('pages/diagnose.html') + '?symptom=' + encodeURIComponent(d.id), text: [d.symptom, d.description].join(' ').toLowerCase() });
      });
      glossary.forEach(function (g) {
        items.push({ type: 'Glossary', title: g.term, subtitle: g.definition || '', url: href('pages/glossary.html') + '?term=' + encodeURIComponent(g.id), text: [g.term, g.definition].join(' ').toLowerCase() });
      });
      return items;
    });
    return staticIndexPromise;
  }

  function liveIndex() {
    var items = [];

    if (global.OMSBuilder) {
      global.OMSBuilder.store.list().forEach(function (p) {
        items.push({
          type: 'Builder Project', title: p.name, subtitle: BUILDER_LABEL[p.builderType] || p.builderType,
          url: href(BUILDER_HREF[p.builderType] || 'pages/build.html') + '?project=' + encodeURIComponent(p.id),
          text: [p.name, p.builderType].join(' ').toLowerCase()
        });
      });
    }

    if (global.OMSBlueprint) {
      global.OMSBlueprint.store.list().forEach(function (bp) {
        global.OMSBlueprint.ENTITY_ORDER.forEach(function (type) {
          (bp.data[type] || []).forEach(function (item) {
            var name = global.OMSBlueprint.entityName(type, item);
            if (!name || name === 'Untitled' || name.indexOf('Untitled') === 0) return;
            items.push({
              type: 'Blueprint Object', title: name, subtitle: global.OMSBlueprint.ENTITY_META[type].label + ' in ' + bp.name,
              url: href('pages/blueprint.html') + '?blueprint=' + encodeURIComponent(bp.id) + '&focusType=' + encodeURIComponent(type),
              text: name.toLowerCase()
            });
          });
        });
      });
    }

    if (global.OMSWorkbenchCore) {
      var ws = global.OMSWorkbenchCore.load();
      global.OMSWorkbenchCore.ENTITY_ORDER.forEach(function (type) {
        (ws[type] || []).forEach(function (item) {
          var name = global.OMSWorkbenchCore.entityName(type, item);
          if (!name || name === 'Untitled') return;
          items.push({
            type: 'Workbench: ' + global.OMSWorkbenchCore.ENTITY_META[type].label, title: name, subtitle: '',
            url: href('pages/workbench.html'), text: name.toLowerCase()
          });
        });
      });
    }

    if (global.OMSValueStream) {
      global.OMSValueStream.store.list().forEach(function (vs) {
        items.push({ type: 'Value Stream', title: vs.name, subtitle: '', url: href('pages/value-streams.html') + '?valuestream=' + encodeURIComponent(vs.id), text: vs.name.toLowerCase() });
        (vs.data.stages || []).forEach(function (s) {
          if (!s.name) return;
          items.push({ type: 'Value Stream: Stage', title: s.name, subtitle: 'Stage in ' + vs.name, url: href('pages/value-streams.html') + '?valuestream=' + encodeURIComponent(vs.id), text: s.name.toLowerCase() });
        });
        (vs.data.handoffs || []).forEach(function (h) {
          var from = (global.OMSValueStream.byId(vs.data.stages, h.fromStageId) || {}).name;
          var to = (global.OMSValueStream.byId(vs.data.stages, h.toStageId) || {}).name;
          if (!from || !to) return;
          var name = from + ' → ' + to;
          items.push({ type: 'Value Stream: Handoff', title: name, subtitle: 'Handoff in ' + vs.name, url: href('pages/value-streams.html') + '?valuestream=' + encodeURIComponent(vs.id), text: name.toLowerCase() });
        });
      });
    }

    return items;
  }

  var TYPE_ORDER = ['Resource', 'Anti-Pattern', 'Diagnostic Symptom', 'Glossary', 'Builder Project', 'Blueprint Object', 'Value Stream'];

  function renderResults(mount, query, allItems) {
    var q = query.trim().toLowerCase();
    if (!q) {
      mount.innerHTML = '<p class="text-dim">Search resources, anti-patterns, diagnostic symptoms, the glossary, and — where already loaded — your builders, Blueprint objects, and Workbench items.</p>';
      return;
    }
    var matches = allItems.filter(function (item) { return item.text.indexOf(q) !== -1; });
    if (!matches.length) {
      mount.innerHTML = '<p class="text-dim">No matches for &ldquo;' + esc(query) + '&rdquo;.</p>';
      return;
    }

    var byType = {};
    matches.forEach(function (m) { (byType[m.type] = byType[m.type] || []).push(m); });
    var types = Object.keys(byType).sort(function (a, b) {
      var ai = TYPE_ORDER.indexOf(a); var bi = TYPE_ORDER.indexOf(b);
      if (ai === -1) ai = 99; if (bi === -1) bi = 99;
      return ai - bi;
    });

    mount.innerHTML = types.map(function (type) {
      var items = byType[type].slice(0, 8);
      return '<div class="trace-tier"><span class="trace-tier__label">' + esc(type) + ' (' + byType[type].length + ')</span>' +
        '<div class="trace-node-list">' + items.map(function (item) {
          return '<a class="trace-node" href="' + item.url + '" style="text-decoration:none">' +
            '<span>' + esc(item.title) + (item.subtitle ? '<span class="text-dim" style="display:block;font-size:var(--step--1)">' + esc(item.subtitle) + '</span>' : '') + '</span>' +
          '</a>';
        }).join('') + '</div>' +
      '</div>';
    }).join('');
  }

  function open() {
    if (!global.OMSNav) return;
    var html =
      '<button type="button" class="modal-panel__close" data-modal-close aria-label="Close">&times;</button>' +
      '<h3 style="margin-top:0">Search OMS</h3>' +
      '<input type="search" class="search-input" id="search-modal-input" placeholder="Search&hellip;" style="width:100%;margin-bottom:var(--space-4)">' +
      '<div id="search-modal-results"></div>';

    global.OMSNav.openModal(html, function (panel) {
      var input = panel.querySelector('#search-modal-input');
      var resultsMount = panel.querySelector('#search-modal-results');
      var combined = liveIndex();

      buildStaticIndex().then(function (staticItems) {
        combined = combined.concat(staticItems);
        renderResults(resultsMount, input.value, combined);
      });

      renderResults(resultsMount, '', combined);
      input.addEventListener('input', function () { renderResults(resultsMount, input.value, combined); });
    });
  }

  global.OMSSearch = { open: open };
})(window);
