/*
 * Operations Maturity System
 * Scenario Lab engine.
 *
 * Responsible for:
 * - loading operational scenarios
 * - presenting decision points
 * - capturing user choices
 * - displaying consequences
 * - revealing system clues
 * - generating final diagnoses
 * - connecting scenarios to relevant operating concepts
 *
 * Scenario content and decision paths live in /data/scenarios.json.
 *
 * Core principle:
 * The place where failure appears is often not
 * the place where failure begins.
 */

(function (global) {
  'use strict';

  var scenario = null;
  var els = {};
  var state = { nodeId: null, trail: [] };

  function byId(id) {
    return document.getElementById(id);
  }

  function renderIntro() {
    if (!els.intro || !scenario) return;
    els.introMount.innerHTML =
      '<span class="eyebrow">Scenario</span>' +
      '<h2 style="margin:var(--space-3) 0">' + scenario.title + '</h2>' +
      '<p class="lede">' + scenario.context + '</p>';
  }

  function renderTrail() {
    if (!els.trail) return;
    els.trail.innerHTML = state.trail.map(function (t) {
      return '<span class="scenario-trail__step">' + t + '</span>';
    }).join('');
  }

  function goToNode(nodeId) {
    state.nodeId = nodeId;
    var node = scenario.nodes[nodeId];

    if (node.terminal) {
      renderReveal(node);
      return;
    }

    renderTrail();

    var clueHtml = node.clue ? '<div class="scenario-clue">' + node.clue + '</div>' : '';
    var choicesHtml = node.choices.map(function (choice, i) {
      return '<button type="button" class="option" data-index="' + i + '">' +
        '<span class="option__marker">' + String.fromCharCode(65 + i) + '</span>' +
        '<span>' + choice.text + '</span>' +
        '</button>';
    }).join('');

    els.nodeMount.innerHTML =
      '<div class="scenario-node">' +
        clueHtml +
        '<h3 style="margin:var(--space-5) 0 var(--space-4)">' + node.prompt + '</h3>' +
        '<div class="option-list">' + choicesHtml + '</div>' +
      '</div>';

    els.nodeMount.querySelectorAll('.option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var choice = node.choices[parseInt(btn.getAttribute('data-index'), 10)];
        state.trail.push(choice.text.length > 40 ? choice.text.slice(0, 37) + '…' : choice.text);
        goToNode(choice.next);
      });
    });
  }

  function renderReveal(node) {
    if (els.flow) els.flow.hidden = true;
    if (els.reveal) els.reveal.hidden = false;

    var linksHtml = global.OMSLinks ? global.OMSLinks.renderList(node.relatedResources) : '';

    els.revealMount.innerHTML =
      '<div class="reveal-panel">' +
        '<span class="eyebrow">Root Cause</span>' +
        '<h2 style="margin:var(--space-3) 0">' + node.rootCause + '</h2>' +
        '<div class="badge badge--accent" style="margin-bottom:var(--space-5)">System Failure: ' + node.systemFailure + '</div>' +
        '<p class="text-muted" style="text-align:left">' + node.explanation + '</p>' +
        '<p style="font-family:var(--font-serif);font-style:italic;font-size:var(--step-1);margin-top:var(--space-6)">' +
          node.closing + '</p>' +
      '</div>' +
      '<div style="margin-top:var(--space-6)">' +
        '<span class="eyebrow">Related Learning</span>' +
        '<div class="related-links" style="margin-top:var(--space-4)">' + linksHtml + '</div>' +
      '</div>' +
      '<button type="button" class="btn btn--ghost" id="scenario-restart" style="margin-top:var(--space-7)">Replay this scenario</button>';

    var restart = byId('scenario-restart');
    if (restart) restart.addEventListener('click', restart_);
  }

  function restart_() {
    state.trail = [];
    if (els.reveal) els.reveal.hidden = true;
    if (els.intro) els.intro.hidden = false;
    if (els.flow) els.flow.hidden = true;
  }

  function begin() {
    if (els.intro) els.intro.hidden = true;
    if (els.flow) els.flow.hidden = false;
    if (els.reveal) els.reveal.hidden = true;
    state.trail = [];
    goToNode(scenario.start);
  }

  function init() {
    els.intro = byId('scenario-intro');
    els.introMount = byId('scenario-intro-mount');
    els.flow = byId('scenario-flow');
    els.trail = byId('scenario-trail');
    els.nodeMount = byId('scenario-node-mount');
    els.reveal = byId('scenario-reveal');
    els.revealMount = byId('scenario-reveal-mount');

    var beginBtn = byId('scenario-begin');
    if (beginBtn) beginBtn.addEventListener('click', begin);

    global.OMSData.load('scenarios.json').then(function (json) {
      scenario = json.scenarios[0];
      renderIntro();
    });
  }

  global.OMSScenarios = { init: init };
})(window);
