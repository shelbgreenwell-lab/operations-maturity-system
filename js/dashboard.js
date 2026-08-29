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

  function renderMetricGrid(mount, results, derived, levelName) {
    var metrics = [
      { label: 'Operating System Score', value: derived.operatingSystemScore, suffix: ' / 100' },
      { label: 'Maturity', value: results.overall.toFixed(1) + ' / 5', suffix: '', note: levelName },
      { label: 'Operational Health', value: derived.operationalHealth, suffix: ' / 100' },
      { label: 'Scale Readiness', value: derived.scaleReadiness, suffix: ' / 100' },
      { label: 'Operating Debt', value: derived.operatingDebt, suffix: ' / 100' },
      { label: 'Decision Friction', value: derived.decisionFriction, suffix: ' / 100' },
      { label: 'Resilience', value: derived.resilience, suffix: ' / 100' }
    ];

    mount.innerHTML = metrics.map(function (m) {
      return '' +
        '<div class="metric-card">' +
          '<span class="metric-card__label">' + m.label + '</span>' +
          '<span class="metric-card__value metric-card__value--accent">' + m.value + (m.suffix || '') + '</span>' +
          (m.note ? '<span class="metric-card__note">' + m.note + '</span>' : '') +
        '</div>';
    }).join('');
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

    Promise.all([
      global.OMSData.load('maturity.json'),
      global.OMSData.load('operating-layers.json')
    ]).then(function (arr) {
      var maturityData = arr[0];
      var layersData = arr[1];
      var level = levelFor(results.overall, maturityData.levels);
      var derived = derive(results);

      var metricMount = byId('metric-grid-mount');
      if (metricMount) renderMetricGrid(metricMount, results, derived, level.name);

      var layerMount = byId('command-layer-bars');
      if (layerMount) renderLayerBars(layerMount, results.layerScores);

      var constraintMount = byId('command-constraint-mount');
      if (constraintMount) {
        var weakDef = layersData.layers.filter(function (l) { return l.id === results.weakest; })[0];
        constraintMount.innerHTML =
          '<span class="eyebrow">Primary Constraint</span>' +
          '<h3 style="margin:var(--space-3) 0">' + LAYER_NAMES[results.weakest] + '</h3>' +
          '<p class="text-muted">' + (weakDef ? weakDef.purpose : '') + '</p>';
      }

      var priorityMount = byId('priority-mount');
      if (priorityMount) renderPriorities(priorityMount, results.layerScores, layersData);
    });
  }

  /* ----------------------------------------------------------
     System Architecture — a light Organization Blueprint summary.
     Reads live from js/blueprint-core.js; does not duplicate its
     analysis logic, just surfaces the headline numbers here.
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

  function renderSystemArchitecture() {
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
      '<div class="metric-grid" style="margin-bottom:var(--space-5)">' +
        '<div class="metric-card"><span class="metric-card__label">Blueprint Completeness</span><span class="metric-card__value metric-card__value--accent">' + completeness.percent + '%</span><span class="metric-card__note">' + bp.name + '</span></div>' +
        '<div class="metric-card"><span class="metric-card__label">Design / Reality Gap</span><span class="metric-card__value metric-card__value--accent">' + gap.level + '</span><span class="metric-card__note">' + gap.count + ' difference' + (gap.count === 1 ? '' : 's') + ' recorded</span></div>' +
        '<div class="metric-card"><span class="metric-card__label">Critical Dependencies</span><span class="metric-card__value metric-card__value--accent">' + criticalCount + '</span><span class="metric-card__note">objects marked Critical</span></div>' +
        '<div class="metric-card"><span class="metric-card__label">Systemic Risks</span><span class="metric-card__value metric-card__value--accent">' + risks.length + '</span><span class="metric-card__note">deterministic structural checks</span></div>' +
        '<div class="metric-card"><span class="metric-card__label">Unowned Critical Components</span><span class="metric-card__value metric-card__value--accent">' + unownedCritical + '</span><span class="metric-card__note">processes, decisions &amp; outcomes</span></div>' +
      '</div>' +
      '<a class="btn btn--secondary" href="blueprint.html?blueprint=' + encodeURIComponent(bp.id) + '">Open Blueprint &rarr;</a>';
  }

  function init() {
    var stored = global.OMSData.storage.get('assessment', null);
    render(stored || DEMO_RESULTS);
    renderSystemArchitecture();
  }

  global.OMSDashboard = { init: init };
})(window);
