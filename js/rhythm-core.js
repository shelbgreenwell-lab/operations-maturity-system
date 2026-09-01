/*
 * Operations Maturity System
 * Operating Rhythm Designer — data model, persistence, and analysis engine.
 *
 * A meeting is not an operating rhythm. This file exists to keep that
 * distinction sharp: every rhythm here is designed from its purpose and
 * the decisions it must produce, not from a meeting name and a calendar
 * slot. Governance without decision authority is ceremony — the rule
 * engine below is built to surface exactly that.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'rhythms';

  function newId(prefix) {
    return (prefix || 'rhythm') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var PURPOSE_CATEGORIES = ['Performance', 'Capacity', 'Risk', 'Customer Health', 'Quality', 'Delivery', 'Strategy', 'Resource Allocation', 'Change', 'Operational Health', 'Improvement', 'Portfolio Prioritization', 'Escalation', 'Custom'];
  var CADENCES = ['Daily', 'Weekly', 'Biweekly', 'Monthly', 'Quarterly', 'Event-Triggered', 'Threshold-Triggered', 'Custom'];
  var AUTHORITY_LEVELS = ['Individual Contributor', 'Manager', 'Senior Manager', 'Director', 'Executive', 'Committee / Governance Body', 'Custom'];
  var PARTICIPANT_ROLES = ['Decides', 'Provides Input', 'Executes', 'Informed Only'];
  var DISPOSITIONS = ['No Action', 'Monitor', 'Decision', 'Investigation', 'Intervention', 'Escalation', 'Separate Problem-Solving Session'];
  var STATUS_VALUES = ['Healthy', 'Watch', 'Weak', 'Critical', 'Unknown'];
  var TREND_VALUES = ['Improving', 'Stable', 'Deteriorating', 'Volatile', 'Unknown'];
  var DATA_CONFIDENCE = ['High', 'Moderate', 'Low', 'Unknown'];
  var INPUT_TYPES = ['Metrics', 'Risks', 'Open Decisions', 'Capacity Signals', 'Customer Signals', 'Quality Signals', 'Work In Progress', 'Intervention Results', 'Exceptions', 'Forecasts', 'Blueprint Findings', 'Workbench Priorities', 'Custom'];
  var STRUCTURE_STEPS = ['What changed?', 'What is off track?', 'Why?', 'What decision is required?', 'Who owns the action?', 'When will we know it worked?'];
  var STATUS_RANK = { Unknown: 0, Healthy: 1, Watch: 2, Weak: 3, Critical: 4 };
  var CADENCE_MONTHLY_FACTOR = { Daily: 21, Weekly: 4.33, Biweekly: 2.17, Monthly: 1, Quarterly: 0.33, 'Event-Triggered': 0, 'Threshold-Triggered': 0, Custom: 0 };

  function blankData() {
    return {
      purposeCategory: '', purpose: '', systemScope: '',
      cadence: '', cadenceCustom: '', cadenceRationale: '', estimatedDurationMinutes: '',
      isTriggered: false, triggerCondition: '', triggerThreshold: '', triggerOwner: '', triggerParticipants: '', triggerDecisionRequired: '', triggerResponseTime: '',
      decisions: [], signals: [], participants: [], inputs: [],
      relatedBlueprintProjectId: '', relatedBlueprintType: '', relatedBlueprintId: '',
      relatedValueStreamId: '', relatedCapacityModelId: '', relatedKpiModelId: '', relatedHealthModelId: '', relatedDecisionRightsProjectId: '',
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
      var rhythm = { id: newId(), name: name || 'New Operating Rhythm', owner: '', createdAt: now, updatedAt: now, isSample: !!isSample, currentStep: 0, data: data || blankData() };
      var all = loadAll();
      all.push(rhythm);
      saveAll(all);
      return rhythm;
    },
    save: function (rhythm) {
      rhythm.updatedAt = new Date().toISOString();
      var all = loadAll();
      var idx = all.findIndex(function (m) { return m.id === rhythm.id; });
      if (idx === -1) all.push(rhythm); else all[idx] = rhythm;
      saveAll(all);
      return rhythm;
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

  function logActivity(rhythm, message) {
    rhythm.data.activity = rhythm.data.activity || [];
    rhythm.data.activity.unshift({ id: newId('act'), timestamp: new Date().toISOString(), message: message });
    rhythm.data.activity = rhythm.data.activity.slice(0, 50);
  }

  function isYes(v) { return v === true || v === 'Yes'; }
  function cadenceLabel(rhythm) { return rhythm.data.cadence === 'Custom' ? (rhythm.data.cadenceCustom || 'Custom') : rhythm.data.cadence; }

  /* ----------------------------------------------------------
     Section 14 — Rhythm anti-patterns. Deterministic, explained.
     ---------------------------------------------------------- */

  function rhythmFlags(rhythm) {
    var d = rhythm.data;
    var flags = [];
    var decisions = d.decisions || [];
    var signals = d.signals || [];
    var participants = d.participants || [];

    if (!decisions.length) {
      flags.push({ severity: 'critical', rule: 'Meeting Without Decision Purpose', message: 'No decisions are defined for this rhythm. Metrics without decisions are reporting, not management.', why: 'Zero decisions recorded.' });
    }
    if (!decisions.length && signals.length >= 2) {
      flags.push({ severity: 'warning', rule: 'Status Meeting', message: 'This rhythm reviews ' + signals.length + ' signals but produces no decisions. A dashboard is not a management system.', why: 'Two or more signals are reviewed and zero decisions are recorded.' });
    }
    if (signals.length >= 5) {
      var linked = signals.filter(function (s) { return s.decisionSupported; }).length;
      if (linked / signals.length < 0.5) {
        flags.push({ severity: 'warning', rule: 'Dashboard Theater', message: linked + ' of ' + signals.length + ' signals reviewed here are tied to a decision. Seeing a number is not the same as managing the system.', why: 'Five or more signals exist and fewer than half name the decision they support.' });
      }
    }
    if (participants.length >= 8) {
      flags.push({ severity: 'warning', rule: 'Too Many Attendees', message: participants.length + ' participant roles are listed. Ask what would break if each one were not present.', why: 'Eight or more participant roles are recorded.' });
    }
    var noOwnerDecisions = decisions.filter(function (dec) { return !dec.owner; });
    if (noOwnerDecisions.length) {
      flags.push({ severity: 'critical', rule: 'No Decision Owner', message: noOwnerDecisions.length + ' decision(s) have no named owner.', why: 'A decision\'s owner field is empty.' });
    }
    if (decisions.length >= 2 && decisions.every(function (dec) { return dec.escalationThreshold && (dec.authorityLevel === 'Executive' || dec.authorityLevel === 'Committee / Governance Body'); })) {
      flags.push({ severity: 'warning', rule: 'Every Decision Escalates', message: 'Every decision in this rhythm escalates to executive or committee authority. If everything requires escalation, you don\'t have decision rights.', why: 'All recorded decisions name an escalation threshold and an Executive or Committee authority level.' });
    }
    if (signals.length && signals.every(function (s) { return !s.threshold; })) {
      flags.push({ severity: 'warning', rule: 'No Thresholds', message: 'None of the signals reviewed here have a defined threshold. Escalation should be triggered by thresholds, not uncertainty.', why: 'No signal has a threshold recorded.' });
    }
    if (decisions.length && decisions.every(function (dec) { return !dec.reviewDate && !dec.action; })) {
      flags.push({ severity: 'warning', rule: 'No Follow-Through', message: 'No decision here has a recorded action or review date.', why: 'Every decision is missing both an action and a review date.' });
    }
    if (d.cadence && d.cadence !== 'Event-Triggered' && d.cadence !== 'Threshold-Triggered' && !d.cadenceRationale) {
      flags.push({ severity: 'info', rule: 'Wrong Cadence Risk', message: 'No rationale is recorded for why ' + (d.cadence || 'this cadence') + ' matches the speed of the system being managed.', why: 'Cadence is set but the cadence rationale field is empty.' });
    }
    var actionsNoOwner = decisions.filter(function (dec) { return dec.action && !dec.executionOwner; });
    if (actionsNoOwner.length) {
      flags.push({ severity: 'critical', rule: 'Action Without Owner', message: actionsNoOwner.length + ' action(s) are recorded with no execution owner.', why: 'A decision has an action but no execution owner.' });
    }
    var repeatedNoResponse = signals.filter(function (s) { return (s.status === 'Weak' || s.status === 'Critical') && (s.disposition === 'No Action' || s.disposition === 'Monitor' || !s.disposition); });
    if (repeatedNoResponse.length) {
      flags.push({ severity: 'critical', rule: 'Issue Repeated Without System Response', message: repeatedNoResponse.length + ' signal(s) are Weak or Critical but were dispositioned as No Action or Monitor.', why: 'A signal\'s status is Weak or Critical while its disposition is No Action, Monitor, or unset.' });
    }
    if (participants.length && !participants.some(function (p) { return p.decisionAuthority === 'Decides'; })) {
      flags.push({ severity: 'warning', rule: 'No Final Authority', message: 'No participant is recorded as having final decision authority in this rhythm.', why: 'No participant\'s decision authority is set to "Decides".' });
    }
    if (participants.length && participants.filter(function (p) { return p.decisionAuthority === 'Decides'; }).length > 2) {
      flags.push({ severity: 'info', rule: 'Too Many Decision Makers', message: 'More than two participants are recorded as having final decision authority.', why: 'More than two participants have decision authority "Decides".' });
    }
    if (participants.length >= 3 && participants.every(function (p) { return p.decisionAuthority === 'Provides Input' || p.decisionAuthority === 'Informed Only'; })) {
      flags.push({ severity: 'warning', rule: 'Everyone Is Input', message: 'Every participant is recorded as input or information-only. Someone has to decide.', why: 'No participant has "Decides" or "Executes" authority.' });
    }

    return flags;
  }

  /* ----------------------------------------------------------
     Section 13 — Operating Rhythm Health. Nine dimensions,
     explained, never a judgment of the people involved.
     ---------------------------------------------------------- */

  function dimensionStatus(rhythm) {
    var d = rhythm.data;
    var decisions = d.decisions || [];
    var signals = d.signals || [];
    var participants = d.participants || [];
    var out = {};

    out.purpose = (d.purposeCategory && d.purpose && d.purpose.length > 10)
      ? { status: 'Healthy', why: 'A purpose category and a written purpose are both recorded.' }
      : (d.purposeCategory || d.purpose)
        ? { status: 'Watch', why: 'Only one of purpose category or written purpose is recorded.' }
        : { status: 'Unknown', why: 'No purpose is recorded for what this rhythm exists to manage.' };

    if (!signals.length) out.signals = { status: 'Unknown', why: 'No signals are reviewed in this rhythm.' };
    else {
      var pctLinked = signals.filter(function (s) { return s.decisionSupported; }).length / signals.length;
      out.signals = pctLinked === 1 ? { status: 'Healthy', why: 'Every signal names the decision it supports.' }
        : pctLinked >= 0.5 ? { status: 'Watch', why: 'Some signals do not name a decision they support.' }
        : { status: 'Weak', why: 'Most signals do not name a decision they support.' };
    }

    if (!decisions.length) out.decisions = { status: 'Critical', why: 'No decisions are defined. A meeting is not an operating rhythm.' };
    else {
      var wellFormed = decisions.filter(function (dec) { return dec.owner && dec.authorityLevel; }).length / decisions.length;
      out.decisions = wellFormed === 1 ? { status: 'Healthy', why: 'Every decision has an owner and an authority level.' }
        : wellFormed >= 0.5 ? { status: 'Watch', why: 'Some decisions are missing an owner or authority level.' }
        : { status: 'Weak', why: 'Most decisions are missing an owner or authority level.' };
    }

    if (!decisions.length) out.authority = { status: 'Unknown', why: 'No decisions exist to assess authority against.' };
    else {
      var missingAuthority = decisions.filter(function (dec) { return !dec.authorityLevel; }).length;
      var wrongLevel = decisions.filter(function (dec) { return (dec.frequency === 'Daily' || dec.frequency === 'Weekly') && (dec.authorityLevel === 'Executive' || dec.authorityLevel === 'Committee / Governance Body'); }).length;
      out.authority = missingAuthority ? { status: 'Weak', why: missingAuthority + ' decision(s) have no authority level set.' }
        : wrongLevel ? { status: 'Watch', why: wrongLevel + ' high-frequency decision(s) are owned at executive or committee level.' }
        : { status: 'Healthy', why: 'Authority levels are set and roughly match decision frequency.' };
    }

    if (!participants.length) out.participation = { status: 'Unknown', why: 'No participants are recorded.' };
    else {
      var hasDecider = participants.some(function (p) { return p.decisionAuthority === 'Decides'; });
      out.participation = !hasDecider ? { status: 'Critical', why: 'No participant has final decision authority.' }
        : participants.length >= 8 ? { status: 'Watch', why: participants.length + ' participant roles are recorded — worth challenging whether all are required.' }
        : { status: 'Healthy', why: 'Participation is defined with clear decision authority.' };
    }

    out.cadence = !d.cadence ? { status: 'Unknown', why: 'No cadence is set.' }
      : d.cadenceRationale ? { status: 'Healthy', why: 'A cadence is set with a stated rationale for why it matches the system\'s speed.' }
      : { status: 'Watch', why: 'A cadence is set but no rationale is recorded for why it fits the system being managed.' };

    if (!signals.length && !d.isTriggered) out.thresholds = { status: 'Unknown', why: 'No signals or triggers are recorded.' };
    else {
      var withThreshold = signals.filter(function (s) { return s.threshold; }).length;
      var triggerOk = !d.isTriggered || !!d.triggerThreshold;
      out.thresholds = (signals.length && withThreshold === signals.length && triggerOk) ? { status: 'Healthy', why: 'Every signal has a threshold, and any trigger has a defined threshold.' }
        : (signals.length && withThreshold === 0 && !d.isTriggered) ? { status: 'Weak', why: 'No signal has a threshold recorded.' }
        : { status: 'Watch', why: 'Some signals or the trigger condition are missing a threshold.' };
    }

    if (!decisions.length) out.actionOwnership = { status: 'Unknown', why: 'No decisions exist to assess action ownership against.' };
    else {
      var actionsWithOwner = decisions.filter(function (dec) { return dec.action; });
      var missingOwner = actionsWithOwner.filter(function (dec) { return !dec.executionOwner; }).length;
      out.actionOwnership = !actionsWithOwner.length ? { status: 'Weak', why: 'No decision has a recorded action.' }
        : missingOwner ? { status: 'Critical', why: missingOwner + ' action(s) have no execution owner.' }
        : { status: 'Healthy', why: 'Every recorded action has an execution owner.' };
    }

    if (!decisions.length) out.followThrough = { status: 'Unknown', why: 'No decisions exist to assess follow-through against.' };
    else {
      var withReview = decisions.filter(function (dec) { return dec.reviewDate; }).length;
      out.followThrough = withReview === decisions.length ? { status: 'Healthy', why: 'Every decision has a review date.' }
        : withReview === 0 ? { status: 'Weak', why: 'No decision has a review date.' }
        : { status: 'Watch', why: 'Some decisions have no review date.' };
    }

    return out;
  }

  function overallHealth(rhythm) {
    var dims = dimensionStatus(rhythm);
    var worst = null;
    Object.keys(dims).forEach(function (key) {
      var s = dims[key];
      if (!worst || STATUS_RANK[s.status] > STATUS_RANK[worst.status]) worst = { status: s.status, why: s.why, dimension: key };
    });
    return worst || { status: 'Unknown', why: 'No data recorded yet.', dimension: null };
  }

  /* ----------------------------------------------------------
     Section 10 — the standard rhythm structure. Static and
     always visible: this is what the tool teaches, not a form.
     ---------------------------------------------------------- */

  /* ----------------------------------------------------------
     Sections 26-28 — cross-rhythm rollups. Never a claim that
     more decisions or fewer meetings is inherently better.
     ---------------------------------------------------------- */

  function monthlyHoursFor(rhythm) {
    var mins = parseFloat(rhythm.data.estimatedDurationMinutes);
    if (isNaN(mins) || mins <= 0) return 0;
    var factor = CADENCE_MONTHLY_FACTOR[rhythm.data.cadence] || 0;
    return (mins / 60) * factor;
  }

  function managementLoad(rhythms) {
    var totalRhythms = rhythms.length;
    var monthlyHours = 0, participantMonthlyHours = 0, metricsReviewed = 0, decisionsProduced = 0;
    rhythms.forEach(function (r) {
      var h = monthlyHoursFor(r);
      monthlyHours += h;
      participantMonthlyHours += h * (r.data.participants || []).length;
      metricsReviewed += (r.data.signals || []).length;
      decisionsProduced += (r.data.decisions || []).length;
    });
    var duplicateSignals = crossRhythmFindings(rhythms).filter(function (f) { return f.rule === 'Metric Reviewed In Multiple Places'; }).length;
    return {
      totalRhythms: totalRhythms, monthlyHours: Math.round(monthlyHours * 10) / 10,
      participantMonthlyHours: Math.round(participantMonthlyHours * 10) / 10,
      metricsReviewed: metricsReviewed, decisionsProduced: decisionsProduced, duplicateReviews: duplicateSignals
    };
  }

  function decisionYield(rhythms) {
    var rhythmsHeld = rhythms.length;
    var decisionsMade = 0, actionsCreated = 0, issuesResolved = 0, repeatedUnresolved = 0;
    rhythms.forEach(function (r) {
      var decisions = r.data.decisions || [];
      decisionsMade += decisions.length;
      actionsCreated += decisions.filter(function (dec) { return dec.action; }).length;
      (r.data.signals || []).forEach(function (s) {
        if (s.disposition === 'Decision' || s.disposition === 'Intervention') issuesResolved++;
        if ((s.status === 'Weak' || s.status === 'Critical') && (s.disposition === 'No Action' || s.disposition === 'Monitor' || !s.disposition)) repeatedUnresolved++;
      });
    });
    return { rhythmsHeld: rhythmsHeld, decisionsMade: decisionsMade, actionsCreated: actionsCreated, issuesResolved: issuesResolved, repeatedUnresolved: repeatedUnresolved };
  }

  function normalizeName(s) { return (s || '').trim().toLowerCase().replace(/[^a-z0-9 ]/g, ''); }

  function crossRhythmFindings(rhythms) {
    var flags = [];
    var signalMap = {}, decisionMap = {};
    rhythms.forEach(function (r) {
      (r.data.signals || []).forEach(function (s) {
        var key = normalizeName(s.name);
        if (!key) return;
        signalMap[key] = signalMap[key] || { label: s.name, occurrences: [] };
        signalMap[key].occurrences.push({ rhythmId: r.id, rhythmName: r.name });
      });
      (r.data.decisions || []).forEach(function (dec) {
        var key = normalizeName(dec.name);
        if (!key) return;
        decisionMap[key] = decisionMap[key] || { label: dec.name, occurrences: [] };
        decisionMap[key].occurrences.push({ rhythmId: r.id, rhythmName: r.name });
      });
    });
    Object.keys(signalMap).forEach(function (key) {
      var entry = signalMap[key];
      if (entry.occurrences.length >= 3) {
        flags.push({
          severity: 'warning', rule: 'Metric Reviewed In Multiple Places',
          message: 'A signal named "' + entry.label + '" appears in ' + entry.occurrences.length + ' different rhythms: ' + entry.occurrences.map(function (o) { return o.rhythmName; }).join(', ') + '.',
          why: 'The same signal name appears in three or more rhythms. Overlap is not automatically bad — ask whether each rhythm uses it for a distinct decision.',
          rhythmIds: entry.occurrences.map(function (o) { return o.rhythmId; })
        });
      }
    });
    Object.keys(decisionMap).forEach(function (key) {
      var entry = decisionMap[key];
      if (entry.occurrences.length >= 2) {
        flags.push({
          severity: 'info', rule: 'Same Decision In Multiple Forums',
          message: 'A decision named "' + entry.label + '" appears in ' + entry.occurrences.length + ' different rhythms: ' + entry.occurrences.map(function (o) { return o.rhythmName; }).join(', ') + '.',
          why: 'The same decision name appears in two or more rhythms.',
          rhythmIds: entry.occurrences.map(function (o) { return o.rhythmId; })
        });
      }
    });
    return flags;
  }

  global.OMSRhythm = {
    STORAGE_KEY: STORAGE_KEY,
    PURPOSE_CATEGORIES: PURPOSE_CATEGORIES, CADENCES: CADENCES, AUTHORITY_LEVELS: AUTHORITY_LEVELS,
    PARTICIPANT_ROLES: PARTICIPANT_ROLES, DISPOSITIONS: DISPOSITIONS, STATUS_VALUES: STATUS_VALUES,
    TREND_VALUES: TREND_VALUES, DATA_CONFIDENCE: DATA_CONFIDENCE, INPUT_TYPES: INPUT_TYPES,
    STRUCTURE_STEPS: STRUCTURE_STEPS, STATUS_RANK: STATUS_RANK,
    newId: newId, blankData: blankData, store: store, logActivity: logActivity, isYes: isYes, cadenceLabel: cadenceLabel,
    rhythmFlags: rhythmFlags, dimensionStatus: dimensionStatus, overallHealth: overallHealth,
    monthlyHoursFor: monthlyHoursFor, managementLoad: managementLoad, decisionYield: decisionYield, crossRhythmFindings: crossRhythmFindings
  };
})(window);
