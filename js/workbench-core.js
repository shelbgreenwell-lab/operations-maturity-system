/*
 * Operations Maturity System
 * Operator Workbench — data model, persistence, and deterministic
 * rule engines.
 *
 * The Workbench answers one question the rest of OMS doesn't:
 * "What are we actively doing about what we learned?" It is not a
 * task board. It models the actual shape of operational improvement
 * work — observation, question, investigation, evidence, validated
 * root cause, intervention, measured result, standardization — and
 * keeps every one of those objects tied back to where it came from
 * (an OMS layer, a system, a Blueprint object).
 *
 * Persistence is intentionally a SINGLE workspace object (not a list
 * like Blueprints or builder projects) stored under one localStorage
 * key, exactly as instructed: one place holding every entity array,
 * so nothing here scatters storage logic across unrelated files.
 *
 * Responsible for:
 * - the workspace shape and its localStorage persistence (load,
 *   save, export, import, clear-sample)
 * - generic CRUD for every entity type, with activity logging
 * - the deterministic, explicitly-non-scientific Priority Signal
 *   (business impact, urgency, dependency value, risk, effort)
 * - baseline/target/actual measurement evaluation — never inventing
 *   a value the user didn't enter
 * - the Attention Needed rule engine
 * - the Improvement Pipeline stage counts (Observe -> Scale)
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'workbench';

  var LAYER_META = {
    direction: { label: 'Direction' },
    design: { label: 'Design' },
    execution: { label: 'Execution' },
    management: { label: 'Management' },
    intelligence: { label: 'Intelligence' },
    evolution: { label: 'Evolution' }
  };
  var LAYER_ORDER = ['direction', 'design', 'execution', 'management', 'intelligence', 'evolution'];

  var ENTITY_META = {
    observations: { label: 'Observation', plural: 'Observations', nameField: 'title' },
    questions: { label: 'Question', plural: 'Questions', nameField: 'question' },
    findings: { label: 'Finding', plural: 'OMS Findings', nameField: 'title' },
    priorities: { label: 'Priority', plural: 'Priorities', nameField: 'title' },
    evidence: { label: 'Evidence', plural: 'Evidence', nameField: 'title' },
    investigations: { label: 'Investigation', plural: 'Investigations', nameField: 'title' },
    rootCauses: { label: 'Root Cause', plural: 'Root Causes', nameField: 'validatedRootCause' },
    interventions: { label: 'Intervention', plural: 'Interventions', nameField: 'proposedChange' },
    decisions: { label: 'Decision', plural: 'Decisions', nameField: 'decision' },
    risks: { label: 'Risk', plural: 'Risks', nameField: 'risk' },
    savedSystems: { label: 'Saved System', plural: 'Saved Systems', nameField: null },
    builderLinks: { label: 'Builder Link', plural: 'Builder Links', nameField: null }
  };
  var ENTITY_ORDER = ['observations', 'questions', 'findings', 'priorities', 'evidence', 'investigations',
    'rootCauses', 'interventions', 'decisions', 'risks', 'savedSystems', 'builderLinks'];

  function entityName(type, item) {
    if (!item) return 'Untitled';
    if (type === 'savedSystems') return (item.resourceRef && item.resourceRef.label) || 'Untitled';
    var field = ENTITY_META[type] && ENTITY_META[type].nameField;
    return (field && item[field]) || 'Untitled';
  }

  function newId(prefix) {
    return (prefix || 'wb') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ----------------------------------------------------------
     Workspace shape + persistence
     ---------------------------------------------------------- */

  function blankWorkspace() {
    var now = new Date().toISOString();
    var ws = { meta: { createdAt: now, updatedAt: now } };
    ENTITY_ORDER.forEach(function (t) { ws[t] = []; });
    ws.activity = [];
    return ws;
  }

  function load() {
    var ws = global.OMSData.storage.get(STORAGE_KEY, null);
    if (!ws) { ws = blankWorkspace(); global.OMSData.storage.set(STORAGE_KEY, ws); }
    // Defensive: fill in any entity arrays missing from an older shape.
    ENTITY_ORDER.forEach(function (t) { if (!ws[t]) ws[t] = []; });
    if (!ws.activity) ws.activity = [];
    if (!ws.meta) ws.meta = { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    return ws;
  }

  function save(ws) {
    ws.meta.updatedAt = new Date().toISOString();
    global.OMSData.storage.set(STORAGE_KEY, ws);
    return ws;
  }

  function logActivity(ws, message) {
    ws.activity = ws.activity || [];
    ws.activity.unshift({ id: newId('act'), timestamp: new Date().toISOString(), message: message });
    ws.activity = ws.activity.slice(0, 100);
  }

  /* ----------------------------------------------------------
     Generic CRUD
     ---------------------------------------------------------- */

  function addItem(ws, type, fields) {
    var now = new Date().toISOString();
    var item = Object.assign({ id: newId(type.slice(0, 3)), createdAt: now, updatedAt: now }, fields);
    ws[type] = ws[type] || [];
    ws[type].push(item);
    logActivity(ws, ENTITY_META[type].label + ' created: "' + entityName(type, item) + '"');
    save(ws);
    return item;
  }

  function updateItem(ws, type, id, patch) {
    var item = (ws[type] || []).filter(function (x) { return x.id === id; })[0];
    if (!item) return null;
    var oldStatus = item.status;
    if (patch.status === 'Blocked' && oldStatus !== 'Blocked') patch.blockedSince = new Date().toISOString();
    else if (patch.status && patch.status !== 'Blocked' && oldStatus === 'Blocked') patch.blockedSince = null;
    Object.keys(patch).forEach(function (k) { item[k] = patch[k]; });
    item.updatedAt = new Date().toISOString();
    if (patch.status && patch.status !== oldStatus) {
      logActivity(ws, ENTITY_META[type].label + ' "' + entityName(type, item) + '" status changed to ' + patch.status);
    }
    save(ws);
    return item;
  }

  function removeItem(ws, type, id) {
    var item = (ws[type] || []).filter(function (x) { return x.id === id; })[0];
    ws[type] = (ws[type] || []).filter(function (x) { return x.id !== id; });
    if (item) logActivity(ws, ENTITY_META[type].label + ' removed: "' + entityName(type, item) + '"');
    save(ws);
  }

  function byId(list, id) { return (list || []).filter(function (x) { return x.id === id; })[0] || null; }

  function clearSample(ws) {
    ENTITY_ORDER.concat(['activity']).forEach(function (t) {
      ws[t] = (ws[t] || []).filter(function (x) { return !x.isSample; });
    });
    save(ws);
    return ws;
  }

  function hasSample(ws) {
    return ENTITY_ORDER.some(function (t) { return (ws[t] || []).some(function (x) { return x.isSample; }); });
  }

  function exportWorkspace(ws) {
    var blob = new Blob([JSON.stringify(ws, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'oms-workbench-export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importWorkspace(json) {
    var parsed = JSON.parse(json);
    var ws = blankWorkspace();
    ENTITY_ORDER.forEach(function (t) { if (Array.isArray(parsed[t])) ws[t] = parsed[t]; });
    if (Array.isArray(parsed.activity)) ws.activity = parsed.activity;
    save(ws);
    return ws;
  }

  /* ----------------------------------------------------------
     Priority Signal — deterministic, explicitly not scientific.
     ---------------------------------------------------------- */

  var LEVEL_SCORE = { Low: 1, Medium: 2, High: 3, Critical: 4 };
  var EFFORT_SCORE = { Low: 3, Medium: 2, High: 1 };
  var PRIORITY_MAX_SCORE = LEVEL_SCORE.Critical * 2 + LEVEL_SCORE.Critical * 2 + 3 + LEVEL_SCORE.Critical + 3;

  function prioritySignal(p) {
    var reasons = [];
    var bi = LEVEL_SCORE[p.businessImpact] || 0;
    var ur = LEVEL_SCORE[p.urgency] || 0;
    var dv = LEVEL_SCORE[p.dependencyValue] || 0;
    var rk = LEVEL_SCORE[p.risk] || 0;
    var ef = EFFORT_SCORE[p.effort] || 0;
    var score = bi * 2 + ur * 2 + dv + rk + ef;
    var ratio = score / PRIORITY_MAX_SCORE;

    if (p.businessImpact === 'High' || p.businessImpact === 'Critical') reasons.push(p.businessImpact + ' business impact');
    if (p.urgency === 'High' || p.urgency === 'Critical') reasons.push(p.urgency + ' urgency');
    if (p.dependencyValue === 'High') reasons.push('High dependency value');
    if (p.risk === 'High' || p.risk === 'Critical') reasons.push(p.risk + ' risk if left unaddressed');
    if (p.effort === 'Low') reasons.push('Low effort to act on');
    if (p.effort === 'High') reasons.push('High effort required');
    if (!reasons.length) reasons.push('Not enough entered yet to signal more than Low.');

    var signal = ratio >= 0.66 ? 'High' : ratio >= 0.4 ? 'Moderate' : 'Low';
    return { signal: signal, reasons: reasons, score: score, maxScore: PRIORITY_MAX_SCORE };
  }

  /* ----------------------------------------------------------
     Baseline / Target / Actual — only ever reflects entered values.
     ---------------------------------------------------------- */

  function evaluateMeasurement(baseline, target, actual) {
    if (baseline == null || baseline === '' || target == null || target === '' || actual == null || actual === '') return null;
    var b = parseFloat(baseline), t = parseFloat(target), a = parseFloat(actual);
    if (isNaN(b) || isNaN(t) || isNaN(a)) return null;
    if (t < b) { // lower is better
      if (a <= t) return 'Target Met';
      if (a < b) return 'Partially Met';
      return 'Not Met';
    }
    if (t > b) { // higher is better
      if (a >= t) return 'Target Met';
      if (a > b) return 'Partially Met';
      return 'Not Met';
    }
    return a === t ? 'Target Met' : 'Not Met';
  }

  /* ----------------------------------------------------------
     Improvement Pipeline stage counts (Observe -> Scale)
     ---------------------------------------------------------- */

  function pipelineStages(ws) {
    var hasIntervention = {};
    (ws.interventions || []).forEach(function (iv) { if (iv.relatedRootCauseId) hasIntervention[iv.relatedRootCauseId] = true; });

    return [
      { id: 'observe', label: 'Observe', count: (ws.observations || []).filter(function (o) { return !o.linkedQuestionIds || !o.linkedQuestionIds.length; }).length },
      { id: 'diagnose', label: 'Diagnose', count: (ws.questions || []).filter(function (q) { return q.status === 'Open' || q.status === 'Investigating'; }).length + (ws.investigations || []).filter(function (i) { return i.rootCauseStatus === 'Unvalidated'; }).length },
      { id: 'validate', label: 'Validate', count: (ws.investigations || []).filter(function (i) { return i.rootCauseStatus === 'Likely'; }).length + (ws.rootCauses || []).filter(function (rc) { return !hasIntervention[rc.id]; }).length },
      { id: 'design', label: 'Design', count: (ws.interventions || []).filter(function (i) { return i.status === 'Designing'; }).length },
      { id: 'test', label: 'Test', count: (ws.interventions || []).filter(function (i) { return i.status === 'Ready to Test' || i.status === 'Testing'; }).length },
      { id: 'measure', label: 'Measure', count: (ws.interventions || []).filter(function (i) { return i.status === 'Measuring'; }).length },
      { id: 'standardize', label: 'Standardize', count: (ws.interventions || []).filter(function (i) { return i.status === 'Successful'; }).length },
      { id: 'scale', label: 'Scale', count: (ws.interventions || []).filter(function (i) { return i.status === 'Standardized'; }).length }
    ];
  }

  /* ----------------------------------------------------------
     Attention Needed — deterministic rules, each one explained.
     ---------------------------------------------------------- */

  var DAY_MS = 24 * 60 * 60 * 1000;

  function daysSince(iso) {
    if (!iso) return 0;
    return (Date.now() - new Date(iso).getTime()) / DAY_MS;
  }

  function isPast(iso) {
    if (!iso) return false;
    return new Date(iso).getTime() < Date.now();
  }

  function attentionNeeded(ws) {
    var out = [];
    function flag(type, item, rule, message, why) {
      out.push({ type: type, itemId: item.id, itemLabel: entityName(type, item), rule: rule, message: message, why: why });
    }

    (ws.priorities || []).forEach(function (p) {
      if (p.status === 'Blocked' && p.blockedSince && daysSince(p.blockedSince) > 7) {
        flag('priorities', p, 'Blocked Too Long', '"' + p.title + '" has been blocked for ' + Math.floor(daysSince(p.blockedSince)) + ' days.', 'A priority has been in Blocked status for more than 7 days.');
      }
      if (p.status !== 'Complete' && !p.successMeasure) {
        flag('priorities', p, 'No Success Measure', '"' + p.title + '" has no success measure defined.', 'A priority that is not yet Complete has no way to know when it is done.');
      }
    });

    (ws.investigations || []).forEach(function (inv) {
      var evidenceCount = (ws.evidence || []).filter(function (e) { return e.relatedInvestigationId === inv.id; }).length;
      if (inv.rootCauseStatus !== 'Disproven' && evidenceCount === 0) {
        flag('investigations', inv, 'No Evidence Yet', '"' + inv.title + '" has no evidence attached.', 'An open investigation has zero linked evidence records.');
      }
    });

    (ws.risks || []).forEach(function (r) {
      if ((r.impact === 'High' || r.impact === 'Critical') && !r.mitigation && r.status !== 'Closed') {
        flag('risks', r, 'High-Impact Risk Unmitigated', '"' + r.risk + '" is a ' + r.impact + '-impact risk with no mitigation.', 'A risk marked High or Critical impact has no mitigation entered.');
      }
    });

    (ws.interventions || []).forEach(function (iv) {
      var label = iv.proposedChange || 'Untitled intervention';
      if (['Ready to Test', 'Testing', 'Measuring', 'Successful', 'Failed', 'Inconclusive', 'Standardized'].indexOf(iv.status) !== -1 && !iv.baselineValue) {
        flag('interventions', iv, 'No Baseline', '"' + label + '" has no baseline recorded.', 'An intervention past the design stage has no baseline value, so measurement is not yet possible.');
      }
      if (iv.reviewDate && isPast(iv.reviewDate) && ['Successful', 'Failed', 'Standardized'].indexOf(iv.status) === -1) {
        flag('interventions', iv, 'Review Date Passed', '"' + label + '" was due for review on ' + new Date(iv.reviewDate).toLocaleDateString() + '.', 'The intervention\'s review date has passed and it has not reached a terminal status.');
      }
      if (iv.status === 'Successful') {
        flag('interventions', iv, 'Not Yet Standardized', '"' + label + '" succeeded but has not been standardized.', 'An intervention marked Successful should be written into the standard before it quietly reverts.');
      }
    });

    (ws.decisions || []).forEach(function (d) {
      if (d.reviewDate && isPast(d.reviewDate) && d.status === 'Active') {
        flag('decisions', d, 'Decision Review Due', '"' + d.decision + '" was due for review on ' + new Date(d.reviewDate).toLocaleDateString() + '.', 'Organizations repeat mistakes when decisions survive longer than their rationale.');
      }
    });

    (ws.rootCauses || []).forEach(function (rc) {
      var hasIntervention = (ws.interventions || []).some(function (iv) { return iv.relatedRootCauseId === rc.id; });
      if (!hasIntervention) {
        flag('rootCauses', rc, 'Validated, Not Yet Acted On', '"' + (rc.validatedRootCause || 'Untitled root cause') + '" has no intervention designed for it yet.', 'A validated root cause with no intervention is a diagnosis without a plan.');
      }
    });

    return out;
  }

  global.OMSWorkbenchCore = {
    ENTITY_META: ENTITY_META,
    ENTITY_ORDER: ENTITY_ORDER,
    LAYER_META: LAYER_META,
    LAYER_ORDER: LAYER_ORDER,
    entityName: entityName,
    newId: newId,
    blankWorkspace: blankWorkspace,
    load: load,
    save: save,
    logActivity: logActivity,
    addItem: addItem,
    updateItem: updateItem,
    removeItem: removeItem,
    byId: byId,
    clearSample: clearSample,
    hasSample: hasSample,
    exportWorkspace: exportWorkspace,
    importWorkspace: importWorkspace,
    prioritySignal: prioritySignal,
    evaluateMeasurement: evaluateMeasurement,
    pipelineStages: pipelineStages,
    attentionNeeded: attentionNeeded
  };
})(window);
