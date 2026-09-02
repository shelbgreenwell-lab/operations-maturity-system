/*
 * Operations Maturity System
 * Transformation — data model, persistence, and analysis engine.
 *
 * Foundational operating maturity should not be skipped in pursuit of
 * advanced capabilities. This file helps move intentionally from a
 * current maturity state (read live from the stored Assessment — never
 * re-entered or duplicated here) toward a named target state, through
 * five fixed phases: Stabilize, Standardize, Control, Optimize, Adapt.
 * It sequences those phases and flags when a later phase is being
 * pursued while an earlier, foundational one is still not started.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'transformationplans';

  function newId(prefix) {
    return (prefix || 'xform') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var LAYER_ORDER = ['direction', 'design', 'execution', 'management', 'intelligence', 'evolution'];
  var LAYER_NAMES = { direction: 'Direction', design: 'Design', execution: 'Execution', management: 'Management', intelligence: 'Intelligence', evolution: 'Evolution' };
  var PHASE_NAMES = ['Stabilize', 'Standardize', 'Control', 'Optimize', 'Adapt'];
  var PHASE_STATUSES = ['Not Started', 'In Progress', 'Complete', 'Blocked'];
  var PHASE_STATUS_RANK = { 'Not Started': 0, 'In Progress': 1, Blocked: 1, Complete: 2 };

  function blankPhase(name) {
    return {
      name: name, objective: '', exitCriteria: [], status: 'Not Started',
      startDate: '', targetCompletionDate: '', actualCompletionDate: '',
      blockedReason: '', risks: '', owner: ''
    };
  }

  function blankData() {
    return {
      planScope: '', targetStateDescription: '',
      targetLayerScores: {},
      phases: PHASE_NAMES.map(blankPhase),
      sequencingNotes: '',
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
      var model = { id: newId(), name: name || 'New Transformation Plan', owner: '', createdAt: now, updatedAt: now, isSample: !!isSample, currentStep: 0, data: data || blankData() };
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
    clearSamples: function () { saveAll(loadAll().filter(function (m) { return !m.isSample; })); }
  };

  function logActivity(model, message) {
    model.data.activity = model.data.activity || [];
    model.data.activity.unshift({ id: newId('act'), timestamp: new Date().toISOString(), message: message });
    model.data.activity = model.data.activity.slice(0, 50);
  }

  /* ----------------------------------------------------------
     Current state — read live from the stored Assessment, never
     duplicated or re-entered here.
     ---------------------------------------------------------- */

  function currentAssessment() {
    return global.OMSData.storage.get('assessment', null);
  }

  function layerGap(model) {
    var assessment = currentAssessment();
    return LAYER_ORDER.map(function (key) {
      var current = assessment && assessment.layerScores ? assessment.layerScores[key] : null;
      var target = model.data.targetLayerScores ? model.data.targetLayerScores[key] : null;
      target = target === '' || target == null ? null : Number(target);
      if (current == null || target == null) {
        return { key: key, label: LAYER_NAMES[key], current: current, target: target, gap: null, status: 'Unknown' };
      }
      var gap = target - current;
      var status = gap <= 0 ? 'Healthy' : gap <= 0.75 ? 'Watch' : gap <= 1.5 ? 'Weak' : 'Critical';
      return { key: key, label: LAYER_NAMES[key], current: current, target: target, gap: Math.round(gap * 100) / 100, status: status };
    });
  }

  /* ----------------------------------------------------------
     Phase sequencing — the one rule that matters most: don't
     pursue an advanced phase while a foundational one hasn't
     started.
     ---------------------------------------------------------- */

  function phaseSequenceFindings(model) {
    var flags = [];
    var phases = model.data.phases || [];
    for (var i = 1; i < phases.length; i++) {
      var prior = phases[i - 1];
      var current = phases[i];
      if (PHASE_STATUS_RANK[prior.status] === 0 && PHASE_STATUS_RANK[current.status] > 0) {
        flags.push({ severity: 'critical', rule: 'Phase Sequencing Skipped', message: '"' + current.name + '" is ' + current.status + ' while "' + prior.name + '" has not started.', why: 'Foundational operating maturity should not be skipped in pursuit of advanced capabilities.' });
      }
    }
    return flags;
  }

  function modelFindings(model) {
    var flags = phaseSequenceFindings(model);
    var phases = model.data.phases || [];

    phases.forEach(function (p) {
      var unmet = (p.exitCriteria || []).filter(function (c) { return !c.met; });
      if (p.status === 'Complete' && unmet.length) {
        flags.push({ severity: 'critical', rule: 'Exit Criteria Incomplete But Marked Complete', message: '"' + p.name + '" is marked Complete but ' + unmet.length + ' exit criterion/criteria are not yet met.', why: 'A phase should not be marked complete while its own exit criteria remain unmet.' });
      }
      if (p.status === 'In Progress' && !p.targetCompletionDate) {
        flags.push({ severity: 'warning', rule: 'Phase In Progress With No Target Date', message: '"' + p.name + '" is in progress with no target completion date.', why: 'targetCompletionDate is empty while status is In Progress.' });
      }
      if (p.status === 'Blocked' && !p.blockedReason) {
        flags.push({ severity: 'warning', rule: 'Blocked Phase With No Reason Recorded', message: '"' + p.name + '" is marked Blocked with no reason recorded.', why: 'blockedReason is empty while status is Blocked.' });
      }
    });

    if (!currentAssessment()) {
      flags.push({ severity: 'info', rule: 'No Current-State Assessment', message: 'Take the Assessment to give this plan a real current-state baseline instead of an assumed one.', why: 'No assessment results are stored yet.' });
    }
    var hasTarget = model.data.targetLayerScores && Object.keys(model.data.targetLayerScores).some(function (k) { return model.data.targetLayerScores[k]; });
    if (!hasTarget) {
      flags.push({ severity: 'info', rule: 'Target Maturity Not Set', message: 'No target maturity level has been set for any layer yet.', why: 'targetLayerScores is empty.' });
    }
    return flags;
  }

  function phaseProgress(model) {
    var phases = model.data.phases || [];
    return {
      total: phases.length,
      complete: phases.filter(function (p) { return p.status === 'Complete'; }).length,
      inProgress: phases.filter(function (p) { return p.status === 'In Progress'; }).length,
      blocked: phases.filter(function (p) { return p.status === 'Blocked'; }).length,
      notStarted: phases.filter(function (p) { return p.status === 'Not Started'; }).length
    };
  }

  global.OMSTransformation = {
    STORAGE_KEY: STORAGE_KEY,
    LAYER_ORDER: LAYER_ORDER, LAYER_NAMES: LAYER_NAMES, PHASE_NAMES: PHASE_NAMES, PHASE_STATUSES: PHASE_STATUSES,
    newId: newId, blankData: blankData, blankPhase: blankPhase, store: store, logActivity: logActivity,
    currentAssessment: currentAssessment, layerGap: layerGap,
    phaseSequenceFindings: phaseSequenceFindings, modelFindings: modelFindings, phaseProgress: phaseProgress
  };
})(window);
