/*
 * Operations Maturity System
 * Resilience Intelligence — data model, persistence, and analysis engine.
 *
 * Risk asks what could fail. This file asks what happens when it does.
 * Resilience is not the absence of failure — it is the ability to
 * absorb, respond, recover, and learn. A system can be functioning
 * perfectly today and still be one absence, one outage, or one vendor
 * away from stalling, with no tested way back.
 *
 * Deliberately never collapsed into a single mystery score: the profile
 * below scores ten dimensions separately and explains every one of them.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'resiliencemodels';

  function newId(prefix) {
    return (prefix || 'res') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var PREVENTION_MECHANISMS = ['Standard', 'Control', 'Validation', 'Redundancy', 'Maintenance', 'Training', 'Capacity Buffer', 'Quality Check', 'Approval Threshold', 'Automation', 'Backup'];
  var CONTINUITY_LEVELS = ['Full Operation', 'Reduced Operation', 'Manual Workaround', 'Alternative Path', 'Suspend Affected Service', 'No Continuity Option'];
  var YES_NO_UNSURE = ['Yes', 'No', 'Unsure'];
  var AUTOMATED_MANUAL = ['Automated', 'Manual'];
  var REDUNDANCY_CATEGORIES = ['Backup Skills', 'Alternative Systems', 'Secondary Vendors', 'Capacity Buffer', 'Data Backup', 'Distributed Authority', 'Custom'];
  var REDUNDANCY_CLASSIFICATIONS = ['Intentional', 'Accidental', 'Required', 'Excessive', 'Unknown'];
  var STRESS_SCENARIO_TYPES = ['Remove One Critical Person', 'Lose Primary System', 'Lose Primary Data Source', 'Lose Primary Vendor', 'Demand +30%', 'Capacity -20%', 'Site Unavailable', 'Executive Approver Unavailable', 'Multiple Failures', 'Custom'];
  var TEST_TYPES = ['Backup Restoration', 'Staff Absence Simulation', 'System Outage Simulation', 'Manual Fallback', 'Vendor Failure', 'Demand Surge', 'Custom'];
  var STATUS_VALUES = ['Healthy', 'Watch', 'Weak', 'Critical', 'Unknown'];
  var STATUS_RANK = { Unknown: 0, Healthy: 1, Watch: 2, Weak: 3, Critical: 4 };

  var DIMENSION_LABELS = {
    dependencyResilience: 'Dependency Resilience', detection: 'Detection', response: 'Response',
    continuity: 'Continuity', recovery: 'Recovery', knowledge: 'Knowledge',
    capacityBuffer: 'Capacity Buffer', decisionAuthority: 'Decision Authority',
    testing: 'Testing', learning: 'Learning'
  };

  function blankData() {
    return {
      systemName: '', systemType: '', owner: '', criticality: '',
      relatedRiskModelId: '', relatedCapacityModelId: '',
      relatedBlueprintProjectId: '', relatedBlueprintType: '', relatedBlueprintId: '',
      prevention: { mechanisms: [], description: '' },
      detection: { signal: '', detectionMechanism: '', owner: '', expectedDetectionTime: '', automatedOrManual: '', relatedKpiModelId: '', relatedKpiId: '', relatedHealthModelId: '', relatedHealthDimensionId: '' },
      response: { whoResponds: '', authorityOwner: '', backupAuthority: '', backupAuthorityExists: '', firstAction: '', informationNeeded: '', documented: '', tested: '', whoCommunicates: '', escalationTrigger: '', expectedResponseTime: '' },
      continuity: { continuityLevel: '', sustainDuration: '' },
      recovery: { recoveryProcess: '', owner: '', dependencies: '', expectedRecoveryTime: '', targetRecoveryTime: '', validationRequired: '', returnToNormalCriteria: '' },
      learning: { reviewer: '', rootCauseMethod: '', standardsUpdateProcess: '', controlsUpdateProcess: '', documentationUpdateProcess: '', lessonsPropagationMethod: '' },
      redundancy: [], resilienceTests: [], stressTests: [],
      currentBullets: [], targetBullets: [],
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
      var model = { id: newId(), name: name || 'New Resilience Model', owner: '', createdAt: now, updatedAt: now, isSample: !!isSample, currentStep: 0, data: data || blankData() };
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

  function isYes(v) { return v === true || v === 'Yes'; }
  function isNo(v) { return v === false || v === 'No'; }
  function linkedRiskModel(model) { return (global.OMSRisk && model.data.relatedRiskModelId) ? global.OMSRisk.store.get(model.data.relatedRiskModelId) : null; }

  /* ----------------------------------------------------------
     Section 28-29 — Resilience Health as a profile, never a
     mystery score. Ten dimensions, each explained.
     ---------------------------------------------------------- */

  function resilienceProfile(model) {
    var d = model.data;
    var risk = linkedRiskModel(model);
    var out = {};

    if (!risk) out.dependencyResilience = { status: 'Unknown', why: 'No Risk Model is linked, so dependency exposure cannot be assessed here.' };
    else {
      var spofCount = global.OMSRisk.singlePointsOfFailure(risk).length;
      out.dependencyResilience = spofCount === 0 ? { status: 'Healthy', why: 'No single points of failure recorded in the linked Risk Model.' }
        : spofCount === 1 ? { status: 'Watch', why: '1 single point of failure recorded in the linked Risk Model.' }
        : spofCount === 2 ? { status: 'Weak', why: '2 single points of failure recorded in the linked Risk Model.' }
        : { status: 'Critical', why: spofCount + ' single points of failure recorded in the linked Risk Model.' };
    }

    var det = d.detection || {};
    out.detection = (det.detectionMechanism && det.signal && det.automatedOrManual === 'Automated') ? { status: 'Healthy', why: 'An automated detection mechanism and signal are both recorded.' }
      : (det.detectionMechanism || det.signal) ? { status: 'Watch', why: 'A detection mechanism or signal is recorded, but it is manual or incomplete.' }
      : { status: 'Weak', why: 'No detection signal or mechanism is recorded — a critical system with no failure signal should not stay invisible.' };

    var resp = d.response || {};
    if (resp.whoResponds && resp.authorityOwner) {
      out.response = resp.documented === 'Yes' ? { status: 'Healthy', why: 'A responder and an authority owner are named, and the response is documented.' } : { status: 'Watch', why: 'A responder and an authority owner are named, but the response is not documented.' };
      if (out.response.status === 'Healthy' && resp.tested === 'No') out.response = { status: 'Watch', why: 'The response is documented but has never been tested — a paper plan is an assumption.' };
    } else if (resp.whoResponds || resp.authorityOwner) {
      out.response = { status: 'Weak', why: 'Either the responder or the authority owner is missing.' };
    } else {
      out.response = { status: 'Unknown', why: 'No response plan is recorded yet.' };
    }

    var cont = d.continuity || {};
    out.continuity = !cont.continuityLevel ? { status: 'Unknown', why: 'No continuity option is recorded.' }
      : (cont.continuityLevel === 'Full Operation' || cont.continuityLevel === 'Reduced Operation') ? { status: 'Healthy', why: 'The business can continue operating: ' + cont.continuityLevel + '.' }
      : (cont.continuityLevel === 'Manual Workaround' || cont.continuityLevel === 'Alternative Path') ? { status: 'Watch', why: 'Continuity depends on a manual workaround or alternative path.' }
      : cont.continuityLevel === 'Suspend Affected Service' ? { status: 'Weak', why: 'The only continuity option is to suspend the affected service.' }
      : { status: 'Critical', why: 'No continuity option exists — operations cannot continue through this failure.' };

    var rec = d.recovery || {};
    out.recovery = (rec.recoveryProcess && rec.owner && rec.expectedRecoveryTime) ? { status: 'Healthy', why: 'A recovery process, owner, and expected recovery time are all recorded.' }
      : (rec.recoveryProcess || rec.owner) ? { status: 'Watch', why: 'A recovery process is only partially defined.' }
      : { status: 'Unknown', why: 'No recovery process is recorded yet.' };

    if (!risk) out.knowledge = { status: 'Unknown', why: 'No Risk Model is linked, so knowledge dependency cannot be assessed here.' };
    else {
      var krFlags = (risk.data.knowledgeRisks || []).reduce(function (sum, kr) { return sum + global.OMSRisk.knowledgeRiskFlags(kr).length; }, 0);
      out.knowledge = !((risk.data.knowledgeRisks || []).length) ? { status: 'Unknown', why: 'No knowledge risks recorded in the linked Risk Model.' }
        : krFlags === 0 ? { status: 'Healthy', why: 'No knowledge risk flags in the linked Risk Model.' }
        : krFlags <= 2 ? { status: 'Watch', why: krFlags + ' knowledge risk flag(s) in the linked Risk Model.' }
        : { status: 'Weak', why: krFlags + ' knowledge risk flags in the linked Risk Model.' };
    }

    if (global.OMSCapacity && d.relatedCapacityModelId) {
      var cap = global.OMSCapacity.store.get(d.relatedCapacityModelId);
      var balance = cap ? global.OMSCapacity.demandCapacityBalance(cap) : null;
      if (balance && balance.bufferPct != null) {
        out.capacityBuffer = balance.bufferPct < 0 ? { status: 'Critical', why: 'Linked Capacity Model shows demand exceeding capacity (buffer ' + balance.bufferPct + '%).' }
          : balance.bufferPct < 8 ? { status: 'Weak', why: 'Linked Capacity Model shows a thin buffer (' + balance.bufferPct + '%).' }
          : balance.bufferPct < 15 ? { status: 'Watch', why: 'Linked Capacity Model shows a modest buffer (' + balance.bufferPct + '%).' }
          : { status: 'Healthy', why: 'Linked Capacity Model shows a healthy buffer (' + balance.bufferPct + '%).' };
      } else out.capacityBuffer = { status: 'Unknown', why: 'Linked Capacity Model does not have enough data to compute a buffer.' };
    } else if (risk) {
      var capDep = (risk.data.dependencies || []).filter(function (dep) { return dep.category === 'Capacity'; });
      out.capacityBuffer = !capDep.length ? { status: 'Unknown', why: 'No capacity dependency recorded in the linked Risk Model, and no Capacity Model is linked.' }
        : capDep.some(function (dep) { return dep.concentrationDescription || dep.alternativeAvailable === 'No'; }) ? { status: 'Weak', why: 'A capacity dependency shows concentration or no alternative.' }
        : { status: 'Watch', why: 'A capacity dependency is recorded without a linked Capacity Model to verify buffer.' };
    } else {
      out.capacityBuffer = { status: 'Unknown', why: 'No Capacity Model or Risk Model is linked.' };
    }

    out.decisionAuthority = resp.backupAuthorityExists === 'Yes' ? { status: 'Healthy', why: 'A backup decision authority exists for this system.' }
      : resp.backupAuthorityExists === 'Unsure' ? { status: 'Watch', why: 'It is unclear whether a backup decision authority exists.' }
      : resp.backupAuthorityExists === 'No' ? { status: 'Critical', why: 'No backup decision authority exists — if the primary authority is unavailable, the decision has nowhere to go.' }
      : { status: 'Unknown', why: 'Backup decision authority has not been assessed yet.' };

    var tests = d.resilienceTests || [];
    if (!tests.length) out.testing = { status: 'Unknown', why: 'No resilience tests are recorded yet.' };
    else {
      var withGapNoAction = tests.filter(function (t) { return t.gap && !t.action; });
      out.testing = withGapNoAction.length ? { status: 'Weak', why: withGapNoAction.length + ' test(s) found a gap with no follow-up action.' }
        : tests.some(function (t) { return t.gap; }) ? { status: 'Watch', why: 'Testing found gaps, and all have a follow-up action recorded.' }
        : { status: 'Healthy', why: tests.length + ' test(s) recorded with no unresolved gap.' };
    }

    var learn = d.learning || {};
    out.learning = (learn.reviewer && learn.rootCauseMethod) ? { status: 'Healthy', why: 'A reviewer and root-cause method are both recorded for after disruption.' }
      : (learn.reviewer || learn.rootCauseMethod) ? { status: 'Watch', why: 'The learning process is only partially defined.' }
      : { status: 'Unknown', why: 'No learning process is recorded yet.' };

    return out;
  }

  function overallHealth(model) {
    var profile = resilienceProfile(model);
    var worst = null;
    Object.keys(profile).forEach(function (key) {
      var s = profile[key];
      if (!worst || STATUS_RANK[s.status] > STATUS_RANK[worst.status]) worst = { status: s.status, why: s.why, dimension: DIMENSION_LABELS[key] };
    });
    return worst || { status: 'Unknown', why: 'No data recorded yet.', dimension: null };
  }

  /* ----------------------------------------------------------
     Section 38 — Fragility Signal. Explains exactly which
     factors triggered it; never claims scientific validation.
     ---------------------------------------------------------- */

  function fragilitySignal(model) {
    var profile = resilienceProfile(model);
    var risk = linkedRiskModel(model);
    var contributing = [];
    if (risk && (risk.data.criticality === 'High' || risk.data.criticality === 'Critical')) contributing.push('System criticality is ' + risk.data.criticality + '.');
    if (profile.dependencyResilience.status === 'Weak' || profile.dependencyResilience.status === 'Critical') contributing.push('Dependency resilience is ' + profile.dependencyResilience.status + ' (' + profile.dependencyResilience.why + ')');
    if (profile.detection.status === 'Weak' || profile.detection.status === 'Critical') contributing.push('Detection is ' + profile.detection.status + ' (' + profile.detection.why + ')');
    if (profile.recovery.status === 'Weak' || profile.recovery.status === 'Critical' || profile.recovery.status === 'Unknown') contributing.push('Recovery is ' + profile.recovery.status + ' (' + profile.recovery.why + ')');
    if (profile.response.status === 'Weak' || profile.response.status === 'Critical') contributing.push('Response is ' + profile.response.status + ' (' + profile.response.why + ')');

    if (contributing.length >= 3) {
      return { flagged: true, rule: 'System Fragility', message: 'This system combines ' + contributing.length + ' fragility factors. This is a structural signal from the rules below, not a scientifically validated fragility score.', factors: contributing };
    }
    return { flagged: false, rule: 'System Fragility', message: 'Fewer than three fragility factors are present.', factors: contributing };
  }

  /* ----------------------------------------------------------
     Section 39 — Hidden Fragility
     ---------------------------------------------------------- */

  function hiddenFragility(model, healthModel) {
    if (!healthModel || !global.OMSHealth) return { flagged: false };
    var currentHealth = global.OMSHealth.overallHealth(healthModel);
    var overall = overallHealth(model);
    if (currentHealth.status === 'Healthy' && (overall.status === 'Weak' || overall.status === 'Critical')) {
      return {
        flagged: true, rule: 'Hidden Fragility',
        message: 'Current health for "' + healthModel.name + '" is Healthy, but resilience for "' + model.name + '" is ' + overall.status + '. Current performance does not prove the system can withstand disruption.',
        currentHealth: currentHealth.status, resilience: overall.status
      };
    }
    return { flagged: false };
  }

  /* ----------------------------------------------------------
     Section 47 — Paper Resilience. A fallback that has never
     been tested is an assumption, not a fact.
     ---------------------------------------------------------- */

  function paperResilienceFlags(model) {
    var flags = [];
    var d = model.data;
    (d.redundancy || []).forEach(function (r) {
      if (r.what && r.tested === 'No') flags.push({ severity: 'warning', rule: 'Paper Resilience', message: '"' + r.what + '" exists in documentation but has never been tested.', why: 'A fallback that has never been tested is an assumption.' });
    });
    if (d.response && d.response.documented === 'Yes' && d.response.tested === 'No') {
      flags.push({ severity: 'warning', rule: 'Paper Resilience', message: 'The response plan is documented but has never been tested.', why: 'A fallback that has never been tested is an assumption.' });
    }
    return flags;
  }

  /* ----------------------------------------------------------
     Section 40 — Efficiency vs Resilience. Reflective
     questions, not stored answers or a verdict.
     ---------------------------------------------------------- */

  var EFFICIENCY_VS_RESILIENCE_QUESTIONS = [
    'Has efficiency removed all spare capacity?',
    'Has standardization created one critical path?',
    'Has consolidation created concentration?',
    'Has automation removed manual fallback?',
    'Has role specialization removed backup capability?'
  ];

  /* ----------------------------------------------------------
     Section 24 — Detection should connect directly to KPI /
     Operational Health. Flag when it doesn't.
     ---------------------------------------------------------- */

  function detectionGapFlag(model) {
    var det = model.data.detection || {};
    if (!det.relatedKpiId && !det.relatedHealthDimensionId && !det.detectionMechanism && !det.signal) {
      return { severity: 'critical', rule: 'Critical System With No Detection Signal', message: 'No signal, KPI, or Health dimension is linked to tell us this system is failing.', why: 'Detection fields and both KPI/Health links are empty.' };
    }
    return null;
  }

  /* ----------------------------------------------------------
     Model-level findings
     ---------------------------------------------------------- */

  function modelFindings(model, healthModel) {
    var flags = [];
    var frag = fragilitySignal(model);
    if (frag.flagged) flags.push({ severity: 'critical', rule: frag.rule, message: frag.message, why: frag.factors.join(' ') });
    var hidden = hiddenFragility(model, healthModel);
    if (hidden.flagged) flags.push({ severity: 'critical', rule: hidden.rule, message: hidden.message, why: 'Health and resilience are different questions — a healthy signal does not confirm resilience.' });
    flags = flags.concat(paperResilienceFlags(model));
    var detGap = detectionGapFlag(model);
    if (detGap) flags.push(detGap);
    var excessive = (model.data.redundancy || []).filter(function (r) { return r.classification === 'Excessive'; });
    if (excessive.length) flags.push({ severity: 'info', rule: 'Excessive Redundancy Flagged', message: excessive.length + ' redundancy item(s) are classified as Excessive.', why: 'Redundancy is not always waste, but excessive redundancy should be a deliberate choice, not an accident.' });
    var accidental = (model.data.redundancy || []).filter(function (r) { return r.classification === 'Accidental'; });
    if (accidental.length) flags.push({ severity: 'info', rule: 'Accidental Redundancy Found', message: accidental.length + ' redundancy item(s) are classified as Accidental.', why: 'Decide whether to formalize this redundancy or remove it — accidental redundancy is neither designed resilience nor clean efficiency.' });
    return flags;
  }

  global.OMSResilience = {
    STORAGE_KEY: STORAGE_KEY,
    PREVENTION_MECHANISMS: PREVENTION_MECHANISMS, CONTINUITY_LEVELS: CONTINUITY_LEVELS, YES_NO_UNSURE: YES_NO_UNSURE,
    AUTOMATED_MANUAL: AUTOMATED_MANUAL, REDUNDANCY_CATEGORIES: REDUNDANCY_CATEGORIES, REDUNDANCY_CLASSIFICATIONS: REDUNDANCY_CLASSIFICATIONS,
    STRESS_SCENARIO_TYPES: STRESS_SCENARIO_TYPES, TEST_TYPES: TEST_TYPES, STATUS_VALUES: STATUS_VALUES, STATUS_RANK: STATUS_RANK,
    DIMENSION_LABELS: DIMENSION_LABELS, EFFICIENCY_VS_RESILIENCE_QUESTIONS: EFFICIENCY_VS_RESILIENCE_QUESTIONS,
    newId: newId, blankData: blankData, store: store, logActivity: logActivity, isYes: isYes, isNo: isNo, linkedRiskModel: linkedRiskModel,
    resilienceProfile: resilienceProfile, overallHealth: overallHealth, fragilitySignal: fragilitySignal,
    hiddenFragility: hiddenFragility, paperResilienceFlags: paperResilienceFlags, detectionGapFlag: detectionGapFlag,
    modelFindings: modelFindings
  };
})(window);
