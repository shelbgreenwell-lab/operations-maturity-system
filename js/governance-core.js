/*
 * Operations Maturity System
 * Governance Architecture — data model, persistence, and analysis engine.
 *
 * Governance is broader than meetings. This file manages the mechanisms
 * that keep the operating system reviewed, controlled, changed, and
 * improved: policies, standards, controls, decision forums, escalation
 * paths, change authority, and exception handling. Recurring review
 * rhythms are designed in their own dedicated tool (js/rhythm-core.js) —
 * a governance object of type "Review Rhythm" or "Decision Forum" can
 * point at one instead of duplicating its fields here.
 *
 * Governance without decision authority is ceremony. Standardization
 * without governance decays. The rule engine below exists to make both
 * of those visible, not just recite them.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'governancemodels';

  function newId(prefix) {
    return (prefix || 'gov') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var OBJECT_TYPES = ['Policy', 'Standard', 'Control', 'Decision Forum', 'Review Rhythm', 'Escalation Path', 'Change Authority', 'Risk Governance', 'Quality Governance', 'Process Governance', 'Data Governance', 'Capacity Governance', 'Custom'];
  var APPROVAL_LEVELS = ['None', 'Manager', 'Director', 'Executive', 'Committee / Governance Body'];
  var TRIGGER_TYPES = ['Threshold-Based', 'Judgment-Based'];
  var FREQUENCY_OBSERVED = ['Rare', 'Occasional', 'Frequent', 'Constant'];
  var YES_NO_UNSURE = ['Yes', 'No', 'Unsure'];
  var OMS_LAYERS = ['Direction', 'Design', 'Execution', 'Management', 'Intelligence', 'Evolution'];
  var OBJECT_TYPE_LAYER = {
    Policy: 'Design', Standard: 'Design', Control: 'Execution', 'Decision Forum': 'Management',
    'Review Rhythm': 'Management', 'Escalation Path': 'Management', 'Change Authority': 'Design',
    'Risk Governance': 'Management', 'Quality Governance': 'Execution', 'Process Governance': 'Execution',
    'Data Governance': 'Intelligence', 'Capacity Governance': 'Management', Custom: 'Management'
  };

  function blankData() {
    return {
      scopeType: '', scopeDescription: '',
      relatedBlueprintProjectId: '', relatedBlueprintType: '', relatedBlueprintId: '',
      objects: [], changeAuthorities: [], exceptions: [], escalations: [],
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
      var model = { id: newId(), name: name || 'New Governance Model', owner: '', createdAt: now, updatedAt: now, isSample: !!isSample, currentStep: 0, data: data || blankData() };
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

  /* ----------------------------------------------------------
     Section 16 — per-object coverage. Not a judgment of the
     people running it, a check on whether it is designed.
     ---------------------------------------------------------- */

  function objectFlags(obj) {
    var flags = [];
    if (!obj.owner) flags.push({ rule: 'No Owner', message: '"' + (obj.name || 'This object') + '" has no named owner.' });
    if (!obj.decisionAuthority) flags.push({ rule: 'No Decision Authority', message: 'No decision authority is recorded — governance without decision authority is ceremony.' });
    if (!obj.cadenceOrTrigger) flags.push({ rule: 'No Cadence Or Trigger', message: 'No cadence or trigger is recorded for when this is reviewed or activated.' });
    if (!obj.output) flags.push({ rule: 'No Output Defined', message: 'No output is recorded for what this mechanism actually produces.' });
    if (!obj.escalation) flags.push({ rule: 'No Escalation Path', message: 'No escalation path is recorded for when this needs to go further.' });
    if (!obj.evidence) flags.push({ rule: 'No Evidence Defined', message: 'No evidence is recorded for how this mechanism\'s effectiveness would be shown.' });
    return flags;
  }

  /* ----------------------------------------------------------
     Section 24 — Duplicate Governance Analysis (within model)
     ---------------------------------------------------------- */

  function normalizeName(s) { return (s || '').trim().toLowerCase().replace(/[^a-z0-9 ]/g, ''); }

  function duplicateGovernanceAnalysis(model) {
    var flags = [];
    var objects = model.data.objects || [];
    var seen = {};
    objects.forEach(function (o) {
      var key = normalizeName(o.whatIsGoverned) + '|' + o.type;
      if (!key.trim() || key === '|' + o.type) return;
      seen[key] = seen[key] || [];
      seen[key].push(o.name || o.type);
    });
    Object.keys(seen).forEach(function (key) {
      if (seen[key].length >= 2) {
        flags.push({ severity: 'info', rule: 'Governance Duplication', message: seen[key].length + ' governance objects govern the same thing in this model: ' + seen[key].join(', ') + '.', why: 'Same "what is governed" value and object type appears more than once. Overlap is not automatically bad — confirm each has a distinct decision purpose.' });
      }
    });
    return flags;
  }

  /* ----------------------------------------------------------
     Section 17 — Change Authority
     ---------------------------------------------------------- */

  function changeAuthorityFlags(changeAuthorities) {
    var flags = [];
    var list = changeAuthorities || [];
    var noAuthority = list.filter(function (c) { return !c.changeAuthority; });
    if (noAuthority.length) {
      flags.push({ severity: 'critical', rule: 'System With No Change Authority', message: noAuthority.length + ' system object(s) have no one recorded as authorized to change them.', why: 'Change authority field is empty.' });
    }
    if (list.length >= 3 && list.every(function (c) { return c.approvalLevel === 'Executive' || c.approvalLevel === 'Committee / Governance Body'; })) {
      flags.push({ severity: 'warning', rule: 'Every Change Requires Executive Approval', message: 'Every recorded change authority requires executive or committee approval. If everything requires escalation, you don\'t have decision rights.', why: 'Three or more change authorities all require Executive or Committee approval.' });
    }
    return flags;
  }

  /* ----------------------------------------------------------
     Section 19 — Exception Governance
     ---------------------------------------------------------- */

  function exceptionFlags(exceptions) {
    var flags = [];
    (exceptions || []).forEach(function (e) {
      var itemFlags = [];
      if (!e.whoMayApprove) itemFlags.push('No Exception Owner');
      if (!e.duration) itemFlags.push('No Expiration');
      if (!e.reviewRequirement) itemFlags.push('No Review Requirement');
      if (e.frequencyObserved === 'Frequent' || e.frequencyObserved === 'Constant') itemFlags.push('Exceptions Becoming Normal Work');
      itemFlags.forEach(function (rule) {
        flags.push({ severity: rule === 'Exceptions Becoming Normal Work' ? 'warning' : 'info', rule: rule, message: '"' + (e.exceptionType || 'This exception type') + '": ' + rule.toLowerCase() + '.', why: 'From the exception governance entry "' + (e.exceptionType || 'Untitled') + '".' });
      });
    });
    return flags;
  }

  /* ----------------------------------------------------------
     Section 21 — Escalation Health
     ---------------------------------------------------------- */

  function escalationFlags(escalations) {
    var flags = [];
    (escalations || []).forEach(function (esc) {
      var label = esc.condition || 'This escalation';
      if (!esc.escalationTrigger) flags.push({ severity: 'critical', rule: 'No Trigger', message: '"' + label + '" has no defined escalation trigger.', why: 'Escalation trigger field is empty.' });
      if (esc.triggerType === 'Judgment-Based') flags.push({ severity: 'warning', rule: 'Escalation Based On Person Rather Than Threshold', message: '"' + label + '" escalates based on judgment rather than a defined threshold. Escalation should be triggered by thresholds, not uncertainty.', why: 'Trigger type is set to Judgment-Based.' });
      if (!esc.expectedResponse) flags.push({ severity: 'warning', rule: 'No Response Expectation', message: '"' + label + '" has no expected response time or action.', why: 'Expected response field is empty.' });
      if (esc.escalationOwnerHasAuthority === 'No') flags.push({ severity: 'critical', rule: 'Escalation Owner Lacks Authority', message: 'The escalation owner for "' + label + '" is recorded as not having the authority to decide.', why: 'Escalation owner has authority is set to No.' });
      if (!esc.returnPath) flags.push({ severity: 'warning', rule: 'No Return Path', message: '"' + label + '" has no defined path back to the normal owner once resolved.', why: 'Return path field is empty.' });
      if (esc.repeatedWithNoChange === 'Yes') flags.push({ severity: 'critical', rule: 'Repeat Escalation With No System Change', message: '"' + label + '" has escalated repeatedly with no change made to the system that keeps causing it.', why: 'Repeated with no system change is marked Yes.' });
    });
    if (escalations && escalations.length >= 3 && escalations.every(function (e) { return e.triggerType === 'Judgment-Based'; })) {
      flags.push({ severity: 'warning', rule: 'Everything Escalates', message: 'Every recorded escalation path in this model is judgment-based rather than threshold-based.', why: 'Three or more escalation paths all use a Judgment-Based trigger type.' });
    }
    return flags;
  }

  /* ----------------------------------------------------------
     Section 25 — Governance Gaps. Cross-references live data
     from Blueprint, KPI, Health, Capacity, Value Stream,
     Decision Rights, and Workbench. Every check is guarded —
     a module that hasn't been used yet simply contributes no
     findings, rather than erroring.
     ---------------------------------------------------------- */

  function isCritical(item) { return item && (item.criticality === 'High' || item.criticality === 'Critical'); }

  function matchesBlueprintObject(entry, type, id) { return entry.linkedBlueprintObject === (type + '::' + id); }

  function governanceGaps() {
    var flags = [];
    var BP = global.OMSBlueprint;
    var Rhy = global.OMSRhythm;
    var K = global.OMSKpi;
    var Cap = global.OMSCapacity;
    var VS = global.OMSValueStream;
    var B = global.OMSBuilder;
    var WB = global.OMSWorkbenchCore;
    var rhythms = Rhy ? Rhy.store.list() : [];
    var govModels = store.list();

    function hasAnyRhythmOrGovernanceFor(type, id) {
      var inRhythms = rhythms.some(function (r) { return r.data.relatedBlueprintType === type && r.data.relatedBlueprintId === id; });
      var inGovernance = govModels.some(function (g) { return (g.data.objects || []).some(function (o) { return matchesBlueprintObject(o, type, id); }); });
      return inRhythms || inGovernance;
    }

    if (BP) {
      BP.store.list().forEach(function (bp) {
        ['processes', 'valueStreams', 'capabilities', 'teams'].forEach(function (type) {
          (bp.data[type] || []).forEach(function (item) {
            if (!isCritical(item)) return;
            if (!hasAnyRhythmOrGovernanceFor(type, item.id)) {
              flags.push({ severity: 'critical', rule: 'Critical Process With No Governance', message: (item.name || 'Untitled') + ' (' + BP.ENTITY_META[type].label + ') is marked ' + item.criticality + ' criticality but has no governance object or operating rhythm pointing back to it.', why: 'No rhythm or governance object references this Blueprint object.' });
            }
            var hasChangeAuthority = govModels.some(function (g) { return (g.data.changeAuthorities || []).some(function (c) { return matchesBlueprintObject(c, type, item.id); }); });
            if (!hasChangeAuthority) {
              flags.push({ severity: 'warning', rule: 'System With No Change Authority', message: (item.name || 'Untitled') + ' is marked ' + item.criticality + ' criticality but no one is recorded as authorized to change it.', why: 'No change authority entry references this Blueprint object.' });
            }
          });
        });
      });
    }

    if (K) {
      K.store.list().forEach(function (m) {
        (m.data.kpis || []).forEach(function (kpi) {
          var reviewed = rhythms.some(function (r) { return (r.data.signals || []).some(function (s) { return s.relatedKpiId === kpi.id; }); });
          if (!reviewed && (kpi.decision || kpi.decisionEnabled)) {
            flags.push({ severity: 'warning', rule: 'Critical KPI Reviewed Nowhere', message: '"' + (kpi.name || 'Untitled KPI') + '" supports a decision but is not reviewed in any operating rhythm.', why: 'No rhythm signal links back to this KPI.' });
          }
        });
      });
    }

    if (Cap) {
      Cap.store.list().forEach(function (m) {
        var reviewed = rhythms.some(function (r) { return r.data.relatedCapacityModelId === m.id; });
        if (!reviewed) flags.push({ severity: 'warning', rule: 'Capacity Model With No Management Rhythm', message: '"' + m.name + '" has no operating rhythm reviewing it.', why: 'No rhythm names this Capacity Model as its related model.' });
      });
    }

    if (VS) {
      VS.store.list().forEach(function (v) {
        var reviewed = rhythms.some(function (r) { return r.data.relatedValueStreamId === v.id; });
        if (!reviewed) flags.push({ severity: 'warning', rule: 'Value Stream With No End-To-End Review', message: '"' + v.name + '" has no operating rhythm reviewing the whole flow.', why: 'No rhythm names this Value Stream as its related stream — individual stages may still be reviewed elsewhere.' });
      });
    }

    if (B) {
      B.store.list('decision-rights').forEach(function (p) {
        (p.data.decisions || []).forEach(function (dec) {
          if (!dec.decider) {
            flags.push({ severity: 'critical', rule: 'Decision With No Forum Or Owner', message: '"' + (dec.name || 'Untitled decision') + '" from Decision Rights Architect has no decider named.', why: 'The decider field is empty in Decision Rights Architect.' });
          }
        });
      });
    }

    if (WB) {
      var ws = WB.load ? WB.load() : null;
      if (ws) {
        var hasRiskRhythm = rhythms.some(function (r) { return r.data.purposeCategory === 'Risk'; });
        var highRisks = (ws.risks || []).filter(function (r) { return (r.impact === 'High' || r.impact === 'Critical') && r.status !== 'Closed'; });
        if (highRisks.length && !hasRiskRhythm) {
          flags.push({ severity: 'critical', rule: 'Risk With No Review Rhythm', message: highRisks.length + ' high or critical impact risk(s) are open, but no operating rhythm has a Risk purpose.', why: 'No rhythm\'s purpose category is set to Risk.' });
        }
        (ws.interventions || []).forEach(function (iv) {
          if ((iv.status === 'Testing' || iv.status === 'Measuring') && !iv.reviewDate) {
            flags.push({ severity: 'warning', rule: 'Intervention With No Review Date', message: '"' + (iv.proposedChange || 'This intervention') + '" is in progress with no review date set.', why: 'The intervention\'s review date field is empty.' });
          }
        });
      }
    }

    if (global.OMSRisk) {
      var hasRiskRhythm2 = rhythms.some(function (r) { return r.data.purposeCategory === 'Risk'; });
      var hasRiskGovernance = govModels.some(function (g) { return (g.data.objects || []).some(function (o) { return o.type === 'Risk Governance'; }); });
      global.OMSRisk.store.list().forEach(function (rm) {
        var highImpactRisks = (rm.data.risks || []).filter(function (r) { return (r.impact === 'High' || r.impact === 'Critical') && r.status !== 'Closed'; });
        if (highImpactRisks.length && !hasRiskRhythm2 && !hasRiskGovernance) {
          flags.push({ severity: 'critical', rule: 'Critical Risk With No Governance', message: '"' + (rm.name || 'This Risk Model') + '" has ' + highImpactRisks.length + ' high or critical impact risk(s), but no operating rhythm has a Risk purpose and no Risk Governance object exists.', why: 'No rhythm\'s purpose category is set to Risk, and no governance object of type Risk Governance references this.' });
        }
      });
    }

    return flags.concat(decisionRightsInsights());
  }

  /* ----------------------------------------------------------
     Section 32 — Decision Rights Architect integration. Surface
     the specific pattern the spec calls out: a decision Decision
     Rights already flags as owned too high for its frequency, in
     a rhythm where every decision also escalates. Neither tool
     alone shows the combination.
     ---------------------------------------------------------- */

  function decisionRightsInsights() {
    var flags = [];
    var B = global.OMSBuilder;
    var DR = global.OMSBuilderDecisionRights;
    var Rhy = global.OMSRhythm;
    if (!B || !DR || !Rhy) return flags;

    var highOwnedNames = [];
    B.store.list('decision-rights').forEach(function (p) {
      DR.analyzeAll(p.data).forEach(function (r) {
        if (r.flags.some(function (f) { return f.rule === 'High-Frequency Decision Owned Too High' || f.rule === 'Executive Bottleneck'; })) {
          highOwnedNames.push({ name: r.decision.name, projectId: p.id, projectName: p.name });
        }
      });
    });
    if (!highOwnedNames.length) return flags;

    var escalatingRhythms = Rhy.store.list().filter(function (r) {
      return Rhy.rhythmFlags(r).some(function (f) { return f.rule === 'Every Decision Escalates'; });
    });
    if (!escalatingRhythms.length) return flags;

    highOwnedNames.forEach(function (dr) {
      var drKey = normalizeName(dr.name);
      escalatingRhythms.forEach(function (r) {
        var matches = (r.data.decisions || []).some(function (dec) { return normalizeName(dec.name) === drKey; });
        flags.push({
          severity: 'critical', rule: 'High-Frequency Decision Escalates Every Time',
          message: 'Decision Rights Architect flags "' + dr.name + '" as owned too high for how often it happens, and "' + r.name + '" shows every decision escalating to executive or committee authority.' + (matches ? ' The decision name matches directly.' : ' Confirm whether this is the same decision.'),
          why: 'A decision flagged as owned too high in "' + dr.projectName + '" and a rhythm where every decision escalates both point at the same underlying problem: no decision rights exist below executive level.',
          decisionRightsProjectId: dr.projectId, rhythmId: r.id
        });
      });
    });
    return flags;
  }

  /* ----------------------------------------------------------
     Section 26 — Management Load (governance objects add to
     the rhythm-level load computed in rhythm-core.js)
     ---------------------------------------------------------- */

  function objectLoad(model) {
    var objects = model.data.objects || [];
    var byType = {};
    objects.forEach(function (o) { byType[o.type] = (byType[o.type] || 0) + 1; });
    return { total: objects.length, byType: byType };
  }

  /* ----------------------------------------------------------
     Section 31 — Governance by OMS Layer
     ---------------------------------------------------------- */

  function byLayer(model) {
    var objects = model.data.objects || [];
    var rhythms = global.OMSRhythm ? global.OMSRhythm.store.list() : [];
    var counts = {};
    OMS_LAYERS.forEach(function (l) { counts[l] = 0; });
    objects.forEach(function (o) { var l = OBJECT_TYPE_LAYER[o.type] || 'Management'; counts[l] = (counts[l] || 0) + 1; });
    rhythms.forEach(function () { counts.Management = (counts.Management || 0) + 1; });
    return counts;
  }

  /* ----------------------------------------------------------
     Section 41 — Management System Architecture chain for one
     Blueprint object: System -> Owner -> Signals -> Rhythm ->
     Decision -> Action -> Escalation -> Change Authority.
     ---------------------------------------------------------- */

  function managementSystemChain(model, type, blueprintId) {
    var BP = global.OMSBlueprint;
    var Rhy = global.OMSRhythm;
    if (!BP || !type || !blueprintId) return null;
    var bp = model.data.relatedBlueprintProjectId ? BP.store.get(model.data.relatedBlueprintProjectId) : BP.store.mostRecent();
    if (!bp) return null;
    var item = BP.byId(bp.data[type] || [], blueprintId);
    if (!item) return null;
    var rhythms = (Rhy ? Rhy.store.list() : []).filter(function (r) { return r.data.relatedBlueprintType === type && r.data.relatedBlueprintId === blueprintId; });
    var signals = [];
    var decisions = [];
    rhythms.forEach(function (r) { signals = signals.concat(r.data.signals || []); decisions = decisions.concat(r.data.decisions || []); });
    var changeAuthority = null;
    (model.data.changeAuthorities || []).some(function (c) { if (matchesBlueprintObject(c, type, blueprintId)) { changeAuthority = c; return true; } return false; });
    var escalation = null;
    (model.data.escalations || []).some(function (e) { if (matchesBlueprintObject(e, type, blueprintId)) { escalation = e; return true; } return false; });

    return {
      systemName: BP.entityName(type, item), owner: item.owner || '',
      signals: signals, rhythms: rhythms, decisions: decisions,
      actions: decisions.filter(function (d) { return d.action; }).map(function (d) { return d.action; }),
      escalation: escalation, changeAuthority: changeAuthority
    };
  }

  global.OMSGovernance = {
    STORAGE_KEY: STORAGE_KEY,
    OBJECT_TYPES: OBJECT_TYPES, APPROVAL_LEVELS: APPROVAL_LEVELS, TRIGGER_TYPES: TRIGGER_TYPES,
    FREQUENCY_OBSERVED: FREQUENCY_OBSERVED, YES_NO_UNSURE: YES_NO_UNSURE, OMS_LAYERS: OMS_LAYERS,
    newId: newId, blankData: blankData, store: store, logActivity: logActivity, isYes: isYes,
    objectFlags: objectFlags, duplicateGovernanceAnalysis: duplicateGovernanceAnalysis,
    changeAuthorityFlags: changeAuthorityFlags, exceptionFlags: exceptionFlags, escalationFlags: escalationFlags,
    governanceGaps: governanceGaps, decisionRightsInsights: decisionRightsInsights,
    objectLoad: objectLoad, byLayer: byLayer, managementSystemChain: managementSystemChain
  };
})(window);
