/*
 * Operations Maturity System
 * Operations Command Center.
 *
 * Responsible for:
 * - rendering operational scores and insights
 * - displaying maturity and health results
 * - surfacing primary system constraints
 * - displaying risks and improvement opportunities
 * - connecting diagnostic findings across the platform
 * - presenting recommended operational priorities
 *
 * Dashboard calculations read from the assessment results persisted
 * in localStorage by js/assessment.js. When no assessment exists,
 * clearly labeled demonstration data is used instead.
 *
 * Signals are organized under six headings — Maturity, Health,
 * Architecture, Active Improvement, Risk, Attention — so the page
 * reads as a hierarchy of signal, not a wall of cards. See §23 of
 * the coherence-iteration brief.
 */

(function (global) {
  'use strict';

  var LAYER_ORDER = ['direction', 'design', 'execution', 'management', 'intelligence', 'evolution'];
  var LAYER_NAMES = {
    direction: 'Direction', design: 'Design', execution: 'Execution',
    management: 'Management', intelligence: 'Intelligence', evolution: 'Evolution'
  };
  var LAYER_COLOR_VAR = {
    direction: '--layer-direction', design: '--layer-design', execution: '--layer-execution',
    management: '--layer-management', intelligence: '--layer-intelligence', evolution: '--layer-evolution'
  };

  var DEMO_RESULTS = {
    overall: 2.5,
    layerScores: { direction: 3.2, design: 2.6, execution: 2.1, management: 2.4, intelligence: 3.0, evolution: 1.8 },
    strongest: 'direction',
    weakest: 'evolution',
    isDemo: true
  };

  function byId(id) { return document.getElementById(id); }
  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pct(score) { return Math.round((score / 5) * 100); }

  function levelFor(score, levels) {
    for (var i = 0; i < levels.length; i++) {
      if (score >= levels[i].range[0] && score < levels[i].range[1]) return levels[i];
    }
    return levels[levels.length - 1];
  }

  function derive(results) {
    var l = results.layerScores;
    return {
      operatingSystemScore: Math.round(results.overall * 20),
      operationalHealth: Math.round(((l.intelligence + l.management) / 2) * 20),
      scaleReadiness: Math.round(((l.design + l.management + l.execution) / 3) * 20),
      operatingDebt: Math.round(100 - ((l.execution + l.management) / 2) * 20),
      decisionFriction: Math.round(100 - l.design * 20),
      resilience: Math.round(((l.execution + l.management + l.evolution) / 3) * 20)
    };
  }

  function sortedLayers(layerScores) {
    return LAYER_ORDER.slice().sort(function (a, b) { return layerScores[a] - layerScores[b]; });
  }

  function metricGridHtml(metrics) {
    return '<div class="metric-grid">' + metrics.map(function (m) {
      return '' +
        '<div class="metric-card">' +
          '<span class="metric-card__label">' + esc(m.label) + '</span>' +
          '<span class="metric-card__value metric-card__value--accent">' + m.value + (m.suffix || '') + '</span>' +
          (m.note ? '<span class="metric-card__note">' + esc(m.note) + '</span>' : '') +
        '</div>';
    }).join('') + '</div>';
  }

  function renderLayerBars(mount, layerScores) {
    mount.innerHTML = LAYER_ORDER.map(function (layer) {
      var score = layerScores[layer];
      return '' +
        '<div class="layer-bar-row">' +
          '<span class="layer-bar-row__label">' + LAYER_NAMES[layer] + '</span>' +
          '<span class="layer-bar-row__track"><span class="layer-bar-row__fill" style="width:' + pct(score) +
            '%;--layer-color:var(' + LAYER_COLOR_VAR[layer] + ')"></span></span>' +
          '<span class="layer-bar-row__value">' + score.toFixed(1) + '</span>' +
        '</div>';
    }).join('');
  }

  function renderPriorities(mount, layerScores, layersData) {
    var weakestFirst = sortedLayers(layerScores).slice(0, 3);
    mount.innerHTML = weakestFirst.map(function (layer, i) {
      var def = layersData.layers.filter(function (l) { return l.id === layer; })[0];
      var link = global.OMSLinks ? global.OMSLinks.resolve({ type: 'layer', id: layer }) : '#';
      return '' +
        '<a class="priority-item" href="' + link + '" style="text-decoration:none">' +
          '<span class="priority-item__rank">0' + (i + 1) + '</span>' +
          '<span>' +
            '<strong>' + LAYER_NAMES[layer] + '</strong> — ' + (def ? def.purpose : '') +
            ' Currently scoring ' + layerScores[layer].toFixed(1) + ' / 5.' +
          '</span>' +
        '</a>';
    }).join('');
  }

  function render(results) {
    var demoNotice = byId('command-center-demo-notice');
    if (demoNotice) demoNotice.hidden = !results.isDemo;

    return Promise.all([
      global.OMSData.load('maturity.json'),
      global.OMSData.load('operating-layers.json')
    ]).then(function (arr) {
      var maturityData = arr[0];
      var layersData = arr[1];
      var level = levelFor(results.overall, maturityData.levels);
      var derived = derive(results);

      var maturityMount = byId('command-maturity-mount');
      if (maturityMount) {
        maturityMount.innerHTML = metricGridHtml([
          { label: 'Operating System Score', value: derived.operatingSystemScore, suffix: ' / 100' },
          { label: 'Overall Maturity', value: results.overall.toFixed(1) + ' / 5', note: level.name }
        ]);
      }

      var layerMount = byId('command-layer-bars');
      if (layerMount) renderLayerBars(layerMount, results.layerScores);

      var healthMount = byId('command-health-mount');
      if (healthMount) {
        healthMount.innerHTML = metricGridHtml([
          { label: 'Operational Health', value: derived.operationalHealth, suffix: ' / 100' },
          { label: 'Scale Readiness', value: derived.scaleReadiness, suffix: ' / 100' },
          { label: 'Operating Debt', value: derived.operatingDebt, suffix: ' / 100' },
          { label: 'Decision Friction', value: derived.decisionFriction, suffix: ' / 100' },
          { label: 'Resilience', value: derived.resilience, suffix: ' / 100' }
        ]);
      }

      var constraintMount = byId('command-constraint-mount');
      if (constraintMount) {
        var weakDef = layersData.layers.filter(function (l) { return l.id === results.weakest; })[0];
        constraintMount.innerHTML =
          '<span class="eyebrow">Primary Constraint</span>' +
          '<h3 style="margin:var(--space-3) 0">' + LAYER_NAMES[results.weakest] + '</h3>' +
          '<p class="text-muted">' + (weakDef ? weakDef.purpose : '') + '</p>' +
          '<button type="button" class="btn btn--ghost" id="constraint-why-btn" style="margin-top:var(--space-2)" aria-expanded="false">Why?</button>' +
          '<div id="constraint-why-body" hidden style="margin-top:var(--space-3)">' +
            '<p class="text-dim" style="font-size:var(--step--1)">' + LAYER_NAMES[results.weakest] + ' scored ' + results.layerScores[results.weakest].toFixed(1) + ' / 5, the lowest of the six operating layers in ' + (results.isDemo ? 'this demonstration data' : 'your assessment') + '. OMS treats the lowest-scoring layer as the primary constraint because weak layers tend to limit how much improvement elsewhere can actually help.</p>' +
          '</div>' +
          '<div class="related-links" style="margin-top:var(--space-3)">' +
            '<a href="' + (global.OMSLinks ? global.OMSLinks.resolve({ type: 'layer', id: results.weakest }) : '#') + '">Explore This Layer</a>' +
          '</div>';
        var whyBtn = constraintMount.querySelector('#constraint-why-btn');
        var whyBody = constraintMount.querySelector('#constraint-why-body');
        if (whyBtn) whyBtn.addEventListener('click', function () {
          var isHidden = whyBody.hidden;
          whyBody.hidden = !isHidden;
          whyBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
        });
      }

      var priorityMount = byId('priority-mount');
      if (priorityMount) renderPriorities(priorityMount, results.layerScores, layersData);

      return { results: results, layersData: layersData, level: level };
    });
  }

  /* ----------------------------------------------------------
     Architecture — a light Organization Blueprint summary. Reads
     live from js/blueprint-core.js; does not duplicate its analysis
     logic, just surfaces the headline numbers here.
     ---------------------------------------------------------- */

  function criticalObjectCount(bp, BP) {
    var count = 0;
    BP.ENTITY_ORDER.forEach(function (type) {
      (bp.data[type] || []).forEach(function (item) {
        var c = item.criticality || item.impact || item.priority;
        if (c === 'Critical') count++;
      });
    });
    return count;
  }

  function renderArchitecture() {
    var mount = byId('system-architecture-mount');
    if (!mount) return;
    var BP = global.OMSBlueprint;
    var bp = BP && BP.store.mostRecent();

    if (!bp) {
      mount.innerHTML =
        '<p class="callout">You haven\'t mapped an Organization Blueprint yet. The Blueprint shows how outcomes, capabilities, processes, and the rest of the system connect &mdash; and what could be affected if one part fails.</p>' +
        '<a class="btn btn--primary" href="blueprint.html">Create Your Blueprint</a>';
      return;
    }

    var completeness = BP.completeness(bp);
    var gap = BP.designRealityGap(bp);
    var risks = BP.systemicRisks(bp);
    var gaps = BP.ownershipGaps(bp);
    var unownedCritical = gaps.filter(function (g) { return g.severity === 'critical'; }).length;
    var criticalCount = criticalObjectCount(bp, BP);

    mount.innerHTML =
      metricGridHtml([
        { label: 'Blueprint Completeness', value: completeness.percent, suffix: '%', note: bp.name },
        { label: 'Design / Reality Gap', value: gap.level, note: gap.count + ' difference' + (gap.count === 1 ? '' : 's') + ' recorded' },
        { label: 'Critical Dependencies', value: criticalCount, note: 'objects marked Critical' },
        { label: 'Systemic Risks', value: risks.length, note: 'deterministic structural checks' },
        { label: 'Unowned Critical Components', value: unownedCritical, note: 'processes, decisions & outcomes' }
      ]) +
      '<a class="btn btn--secondary" href="blueprint.html?blueprint=' + encodeURIComponent(bp.id) + '" style="margin-top:var(--space-4);display:inline-block">Open Blueprint &rarr;</a>';
  }

  /* ----------------------------------------------------------
     Active Improvement — a light Workbench summary. Command Center
     answers "what is happening in the operating system?"; the
     Workbench answers "what are we doing about it?" — this section
     only surfaces the headline counts, never the work itself.
     ---------------------------------------------------------- */

  function renderActiveImprovement() {
    var mount = byId('managed-action-mount');
    if (!mount) return;
    var WB = global.OMSWorkbenchCore;
    if (!WB) return;
    var ws = WB.load();
    var hasAny = WB.ENTITY_ORDER.some(function (t) { return (ws[t] || []).length > 0; });

    if (!hasAny) {
      mount.innerHTML =
        '<p class="callout">Nothing is being actively worked yet. The Workbench is where findings become priorities, priorities become interventions, and results get measured.</p>' +
        '<a class="btn btn--primary" href="workbench.html">Open Workbench</a>';
      return;
    }

    var activePriorities = ws.priorities.filter(function (p) { return p.status !== 'Complete'; }).length;
    var openInvestigations = ws.investigations.filter(function (i) { return i.rootCauseStatus !== 'Validated' && i.rootCauseStatus !== 'Disproven'; }).length;
    var interventionsInTest = ws.interventions.filter(function (i) { return i.status === 'Testing' || i.status === 'Ready to Test'; }).length;

    mount.innerHTML =
      metricGridHtml([
        { label: 'Active Priorities', value: activePriorities },
        { label: 'Open Investigations', value: openInvestigations },
        { label: 'Interventions In Test', value: interventionsInTest }
      ]) +
      '<a class="btn btn--secondary" href="workbench.html" style="margin-top:var(--space-4);display:inline-block">Open Workbench &rarr;</a>';
  }

  /* ----------------------------------------------------------
     Risk — fuses Blueprint's systemic risks with the Workbench's
     risk register. Two different rule systems, one signal.
     ---------------------------------------------------------- */

  function riskFlagHtml(severity, rule, message) {
    return '<div class="risk-flag risk-flag--' + severity + '">' +
      '<div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--' + severity + '">' + esc(rule) + '</span></div>' +
      '<p class="risk-flag__message">' + esc(message) + '</p>' +
    '</div>';
  }

  function renderRisk() {
    var mount = byId('command-risk-mount');
    if (!mount) return;
    var BP = global.OMSBlueprint;
    var WB = global.OMSWorkbenchCore;
    var bp = BP && BP.store.mostRecent();
    var blueprintRisks = bp ? BP.systemicRisks(bp) : [];
    var ws = WB && WB.load();
    var openRisks = ws ? ws.risks.filter(function (r) { return r.status !== 'Closed'; }) : [];

    if (!blueprintRisks.length && !openRisks.length) {
      mount.innerHTML = '<p class="callout">No systemic risks detected in your Blueprint, and no open risks logged in the Workbench.</p>';
      return;
    }

    var cards = blueprintRisks.slice(0, 3).map(function (r) { return riskFlagHtml(r.severity, r.rule, r.message); })
      .concat(openRisks.slice(0, 3).map(function (r) { return riskFlagHtml((r.impact === 'High' || r.impact === 'Critical') ? 'critical' : 'warning', r.risk, (r.mitigation ? 'Mitigation in place: ' + r.mitigation : 'No mitigation recorded yet.')); }));

    mount.innerHTML = cards.join('') +
      '<div class="related-links" style="margin-top:var(--space-3)">' +
        (bp ? '<a href="blueprint.html?blueprint=' + encodeURIComponent(bp.id) + '">View Blueprint Risks</a>' : '') +
        (ws ? '<a href="workbench.html">View Risk Register</a>' : '') +
      '</div>';
  }

  /* ----------------------------------------------------------
     Attention — the Workbench's deterministic Attention Needed
     rules, surfaced here so they're visible without opening the
     Workbench first.
     ---------------------------------------------------------- */

  function renderAttention() {
    var mount = byId('command-attention-mount');
    if (!mount) return;
    var WB = global.OMSWorkbenchCore;
    if (!WB) { mount.innerHTML = ''; return []; }
    var ws = WB.load();
    var items = WB.attentionNeeded(ws);

    if (!items.length) {
      mount.innerHTML = '<p class="callout">Nothing needs attention right now &mdash; that does not mean everything is healthy, only that none of these specific checks tripped.</p>';
      return items;
    }

    mount.innerHTML = items.slice(0, 6).map(function (a) {
      return '<div class="risk-flag risk-flag--warning">' +
        '<div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--warning">' + esc(a.rule) + '</span></div>' +
        '<p class="risk-flag__message">' + esc(a.message) + '</p>' +
        '<p class="risk-flag__why text-dim">' + esc(a.why) + '</p>' +
      '</div>';
    }).join('') + '<a class="btn btn--secondary" href="workbench.html" style="margin-top:var(--space-3);display:inline-block">Open Workbench &rarr;</a>';

    return items;
  }

  /* ----------------------------------------------------------
     Flow — a modest summary of Value Stream Intelligence, shown only
     once at least one Value Stream has been mapped. Command Center
     does not attempt to visualize the flow itself; that lives on the
     Value Streams page.
     ---------------------------------------------------------- */

  function renderFlow() {
    var section = byId('command-flow-section');
    var mount = byId('command-flow-mount');
    var VS = global.OMSValueStream;
    if (!section || !mount) return;
    var list = VS ? VS.store.list() : [];
    if (!VS || !list.length) { section.hidden = true; return; }
    section.hidden = false;

    var criticalRisks = 0, criticalHandoffs = 0, reworkLoops = 0, noOwner = 0;
    var largestWait = null;

    list.forEach(function (vs) {
      VS.riskAnalysis(vs).forEach(function (r) { if (r.severity === 'critical') criticalRisks++; });
      (vs.data.handoffs || []).forEach(function (h) { if (VS.handoffHealth(vs, h).status === 'Critical') criticalHandoffs++; });
      reworkLoops += (vs.data.rework || []).length;
      if (!vs.owner) noOwner++;
      VS.whereIsValueWaiting(vs).forEach(function (loc) {
        if (!largestWait || loc.hours > largestWait.hours) largestWait = { label: loc.label, hours: loc.hours, vsName: vs.name };
      });
    });

    mount.innerHTML =
      metricGridHtml([
        { label: 'Mapped Value Streams', value: list.length },
        { label: 'Critical Flow Risks', value: criticalRisks },
        { label: 'Critical Handoffs', value: criticalHandoffs },
        { label: 'Active Rework Loops', value: reworkLoops },
        { label: 'No End-To-End Owner', value: noOwner, note: 'value streams' }
      ]) +
      (largestWait ? '<p class="text-muted" style="margin-top:var(--space-4)">Largest wait right now: <strong>' + esc(largestWait.label) + '</strong> (' + VS.fmtHours(largestWait.hours) + ') in "' + esc(largestWait.vsName) + '."</p>' : '') +
      '<a class="btn btn--secondary" href="value-streams.html" style="margin-top:var(--space-3);display:inline-block">Open Value Streams &rarr;</a>';
  }

  /* ----------------------------------------------------------
     Capacity — a modest summary of Capacity Intelligence, shown only
     once at least one Capacity Model has been analyzed.
     ---------------------------------------------------------- */

  function renderCapacity() {
    var section = byId('command-capacity-section');
    var mount = byId('command-capacity-mount');
    var Cap = global.OMSCapacity;
    if (!section || !mount) return;
    var list = Cap ? Cap.store.list() : [];
    if (!Cap || !list.length) { section.hidden = true; return; }
    section.hidden = false;

    var overCapacity = 0, lowBuffer = 0, skillBottlenecks = 0, growingQueues = 0;
    var largestReworkTax = null;

    list.forEach(function (m) {
      var d = Cap.demandCapacityBalance(m);
      if (d.capacity > 0 && d.totalTypicalLoad > d.capacity) overCapacity++;
      if (d.bufferPct != null && d.bufferPct >= 0 && d.bufferPct < 8) lowBuffer++;
      (m.data.skills || []).forEach(function (s) { if (Cap.isYes(s.isBottleneck)) skillBottlenecks++; });
      var qb = Cap.queueBehavior(m);
      if (qb && qb.structurallyGrowing) growingQueues++;
      var rt = Cap.reworkTax(m);
      if (!largestReworkTax || rt.pct > largestReworkTax.pct) largestReworkTax = { pct: rt.pct, name: m.name };
    });

    mount.innerHTML =
      metricGridHtml([
        { label: 'Active Capacity Models', value: list.length },
        { label: 'Systems Over Capacity', value: overCapacity },
        { label: 'Low Buffer Systems', value: lowBuffer },
        { label: 'Critical Skill Bottlenecks', value: skillBottlenecks },
        { label: 'Growing Queues', value: growingQueues }
      ]) +
      (largestReworkTax && largestReworkTax.pct ? '<p class="text-muted" style="margin-top:var(--space-4)">Largest rework tax right now: <strong>' + esc(largestReworkTax.pct + '%') + '</strong> of capacity in "' + esc(largestReworkTax.name) + '."</p>' : '') +
      '<a class="btn btn--secondary" href="capacity.html" style="margin-top:var(--space-3);display:inline-block">Open Capacity &rarr;</a>';
  }

  /* ----------------------------------------------------------
     System Story — a deterministic narrative assembled only from
     what is actually stored. Not AI, not fabricated: if there isn't
     enough data, it says so.
     ---------------------------------------------------------- */

  function renderSystemStory(results, attentionItems) {
    var mount = byId('system-story-mount');
    if (!mount) return;
    var BP = global.OMSBlueprint;
    var WB = global.OMSWorkbenchCore;
    var bp = BP && BP.store.mostRecent();
    var ws = WB && WB.load();
    var lines = [];

    if (results && !results.isDemo) {
      lines.push('Your current maturity assessment indicates the greatest weakness in ' + LAYER_NAMES[results.weakest] + '.');
    }

    if (bp) {
      var ownershipGaps = BP.ownershipGaps(bp);
      var unownedProcesses = ownershipGaps.filter(function (g) { return g.rule === 'Process Without Owner'; }).length;
      if (unownedProcesses > 0) lines.push('Your Blueprint contains ' + unownedProcesses + ' critical process' + (unownedProcesses === 1 ? '' : 'es') + ' without a clear owner.');
      var sysRisks = BP.systemicRisks(bp);
      if (sysRisks.length) lines.push('Your Blueprint has flagged ' + sysRisks.length + ' systemic risk' + (sysRisks.length === 1 ? '' : 's') + ', including ' + sysRisks[0].rule + '.');
    }

    if (ws) {
      var openInvestigations = ws.investigations.filter(function (i) { return i.rootCauseStatus !== 'Validated' && i.rootCauseStatus !== 'Disproven'; }).length;
      if (openInvestigations > 0) lines.push(openInvestigations + ' active investigation' + (openInvestigations === 1 ? ' is' : 's are') + ' still open.');
      var interventionsInTest = ws.interventions.filter(function (i) { return i.status === 'Testing' || i.status === 'Ready to Test' || i.status === 'Measuring'; }).length;
      if (interventionsInTest > 0) lines.push(interventionsInTest + ' improvement intervention' + (interventionsInTest === 1 ? ' is' : 's are') + ' currently in test.');
      var unmitigated = ws.risks.filter(function (r) { return (r.impact === 'High' || r.impact === 'Critical') && !r.mitigation && r.status !== 'Closed'; }).length;
      if (unmitigated > 0) lines.push(unmitigated + ' high-impact risk' + (unmitigated === 1 ? ' has' : 's have') + ' no mitigation.');
    }

    if (!lines.length) {
      mount.innerHTML =
        '<p class="callout">There isn\'t enough stored data yet to tell this story. Take the assessment, map an Organization Blueprint, or start work in the Workbench, and this section will fill in.</p>' +
        '<div class="related-links" style="margin-top:var(--space-3)"><a href="assess.html">Take the Assessment</a><a href="blueprint.html">Create a Blueprint</a><a href="workbench.html">Open Workbench</a></div>';
      return;
    }

    mount.innerHTML =
      '<span class="eyebrow">Your Operating System Right Now</span>' +
      '<ul style="margin:var(--space-3) 0 var(--space-5)">' + lines.map(function (l) { return '<li style="margin-bottom:var(--space-2)">' + esc(l) + '</li>'; }).join('') + '</ul>' +
      (attentionItems && attentionItems.length ?
        '<span class="eyebrow">What Deserves Attention</span>' +
        '<p class="text-muted" style="margin-top:var(--space-2)">' + attentionItems.length + ' item' + (attentionItems.length === 1 ? '' : 's') + ' flagged below.</p>'
        : '');
  }

  function init() {
    var stored = global.OMSData.storage.get('assessment', null);
    var results = stored || DEMO_RESULTS;
    render(results).then(function () {
      renderArchitecture();
      renderActiveImprovement();
      renderRisk();
      var attentionItems = renderAttention();
      renderFlow();
      renderCapacity();
      renderSystemStory(results, attentionItems);
    });
  }

  global.OMSDashboard = { init: init };
})(window);
