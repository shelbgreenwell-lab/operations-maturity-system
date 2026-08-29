/*
 * Operations Maturity System
 * Explore the System engine.
 *
 * Responsible for:
 * - rendering the six operating layers as a connected system
 * - progressive disclosure of each layer's detail on selection
 * - deep-linking a single layer via ?layer=<id>
 * - cross-linking depends-on / enables relationships and related
 *   learning resources
 *
 * Layer content lives in /data/operating-layers.json.
 */

(function (global) {
  'use strict';

  var LAYER_NAMES = {
    direction: 'Direction', design: 'Design', execution: 'Execution',
    management: 'Management', intelligence: 'Intelligence', evolution: 'Evolution'
  };
  var LAYER_COLOR_VAR = {
    direction: '--layer-direction', design: '--layer-design', execution: '--layer-execution',
    management: '--layer-management', intelligence: '--layer-intelligence', evolution: '--layer-evolution'
  };

  var layers = [];
  var mount = null;

  function byId(id) { return document.getElementById(id); }

  function relationPills(ids, onClick) {
    return ids.map(function (id) {
      return '<button type="button" class="pill" data-jump="' + id + '">' + (LAYER_NAMES[id] || id) + '</button>';
    }).join('');
  }

  function renderDetail(layer) {
    var weakHtml = layer.weakSignals.map(function (s) { return '<li>' + s + '</li>'; }).join('');
    var strongHtml = layer.strongSignals.map(function (s) { return '<li>' + s + '</li>'; }).join('');
    var topicsHtml = layer.topics.map(function (t) { return '<span class="pill">' + t + '</span>'; }).join('');
    var dependsHtml = relationPills(layer.dependsOn || []);
    var enablesHtml = relationPills(layer.enables || []);
    var resourcesHtml = global.OMSLinks ? global.OMSLinks.renderList(layer.relatedResources) : '';
    var highlight = layer.highlight
      ? '<div class="callout" style="margin:var(--space-5) 0">' + layer.highlight + '</div>'
      : '';

    return '' +
      '<p class="lede" style="max-width:70ch">' + layer.purpose + '</p>' +
      highlight +
      '<div class="tag-list" style="margin-top:var(--space-5)">' + topicsHtml + '</div>' +
      '<div class="layer-detail__grid">' +
        '<div class="layer-detail__block">' +
          '<h4>What Weak Maturity Looks Like</h4>' +
          '<ul class="layer-detail__weak">' + weakHtml + '</ul>' +
        '</div>' +
        '<div class="layer-detail__block">' +
          '<h4>What Strong Maturity Looks Like</h4>' +
          '<ul class="layer-detail__strong">' + strongHtml + '</ul>' +
        '</div>' +
        '<div class="layer-detail__block">' +
          '<h4>What It Depends On</h4>' +
          '<div class="tag-list">' + (dependsHtml || '<span class="text-dim">Nothing upstream &mdash; this is where direction originates.</span>') + '</div>' +
        '</div>' +
        '<div class="layer-detail__block">' +
          '<h4>What It Enables</h4>' +
          '<div class="tag-list">' + (enablesHtml || '') + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="margin-top:var(--space-6)">' +
        '<h4 style="font-family:var(--font-mono);font-size:var(--step--1);letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-dim);margin-bottom:var(--space-3)">Related Learning</h4>' +
        '<div class="related-links">' + resourcesHtml + '</div>' +
      '</div>';
  }

  function closeAll() {
    mount.querySelectorAll('.layer-row').forEach(function (row) { row.classList.remove('is-active'); });
    mount.querySelectorAll('.layer-detail').forEach(function (detail) { detail.classList.remove('is-open'); });
  }

  function openLayer(id) {
    var row = mount.querySelector('.layer-row[data-layer="' + id + '"]');
    var detail = mount.querySelector('.layer-detail[data-layer="' + id + '"]');
    if (!row || !detail) return;

    var wasOpen = row.classList.contains('is-active');
    closeAll();
    if (!wasOpen) {
      row.classList.add('is-active');
      detail.classList.add('is-open');
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function render() {
    mount.innerHTML = layers.map(function (layer) {
      return '' +
        '<button type="button" class="layer-row" data-layer="' + layer.id + '" style="--layer-color:var(' + LAYER_COLOR_VAR[layer.id] + ')">' +
          '<span class="layer-row__number">' + layer.number + '</span>' +
          '<span class="layer-row__name">' + layer.name + '</span>' +
          '<span class="layer-row__question">' + layer.question + '</span>' +
          '<span class="layer-row__toggle">+</span>' +
        '</button>' +
        '<div class="layer-detail" data-layer="' + layer.id + '">' + renderDetail(layer) + '</div>';
    }).join('');

    mount.querySelectorAll('.layer-row').forEach(function (row) {
      row.addEventListener('click', function () { openLayer(row.getAttribute('data-layer')); });
    });

    mount.querySelectorAll('[data-jump]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openLayer(btn.getAttribute('data-jump'));
      });
    });
  }

  function init() {
    mount = byId('layer-stack-mount');
    if (!mount) return;

    global.OMSData.load('operating-layers.json').then(function (data) {
      layers = data.layers;
      render();

      var params = new URLSearchParams(global.location.search);
      var requested = params.get('layer');
      if (requested && layers.some(function (l) { return l.id === requested; })) {
        openLayer(requested);
      }
    });
  }

  global.OMSExplore = { init: init };
})(window);
