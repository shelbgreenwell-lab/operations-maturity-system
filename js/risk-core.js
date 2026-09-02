/*
 * Operations Maturity System
 * Operational Risk — data model, persistence, and analysis engine.
 *
 * A system can be healthy and still be fragile. This file exists to make
 * exposure visible before disruption becomes failure: what a system
 * depends on, which of those dependencies have no real alternative, where
 * work is concentrated in one person, system, or vendor, and how exposed
 * each recorded risk actually is — not just a red/yellow/green guess.
 *
 * This is deliberately NOT an enterprise risk register, compliance tool,
 * or cybersecurity product. It stays scoped to operational risk: what
 * could fail in how the work gets done, and how badly.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'riskmodels';

  function newId(prefix) {
    return (prefix || 'risk') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var SYSTEM_TYPES = ['Organization', 'Capability', 'Value Stream', 'Process', 'Team', 'Technology', 'Data System', 'Vendor', 'Role', 'Decision', 'Critical Service', 'Custom'];
  var IMPACT_CATEGORIES = ['Customer', 'Revenue', 'Delivery', 'Quality', 'Compliance', 'Employee', 'Financial', 'Reputation', 'Data', 'Strategic', 'Operational'];
  var CRITICALITY_LEVELS = ['Low', 'Moderate', 'High', 'Critical'];
  var CRITICALITY_RANK = { Low: 0, Moderate: 1, High: 2, Critical: 3 };
  var DEPENDENCY_CATEGORIES = ['People', 'Teams', 'Processes', 'Decisions', 'Technology', 'Data', 'Vendors', 'Locations', 'Skills', 'Capacity', 'Policies', 'Controls', 'Upstream Value Streams', 'Downstream Systems'];
  var DEPENDENCY_STRENGTH = ['Low', 'Moderate', 'High', 'Critical'];
  var TIME_OPTIONS = ['Immediate', 'Hours', 'Days', 'Weeks', 'Months', 'Not Possible', 'Unknown'];
  var YES_NO_UNSURE = ['Yes', 'No', 'Unsure'];
  var CONTROL_TYPES = ['Preventive', 'Detective', 'Corrective'];
  var RISK_STATUSES = ['Open', 'Monitoring', 'Mitigated', 'Closed', 'Accepted'];
  var CONFIDENCE_LEVELS = ['High', 'Moderate', 'Low', 'Unknown'];
  var DETECTABILITY_LEVELS = ['High', 'Moderate', 'Low', 'Unknown'];
  var COVERAGE_LEVELS = ['Controlled', 'Partially Controlled', 'Uncontrolled', 'Unknown'];

  var CATEGORY_SPOF_FLAG = {
    People: 'Single Person', Technology: 'Single System', Vendors: 'Single Vendor',
    Data: 'Single Data Source', Locations: 'Single Location', Skills: 'Single Skill Group',
    Decisions: 'Single Approver', Processes: 'Single Process Path'
  };

  function blankData() {
    return {
      systemType: '', systemOwner: '', valueOutcomeSupported: '', stakeholdersAffected: '',
      relatedBlueprintProjectId: '', relatedBlueprintType: '', relatedBlueprintId: '',
      relatedValueStreamId: '', relatedCapacityModelId: '',
      criticality: '', criticalityExplanation: '', impacts: [],
      dependencies: [], technologyDependencies: [], dataDependencies: [], vendorDependencies: [],
      knowledgeRisks: [], failureScenarios: [], risks: [], controls: [],
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
      var model = { id: newId(), name: name || 'New Risk Model', owner: '', createdAt: now, updatedAt: now, isSample: !!isSample, currentStep: 0, data: data || blankData() };
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

  function parseLinkedBlueprintObject(composite) {
    if (!composite || composite.indexOf('::') === -1) return null;
    var parts = composite.split('::');
    return { type: parts[0], id: parts[1] };
  }

  /* ----------------------------------------------------------
     Sections 6-7 — Critical Dependency Analysis + Single Point
     of Failure. Related but distinct: a critical dependency has
     no real alternative; a single point of failure additionally
     requires that its loss stops a critical outcome with no
     workable substitute in time. Never used interchangeably.
     ---------------------------------------------------------- */

  function dependencyFlags(dep, systemCriticality) {
    var flags = [];
    if (isNo(dep.alternativeAvailable)) {
      var specific = CATEGORY_SPOF_FLAG[dep.category];
      flags.push({ rule: specific || 'No Alternative', message: '"' + (dep.whatDependedOn || 'This dependency') + '" has no available alternative.' });
    }
    if (dep.concentrationDescription) {
      flags.push({ rule: 'Concentration', message: 'Concentration noted: ' + dep.concentrationDescription });
    }
    var strengthHigh = dep.strength === 'High' || dep.strength === 'Critical';
    var longSubstitute = dep.timeToSubstitute === 'Weeks' || dep.timeToSubstitute === 'Months' || dep.timeToSubstitute === 'Not Possible';
    var systemCritical = systemCriticality === 'High' || systemCriticality === 'Critical';
    if (isNo(dep.alternativeAvailable) && strengthHigh && longSubstitute && systemCritical) {
      flags.push({
        rule: 'Single Point Of Failure',
        message: 'Losing "' + (dep.whatDependedOn || 'this dependency') + '" would stop a critical outcome, no alternative exists, and substituting it would take ' + dep.timeToSubstitute.toLowerCase() + '.',
        severity: 'critical'
      });
    }
    return flags;
  }

  function singlePointsOfFailure(model) {
    return (model.data.dependencies || []).reduce(function (acc, dep) {
      var flags = dependencyFlags(dep, model.data.criticality);
      var spof = flags.filter(function (f) { return f.rule === 'Single Point Of Failure'; });
      if (spof.length) acc.push({ dependency: dep, flag: spof[0] });
      return acc;
    }, []);
  }

  /* ----------------------------------------------------------
     Section 9 — Knowledge Dependency
     ---------------------------------------------------------- */

  function knowledgeRiskFlags(kr) {
    var flags = [];
    if (isNo(kr.documented)) flags.push({ rule: 'Tribal Knowledge', message: '"' + (kr.whatKnowledge || 'This knowledge') + '" is not documented anywhere.' });
    else if (isNo(kr.backupTested)) flags.push({ rule: 'Documented But Untested', message: '"' + (kr.whatKnowledge || 'This knowledge') + '" is documented, but the backup capability has never been tested.' });
    if (isNo(kr.canOthersExecute)) flags.push({ rule: 'No Backup', message: 'No one else can currently execute from this knowledge.' });
    if (kr.recoveryTime === 'Weeks' || kr.recoveryTime === 'Months' || kr.recoveryTime === 'Not Possible') {
      flags.push({ rule: 'Long Recovery Time', message: 'Replacing this knowledge would take ' + kr.recoveryTime.toLowerCase() + '.' });
    }
    return flags;
  }

  /* ----------------------------------------------------------
     Section 10 — Technology Dependency
     ---------------------------------------------------------- */

  function technologyFlags(tech) {
    var flags = [];
    if (!tech.fallback) flags.push({ rule: 'No Fallback', message: '"' + (tech.system || 'This system') + '" has no recorded fallback.' });
    else if (isNo(tech.manualWorkaroundTested)) flags.push({ rule: 'Manual Fallback Untested', message: '"' + (tech.system || 'This system') + '" has a documented fallback that has never been tested.' });
    return flags;
  }

  function technologyConcentration(list) {
    var flags = [];
    var platformMentions = {};
    (list || []).forEach(function (t) {
      if (!t.integrationDependencies) return;
      var key = t.integrationDependencies.trim().toLowerCase();
      platformMentions[key] = platformMentions[key] || [];
      platformMentions[key].push(t.system || 'Untitled system');
    });
    Object.keys(platformMentions).forEach(function (key) {
      if (platformMentions[key].length >= 3) {
        flags.push({ rule: 'Multiple Critical Systems Depend On Same Platform', message: platformMentions[key].length + ' systems (' + platformMentions[key].join(', ') + ') all name the same integration dependency: "' + key + '".', why: 'Three or more technology entries list the same integration dependency text.' });
      }
    });
    return flags;
  }

  /* ----------------------------------------------------------
     Section 11 — Data Dependency
     ---------------------------------------------------------- */

  function dataFlags(d) {
    var flags = [];
    if (!d.validation) flags.push({ rule: 'Single Source Without Validation', message: '"' + (d.dataSource || 'This data source') + '" has no recorded validation method.' });
    if (isYes(d.manuallyMaintained)) flags.push({ rule: 'Manual Data Dependency', message: '"' + (d.dataSource || 'This data source') + '" is manually maintained.' });
    if (!d.owner) flags.push({ rule: 'Unknown Data Owner', message: '"' + (d.dataSource || 'This data source') + '" has no named owner.' });
    if (!d.recoveryMethod) flags.push({ rule: 'No Recovery Method', message: '"' + (d.dataSource || 'This data source') + '" has no recorded recovery method if lost.' });
    if (isYes(d.usedInCriticalDecision) && (d.dataConfidence === 'Low' || d.dataConfidence === 'Unknown')) {
      flags.push({ rule: 'Critical Decision Using Low-Confidence Data', message: '"' + (d.dataSource || 'This data source') + '" feeds a critical decision but has ' + (d.dataConfidence || 'unknown').toLowerCase() + ' confidence.', severity: 'critical' });
    }
    return flags;
  }

  /* ----------------------------------------------------------
     Section 12 — Vendor Dependency (kept intentionally light —
     this is not vendor-management software)
     ---------------------------------------------------------- */

  function vendorFlags(v) {
    var flags = [];
    if (isNo(v.alternativeSupplier) && (v.criticality === 'High' || v.criticality === 'Critical')) {
      flags.push({ rule: 'Single Vendor', message: '"' + (v.vendor || 'This vendor') + '" supplies a ' + v.criticality.toLowerCase() + '-criticality service with no alternative supplier.' });
    }
    return flags;
  }

  /* ----------------------------------------------------------
     Section 30-31 — Controls + Control Effectiveness
     ---------------------------------------------------------- */

  function controlFlags(c) {
    var flags = [];
    if (!c.owner) flags.push({ rule: 'No Control Owner', message: '"' + (c.control || 'This control') + '" has no named owner.' });
    if (!c.evidence) flags.push({ rule: 'No Evidence', message: '"' + (c.control || 'This control') + '" has no recorded evidence that it operates.' });
    if (isNo(c.monitoring)) flags.push({ rule: 'Control Failure Not Monitored', message: '"' + (c.control || 'This control') + '" has no one monitoring whether it fails.' });
    if (!c.evidence && isNo(c.monitoring)) flags.push({ rule: 'Control Exists Only On Paper', message: '"' + (c.control || 'This control') + '" has no evidence it operates and no one monitoring it — a control nobody monitors is not a control.', severity: 'critical' });
    return flags;
  }

  /* ----------------------------------------------------------
     Section 32 — Control Coverage
     ---------------------------------------------------------- */

  function controlCoverage(risk, controls) {
    if (!risk.control) return 'Unknown';
    var matched = (controls || []).filter(function (c) { return c.control && c.control.trim().toLowerCase() === risk.control.trim().toLowerCase(); });
    if (!matched.length) return 'Unknown';
    var control = matched[0];
    var flags = controlFlags(control);
    if (flags.some(function (f) { return f.rule === 'Control Exists Only On Paper'; })) return 'Uncontrolled';
    if (flags.length) return 'Partially Controlled';
    return 'Controlled';
  }

  /* ----------------------------------------------------------
     Section 36 — Detectability. Transparent, never fabricated.
     ---------------------------------------------------------- */

  function detectability(risk) {
    var mechanism = (risk.detectionMechanism || '').toLowerCase();
    if (!risk.detectionMechanism && !risk.earlyWarning) return { level: 'Unknown', why: 'No detection mechanism or early warning is recorded.' };
    if (mechanism.indexOf('customer') !== -1 || mechanism.indexOf('complaint') !== -1) {
      return { level: 'Low', why: 'This is only discovered through customer complaints or customer-reported issues.' };
    }
    if (risk.automatedOrManual === 'Automated' && risk.detectionMechanism && risk.earlyWarning) {
      return { level: 'High', why: 'Detection is automated, with both a mechanism and an early warning signal recorded.' };
    }
    if (risk.detectionMechanism || risk.earlyWarning) {
      return { level: 'Moderate', why: 'A detection mechanism or early warning is recorded, but it is manual or incomplete.' };
    }
    return { level: 'Unknown', why: 'Not enough is recorded to assess detectability.' };
  }

  /* ----------------------------------------------------------
     Section 37 — Recoverability. A simple, explained count.
     ---------------------------------------------------------- */

  function recoverability(risk) {
    var checks = ['fallbackExists', 'backupExists', 'knowledgeExists', 'authorityExists', 'recoveryStepsExist'];
    var known = checks.filter(function (k) { return risk[k] === 'Yes' || risk[k] === 'No'; });
    if (!known.length) return { level: 'Unknown', why: 'Recovery readiness has not been assessed yet.' };
    var yesCount = checks.filter(function (k) { return risk[k] === 'Yes'; }).length;
    var tested = risk.recoveryTested === 'Yes';
    if (yesCount >= 5 && tested) return { level: 'High', why: 'Fallback, backup, knowledge, authority, and recovery steps all exist, and recovery has been tested.' };
    if (yesCount >= 3) return { level: 'Moderate', why: yesCount + ' of 5 recovery elements exist' + (tested ? ' and recovery has been tested.' : ', but recovery has not been tested.') };
    if (yesCount >= 1) return { level: 'Low', why: 'Only ' + yesCount + ' of 5 recovery elements exist.' };
    return { level: 'Low', why: 'None of the recorded recovery elements (fallback, backup, knowledge, authority, recovery steps) exist.' };
  }

  /* ----------------------------------------------------------
     Section 35 — Exposure Profile. More useful than red/yellow/
     green: shows the dimensions separately rather than collapsing
     them into one number.
     ---------------------------------------------------------- */

  function exposureProfile(risk, model) {
    var det = detectability(risk);
    var rec = recoverability(risk);
    var blastCount = null;
    var linked = parseLinkedBlueprintObject(risk.linkedBlueprintObject);
    if (global.OMSBlueprint && linked) {
      var bp = model.data.relatedBlueprintProjectId ? global.OMSBlueprint.store.get(model.data.relatedBlueprintProjectId) : global.OMSBlueprint.store.mostRecent();
      if (bp) {
        var tiers = global.OMSBlueprint.blastRadius(bp, linked.type, linked.id);
        blastCount = tiers.reduce(function (sum, t) { return sum + t.nodes.length; }, 0);
      }
    }
    var concentrationHit = (model.data.dependencies || []).some(function (d) {
      return d.concentrationDescription || dependencyFlags(d, model.data.criticality).some(function (f) { return f.rule === 'Single Point Of Failure'; });
    });
    return {
      likelihood: risk.likelihood || 'Unknown', impact: risk.impact || 'Unknown',
      blastRadius: blastCount == null ? 'Not linked to Blueprint' : (blastCount + ' connected object' + (blastCount === 1 ? '' : 's')),
      detectability: det.level, detectabilityWhy: det.why,
      timeToImpact: risk.timeToImpact || 'Unknown',
      responseReadiness: risk.response ? (isYes(risk.responseTested) ? 'High' : 'Moderate') : 'Unknown',
      recoveryReadiness: rec.level, recoveryReadinessWhy: rec.why,
      dependencyConcentration: concentrationHit ? 'Concentrated' : 'Not flagged'
    };
  }

  /* ----------------------------------------------------------
     Section 58 — Top Systemic Risks. A transparent ranking, not
     a scientifically validated score. Every risk can explain
     exactly why it ranked where it did.
     ---------------------------------------------------------- */

  var LEVEL_WEIGHT = { Low: 1, Moderate: 2, High: 3, Critical: 4 };
  var DETECT_PENALTY = { High: 0, Moderate: 1, Low: 3, Unknown: 2 };
  var RECOVERY_PENALTY = { High: 0, Moderate: 1, Low: 3, Unknown: 2 };

  function topSystemicRisks(model) {
    var risks = model.data.risks || [];
    return risks.map(function (r) {
      var profile = exposureProfile(r, model);
      var blastScore = profile.blastRadius && /^\d/.test(profile.blastRadius) ? Math.min(parseInt(profile.blastRadius, 10), 4) : 0;
      var concentrationScore = profile.dependencyConcentration === 'Concentrated' ? 2 : 0;
      var score =
        (LEVEL_WEIGHT[r.likelihood] || 0) +
        (LEVEL_WEIGHT[r.impact] || 0) * 2 +
        blastScore +
        concentrationScore +
        (DETECT_PENALTY[profile.detectability] || 0) +
        (RECOVERY_PENALTY[profile.recoveryReadiness] || 0);
      var why = [
        'Likelihood ' + (r.likelihood || 'Unknown') + ' (+' + (LEVEL_WEIGHT[r.likelihood] || 0) + ')',
        'Impact ' + (r.impact || 'Unknown') + ' (+' + ((LEVEL_WEIGHT[r.impact] || 0) * 2) + ', weighted double)',
        'Blast radius ' + profile.blastRadius + ' (+' + blastScore + ')',
        'Dependency concentration: ' + profile.dependencyConcentration + ' (+' + concentrationScore + ')',
        'Detectability ' + profile.detectability + ' (+' + (DETECT_PENALTY[profile.detectability] || 0) + ' — harder to detect scores higher)',
        'Recovery readiness ' + profile.recoveryReadiness + ' (+' + (RECOVERY_PENALTY[profile.recoveryReadiness] || 0) + ' — weaker recovery scores higher)'
      ];
      return { risk: r, score: score, profile: profile, why: why };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  /* ----------------------------------------------------------
     Model-level findings
     ---------------------------------------------------------- */

  function modelFindings(model) {
    var flags = [];
    var d = model.data;
    if (!d.criticality) flags.push({ severity: 'warning', rule: 'No Criticality Set', message: 'This system has no criticality level set yet.', why: 'Criticality field is empty.' });
    else if (!d.criticalityExplanation) flags.push({ severity: 'warning', rule: 'Criticality Without Explanation', message: 'Criticality is set to ' + d.criticality + ', but there is no explanation of what would happen if this system stopped working.', why: 'Criticality should never be inferred from category alone.' });
    var spofs = singlePointsOfFailure(model);
    if (spofs.length) {
      flags.push({ severity: 'critical', rule: 'Single Points Of Failure Present', message: spofs.length + ' dependenc' + (spofs.length === 1 ? 'y is' : 'ies are') + ' a single point of failure.', why: 'See Dependencies for detail.' });
    }
    flags = flags.concat(technologyConcentration(d.technologyDependencies));
    var noOwnerRisks = (d.risks || []).filter(function (r) { return !r.owner; });
    if (noOwnerRisks.length) {
      flags.push({ severity: 'warning', rule: 'Risks Without Owners', message: noOwnerRisks.length + ' risk(s) have no named owner.', why: 'Owner field is empty on one or more risk records.' });
    }
    var uncontrolled = (d.risks || []).filter(function (r) { return controlCoverage(r, d.controls) === 'Uncontrolled' || controlCoverage(r, d.controls) === 'Unknown'; });
    if (d.risks && d.risks.length && uncontrolled.length === d.risks.length) {
      flags.push({ severity: 'warning', rule: 'No Effective Controls', message: 'None of the recorded risks have an effective, evidenced control.', why: 'Every risk resolves to Uncontrolled or Unknown coverage.' });
    }
    var noWarningRisks = (d.risks || []).filter(function (r) {
      return (r.impact === 'High' || r.impact === 'Critical') && !r.detectionMechanism && !r.earlyWarning;
    });
    if (noWarningRisks.length) {
      flags.push({ severity: 'critical', rule: 'Critical Risk With No Warning Signal', message: noWarningRisks.length + ' high or critical impact risk(s) have no detection mechanism and no early warning signal recorded.', why: 'Both the detection mechanism and early warning fields are empty on one or more high/critical impact risks.' });
    }
    return flags;
  }

  global.OMSRisk = {
    STORAGE_KEY: STORAGE_KEY,
    SYSTEM_TYPES: SYSTEM_TYPES, IMPACT_CATEGORIES: IMPACT_CATEGORIES, CRITICALITY_LEVELS: CRITICALITY_LEVELS, CRITICALITY_RANK: CRITICALITY_RANK,
    DEPENDENCY_CATEGORIES: DEPENDENCY_CATEGORIES, DEPENDENCY_STRENGTH: DEPENDENCY_STRENGTH, TIME_OPTIONS: TIME_OPTIONS,
    YES_NO_UNSURE: YES_NO_UNSURE, CONTROL_TYPES: CONTROL_TYPES, RISK_STATUSES: RISK_STATUSES, CONFIDENCE_LEVELS: CONFIDENCE_LEVELS,
    DETECTABILITY_LEVELS: DETECTABILITY_LEVELS, COVERAGE_LEVELS: COVERAGE_LEVELS,
    newId: newId, blankData: blankData, store: store, logActivity: logActivity, isYes: isYes, isNo: isNo, parseLinkedBlueprintObject: parseLinkedBlueprintObject,
    dependencyFlags: dependencyFlags, singlePointsOfFailure: singlePointsOfFailure,
    knowledgeRiskFlags: knowledgeRiskFlags, technologyFlags: technologyFlags, technologyConcentration: technologyConcentration,
    dataFlags: dataFlags, vendorFlags: vendorFlags, controlFlags: controlFlags, controlCoverage: controlCoverage,
    detectability: detectability, recoverability: recoverability, exposureProfile: exposureProfile,
    topSystemicRisks: topSystemicRisks, modelFindings: modelFindings
  };
})(window);
