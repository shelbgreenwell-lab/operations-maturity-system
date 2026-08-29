/*
 * Operations Maturity System
 * Operational Diagnostic Engine.
 *
 * Responsible for:
 * - guiding users through operational symptoms
 * - handling branching diagnostic questions
 * - tracing symptoms toward potential system causes
 * - identifying likely operational constraints
 * - connecting findings to evidence, resources, and recommended actions
 *
 * Diagnostic questions, symptoms, branches, and findings
 * live in /data/diagnostics.json.
 *
 * Core principle:
 * Do not prescribe a solution before validating the cause.
 */

(function (global) {
  'use strict';

  var data = null;
  var els = {};
  var state = { symptom: null, stepIndex: 0, scores: {} };

  function byId(id) {
    return document.getElementById(id);
  }

  function renderIntro() {
    if (!els.symptomMount || !data) return;
    var html = data.diagnostics.map(function (d) {
      return '' +
        '<button type="button" class="symptom-card card--interactive" data-symptom="' + d.id + '">' +
          '<div class="card__eyebrow">Symptom</div>' +
          '<h3 style="margin:var(--space-2) 0">' + d.symptom + '</h3>' +
          '<p class="text-muted" style="font-size:var(--step--1)">' + d.description + '</p>' +
        '</button>';
    }).join('');
    els.symptomMount.innerHTML = html;

    els.symptomMount.querySelectorAll('.symptom-card').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectSymptom(btn.getAttribute('data-symptom'));
      });
    });
  }

  function selectSymptom(id) {
    state.symptom = data.diagnostics.filter(function (d) { return d.id === id; })[0];
    state.stepIndex = 0;
    state.scores = {};

    if (els.intro) els.intro.hidden = true;
    if (els.outcome) els.outcome.hidden = true;
    if (els.flow) els.flow.hidden = false;

    renderStep();
  }

  function addScores(options) {
    Object.keys(options || {}).forEach(function (key) {
      state.scores[key] = (state.scores[key] || 0) + options[key];
    });
  }

  function renderStep() {
    var q = state.symptom.questions[state.stepIndex];
    if (!q) {
      renderOutcome();
      return;
    }

    var optionsHtml = q.options.map(function (opt, i) {
      return '<button type="button" class="option" data-index="' + i + '">' +
        '<span class="option__marker">' + String.fromCharCode(65 + i) + '</span>' +
        '<span>' + opt.text + '</span>' +
        '</button>';
    }).join('');

    els.stepMount.innerHTML =
      '<div class="diagnostic-step">' +
        '<div class="card__eyebrow">' + state.symptom.symptom + '</div>' +
        '<h2 class="question-card__prompt" style="margin-top:var(--space-3)">' + q.text + '</h2>' +
        '<div class="option-list">' + optionsHtml + '</div>' +
      '</div>';

    if (els.progressLabel) {
      els.progressLabel.textContent = 'Question ' + (state.stepIndex + 1) + ' of ' + state.symptom.questions.length;
    }
    if (els.progressFill) {
      els.progressFill.style.width = Math.round((state.stepIndex / state.symptom.questions.length) * 100) + '%';
    }

    els.stepMount.querySelectorAll('.option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var opt = q.options[parseInt(btn.getAttribute('data-index'), 10)];
        addScores(opt.scores);
        state.stepIndex += 1;
        renderStep();
      });
    });
  }

  function topConstraint() {
    var best = null;
    Object.keys(state.scores).forEach(function (key) {
      if (!best || state.scores[key] > state.scores[best]) best = key;
    });
    return best;
  }

  function renderOutcome() {
    if (els.flow) els.flow.hidden = true;
    if (els.outcome) els.outcome.hidden = false;

    var constraintId = topConstraint();
    var constraint = data.constraints[constraintId];
    if (!constraint) return;

    var evidenceHtml = constraint.evidence.map(function (e) { return '<li>' + e + '</li>'; }).join('');
    var questionsHtml = constraint.questionsToAsk.map(function (q) { return '<li class="operator-question">' + q + '</li>'; }).join('');
    var notYetHtml = constraint.whatNotToDoYet.map(function (n) { return '<li>' + n + '</li>'; }).join('');
    var relatedSystemsHtml = global.OMSLinks ? global.OMSLinks.renderList(constraint.investigateNext) : '';
    var antiPatternsHtml = global.OMSLinks && constraint.relatedAntiPatterns && constraint.relatedAntiPatterns.length
      ? global.OMSLinks.renderList(constraint.relatedAntiPatterns) : '';

    els.outcomeMount.innerHTML =
      '<div class="section-head">' +
        '<span class="eyebrow">Observed Symptom</span>' +
        '<h3 style="margin-top:var(--space-2)">' + state.symptom.symptom + '</h3>' +
      '</div>' +
      '<div class="section-head" style="margin-top:var(--space-6)">' +
        '<span class="eyebrow">Likely Constraint &mdash; Not A Confirmed Diagnosis</span>' +
        '<h2>' + constraint.name + '</h2>' +
        '<p class="lede">This is a potential cause based on your answers. Validate it with evidence before intervening.</p>' +
      '</div>' +
      '<div class="constraint-panel" style="margin-bottom:var(--space-6)">' +
        '<span class="eyebrow">Why This May Be Happening</span>' +
        '<p style="margin-top:var(--space-3)">' + constraint.why + '</p>' +
      '</div>' +
      '<div class="outcome-grid">' +
        '<div class="outcome-block"><h4>Evidence To Validate</h4><ul>' + evidenceHtml + '</ul></div>' +
        '<div class="outcome-block"><h4>Questions To Ask</h4><ul>' + questionsHtml + '</ul></div>' +
        '<div class="outcome-block"><h4>What Not To Do Yet</h4><ul>' + notYetHtml + '</ul></div>' +
      '</div>' +
      (antiPatternsHtml ?
        '<hr class="divider">' +
        '<span class="eyebrow">Common Anti-Patterns Here</span>' +
        '<div class="related-links" style="margin-top:var(--space-4)">' + antiPatternsHtml + '</div>'
        : '') +
      '<hr class="divider">' +
      '<span class="eyebrow">Related Systems &amp; What To Investigate Next</span>' +
      '<div class="related-links" style="margin-top:var(--space-4)">' + relatedSystemsHtml + '</div>' +
      (constraint.resourceToStudy ?
        '<div class="next-action">' +
          '<span>Resource to study</span>' +
          '<a class="btn btn--primary" href="' + global.OMSLinks.resolve(constraint.resourceToStudy) + '">' + constraint.resourceToStudy.label + ' &rarr;</a>' +
        '</div>'
        : '') +
      (constraint.builderRecommendation ?
        '<div class="next-action" style="margin-top:var(--space-4)">' +
          '<span>' + constraint.builderRecommendation.note + '</span>' +
          '<a class="btn btn--secondary" href="' + global.OMSData.href('pages/' + constraint.builderRecommendation.href + '.html') + '">Build This System: ' + constraint.builderRecommendation.label + ' &rarr;</a>' +
        '</div>'
        : '') +
      '<button type="button" class="btn btn--ghost" id="diagnose-restart" style="margin-top:var(--space-7)">Investigate a different symptom</button>';

    var restart = byId('diagnose-restart');
    if (restart) restart.addEventListener('click', restartFlow);
  }

  function restartFlow() {
    state.symptom = null;
    state.stepIndex = 0;
    state.scores = {};
    if (els.outcome) els.outcome.hidden = true;
    if (els.flow) els.flow.hidden = true;
    if (els.intro) els.intro.hidden = false;
  }

  function init() {
    els.intro = byId('diagnose-intro');
    els.flow = byId('diagnose-flow');
    els.outcome = byId('diagnose-outcome');
    els.symptomMount = byId('symptom-mount');
    els.stepMount = byId('diagnostic-step-mount');
    els.outcomeMount = byId('diagnostic-outcome-mount');
    els.progressFill = byId('diagnose-progress-fill');
    els.progressLabel = byId('diagnose-progress-label');

    global.OMSData.load('diagnostics.json').then(function (json) {
      data = json;
      renderIntro();

      var params = new URLSearchParams(global.location.search);
      var requestedSymptom = params.get('symptom');
      if (requestedSymptom && data.diagnostics.some(function (d) { return d.id === requestedSymptom; })) {
        selectSymptom(requestedSymptom);
      }
    });
  }

  global.OMSDiagnostics = { init: init };
})(window);
