/*
 * Operations Maturity System
 * Operating Debt — data model, persistence, and analysis engine.
 *
 * Short-term operational workarounds accumulate into long-term operating
 * cost. This file exists to make that accumulation visible and named
 * rather than felt-but-unspoken: what workaround exists, what category of
 * debt it represents, what it costs to keep carrying it, and whether
 * anyone actually owns paying it down.
 *
 * Operating Debt is deliberately a REGISTER, not a fabricated single
 * score. It draws candidate entries from findings already produced by
 * Capacity, Blueprint, Governance, Risk, and Resilience — the user
 * decides which candidates are actually debt worth tracking — plus
 * whatever is entered directly. No dollar figures are invented; cost of
 * carrying is a qualitative, explained judgment.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'operatingdebt';

  function newId(prefix) {
    return (prefix || 'debt') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var DEBT_CATEGORIES = ['Process Debt', 'Technology Debt', 'Governance Debt', 'Data Debt', 'Knowledge Debt', 'Decision Debt', 'Control Debt', 'Meeting Debt'];
  var COST_LEVELS = ['Low', 'Moderate', 'High', 'Severe'];
  var COST_RANK = { Low: 0, Moderate: 1, High: 2, Severe: 3 };
  var AGE_BANDS = ['New', 'Ongoing', 'Long-Standing', 'Chronic'];
  var REMEDIATION_STATUSES = ['Untracked', 'Acknowledged', 'Planned', 'In Remediation', 'Resolved', 'Accepted'];
  var SOURCE_TYPES = ['Manual', 'Capacity', 'Blueprint', 'Governance', 'Risk', 'Resilience'];

  function blankData() {
    return {
      registerScope: '', registerOwner: '',
      relatedBlueprintProjectId: '', relatedBlueprintType: '', relatedBlueprintId: '',
      debtItems: [],
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
      var model = { id: newId(), name: name || 'New Operating Debt Register', owner: '', createdAt: now, updatedAt: now, isSample: !!isSample, currentStep: 0, data: data || blankData() };
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
     Cross-module scan — reads findings already produced by other
     engines and maps them into candidate debt items. Nothing here
     is written to the register automatically; scanForCandidates()
     is a pure read used by the wizard/viewer to present choices,
     and dedupes against sourceRuleId + sourceModelId already
     accepted into this register.
     ---------------------------------------------------------- */

  var CAPACITY_RULE_MAP = {
    'Rework Consuming Material Capacity': 'Process Debt',
    'Failure Demand High': 'Process Debt',
    'Manual Allocation Bottleneck': 'Process Debt',
    'Meeting Load High': 'Meeting Debt',
    'Skill Bottleneck': 'Knowledge Debt',
    'Key Person Dependency': 'Knowledge Debt',
    'Decision Delay Consuming Flow': 'Decision Debt',
    'No Capacity Owner': 'Governance Debt'
  };

  var GOVERNANCE_RULE_MAP = {
    'Critical Process With No Governance': 'Governance Debt',
    'System With No Change Authority': 'Governance Debt',
    'Decision With No Forum Or Owner': 'Decision Debt',
    'Critical KPI Reviewed Nowhere': 'Governance Debt'
  };

  function dedupeKey(source, sourceModelId, sourceRuleId) {
    return source + '::' + (sourceModelId || '') + '::' + sourceRuleId;
  }

  function scanCapacity(existingKeys) {
    var Cap = global.OMSCapacity;
    if (!Cap) return [];
    var out = [];
    Cap.store.list().forEach(function (m) {
      Cap.findings(m).forEach(function (f) {
        var category = CAPACITY_RULE_MAP[f.rule];
        if (!category) return;
        var key = dedupeKey('Capacity', m.id, f.rule);
        if (existingKeys[key]) return;
        out.push({ source: 'Capacity', sourceModelId: m.id, sourceModelName: m.name, sourceRuleId: f.rule, category: category, title: f.rule + ' — ' + m.name, description: f.message, why: f.why });
      });
    });
    return out;
  }

  function scanGovernance(existingKeys) {
    var Gov = global.OMSGovernance;
    if (!Gov) return [];
    var out = [];
    Gov.governanceGaps().forEach(function (f) {
      var category = GOVERNANCE_RULE_MAP[f.rule];
      if (!category) return;
      var ruleId = f.rule + '::' + f.message.slice(0, 40);
      var key = dedupeKey('Governance', '', ruleId);
      if (existingKeys[key]) return;
      out.push({ source: 'Governance', sourceModelId: '', sourceModelName: 'Governance', sourceRuleId: ruleId, category: category, title: f.rule, description: f.message, why: f.why });
    });
    return out;
  }

  function scanRisk(existingKeys) {
    var Risk = global.OMSRisk;
    if (!Risk) return [];
    var out = [];
    Risk.store.list().forEach(function (m) {
      (m.data.knowledgeRisks || []).forEach(function (k) {
        var flags = Risk.knowledgeRiskFlags(k);
        if (!flags.length) return;
        var ruleId = 'Knowledge::' + (k.name || k.id);
        var key = dedupeKey('Risk', m.id, ruleId);
        if (existingKeys[key]) return;
        out.push({ source: 'Risk', sourceModelId: m.id, sourceModelName: m.name, sourceRuleId: ruleId, category: 'Knowledge Debt', title: 'Knowledge risk: ' + (k.name || 'Untitled') + ' — ' + m.name, description: flags.map(function (f) { return f.rule; }).join(', ') + '.', why: 'Flagged by Operational Risk knowledge risk analysis.' });
      });
      (m.data.controls || []).forEach(function (c) {
        var flags = Risk.controlFlags(c);
        if (!flags.length) return;
        var ruleId = 'Control::' + (c.name || c.id);
        var key = dedupeKey('Risk', m.id, ruleId);
        if (existingKeys[key]) return;
        out.push({ source: 'Risk', sourceModelId: m.id, sourceModelName: m.name, sourceRuleId: ruleId, category: 'Control Debt', title: 'Control gap: ' + (c.name || 'Untitled') + ' — ' + m.name, description: flags.map(function (f) { return f.rule; }).join(', ') + '.', why: 'Flagged by Operational Risk control analysis.' });
      });
      (m.data.dataDependencies || []).forEach(function (d) {
        var flags = Risk.dataFlags(d);
        if (!flags.length) return;
        var ruleId = 'Data::' + (d.name || d.id);
        var key = dedupeKey('Risk', m.id, ruleId);
        if (existingKeys[key]) return;
        out.push({ source: 'Risk', sourceModelId: m.id, sourceModelName: m.name, sourceRuleId: ruleId, category: 'Data Debt', title: 'Data dependency gap: ' + (d.name || 'Untitled') + ' — ' + m.name, description: flags.map(function (f) { return f.rule; }).join(', ') + '.', why: 'Flagged by Operational Risk data dependency analysis.' });
      });
      (m.data.technologyDependencies || []).forEach(function (t) {
        var flags = Risk.technologyFlags(t);
        if (!flags.length) return;
        var ruleId = 'Tech::' + (t.name || t.id);
        var key = dedupeKey('Risk', m.id, ruleId);
        if (existingKeys[key]) return;
        out.push({ source: 'Risk', sourceModelId: m.id, sourceModelName: m.name, sourceRuleId: ruleId, category: 'Technology Debt', title: 'Technology dependency gap: ' + (t.name || 'Untitled') + ' — ' + m.name, description: flags.map(function (f) { return f.rule; }).join(', ') + '.', why: 'Flagged by Operational Risk technology dependency analysis.' });
      });
    });
    return out;
  }

  function scanResilience(existingKeys) {
    var Res = global.OMSResilience;
    if (!Res) return [];
    var out = [];
    Res.store.list().forEach(function (m) {
      var flags = Res.paperResilienceFlags(m);
      if (!flags.length) return;
      var ruleId = 'Paper Resilience';
      var key = dedupeKey('Resilience', m.id, ruleId);
      if (existingKeys[key]) return;
      out.push({ source: 'Resilience', sourceModelId: m.id, sourceModelName: m.name, sourceRuleId: ruleId, category: 'Control Debt', title: 'Untested fallback — ' + m.name, description: flags.length + ' redundancy or response mechanism is documented but has never been tested.', why: 'Flagged by Resilience Intelligence paper-resilience check.' });
    });
    return out;
  }

  function scanBlueprint(existingKeys) {
    var BP = global.OMSBlueprint;
    if (!BP) return [];
    var out = [];
    BP.store.list().forEach(function (bp) {
      var c = BP.completeness(bp);
      (c.gaps || []).forEach(function (gapText, idx) {
        var ruleId = 'Completeness Gap ' + idx;
        var key = dedupeKey('Blueprint', bp.id, ruleId);
        if (existingKeys[key]) return;
        out.push({ source: 'Blueprint', sourceModelId: bp.id, sourceModelName: bp.name, sourceRuleId: ruleId, category: 'Process Debt', title: 'Blueprint gap — ' + bp.name, description: gapText, why: 'Flagged by Blueprint completeness analysis.' });
      });
    });
    return out;
  }

  function scanForCandidates(model) {
    var existingKeys = {};
    (model.data.debtItems || []).forEach(function (item) {
      if (item.source && item.source !== 'Manual' && item.sourceRuleId) {
        existingKeys[dedupeKey(item.source, item.sourceModelId, item.sourceRuleId)] = true;
      }
    });
    return scanCapacity(existingKeys)
      .concat(scanGovernance(existingKeys))
      .concat(scanRisk(existingKeys))
      .concat(scanResilience(existingKeys))
      .concat(scanBlueprint(existingKeys));
  }

  /* ----------------------------------------------------------
     Register analysis
     ---------------------------------------------------------- */

  function categoryBreakdown(model) {
    var items = model.data.debtItems || [];
    return DEBT_CATEGORIES.map(function (cat) {
      var inCat = items.filter(function (i) { return i.category === cat; });
      var highCost = inCat.filter(function (i) { return i.costOfCarrying === 'High' || i.costOfCarrying === 'Severe'; });
      var unowned = inCat.filter(function (i) { return !i.owner; });
      var unremediated = inCat.filter(function (i) { return !i.remediationStatus || i.remediationStatus === 'Untracked'; });
      return { category: cat, count: inCat.length, highCostCount: highCost.length, unownedCount: unowned.length, unremediatedCount: unremediated.length };
    });
  }

  function modelFindings(model) {
    var flags = [];
    var items = model.data.debtItems || [];
    if (!items.length) return flags;

    var unowned = items.filter(function (i) { return !i.owner; });
    if (unowned.length) {
      flags.push({ severity: 'warning', rule: 'Debt Without Owner', message: unowned.length + ' debt item(s) have no named owner.', why: 'The owner field is empty on one or more register entries.' });
    }

    var highCostNoPlan = items.filter(function (i) { return (i.costOfCarrying === 'High' || i.costOfCarrying === 'Severe') && (!i.remediationStatus || i.remediationStatus === 'Untracked'); });
    if (highCostNoPlan.length) {
      flags.push({ severity: 'critical', rule: 'High-Cost Debt With No Remediation Plan', message: highCostNoPlan.length + ' High or Severe cost item(s) have no remediation plan.', why: 'Cost of carrying is High/Severe and remediation status is Untracked or blank.' });
    }

    var chronicUntracked = items.filter(function (i) { return i.ageBand === 'Chronic' && (!i.remediationStatus || i.remediationStatus === 'Untracked'); });
    if (chronicUntracked.length) {
      flags.push({ severity: 'critical', rule: 'Chronic Debt Still Untracked', message: chronicUntracked.length + ' item(s) are marked Chronic and still Untracked.', why: 'Age band is Chronic and remediation status is Untracked or blank.' });
    }

    var costNoExplanation = items.filter(function (i) { return i.costOfCarrying && !i.costExplanation; });
    if (costNoExplanation.length) {
      flags.push({ severity: 'warning', rule: 'Cost Without Explanation', message: costNoExplanation.length + ' item(s) have a cost-of-carrying level with no explanation of what it actually costs.', why: 'Cost of carrying should never be assigned without saying what it costs.' });
    }

    var breakdown = categoryBreakdown(model);
    breakdown.forEach(function (b) {
      if (b.highCostCount >= 3) {
        flags.push({ severity: 'warning', rule: 'Debt Concentrated In One Category', message: b.category + ' has ' + b.highCostCount + ' High or Severe cost item(s).', why: 'Three or more High/Severe items share the same debt category.' });
      }
    });

    return flags;
  }

  global.OMSDebt = {
    STORAGE_KEY: STORAGE_KEY,
    DEBT_CATEGORIES: DEBT_CATEGORIES, COST_LEVELS: COST_LEVELS, COST_RANK: COST_RANK,
    AGE_BANDS: AGE_BANDS, REMEDIATION_STATUSES: REMEDIATION_STATUSES, SOURCE_TYPES: SOURCE_TYPES,
    newId: newId, blankData: blankData, store: store, logActivity: logActivity,
    scanForCandidates: scanForCandidates, categoryBreakdown: categoryBreakdown, modelFindings: modelFindings
  };
})(window);
