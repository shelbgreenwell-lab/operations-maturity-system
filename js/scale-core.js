/*
 * Operations Maturity System
 * Scale Readiness — data model, persistence, and analysis engine.
 *
 * Scale does not create ambiguity. It exposes it. This file evaluates
 * whether a system could support meaningful growth without disproportionate
 * complexity, risk, or degradation — by reusing signal already produced
 * elsewhere (Capacity's own 2x stress test, Risk's single points of
 * failure and technology/knowledge concentration, Blueprint's
 * completeness) rather than inventing a new simulation. Readiness is
 * reported as a transparent profile across named dimensions, never a
 * single fabricated score — the same discipline used by Resilience
 * Intelligence's ten-dimension profile.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'scalereadiness';

  function newId(prefix) {
    return (prefix || 'scale') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var STATUS_VALUES = ['Healthy', 'Watch', 'Weak', 'Critical', 'Unknown'];
  var STATUS_RANK = { Healthy: 0, Watch: 1, Weak: 2, Critical: 3, Unknown: 1 };
  var SEVERITY_LEVELS = ['Low', 'Moderate', 'High', 'Critical'];
  var DIMENSION_LABELS = {
    capacityHeadroom: 'Capacity Headroom',
    processDefinition: 'Process Definition',
    decisionBottlenecks: 'Decision Bottlenecks',
    dependencyConcentration: 'Dependency Concentration',
    technologyHeadroom: 'Technology Headroom',
    knowledgeConcentration: 'Knowledge Concentration'
  };

  function blankData() {
    return {
      scaleTargetLabel: '', scaleMultiplier: 2, scaleTimeframe: '',
      relatedBlueprintProjectId: '', relatedBlueprintType: '', relatedBlueprintId: '',
      relatedCapacityModelIds: [], relatedRiskModelId: '',
      additionalConstraints: [],
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
      var model = { id: newId(), name: name || 'New Scale Readiness Assessment', owner: '', createdAt: now, updatedAt: now, isSample: !!isSample, currentStep: 0, data: data || blankData() };
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

  function linkedCapacityModels(model) {
    var Cap = global.OMSCapacity;
    if (!Cap) return [];
    var ids = model.data.relatedCapacityModelIds || [];
    return ids.map(function (id) { return Cap.store.get(id); }).filter(Boolean);
  }

  function linkedRiskModel(model) {
    var Risk = global.OMSRisk;
    if (!Risk || !model.data.relatedRiskModelId) return null;
    return Risk.store.get(model.data.relatedRiskModelId);
  }

  function linkedBlueprint(model) {
    var BP = global.OMSBlueprint;
    if (!BP || !model.data.relatedBlueprintProjectId) return null;
    return BP.store.get(model.data.relatedBlueprintProjectId);
  }

  /* ----------------------------------------------------------
     Scale test — a thin pass-through to Capacity's own 2x/Nx test.
     No new simulation, no probabilistic modeling.
     ---------------------------------------------------------- */

  function capacityScaleResults(model) {
    var Cap = global.OMSCapacity;
    var multiplier = model.data.scaleMultiplier || 2;
    if (!Cap) return [];
    return linkedCapacityModels(model).map(function (cap) {
      var t = Cap.scaleTest(cap, multiplier);
      return { capacityModel: cap, multiplier: multiplier, result: t };
    });
  }

  /* ----------------------------------------------------------
     Readiness profile — six dimensions, each Healthy/Watch/Weak/
     Critical/Unknown with a stated why. Unknown when nothing is
     linked to evaluate it from — never inferred or guessed.
     ---------------------------------------------------------- */

  function capacityHeadroomStatus(model) {
    var results = capacityScaleResults(model);
    if (!results.length) return { status: 'Unknown', why: 'No Capacity Model is linked, so headroom at scale cannot be evaluated.' };
    var worstPct = null;
    results.forEach(function (r) { if (r.result.pctOfCapacity != null && (worstPct == null || r.result.pctOfCapacity > worstPct)) worstPct = r.result.pctOfCapacity; });
    if (worstPct == null) return { status: 'Unknown', why: 'Linked Capacity Model(s) do not have enough demand/capacity data entered to run the scale test.' };
    if (worstPct > 120) return { status: 'Critical', why: 'At the target multiplier, tested demand reaches ' + worstPct + '% of current output capacity.' };
    if (worstPct > 100) return { status: 'Weak', why: 'At the target multiplier, tested demand reaches ' + worstPct + '% of current output capacity.' };
    if (worstPct >= 80) return { status: 'Watch', why: 'At the target multiplier, tested demand reaches ' + worstPct + '% of current output capacity, leaving little margin.' };
    return { status: 'Healthy', why: 'At the target multiplier, tested demand stays at ' + worstPct + '% of current output capacity.' };
  }

  function processDefinitionStatus(model) {
    var bp = linkedBlueprint(model);
    var BP = global.OMSBlueprint;
    if (!bp || !BP) return { status: 'Unknown', why: 'No Blueprint is linked, so process definition cannot be evaluated.' };
    var c = BP.completeness(bp);
    if (c.percent >= 80) return { status: 'Healthy', why: 'Blueprint completeness is ' + c.percent + '%.' };
    if (c.percent >= 60) return { status: 'Watch', why: 'Blueprint completeness is ' + c.percent + '%. Undocumented processes are exactly what scale exposes.' };
    if (c.percent >= 40) return { status: 'Weak', why: 'Blueprint completeness is ' + c.percent + '%.' };
    return { status: 'Critical', why: 'Blueprint completeness is only ' + c.percent + '%.' };
  }

  function decisionBottlenecksStatus(model) {
    var risk = linkedRiskModel(model);
    var Risk = global.OMSRisk;
    if (!risk || !Risk) return { status: 'Unknown', why: 'No Risk Model is linked, so decision bottlenecks cannot be evaluated.' };
    var spofs = Risk.singlePointsOfFailure(risk).filter(function (s) { return s.dependency && s.dependency.category === 'Decisions'; });
    var decisionDeps = (risk.data.dependencies || []).filter(function (d) { return d.category === 'Decisions'; });
    var noAlt = decisionDeps.filter(function (d) { return d.alternativeAvailable === 'No'; });
    if (spofs.length) return { status: 'Critical', why: spofs.length + ' decision dependency has no alternative approver and would not scale under higher volume.' };
    if (noAlt.length) return { status: 'Weak', why: noAlt.length + ' decision dependency has no recorded alternative.' };
    if (decisionDeps.length) return { status: 'Healthy', why: 'Decision dependencies are recorded with alternatives available.' };
    return { status: 'Unknown', why: 'The linked Risk Model has no decision dependencies recorded yet.' };
  }

  function dependencyConcentrationStatus(model) {
    var risk = linkedRiskModel(model);
    var Risk = global.OMSRisk;
    if (!risk || !Risk) return { status: 'Unknown', why: 'No Risk Model is linked, so dependency concentration cannot be evaluated.' };
    var spofs = Risk.singlePointsOfFailure(risk);
    if (spofs.length >= 5) return { status: 'Critical', why: spofs.length + ' single points of failure are recorded.' };
    if (spofs.length >= 3) return { status: 'Weak', why: spofs.length + ' single points of failure are recorded.' };
    if (spofs.length >= 1) return { status: 'Watch', why: spofs.length + ' single point of failure is recorded.' };
    return { status: 'Healthy', why: 'No single points of failure are recorded in the linked Risk Model.' };
  }

  function technologyHeadroomStatus(model) {
    var risk = linkedRiskModel(model);
    var Risk = global.OMSRisk;
    if (!risk || !Risk) return { status: 'Unknown', why: 'No Risk Model is linked, so technology headroom cannot be evaluated.' };
    var techs = risk.data.technologyDependencies || [];
    if (!techs.length) return { status: 'Unknown', why: 'The linked Risk Model has no technology dependencies recorded yet.' };
    var criticalFlags = [];
    techs.forEach(function (t) { criticalFlags = criticalFlags.concat(Risk.technologyFlags(t)); });
    var concentration = Risk.technologyConcentration(techs);
    if (concentration.length) return { status: 'Critical', why: 'Multiple critical processes depend on the same platform.' };
    if (criticalFlags.length >= 2) return { status: 'Weak', why: criticalFlags.length + ' technology dependency flags are recorded.' };
    if (criticalFlags.length === 1) return { status: 'Watch', why: '1 technology dependency flag is recorded.' };
    return { status: 'Healthy', why: 'No technology dependency flags are recorded.' };
  }

  function knowledgeConcentrationStatus(model) {
    var risk = linkedRiskModel(model);
    var Risk = global.OMSRisk;
    if (!risk || !Risk) return { status: 'Unknown', why: 'No Risk Model is linked, so knowledge concentration cannot be evaluated.' };
    var kr = risk.data.knowledgeRisks || [];
    if (!kr.length) return { status: 'Unknown', why: 'The linked Risk Model has no knowledge risks recorded yet.' };
    var flagCount = 0;
    kr.forEach(function (k) { flagCount += Risk.knowledgeRiskFlags(k).length; });
    if (flagCount >= 4) return { status: 'Critical', why: flagCount + ' knowledge risk flags are recorded.' };
    if (flagCount >= 2) return { status: 'Weak', why: flagCount + ' knowledge risk flags are recorded.' };
    if (flagCount === 1) return { status: 'Watch', why: '1 knowledge risk flag is recorded.' };
    return { status: 'Healthy', why: 'No knowledge risk flags are recorded.' };
  }

  function readinessProfile(model) {
    return [
      { key: 'capacityHeadroom', label: DIMENSION_LABELS.capacityHeadroom, result: capacityHeadroomStatus(model) },
      { key: 'processDefinition', label: DIMENSION_LABELS.processDefinition, result: processDefinitionStatus(model) },
      { key: 'decisionBottlenecks', label: DIMENSION_LABELS.decisionBottlenecks, result: decisionBottlenecksStatus(model) },
      { key: 'dependencyConcentration', label: DIMENSION_LABELS.dependencyConcentration, result: dependencyConcentrationStatus(model) },
      { key: 'technologyHeadroom', label: DIMENSION_LABELS.technologyHeadroom, result: technologyHeadroomStatus(model) },
      { key: 'knowledgeConcentration', label: DIMENSION_LABELS.knowledgeConcentration, result: knowledgeConcentrationStatus(model) }
    ];
  }

  function overallReadiness(model) {
    var profile = readinessProfile(model);
    var known = profile.filter(function (p) { return p.result.status !== 'Unknown'; });
    if (!known.length) return { status: 'Unknown', why: 'No linked models yet — link a Capacity Model, Risk Model, or Blueprint to evaluate readiness.' };
    var worst = known.reduce(function (acc, p) { return STATUS_RANK[p.result.status] > STATUS_RANK[acc.result.status] ? p : acc; });
    return { status: worst.result.status, why: worst.label + ': ' + worst.result.why };
  }

  /* ----------------------------------------------------------
     Scale constraints — named, transparent, assembled from the
     dimensions above plus whatever is added directly. Never a
     probabilistic simulation.
     ---------------------------------------------------------- */

  function scaleConstraints(model) {
    var constraints = [];
    var profile = readinessProfile(model);
    profile.forEach(function (p) {
      if (p.result.status === 'Weak' || p.result.status === 'Critical') {
        constraints.push({ source: 'Computed', name: p.label, severity: p.result.status === 'Critical' ? 'Critical' : 'High', whatBreaksAtScale: p.result.why });
      }
    });
    (model.data.additionalConstraints || []).forEach(function (c) {
      constraints.push({ source: 'Manual', name: c.constraintName || 'Untitled constraint', severity: c.severity || 'Moderate', whatBreaksAtScale: c.whatBreaksAtScale || '', mitigationPlan: c.mitigationPlan, owner: c.owner });
    });
    return constraints;
  }

  function modelFindings(model) {
    var flags = [];
    var profile = readinessProfile(model);
    var unknownCount = profile.filter(function (p) { return p.result.status === 'Unknown'; }).length;
    if (unknownCount === profile.length) {
      flags.push({ severity: 'warning', rule: 'No Linked Models Yet', message: 'Link a Capacity Model, Risk Model, or Blueprint to evaluate scale readiness.', why: 'All six dimensions are Unknown.' });
    }
    profile.forEach(function (p) {
      if (p.result.status === 'Critical') {
        flags.push({ severity: 'critical', rule: p.label + ' Is A Critical Constraint', message: p.result.why, why: 'This dimension resolved to Critical.' });
      }
    });
    var noMitigation = (model.data.additionalConstraints || []).filter(function (c) { return (c.severity === 'High' || c.severity === 'Critical') && !c.mitigationPlan; });
    if (noMitigation.length) {
      flags.push({ severity: 'warning', rule: 'High-Severity Constraint With No Mitigation', message: noMitigation.length + ' High or Critical severity constraint(s) have no mitigation plan.', why: 'Severity is High/Critical and mitigationPlan is empty.' });
    }
    if (!model.data.scaleTargetLabel) {
      flags.push({ severity: 'info', rule: 'No Scale Target Named', message: 'Name what "scale" means here (e.g. "2x volume within 12 months") before drawing conclusions.', why: 'scaleTargetLabel is empty.' });
    }
    return flags;
  }

  global.OMSScale = {
    STORAGE_KEY: STORAGE_KEY,
    STATUS_VALUES: STATUS_VALUES, STATUS_RANK: STATUS_RANK, SEVERITY_LEVELS: SEVERITY_LEVELS, DIMENSION_LABELS: DIMENSION_LABELS,
    newId: newId, blankData: blankData, store: store, logActivity: logActivity,
    linkedCapacityModels: linkedCapacityModels, linkedRiskModel: linkedRiskModel, linkedBlueprint: linkedBlueprint,
    capacityScaleResults: capacityScaleResults, readinessProfile: readinessProfile, overallReadiness: overallReadiness,
    scaleConstraints: scaleConstraints, modelFindings: modelFindings
  };
})(window);
