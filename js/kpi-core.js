/*
 * Operations Maturity System
 * KPI Architect — data model, persistence, and analysis engine.
 *
 * Designs measures that support decisions, not dashboards that collect
 * numbers. The discipline this file enforces throughout:
 *
 *   Metrics without decisions are reporting, not management.
 *   What gets measured is not automatically what matters.
 *
 * Every KPI here starts from a decision, not a number. The quality rules
 * and the Vanity Metric Challenge exist to keep that honest — a KPI with
 * no owner, no decision, no data source, and no threshold is not
 * operationally mature, no matter how precise the number looks.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'kpimodels';

  function newId(prefix) {
    return (prefix || 'kpim') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var SCOPE_TYPES = ['Outcome', 'Capability', 'Value Stream', 'Process', 'Team', 'Decision', 'Operational Health Model', 'Custom'];
  var KPI_TYPES = ['Outcome', 'Quality', 'Speed', 'Capacity', 'Efficiency', 'Customer', 'Employee', 'Financial', 'Risk', 'Process', 'Flow', 'Reliability', 'Exception', 'Custom'];
  var DIRECTIONS = ['Higher Is Better', 'Lower Is Better', 'Target Range', 'Binary'];
  var THRESHOLD_SOURCES = ['Customer Requirement', 'SLA', 'Historical Baseline', 'Contract', 'Risk Tolerance', 'Capacity Limit', 'Operational Standard', 'Leadership Target', 'Benchmark', 'User Judgment', 'Unknown'];
  var REVIEW_RHYTHMS = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Ad hoc', 'Never'];
  var DATA_CONFIDENCE = ['High', 'Moderate', 'Low', 'Unknown'];

  function blankData() {
    return {
      scopeType: '', relatedBlueprintProjectId: '', relatedBlueprintType: '', relatedBlueprintId: '',
      relatedValueStreamId: '', relatedCapacityModelId: '', relatedHealthModelId: '',
      kpis: [], chainLinks: [], outcomeDriverChains: [],
      hasTargetState: false, targetSummary: null,
      findings: [], activity: []
    };
  }

  function loadAll() { return global.OMSData.storage.get(STORAGE_KEY, []); }
  function saveAll(list) { global.OMSData.storage.set(STORAGE_KEY, list); }

  var store = {
    list: function () { return loadAll(); },
    get: function (id) { return loadAll().filter(function (m) { return m.id === id; })[0] || null; },
    create: function (name, data, isSample) {
      var now = new Date().toISOString();
      var model = { id: newId(), name: name || 'New KPI Model', owner: '', createdAt: now, updatedAt: now, isSample: !!isSample, currentStep: 0, data: data || blankData() };
      var all = loadAll();
      all.push(model);
      saveAll(all);
      return model;
    },
    save: function (model) {
      model.updatedAt = new Date().toISOString();
      var all = loadAll();
      var idx = all.findIndex(function (m) { return m.id === model.id; });
      if (idx === -1) all.push(model); else all[idx] = model;
      saveAll(all);
      return model;
    },
    remove: function (id) { saveAll(loadAll().filter(function (m) { return m.id !== id; })); },
    duplicate: function (id) {
      var original = store.get(id);
      if (!original) return null;
      var copy = JSON.parse(JSON.stringify(original));
      copy.id = newId();
      copy.name = original.name + ' (Copy)';
      copy.isSample = false;
      copy.createdAt = new Date().toISOString();
      copy.updatedAt = copy.createdAt;
      var all = loadAll();
      all.push(copy);
      saveAll(all);
      return copy;
    },
    mostRecent: function () {
      var all = loadAll();
      if (!all.length) return null;
      return all.slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); })[0];
    }
  };

  function logActivity(model, message) {
    model.data.activity = model.data.activity || [];
    model.data.activity.unshift({ id: newId('act'), timestamp: new Date().toISOString(), message: message });
    model.data.activity = model.data.activity.slice(0, 50);
  }

  function byId(list, id) { return (list || []).filter(function (x) { return x.id === id; })[0] || null; }
  function isYes(v) { return v === true || v === 'Yes'; }

  /* ----------------------------------------------------------
     Section 10 — KPI quality rules. Deterministic, explained,
     never a judgment of the team.
     ---------------------------------------------------------- */

  function kpiFlags(kpi) {
    var flags = [];
    if (!kpi.owner) flags.push({ rule: 'No Owner', message: '"' + (kpi.name || 'This KPI') + '" has no named owner.' });
    if (!kpi.decision && !kpi.decisionEnabled) flags.push({ rule: 'No Decision', message: 'No decision is named that this measurement supports.' });
    if (!kpi.dataSource) flags.push({ rule: 'No Data Source', message: 'No data source is recorded.' });
    if (!kpi.formula) flags.push({ rule: 'No Definition', message: 'No formula or definition is recorded.' });
    else if (kpi.formula.trim().length < 8) flags.push({ rule: 'Ambiguous Formula', message: 'The formula is very short — likely too vague to calculate consistently. This is a rough heuristic, not a precise check.' });
    if (!kpi.reviewRhythm || kpi.reviewRhythm === 'Never') flags.push({ rule: 'No Review Cadence', message: 'No regular review rhythm is set for this KPI.' });
    if (!kpi.actionOffTarget) flags.push({ rule: 'No Action Threshold', message: 'There is no defined action for when this KPI goes off target.' });
    if (!kpi.target) flags.push({ rule: 'No Target', message: 'No target value is set.' });
    if (kpi.activityOrValue === 'Activity' && !kpi.hasOutcomeConnection) flags.push({ rule: 'Activity Metric With No Outcome Connection', message: 'This measures activity, not outcome, and isn\'t linked to an outcome via the Metric Chain.' });
    if (isYes(kpi.reviewedButNoDecision)) flags.push({ rule: 'Metric Reviewed But No Decision Made', message: 'This KPI is reviewed regularly, but no decision is reported as actually being made from it.' });
    if (kpi.gamingRisk) flags.push({ rule: 'Metric Distortion Risk', message: 'A way to game this metric has been identified: ' + kpi.gamingRisk });
    return flags;
  }

  function nameSimilar(a, b) {
    if (!a || !b) return false;
    var na = a.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '');
    var nb = b.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '');
    if (na === nb) return true;
    var wa = na.split(/\s+/).filter(Boolean);
    var wb = nb.split(/\s+/).filter(Boolean);
    if (!wa.length || !wb.length) return false;
    var shared = wa.filter(function (w) { return wb.indexOf(w) !== -1; });
    return shared.length / Math.max(wa.length, wb.length) >= 0.6;
  }

  function modelFindings(model) {
    var flags = [];
    var kpis = model.data.kpis || [];
    if (!kpis.length) return flags;

    var leading = kpis.filter(function (k) { return k.leadingLagging === 'Leading'; });
    if (kpis.length >= 3 && !leading.length) {
      flags.push({ severity: 'warning', rule: 'Only Lagging Indicators', message: 'None of the ' + kpis.length + ' KPIs in this model are marked Leading. Lagging indicators tell you what happened; leading indicators help you see what may happen next.', why: 'Three or more KPIs exist and none are marked Leading.' });
    }

    var withDecision = kpis.filter(function (k) { return k.decision || k.decisionEnabled; });
    if (kpis.length >= 8 && (withDecision.length / kpis.length) < 0.5) {
      flags.push({ severity: 'critical', rule: 'KPI Explosion', message: kpis.length + ' KPIs exist, but only ' + withDecision.length + ' (' + Math.round((withDecision.length / kpis.length) * 100) + '%) are linked to a decision. Seeing a number is not the same as managing the system.', why: 'Eight or more KPIs exist and fewer than half are linked to a decision.' });
    }

    for (var i = 0; i < kpis.length; i++) {
      for (var j = i + 1; j < kpis.length; j++) {
        if (nameSimilar(kpis[i].name, kpis[j].name)) {
          flags.push({ severity: 'info', rule: 'KPI Duplication', message: '"' + kpis[i].name + '" and "' + kpis[j].name + '" look like they may measure nearly the same thing. Confirm whether one should be retired.', why: 'Name overlap heuristic — not confirmed semantic matching.' });
        }
      }
    }

    return flags;
  }

  /* ----------------------------------------------------------
     Section 31 — Measurement Load
     ---------------------------------------------------------- */

  function measurementLoad(model) {
    var kpis = model.data.kpis || [];
    var byOwner = {};
    kpis.forEach(function (k) { var o = k.owner || 'Unassigned'; byOwner[o] = (byOwner[o] || 0) + 1; });
    var withDecision = kpis.filter(function (k) { return k.decision || k.decisionEnabled; }).length;
    var activelyReviewed = kpis.filter(function (k) { return k.reviewRhythm && k.reviewRhythm !== 'Never'; }).length;
    return {
      total: kpis.length, withDecision: withDecision, withoutDecision: kpis.length - withDecision,
      activelyReviewed: activelyReviewed, byOwner: byOwner
    };
  }

  /* ----------------------------------------------------------
     Section 11 — Vanity Metric Challenge. Reflective questions,
     not stored answers — a teaching interaction, not a form.
     ---------------------------------------------------------- */

  var VANITY_QUESTIONS = [
    'What decision changes because of this metric?',
    'What behavior could improve this metric without improving the system?',
    'Could the metric improve while the customer outcome gets worse?',
    'Does this measure activity or value?',
    'Can someone game this measure?',
    'What would this metric hide?'
  ];

  /* ----------------------------------------------------------
     Section 46 — Measurement System Maturity Snapshot
     ---------------------------------------------------------- */

  function maturitySnapshot(model) {
    var kpis = model.data.kpis || [];
    if (!kpis.length) return null;
    function pct(fn) { return Math.round((kpis.filter(fn).length / kpis.length) * 100); }
    return {
      definition: pct(function (k) { return !!k.formula; }),
      ownership: pct(function (k) { return !!k.owner; }),
      data: pct(function (k) { return !!k.dataSource; }),
      thresholds: pct(function (k) { return !!k.target || !!k.warningThreshold || !!k.criticalThreshold; }),
      decisionLinkage: pct(function (k) { return !!(k.decision || k.decisionEnabled); }),
      reviewCadence: pct(function (k) { return !!k.reviewRhythm && k.reviewRhythm !== 'Never'; }),
      leadingIndicators: pct(function (k) { return k.leadingLagging === 'Leading'; }),
      actionability: pct(function (k) { return !!k.actionOffTarget; })
    };
  }

  global.OMSKpi = {
    STORAGE_KEY: STORAGE_KEY,
    SCOPE_TYPES: SCOPE_TYPES, KPI_TYPES: KPI_TYPES, DIRECTIONS: DIRECTIONS,
    THRESHOLD_SOURCES: THRESHOLD_SOURCES, REVIEW_RHYTHMS: REVIEW_RHYTHMS, DATA_CONFIDENCE: DATA_CONFIDENCE,
    VANITY_QUESTIONS: VANITY_QUESTIONS,
    newId: newId, blankData: blankData, store: store, logActivity: logActivity, byId: byId, isYes: isYes,
    kpiFlags: kpiFlags, modelFindings: modelFindings, measurementLoad: measurementLoad, maturitySnapshot: maturitySnapshot
  };
})(window);
