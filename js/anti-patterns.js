/*
 * Operations Maturity System
 * Anti-Patterns library engine.
 *
 * Responsible for:
 * - rendering the anti-pattern library
 * - progressive disclosure of full anti-pattern detail
 * - deep-linking a single anti-pattern via ?pattern=<id>
 *
 * Anti-pattern content lives in /data/anti-patterns.json.
 */

(function (global) {
  'use strict';

  var patterns = [];
  var els = {};

  function byId(id) { return document.getElementById(id); }

  function renderGrid() {
    els.grid.innerHTML = patterns.map(function (p) {
      return '' +
        '<button type="button" class="antipattern-card card--interactive" data-id="' + p.id + '" style="text-align:left">' +
          '<div class="card__eyebrow">Anti-Pattern</div>' +
          '<h3 style="margin:var(--space-2) 0">' + p.name + '</h3>' +
          '<p class="text-muted" style="font-size:var(--step--1)">' + p.looksLike + '</p>' +
        '</button>';
    }).join('');

    els.grid.querySelectorAll('.antipattern-card').forEach(function (card) {
      card.addEventListener('click', function () { openPattern(card.getAttribute('data-id')); });
    });
  }

  function openPattern(id) {
    var p = patterns.filter(function (x) { return x.id === id; })[0];
    if (!p) return;

    var signalsHtml = p.signals.map(function (s) { return '<li>' + s + '</li>'; }).join('');
    var linksHtml = global.OMSLinks ? global.OMSLinks.renderList(p.investigate) : '';

    els.detail.innerHTML =
      '<span class="badge badge--accent">Anti-Pattern</span>' +
      '<h2 style="margin:var(--space-3) 0">' + p.name + '</h2>' +
      '<p class="lede">' + p.looksLike + '</p>' +
      '<div class="antipattern-detail__grid">' +
        '<div class="outcome-block"><h4>Why It Happens</h4><p class="text-muted">' + p.whyItHappens + '</p></div>' +
        '<div class="outcome-block"><h4>Why It Feels Reasonable</h4><p class="text-muted">' + p.whyItFeelsReasonable + '</p></div>' +
        '<div class="outcome-block"><h4>What It Actually Breaks</h4><p class="text-muted">' + p.whatItBreaks + '</p></div>' +
        '<div class="outcome-block"><h4>Signals</h4><ul>' + signalsHtml + '</ul></div>' +
      '</div>' +
      '<div class="constraint-panel" style="margin-top:var(--space-5)">' +
        '<span class="eyebrow">Likely System Cause</span>' +
        '<p style="margin-top:var(--space-2)">' + p.likelySystemCause + '</p>' +
      '</div>' +
      '<div style="margin-top:var(--space-5)">' +
        '<h4 style="font-family:var(--font-mono);font-size:var(--step--1);letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-dim);margin-bottom:var(--space-3)">Investigate</h4>' +
        '<div class="related-links">' + linksHtml + '</div>' +
      '</div>' +
      '<button type="button" class="btn btn--ghost" id="close-pattern" style="margin-top:var(--space-6)">Close</button>';

    els.detail.classList.add('is-open');
    els.detail.scrollIntoView({ behavior: 'smooth', block: 'start' });

    var closeBtn = byId('close-pattern');
    if (closeBtn) closeBtn.addEventListener('click', function () { els.detail.classList.remove('is-open'); });
  }

  function init() {
    els.grid = byId('antipattern-grid');
    els.detail = byId('antipattern-detail');
    if (!els.grid) return;

    global.OMSData.load('anti-patterns.json').then(function (data) {
      patterns = data.antiPatterns;
      renderGrid();

      var params = new URLSearchParams(global.location.search);
      var requested = params.get('pattern');
      if (requested && patterns.some(function (p) { return p.id === requested; })) {
        openPattern(requested);
      }
    });
  }

  global.OMSAntiPatterns = { init: init };
})(window);
