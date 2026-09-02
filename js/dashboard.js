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
     Operational Health — a modest summary shown only once at
     least one Health Model or KPI Model exists. Health is not
     maturity and not performance: this section is deliberately
     kept separate from the maturity heatmap above.
     ---------------------------------------------------------- */

  function renderOperationalHealth() {
    var section = byId('command-health-section');
    var mount = byId('command-health-mount');
    var H = global.OMSHealth;
    var K = global.OMSKpi;
    var BP = global.OMSBlueprint;
    var WB = global.OMSWorkbenchCore;
    if (!section || !mount) return;
    var healthModels = H ? H.store.list() : [];
    var kpiModels = K ? K.store.list() : [];
    if (!healthModels.length && !kpiModels.length) { section.hidden = true; return; }
    section.hidden = false;

    var worstOverall = null, criticalSystems = 0, deterioratingSignals = 0, earlyWarningsActive = 0;
    healthModels.forEach(function (m) {
      var overall = H.overallHealth(m);
      if (!worstOverall || H.STATUS_RANK[overall.status] > H.STATUS_RANK[worstOverall.status]) {
        worstOverall = { status: overall.status, name: m.name };
      }
      if (overall.status === 'Critical' || overall.status === 'Weak') criticalSystems++;
      (m.data.dimensions || []).forEach(function (d) {
        var trend = H.trendForDimension(d);
        if (trend.label === 'Deteriorating') deterioratingSignals++;
        var status = H.dimensionStatus(d).status;
        if (d.earlyWarning && status !== 'Healthy' && status !== 'Unknown') earlyWarningsActive++;
      });
    });

    var kpisWithoutOwners = 0;
    kpiModels.forEach(function (m) { (m.data.kpis || []).forEach(function (k) { if (!k.owner) kpisWithoutOwners++; }); });

    var criticalSystemsWithoutMeasures = 0;
    if (BP) {
      var measurableTypes = ['teams', 'roles', 'processes', 'capabilities', 'valueStreams', 'technology'];
      BP.store.list().forEach(function (bp) {
        measurableTypes.forEach(function (type) {
          (bp.data[type] || []).forEach(function (item) {
            if (item.criticality !== 'High' && item.criticality !== 'Critical') return;
            var hasKpi = kpiModels.some(function (m) { return m.data.relatedBlueprintProjectId === bp.id && m.data.relatedBlueprintType === type && m.data.relatedBlueprintId === item.id; });
            var hasHealth = healthModels.some(function (m) { return m.data.relatedBlueprintProjectId === bp.id && m.data.relatedBlueprintType === type && m.data.relatedBlueprintId === item.id; });
            if (!hasKpi && !hasHealth) criticalSystemsWithoutMeasures++;
          });
        });
      });
    }

    var interventionsOffTarget = 0;
    var ws = WB && WB.load();
    if (ws) {
      (ws.interventions || []).forEach(function (iv) {
        if (WB.evaluateMeasurement(iv.baselineValue, iv.targetValue, iv.actualValue) === 'Not Met') interventionsOffTarget++;
      });
    }

    mount.innerHTML =
      (worstOverall ? '<div class="build-project-row__meta" style="margin-bottom:var(--space-4)"><span class="health-badge health-badge--' + worstOverall.status.toLowerCase() + '">' + esc(worstOverall.status) + '</span><strong>Overall Health Signal</strong><span class="text-dim text-mono" style="font-size:var(--step--1)">Worst: ' + esc(worstOverall.name) + '</span></div>' : '') +
      metricGridHtml([
        { label: 'Critical Systems', value: criticalSystems },
        { label: 'Deteriorating Signals', value: deterioratingSignals },
        { label: 'Active Early Warnings', value: earlyWarningsActive },
        { label: 'KPIs Without Owners', value: kpisWithoutOwners },
        { label: 'Critical Systems Without Measures', value: criticalSystemsWithoutMeasures },
        { label: 'Interventions Off Target', value: interventionsOffTarget }
      ]) +
      '<a class="btn btn--secondary" href="operational-health.html" style="margin-top:var(--space-3);display:inline-block;margin-right:var(--space-3)">Open Operational Health &rarr;</a>' +
      '<a class="btn btn--secondary" href="kpi-architect.html" style="margin-top:var(--space-3);display:inline-block">Open KPI Architect &rarr;</a>';
  }

  /* ----------------------------------------------------------
     Governance — a modest summary shown only once at least one
     Governance Model or Operating Rhythm exists. Not a redesign
     of Command Center: a handful of counts and a link out.
     ---------------------------------------------------------- */

  function renderGovernance() {
    var section = byId('command-governance-section');
    var mount = byId('command-governance-mount');
    var G = global.OMSGovernance;
    var R = global.OMSRhythm;
    if (!section || !mount) return;
    var govModels = G ? G.store.list() : [];
    var rhythms = R ? R.store.list() : [];
    if (!govModels.length && !rhythms.length) { section.hidden = true; return; }
    section.hidden = false;

    var gaps = G ? G.governanceGaps() : [];
    var criticalSystemsWithoutGovernance = gaps.filter(function (f) { return f.rule === 'Critical Process With No Governance'; }).length;
    var kpisReviewedNowhere = gaps.filter(function (f) { return f.rule === 'Critical KPI Reviewed Nowhere'; }).length;
    var decisionsWithoutOwners = rhythms.reduce(function (sum, r) { return sum + (r.data.decisions || []).filter(function (d) { return !d.owner; }).length; }, 0)
      + gaps.filter(function (f) { return f.rule === 'Decision With No Forum Or Owner'; }).length;

    var today = new Date();
    var overdueGovernanceReviews = 0;
    rhythms.forEach(function (r) {
      (r.data.decisions || []).forEach(function (d) {
        if (d.reviewDate) { var dt = new Date(d.reviewDate); if (!isNaN(dt.getTime()) && dt < today) overdueGovernanceReviews++; }
      });
    });

    var repeatedUnresolvedIssues = R ? R.decisionYield(rhythms).repeatedUnresolved : 0;

    var highEscalationConcentration = rhythms.filter(function (r) { return R.rhythmFlags(r).some(function (f) { return f.rule === 'Every Decision Escalates'; }); }).length;
    govModels.forEach(function (m) {
      highEscalationConcentration += (G.escalationFlags(m.data.escalations || []).filter(function (f) { return f.rule === 'Everything Escalates'; }).length);
    });

    mount.innerHTML =
      metricGridHtml([
        { label: 'Critical Systems Without Governance', value: criticalSystemsWithoutGovernance },
        { label: 'Decisions Without Owners', value: decisionsWithoutOwners },
        { label: 'KPIs Reviewed Nowhere', value: kpisReviewedNowhere },
        { label: 'Overdue Governance Reviews', value: overdueGovernanceReviews },
        { label: 'Repeated Unresolved Issues', value: repeatedUnresolvedIssues },
        { label: 'High Escalation Concentration', value: highEscalationConcentration }
      ]) +
      '<a class="btn btn--secondary" href="governance.html" style="margin-top:var(--space-3);display:inline-block;margin-right:var(--space-3)">Open Governance &rarr;</a>' +
      '<a class="btn btn--secondary" href="operating-rhythm.html" style="margin-top:var(--space-3);display:inline-block">Open Operating Rhythm Designer &rarr;</a>';
  }

  /* ----------------------------------------------------------
     Resilience — a modest summary shown only once a Risk Model or
     Resilience Model exists. Functional is not the same thing as
     resilient — this section stays deliberately separate from the
     Operational Health section above.
     ---------------------------------------------------------- */

  function renderResilience() {
    var section = byId('command-resilience-section');
    var mount = byId('command-resilience-mount');
    var Risk = global.OMSRisk;
    var Res = global.OMSResilience;
    if (!section || !mount) return;
    var riskModels = Risk ? Risk.store.list() : [];
    var resModels = Res ? Res.store.list() : [];
    if (!riskModels.length && !resModels.length) { section.hidden = true; return; }
    section.hidden = false;

    var criticalRisks = 0, spofCount = 0, lowDetectability = 0, highConcentration = 0, untestedFallbacks = 0;
    riskModels.forEach(function (m) {
      (m.data.risks || []).forEach(function (r) {
        if (r.likelihood === 'Critical' || r.impact === 'Critical') criticalRisks++;
        if (Risk.detectability(r).level === 'Low') lowDetectability++;
      });
      (m.data.dependencies || []).forEach(function (d) {
        if (d.concentrationDescription) highConcentration++;
      });
      spofCount += Risk.singlePointsOfFailure(m).length;
      (m.data.technologyDependencies || []).forEach(function (t) {
        if (Risk.technologyFlags(t).some(function (f) { return f.rule === 'Manual Fallback Untested'; })) untestedFallbacks++;
      });
    });

    var weakResilienceSystems = 0;
    resModels.forEach(function (m) {
      var overall = Res.overallHealth(m);
      if (overall.status === 'Weak' || overall.status === 'Critical') weakResilienceSystems++;
      untestedFallbacks += Res.paperResilienceFlags(m).length;
    });

    mount.innerHTML =
      metricGridHtml([
        { label: 'Critical Operational Risks', value: criticalRisks },
        { label: 'Single Points Of Failure', value: spofCount },
        { label: 'Critical Systems With Weak Resilience', value: weakResilienceSystems },
        { label: 'Untested Fallbacks', value: untestedFallbacks },
        { label: 'Low-Detectability Risks', value: lowDetectability },
        { label: 'High-Concentration Dependencies', value: highConcentration }
      ]) +
      '<a class="btn btn--secondary" href="risk.html" style="margin-top:var(--space-3);display:inline-block;margin-right:var(--space-3)">Open Operational Risk &rarr;</a>' +
      '<a class="btn btn--secondary" href="resilience.html" style="margin-top:var(--space-3);display:inline-block">Open Resilience Intelligence &rarr;</a>';
  }

  /* ----------------------------------------------------------
     Operating Debt — shown only once a real register exists,
     replacing the assessment-based approximation above with
     named, owned items.
     ---------------------------------------------------------- */

  function renderDebt() {
    var section = byId('command-debt-section');
    var mount = byId('command-debt-mount');
    var D = global.OMSDebt;
    if (!section || !mount) return;
    var models = D ? D.store.list() : [];
    if (!models.length) { section.hidden = true; return; }
    section.hidden = false;

    var totalItems = 0, highCost = 0, unowned = 0, untracked = 0;
    models.forEach(function (m) {
      var items = m.data.debtItems || [];
      totalItems += items.length;
      items.forEach(function (i) {
        if (i.costOfCarrying === 'High' || i.costOfCarrying === 'Severe') highCost++;
        if (!i.owner) unowned++;
        if (!i.remediationStatus || i.remediationStatus === 'Untracked') untracked++;
      });
    });

    mount.innerHTML =
      metricGridHtml([
        { label: 'Debt Items Named', value: totalItems },
        { label: 'High Or Severe Cost', value: highCost },
        { label: 'Without An Owner', value: unowned },
        { label: 'Untracked', value: untracked }
      ]) +
      '<a class="btn btn--secondary" href="operating-debt.html" style="margin-top:var(--space-3);display:inline-block">Open Operating Debt &rarr;</a>';
  }

  /* ----------------------------------------------------------
     Scale Readiness — shown only once a real assessment exists,
     replacing the assessment-based approximation above with signal
     drawn from Capacity, Risk, and Blueprint.
     ---------------------------------------------------------- */

  function renderScale() {
    var section = byId('command-scale-section');
    var mount = byId('command-scale-mount');
    var Scale = global.OMSScale;
    if (!section || !mount) return;
    var models = Scale ? Scale.store.list() : [];
    if (!models.length) { section.hidden = true; return; }
    section.hidden = false;

    var criticalConstraints = 0, weakOrCritical = 0, totalConstraints = 0;
    models.forEach(function (m) {
      var overall = Scale.overallReadiness(m);
      if (overall.status === 'Weak' || overall.status === 'Critical') weakOrCritical++;
      var constraints = Scale.scaleConstraints(m);
      totalConstraints += constraints.length;
      criticalConstraints += constraints.filter(function (c) { return c.severity === 'Critical'; }).length;
    });

    mount.innerHTML =
      metricGridHtml([
        { label: 'Assessments Run', value: models.length },
        { label: 'Weak Or Critical Readiness', value: weakOrCritical },
        { label: 'Scale Constraints Named', value: totalConstraints },
        { label: 'Critical Constraints', value: criticalConstraints }
      ]) +
      '<a class="btn btn--secondary" href="scale-readiness.html" style="margin-top:var(--space-3);display:inline-block">Open Scale Readiness &rarr;</a>';
  }

  /* ----------------------------------------------------------
     Transformation — shown only once a real plan exists.
     ---------------------------------------------------------- */

  function renderTransformation() {
    var section = byId('command-transformation-section');
    var mount = byId('command-transformation-mount');
    var T = global.OMSTransformation;
    if (!section || !mount) return;
    var models = T ? T.store.list() : [];
    if (!models.length) { section.hidden = true; return; }
    section.hidden = false;

    var totalPhases = 0, complete = 0, blocked = 0, sequencingSkips = 0;
    models.forEach(function (m) {
      var progress = T.phaseProgress(m);
      totalPhases += progress.total;
      complete += progress.complete;
      blocked += progress.blocked;
      sequencingSkips += T.phaseSequenceFindings(m).length;
    });

    mount.innerHTML =
      metricGridHtml([
        { label: 'Plans Active', value: models.length },
        { label: 'Phases Complete', value: complete + ' / ' + totalPhases },
        { label: 'Phases Blocked', value: blocked },
        { label: 'Phases Skipping Ahead', value: sequencingSkips }
      ]) +
      '<a class="btn btn--secondary" href="transformation.html" style="margin-top:var(--space-3);display:inline-block">Open Transformation &rarr;</a>';
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

    var H = global.OMSHealth;
    if (H) {
      var deteriorating = 0, weakOrCritical = [];
      H.store.list().forEach(function (m) {
        var overall = H.overallHealth(m);
        if (overall.status === 'Weak' || overall.status === 'Critical') weakOrCritical.push(m.name);
        (m.data.dimensions || []).forEach(function (d) { if (H.trendForDimension(d).label === 'Deteriorating') deteriorating++; });
      });
      if (deteriorating > 0) lines.push(deteriorating + ' operating signal' + (deteriorating === 1 ? ' is' : 's are') + ' trending deteriorating.');
      if (weakOrCritical.length) lines.push('"' + weakOrCritical[0] + '"' + (weakOrCritical.length > 1 ? ' and ' + (weakOrCritical.length - 1) + ' other system' + (weakOrCritical.length > 2 ? 's' : '') : '') + ' currently show weak or critical health, even where performance is still on target.');
    }

    var R = global.OMSRhythm;
    var G = global.OMSGovernance;
    if (R) {
      var rhythms = R.store.list();
      if (rhythms.length) {
        var dupFindings = R.crossRhythmFindings(rhythms).filter(function (f) { return f.rule === 'Metric Reviewed In Multiple Places'; });
        var gaps = G ? G.governanceGaps() : [];
        if (dupFindings.length && gaps.length) {
          lines.push('The same signal is reviewed in ' + dupFindings.length + ' set' + (dupFindings.length === 1 ? '' : 's') + ' of overlapping rhythms, while ' + gaps.length + ' governance gap' + (gaps.length === 1 ? '' : 's') + ' — including things no rhythm reviews at all — remain open. You don\'t have too many meetings; you have too many meetings doing the same job, and several important jobs no meeting is doing.');
        } else if (dupFindings.length) {
          lines.push(dupFindings.length + ' signal' + (dupFindings.length === 1 ? '' : 's') + ' — ' + dupFindings[0].message.split('"')[1] + (dupFindings.length > 1 ? ' among others' : '') + ' — ' + (dupFindings.length === 1 ? 'is' : 'are') + ' reviewed in three or more different rhythms.');
        } else if (gaps.length) {
          lines.push(gaps.length + ' governance gap' + (gaps.length === 1 ? '' : 's') + ' — including ' + gaps[0].rule.toLowerCase() + ' — remain open.');
        }
      }
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
      renderOperationalHealth();
      renderGovernance();
      renderResilience();
      renderDebt();
      renderScale();
      renderTransformation();
      renderSystemStory(results, attentionItems);
    });
  }

  global.OMSDashboard = { init: init };
})(window);
