/*
 * Operations Maturity System
 * Maturity Assessment engine.
 *
 * Responsible for:
 * - rendering assessment questions
 * - capturing user responses
 * - calculating maturity scores
 * - calculating scores by operating layer
 * - identifying strengths and maturity gaps
 * - generating assessment results
 *
 * Behavioral questions are intentionally kept in this file (rather
 * than /data) because they are tightly coupled to the scoring
 * engine below and, unlike the other content-driven experiences,
 * there is no separate authored knowledge base behind them.
 */

(function (global) {
  'use strict';

  var LAYER_ORDER = ['direction', 'design', 'execution', 'management', 'intelligence', 'evolution'];
  var LAYER_NAMES = {
    direction: 'Direction',
    design: 'Design',
    execution: 'Execution',
    management: 'Management',
    intelligence: 'Intelligence',
    evolution: 'Evolution'
  };

  var QUESTIONS = [
    {
      id: 'd1', layer: 'direction',
      prompt: 'When priorities conflict between two important initiatives, what typically happens?',
      options: [
        { text: 'Whoever escalates loudest, or highest, gets prioritized.', score: 1 },
        { text: 'It gets resolved case by case, usually by the same one or two leaders.', score: 2 },
        { text: 'There is a known process for weighing tradeoffs against stated priorities.', score: 3 },
        { text: 'Tradeoffs are made against explicit priorities and risk appetite, and the reasoning is communicated.', score: 4 },
        { text: 'Prioritization criteria are continuously refined based on what we learn from past tradeoffs.', score: 5 }
      ]
    },
    {
      id: 'd2', layer: 'direction',
      prompt: 'If you asked five employees how their work connects to the company’s top priority, what would happen?',
      options: [
        { text: 'Most would not be able to answer.', score: 1 },
        { text: 'A few could give a rough answer, but it would vary a lot.', score: 2 },
        { text: 'Most could explain the connection, at least at a high level.', score: 3 },
        { text: 'Most could explain it clearly, matching what leadership would say.', score: 4 },
        { text: 'Most could explain it, and also describe how it is measured and reviewed.', score: 5 }
      ]
    },
    {
      id: 'd3', layer: 'direction',
      prompt: 'When the business strategy changes, how does that reach frontline teams?',
      options: [
        { text: 'It mostly does not — teams keep doing what they were doing.', score: 1 },
        { text: 'It filters down informally and inconsistently, through managers.', score: 2 },
        { text: 'There is a defined process for translating strategy into team-level priorities.', score: 3 },
        { text: 'Strategy changes trigger a structured cascade with clear ownership at each level.', score: 4 },
        { text: 'The cascade process itself is reviewed and improved based on how past changes landed.', score: 5 }
      ]
    },
    {
      id: 'ds1', layer: 'design',
      prompt: 'A new initiative needs two different functions to work together closely. How does that get organized?',
      options: [
        { text: 'Ad hoc — whoever picks up the phone first.', score: 1 },
        { text: 'Usually the same two or three people end up coordinating it informally.', score: 2 },
        { text: 'There is a defined process or interface for cross-functional work like this.', score: 3 },
        { text: 'Roles, decision rights, and handoffs are explicitly designed before work starts.', score: 4 },
        { text: 'Cross-functional interfaces are a standing part of the operating model and get refined over time.', score: 5 }
      ]
    },
    {
      id: 'ds2', layer: 'design',
      prompt: 'Two teams both believe they are responsible for the same decision. How does that usually get resolved?',
      options: [
        { text: 'It stays ambiguous until it causes a visible problem.', score: 1 },
        { text: 'Whoever is more senior or more insistent wins.', score: 2 },
        { text: 'There is a documented decision-rights framework people can refer to.', score: 3 },
        { text: 'Decision rights are explicit and generally match how people actually behave.', score: 4 },
        { text: 'Decision-rights conflicts are rare, and when they occur they trigger a deliberate redesign.', score: 5 }
      ]
    },
    {
      id: 'ds3', layer: 'design',
      prompt: 'If you drew the org chart, and then drew how work actually flows, how similar would they be?',
      options: [
        { text: 'Very different — the chart does not reflect reality.', score: 1 },
        { text: 'Somewhat different — a lot happens outside formal structure.', score: 2 },
        { text: 'Mostly similar, with some known exceptions.', score: 3 },
        { text: 'Very similar — structure was designed around how work flows.', score: 4 },
        { text: 'They match, and structure is actively adjusted whenever the flow changes.', score: 5 }
      ]
    },
    {
      id: 'e1', layer: 'execution',
      prompt: 'A critical employee who owns a recurring process becomes unexpectedly unavailable. What happens?',
      options: [
        { text: 'Work stops, or requires contacting that person.', score: 1 },
        { text: 'Someone can usually figure it out, but execution varies.', score: 2 },
        { text: 'Another trained employee can follow the defined process.', score: 3 },
        { text: 'Ownership, backup coverage, controls, and performance measures are established.', score: 4 },
        { text: 'The process is resilient, measured, regularly improved, and increasingly automated where appropriate.', score: 5 }
      ]
    },
    {
      id: 'e2', layer: 'execution',
      prompt: 'How consistent is quality when the same task is completed by different people?',
      options: [
        { text: 'Quality varies significantly depending on who does it.', score: 1 },
        { text: 'There is a rough shared approach, but details vary.', score: 2 },
        { text: 'A documented standard exists and most people follow it.', score: 3 },
        { text: 'Standards are followed consistently, and deviations are caught by controls.', score: 4 },
        { text: 'Standards are enforced automatically wherever practical, and quality is consistently high.', score: 5 }
      ]
    },
    {
      id: 'e3', layer: 'execution',
      prompt: 'When a handoff happens between teams, what typically happens to context and accountability?',
      options: [
        { text: 'Context is often lost; it is unclear who owns the work afterward.', score: 1 },
        { text: 'Context transfers informally, and quality depends on the individuals involved.', score: 2 },
        { text: 'There is a defined handoff process with clear inputs and outputs.', score: 3 },
        { text: 'Handoffs are monitored, and issues are caught quickly when they occur.', score: 4 },
        { text: 'Handoff performance is measured and continuously improved.', score: 5 }
      ]
    },
    {
      id: 'm1', layer: 'management',
      prompt: 'Describe what happens in your team’s main recurring operational meeting.',
      options: [
        { text: 'It is mostly status updates; decisions rarely happen there.', score: 1 },
        { text: 'Some decisions get made, but they are not tracked afterward.', score: 2 },
        { text: 'Decisions are made and recorded, with an owner and a deadline.', score: 3 },
        { text: 'Decisions are tracked to completion, and the meeting’s effectiveness is reviewed.', score: 4 },
        { text: 'The operating rhythm is deliberately designed and evolves based on what is working.', score: 5 }
      ]
    },
    {
      id: 'm2', layer: 'management',
      prompt: 'How is your team’s capacity versus workload tracked?',
      options: [
        { text: 'It is not — we find out we are overloaded when something is late.', score: 1 },
        { text: 'Informally, based on how people are feeling.', score: 2 },
        { text: 'There is a visible way to see workload versus capacity.', score: 3 },
        { text: 'Capacity is actively used to make prioritization tradeoffs.', score: 4 },
        { text: 'Capacity planning includes forecasting and scenario modeling.', score: 5 }
      ]
    },
    {
      id: 'm3', layer: 'management',
      prompt: 'When a significant change (reorg, new tool, new process) is rolled out, how is it managed?',
      options: [
        { text: 'It is just announced, and teams absorb it however they can.', score: 1 },
        { text: 'There is some communication, but little planning for capacity or sequencing.', score: 2 },
        { text: 'Changes are sequenced and communicated with a defined plan.', score: 3 },
        { text: 'Change impact on capacity and existing commitments is assessed beforehand.', score: 4 },
        { text: 'Change management is a mature discipline with feedback loops on what worked.', score: 5 }
      ]
    },
    {
      id: 'i1', layer: 'intelligence',
      prompt: 'When you look at your team’s key metrics, what happens next?',
      options: [
        { text: 'Mostly nothing — the numbers are reviewed but rarely acted on.', score: 1 },
        { text: 'Sometimes they prompt a conversation, inconsistently.', score: 2 },
        { text: 'Metrics are tied to specific decisions and reviewed on a schedule.', score: 3 },
        { text: 'Leading indicators catch problems before they become customer-facing.', score: 4 },
        { text: 'The measurement system itself is regularly refined based on what has proven useful.', score: 5 }
      ]
    },
    {
      id: 'i2', layer: 'intelligence',
      prompt: 'If two people pulled the same metric independently, would they get the same number?',
      options: [
        { text: 'Probably not — there is no single source of truth.', score: 1 },
        { text: 'Usually, but there are known inconsistencies nobody has fixed.', score: 2 },
        { text: 'Yes, for most core metrics.', score: 3 },
        { text: 'Yes, and data quality issues are actively monitored.', score: 4 },
        { text: 'Yes, and the metric’s reliability is itself a tracked measure.', score: 5 }
      ]
    },
    {
      id: 'i3', layer: 'intelligence',
      prompt: 'How would leadership find out about a serious quality or customer problem?',
      options: [
        { text: 'Usually from the customer directly, or a public complaint.', score: 1 },
        { text: 'From an employee noticing and raising it informally.', score: 2 },
        { text: 'Through a defined escalation or reporting channel.', score: 3 },
        { text: 'Through leading indicators that flag it before it reaches the customer.', score: 4 },
        { text: 'Through a continuously monitored operational health view that anticipates it.', score: 5 }
      ]
    },
    {
      id: 'v1', layer: 'evolution',
      prompt: 'When the same problem happens for the third time, what is the typical response?',
      options: [
        { text: 'Fix it again, the same way as before.', score: 1 },
        { text: 'Someone mentions it should really be looked into, but it is not.', score: 2 },
        { text: 'A root cause investigation is triggered.', score: 3 },
        { text: 'Root cause is found and the fix is standardized into the process.', score: 4 },
        { text: 'The fix is measured against a baseline and continues to be refined.', score: 5 }
      ]
    },
    {
      id: 'v2', layer: 'evolution',
      prompt: 'How does the organization capture and reuse lessons learned?',
      options: [
        { text: 'It mostly does not — the same mistakes recur across teams.', score: 1 },
        { text: 'Individuals remember, but it is not shared systematically.', score: 2 },
        { text: 'There is a place lessons get documented, at least sometimes.', score: 3 },
        { text: 'Lessons learned are actively reviewed and applied to related work.', score: 4 },
        { text: 'Organizational learning is a deliberate, measured capability.', score: 5 }
      ]
    },
    {
      id: 'v3', layer: 'evolution',
      prompt: 'How does improvement work typically get evaluated?',
      options: [
        { text: 'By whether it feels better, with no real baseline.', score: 1 },
        { text: 'Informally, based on anecdotes.', score: 2 },
        { text: 'Against a defined baseline measurement.', score: 3 },
        { text: 'Against a baseline, with a decision about whether to standardize or roll back.', score: 4 },
        { text: 'Continuously, with experiments run deliberately and results fed back into the system.', score: 5 }
      ]
    }
  ];

  var state = {
    index: 0,
    answers: {}
  };

  var els = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function currentQuestion() {
    return QUESTIONS[state.index];
  }

  function renderProgress() {
    var answered = Object.keys(state.answers).length;
    var pct = Math.round((state.index / QUESTIONS.length) * 100);
    if (els.progressFill) els.progressFill.style.width = pct + '%';
    if (els.progressLabel) {
      els.progressLabel.textContent = 'Question ' + (state.index + 1) + ' of ' + QUESTIONS.length +
        ' · ' + answered + ' answered';
    }
  }

  function renderQuestion() {
    var q = currentQuestion();
    if (!q || !els.mount) return;

    var selected = state.answers[q.id];
    var optionsHtml = q.options.map(function (opt, i) {
      var isSelected = selected === opt.score;
      return '<button type="button" class="option' + (isSelected ? ' is-selected' : '') +
        '" data-score="' + opt.score + '">' +
        '<span class="option__marker">' + String.fromCharCode(65 + i) + '</span>' +
        '<span>' + opt.text + '</span>' +
        '</button>';
    }).join('');

    els.mount.innerHTML =
      '<div class="question-card">' +
        '<div class="question-card__layer"><span class="badge badge--accent">' + LAYER_NAMES[q.layer] + '</span></div>' +
        '<h2 class="question-card__prompt">' + q.prompt + '</h2>' +
        '<div class="option-list">' + optionsHtml + '</div>' +
      '</div>';

    var options = els.mount.querySelectorAll('.option');
    options.forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.answers[q.id] = parseInt(btn.getAttribute('data-score'), 10);
        renderQuestion();
        renderProgress();
        window.setTimeout(advance, 220);
      });
    });

    if (els.prevBtn) els.prevBtn.disabled = state.index === 0;
    renderProgress();
  }

  function advance() {
    if (state.index < QUESTIONS.length - 1) {
      state.index += 1;
      renderQuestion();
    } else {
      finish();
    }
  }

  function goBack() {
    if (state.index > 0) {
      state.index -= 1;
      renderQuestion();
    }
  }

  function computeResults() {
    var byLayer = {};
    LAYER_ORDER.forEach(function (layer) { byLayer[layer] = []; });

    QUESTIONS.forEach(function (q) {
      var score = state.answers[q.id];
      if (typeof score === 'number') byLayer[q.layer].push(score);
    });

    var layerScores = {};
    var allScores = [];
    LAYER_ORDER.forEach(function (layer) {
      var scores = byLayer[layer];
      var avg = scores.length ? scores.reduce(function (a, b) { return a + b; }, 0) / scores.length : 0;
      layerScores[layer] = Math.round(avg * 10) / 10;
      allScores = allScores.concat(scores);
    });

    var overall = allScores.length
      ? Math.round((allScores.reduce(function (a, b) { return a + b; }, 0) / allScores.length) * 10) / 10
      : 0;

    var strongest = LAYER_ORDER[0];
    var weakest = LAYER_ORDER[0];
    LAYER_ORDER.forEach(function (layer) {
      if (layerScores[layer] > layerScores[strongest]) strongest = layer;
      if (layerScores[layer] < layerScores[weakest]) weakest = layer;
    });

    return {
      overall: overall,
      layerScores: layerScores,
      strongest: strongest,
      weakest: weakest,
      completedAt: new Date().toISOString()
    };
  }

  function levelFor(score, levels) {
    for (var i = 0; i < levels.length; i++) {
      if (score >= levels[i].range[0] && score < levels[i].range[1]) return levels[i];
    }
    return levels[levels.length - 1];
  }

  function finish() {
    var results = computeResults();
    global.OMSData.storage.set('assessment', results);

    if (els.flow) els.flow.hidden = true;
    if (els.intro) els.intro.hidden = true;
    if (els.results) els.results.hidden = false;

    global.OMSData.load('maturity.json').then(function (maturityData) {
      renderResults(results, maturityData.levels);
    });
  }

  var LAYER_COLOR_VAR = {
    direction: '--layer-direction',
    design: '--layer-design',
    execution: '--layer-execution',
    management: '--layer-management',
    intelligence: '--layer-intelligence',
    evolution: '--layer-evolution'
  };

  function renderLayerDetail(layer, def, score, levels) {
    var level = levelFor(score, levels);
    var levelIndex = levels.indexOf(level);
    var nextLevel = levels[levelIndex + 1];
    var byLevel = def && def.byLevel ? def.byLevel.filter(function (l) { return l.level === level.level; })[0] : null;
    var pct = Math.round((score / 5) * 100);

    var toReachHtml = '';
    if (nextLevel && byLevel && byLevel.toReachNext && byLevel.toReachNext.length) {
      toReachHtml = '<h4 style="font-family:var(--font-mono);font-size:var(--step--1);letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-dim);margin:var(--space-5) 0 var(--space-3)">To Reach ' + nextLevel.name + '</h4>' +
        '<ul>' + byLevel.toReachNext.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>';
    } else if (!nextLevel && byLevel && byLevel.toReachNext && byLevel.toReachNext.length) {
      toReachHtml = '<h4 style="font-family:var(--font-mono);font-size:var(--step--1);letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-dim);margin:var(--space-5) 0 var(--space-3)">To Stay Adaptive</h4>' +
        '<ul>' + byLevel.toReachNext.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>';
    }

    var recommendedLink = def && def.relatedResources && def.relatedResources.length
      ? '<a class="btn btn--secondary" href="' + (global.OMSLinks ? global.OMSLinks.resolve(def.relatedResources[0]) : '#') + '" style="margin-top:var(--space-5)">Study ' + def.relatedResources[0].label + ' &rarr;</a>'
      : '';

    return '' +
      '<details class="layer-result-detail">' +
        '<summary class="layer-bar-row">' +
          '<span class="layer-bar-row__label">' + LAYER_NAMES[layer] + '</span>' +
          '<span class="layer-bar-row__track"><span class="layer-bar-row__fill" style="width:' + pct +
            '%;--layer-color:var(' + LAYER_COLOR_VAR[layer] + ')"></span></span>' +
          '<span class="layer-bar-row__value">' + score.toFixed(1) + '</span>' +
        '</summary>' +
        '<div class="layer-result-detail__body">' +
          '<div class="score-display" style="gap:var(--space-3)">' +
            '<span class="score-display__level">' + level.name + '</span>' +
            '<span class="text-dim text-mono" style="font-size:var(--step--1)">' + score.toFixed(1) + ' / 5</span>' +
          '</div>' +
          '<h4 style="font-family:var(--font-mono);font-size:var(--step--1);letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-dim);margin:var(--space-5) 0 var(--space-2)">Likely State</h4>' +
          '<p class="text-muted">' + (byLevel ? byLevel.likelyState : level.description) + '</p>' +
          (byLevel ? '<h4 style="font-family:var(--font-mono);font-size:var(--step--1);letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-dim);margin:var(--space-5) 0 var(--space-2)">Primary Risk</h4><p class="text-muted">' + byLevel.primaryRisk + '</p>' : '') +
          toReachHtml +
          recommendedLink +
        '</div>' +
      '</details>';
  }

  function renderResults(results, levels) {
    if (!els.results) return;
    var level = levelFor(results.overall, levels);
    var weakLayer = results.weakest;
    var strongLayer = results.strongest;

    global.OMSData.load('operating-layers.json').then(function (layersData) {
      var defsById = {};
      layersData.layers.forEach(function (l) { defsById[l.id] = l; });
      var weakDef = defsById[weakLayer];
      var linksHtml = global.OMSLinks ? global.OMSLinks.renderList(weakDef && weakDef.relatedResources) : '';

      var layerDetailsHtml = LAYER_ORDER.map(function (layer) {
        return renderLayerDetail(layer, defsById[layer], results.layerScores[layer], levels);
      }).join('');

      els.results.innerHTML =
        '<div class="section-head">' +
          '<span class="eyebrow">Overall Operations Maturity</span>' +
          '<div class="score-display">' +
            '<span class="score-display__number">' + results.overall.toFixed(1) + '</span>' +
            '<span class="score-display__scale">/ 5</span>' +
            '<span class="score-display__level">' + level.name + '</span>' +
          '</div>' +
          '<p class="lede">' + level.description + '</p>' +
        '</div>' +
        '<div class="card" style="margin-bottom:var(--space-6)">' +
          '<div class="card__eyebrow">By Operating Layer &mdash; select a layer for detail</div>' +
          '<div class="layer-bars" style="margin-top:var(--space-4)">' + layerDetailsHtml + '</div>' +
        '</div>' +
        '<div class="constraint-panel" style="margin-bottom:var(--space-6)">' +
          '<span class="eyebrow">Primary Maturity Constraint</span>' +
          '<h3 style="margin:var(--space-3) 0">' + LAYER_NAMES[weakLayer] + '</h3>' +
          '<p class="text-muted">' + (weakDef ? weakDef.purpose : '') + ' This is currently your least mature layer, scoring ' +
            results.layerScores[weakLayer].toFixed(1) + ' / 5. Weak maturity here tends to look like: ' +
            (weakDef && weakDef.weakSignals ? weakDef.weakSignals[0].toLowerCase() : '') + '</p>' +
          '<p class="text-muted">Your strongest layer is <strong>' + LAYER_NAMES[strongLayer] + '</strong> at ' +
            results.layerScores[strongLayer].toFixed(1) + ' / 5.</p>' +
        '</div>' +
        '<div>' +
          '<span class="eyebrow">What To Investigate Next</span>' +
          '<div class="related-links" style="margin-top:var(--space-4)">' + linksHtml +
            '<a href="' + global.OMSData.href('pages/diagnose.html') + '">Run the Diagnostic</a>' +
            '<a href="' + global.OMSData.href('pages/command-center.html') + '">View Command Center</a>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="btn btn--ghost" id="retake-assessment" style="margin-top:var(--space-7)">Retake the assessment</button>';

      var retake = byId('retake-assessment');
      if (retake) retake.addEventListener('click', reset);
    });
  }

  function reset() {
    state.index = 0;
    state.answers = {};
    if (els.results) els.results.hidden = true;
    if (els.intro) els.intro.hidden = false;
    if (els.flow) els.flow.hidden = true;
  }

  function start() {
    if (els.intro) els.intro.hidden = true;
    if (els.flow) els.flow.hidden = false;
    if (els.results) els.results.hidden = true;
    state.index = 0;
    state.answers = {};
    renderQuestion();
  }

  function init() {
    els.intro = byId('assessment-intro');
    els.flow = byId('assessment-flow');
    els.results = byId('assessment-results');
    els.mount = byId('question-mount');
    els.progressFill = byId('assessment-progress-fill');
    els.progressLabel = byId('assessment-progress-label');
    els.prevBtn = byId('question-prev');

    var startBtn = byId('assessment-start');
    if (startBtn) startBtn.addEventListener('click', start);
    if (els.prevBtn) els.prevBtn.addEventListener('click', goBack);

    var existing = global.OMSData.storage.get('assessment', null);
    if (existing && els.intro) {
      var resume = byId('assessment-existing-note');
      if (resume) resume.hidden = false;
    }
  }

  global.OMSAssessment = { init: init, TOTAL_QUESTIONS: QUESTIONS.length };
})(window);
