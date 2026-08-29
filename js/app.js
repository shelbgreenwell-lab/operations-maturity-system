/*
 * Operations Maturity System
 * Main application controller.
 *
 * Responsible for:
 * - initializing the application
 * - coordinating shared application behavior
 * - loading core application modules
 * - managing global interactions
 * - rendering the homepage (the one experience with no dedicated
 *   feature engine of its own)
 * - resolving cross-link references shared by every data file
 *   (OMSLinks), since anti-patterns, diagnostics, scenarios, the
 *   assessment, and the layer explorer all point into each other
 *
 * Keep feature-specific logic in its dedicated JavaScript file.
 * Do not allow this file to become a catch-all.
 */

(function (global) {
  'use strict';

  /* ----------------------------------------------------------
     Cross-link resolution
     Shared "link object" shape used across every /data file:
       { label, type: 'resource'|'layer'|'domain'|'antipattern'|'diagnostic'|'page', id, layer? }
     'domain' links carry a `layer` field naming which layer the
     (usually non-flagship) domain belongs to.
     ---------------------------------------------------------- */

  function resolveLink(link) {
    if (!link || !global.OMSData) return '#';
    switch (link.type) {
      case 'resource': return global.OMSData.href('pages/learn.html?resource=' + link.id);
      case 'layer': return global.OMSData.href('pages/explore.html?layer=' + link.id);
      case 'domain': return global.OMSData.href('pages/explore.html?layer=' + link.layer + '&domain=' + link.id);
      case 'antipattern': return global.OMSData.href('pages/anti-patterns.html?pattern=' + link.id);
      case 'diagnostic': return global.OMSData.href('pages/diagnose.html?symptom=' + link.id);
      case 'page': return global.OMSData.href('pages/' + link.id + '.html');
      default: return '#';
    }
  }

  function renderLinkList(links) {
    if (!links || !links.length) return '';
    return links.map(function (link) {
      return '<a href="' + resolveLink(link) + '">' + link.label + '</a>';
    }).join('');
  }

  global.OMSLinks = { resolve: resolveLink, renderList: renderLinkList };

  /* ----------------------------------------------------------
     Homepage
     ---------------------------------------------------------- */

  var CHAIN_STAGES = [
    'Strategy', 'Operating Model', 'Capabilities', 'Roles &amp; Ownership',
    'Processes', 'Standards &amp; Controls', 'Measurement',
    'Operating Rhythms', 'Risks &amp; Opportunities', 'Continuous Improvement'
  ];

  var LAYER_COLOR_VAR = {
    direction: '--layer-direction', design: '--layer-design', execution: '--layer-execution',
    management: '--layer-management', intelligence: '--layer-intelligence', evolution: '--layer-evolution'
  };

  function renderChain() {
    var mount = document.getElementById('operating-chain');
    if (!mount) return;

    var html = CHAIN_STAGES.map(function (stage, i) {
      var connector = i < CHAIN_STAGES.length - 1
        ? '<div class="chain__connector">&#8595;</div>'
        : '';
      return '<div class="chain__node">' + stage + '</div>' + connector;
    }).join('');

    mount.innerHTML = html + '<div class="chain__loop">&#8630; feeds back into Strategy</div>';
  }

  function renderLayerPreview() {
    var mount = document.getElementById('layer-preview');
    if (!mount) return;

    global.OMSData.load('operating-layers.json').then(function (data) {
      mount.innerHTML = data.layers.map(function (layer) {
        return '' +
          '<a class="card card--interactive" style="--layer-color:var(' + LAYER_COLOR_VAR[layer.id] +
            ');border-left:3px solid var(' + LAYER_COLOR_VAR[layer.id] + ')" href="' +
            resolveLink({ type: 'layer', id: layer.id }) + '">' +
            '<div class="card__eyebrow">' + layer.number + '</div>' +
            '<h3 style="margin:var(--space-2) 0">' + layer.name + '</h3>' +
            '<p class="text-muted" style="font-size:var(--step--1)">' + layer.question + '</p>' +
          '</a>';
      }).join('');
    });
  }

  function initHome() {
    renderChain();
    renderLayerPreview();
  }

  /* ----------------------------------------------------------
     Dispatch
     ---------------------------------------------------------- */

  var PAGE_INIT = {
    home: initHome,
    explore: function () { if (global.OMSExplore) global.OMSExplore.init(); },
    assess: function () { if (global.OMSAssessment) global.OMSAssessment.init(); },
    diagnose: function () { if (global.OMSDiagnostics) global.OMSDiagnostics.init(); },
    'scenario-lab': function () { if (global.OMSScenarios) global.OMSScenarios.init(); },
    learn: function () { if (global.OMSLearn) global.OMSLearn.init(); },
    'anti-patterns': function () { if (global.OMSAntiPatterns) global.OMSAntiPatterns.init(); },
    'command-center': function () { if (global.OMSDashboard) global.OMSDashboard.init(); }
  };

  function init() {
    var page = document.body.getAttribute('data-page');
    var fn = PAGE_INIT[page];
    if (fn) fn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
