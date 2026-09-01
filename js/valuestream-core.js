/*
 * Operations Maturity System
 * Value Stream Intelligence — data model, persistence, and analysis engine.
 *
 * A Value Stream is not a process. A process is how one defined body of
 * work gets executed. A Value Stream is how value moves end-to-end across
 * multiple processes, teams, decisions, systems, and handoffs to reach a
 * customer or value recipient. This file never uses the two terms
 * interchangeably.
 *
 * Responsible for:
 * - the Value Stream data model and its localStorage persistence
 *   (create, save, resume, duplicate, delete)
 * - transparent flow calculations: work time vs. wait time, lead time,
 *   flow efficiency, handoff/approval/ownership/system-change counts
 * - deterministic, explained "Flow Signals" over queues
 * - deterministic Handoff Health scoring (Healthy/Watch/Weak/Critical/
 *   Unknown), reusing the same status vocabulary as Blueprint's Health View
 * - deterministic value-stream-level risk rules
 * - "Where Is Value Waiting?" ranking, and Trace the Delay / Rework /
 *   Escalation chain builders, each node labeled by how confident OMS is
 *   in it (OBSERVED / ENTERED / INFERRED) — never presented as certain
 * - current-state vs. target-state comparison and a Local Optimum check
 *
 * None of the scoring here is scientific, benchmarked, or certified. It is
 * a set of named, explainable rules over what a user actually entered.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'valuestreams';

  /* ----------------------------------------------------------
     Persistence
     ---------------------------------------------------------- */

  function newId(prefix) {
    return (prefix || 'vs') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function blankData() {
    return {
      meta: { customer: '', trigger: '', expectedValue: '', startingCondition: '', endingCondition: '', businessOutcome: '' },
      stages: [],
      targetStages: null,
      hasTargetState: false,
      queues: [],
      handoffs: [],
      friction: [],
      rework: [],
      approvals: [],
      metrics: [],
      constraint: { type: '', note: '', systemsToInvestigate: '' },
      relatedBlueprintId: null,
      findings: [],
      activity: []
    };
  }

  function loadAll() { return global.OMSData.storage.get(STORAGE_KEY, []); }
  function saveAll(list) { global.OMSData.storage.set(STORAGE_KEY, list); }

  var store = {
    list: function () { return loadAll(); },
    get: function (id) { return loadAll().filter(function (v) { return v.id === id; })[0] || null; },
    create: function (name, data, isSample) {
      var now = new Date().toISOString();
      var vs = {
        id: newId(), name: name || 'New Value Stream', owner: '', criticality: '',
        createdAt: now, updatedAt: now, isSample: !!isSample, currentStep: 0,
        data: data || blankData()
      };
      var all = loadAll();
      all.push(vs);
      saveAll(all);
      return vs;
    },
    save: function (vs) {
      vs.updatedAt = new Date().toISOString();
      var all = loadAll();
      var idx = all.findIndex(function (v) { return v.id === vs.id; });
      if (idx === -1) all.push(vs); else all[idx] = vs;
      saveAll(all);
      return vs;
    },
    remove: function (id) { saveAll(loadAll().filter(function (v) { return v.id !== id; })); },
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

  function logActivity(vs, message) {
    vs.data.activity = vs.data.activity || [];
    vs.data.activity.unshift({ id: newId('act'), timestamp: new Date().toISOString(), message: message });
    vs.data.activity = vs.data.activity.slice(0, 50);
  }

  function byId(list, id) { return (list || []).filter(function (x) { return x.id === id; })[0] || null; }

  // Boolean-like fields are edited as a Yes/No select (matching the rest
  // of OMS's builder convention), so "No" must not read as truthy.
  function isYes(v) { return v === true || v === 'Yes'; }

  /* ----------------------------------------------------------
     Time
     Every duration is stored as {value, unit} with unit one of
     minutes/hours/days. Days are treated as 24-hour periods so wait
     time (which keeps running nights and weekends) and work time
     (which usually doesn't) can still be added on one common scale.
     That's a simplification, not a claim of precision — it's stated
     plainly wherever a total is shown.
     ---------------------------------------------------------- */

  var UNIT_TO_HOURS = { minutes: 1 / 60, hours: 1, days: 24 };

  function toHours(value, unit) {
    var n = parseFloat(value);
    if (isNaN(n) || n < 0) return 0;
    return n * (UNIT_TO_HOURS[unit] || 1);
  }

  function fmtHours(hours) {
    if (!hours) return '0 hours';
    if (hours < 1) return Math.round(hours * 60) + ' min';
    if (hours < 48) return round1(hours) + ' hrs';
    return round1(hours / 24) + ' days';
  }

  function round1(n) { return Math.round(n * 10) / 10; }

  /* ----------------------------------------------------------
     Flow calculations — Section 5/6
     ---------------------------------------------------------- */

  function stagesFor(vs, stateKey) {
    return (stateKey === 'target' ? (vs.data.targetStages || []) : vs.data.stages) || [];
  }

  function calcFlow(vs, stateKey) {
    var isTarget = stateKey === 'target';
    var stages = stagesFor(vs, stateKey);
    var rework = vs.data.rework || [];

    var stageWorkHours = 0, stageWaitHours = 0;
    stages.forEach(function (s) {
      stageWorkHours += toHours(s.workTimeValue, s.workTimeUnit);
      stageWaitHours += toHours(s.waitTimeValue, s.waitTimeUnit);
    });

    // Queues and approvals are only modeled for the current, observed
    // state (that's what makes them real evidence). A target design
    // expresses any queuing or approval delay it still expects directly
    // in that stage's own wait time, rather than duplicating a whole
    // second set of queues/approvals just to compare two numbers.
    var queueWaitHours = 0, approvalWaitHours = 0, handoffCount = 0, approvalCount = 0;
    if (!isTarget) {
      (vs.data.queues || []).forEach(function (q) { queueWaitHours += toHours(q.avgWaitTimeValue, q.avgWaitTimeUnit); });
      (vs.data.approvals || []).forEach(function (a) { approvalWaitHours += toHours(a.waitTimeValue, a.waitTimeUnit); });
      handoffCount = (vs.data.handoffs || []).length;
      approvalCount = (vs.data.approvals || []).length;
    } else {
      handoffCount = stages.filter(function (s, i) { return isYes(s.handoffAfter) && i < stages.length - 1; }).length;
      approvalCount = (vs.data.targetApprovalCount != null && vs.data.targetApprovalCount !== '') ? parseInt(vs.data.targetApprovalCount, 10) : (vs.data.approvals || []).length;
    }

    var totalWaitHours = stageWaitHours + queueWaitHours + approvalWaitHours;
    var totalWorkHours = stageWorkHours;
    var totalLeadHours = totalWorkHours + totalWaitHours;
    var flowEfficiency = totalLeadHours > 0 ? (totalWorkHours / totalLeadHours) : null;

    var ownershipChanges = 0, systemChanges = 0, exceptionPoints = 0;
    for (var i = 0; i < stages.length; i++) {
      if (stages[i].commonException) exceptionPoints++;
      if (i > 0) {
        if ((stages[i].owner || '').trim().toLowerCase() !== (stages[i - 1].owner || '').trim().toLowerCase() && (stages[i].owner || stages[i - 1].owner)) ownershipChanges++;
        if ((stages[i].system || '').trim().toLowerCase() !== (stages[i - 1].system || '').trim().toLowerCase() && (stages[i].system || stages[i - 1].system)) systemChanges++;
      }
    }

    return {
      stageWorkHours: stageWorkHours, stageWaitHours: stageWaitHours,
      queueWaitHours: queueWaitHours, approvalWaitHours: approvalWaitHours,
      totalWorkHours: totalWorkHours, totalWaitHours: totalWaitHours, totalLeadHours: totalLeadHours,
      valueCreatingHours: totalWorkHours, nonValueCreatingHours: totalWaitHours,
      flowEfficiency: flowEfficiency,
      handoffCount: handoffCount, approvalCount: approvalCount,
      ownershipChanges: ownershipChanges, systemChanges: systemChanges,
      exceptionPoints: exceptionPoints, reworkOccurrences: isTarget ? 0 : rework.length,
      stageCount: stages.length, queueCount: isTarget ? 0 : (vs.data.queues || []).length
    };
  }

  /* ----------------------------------------------------------
     Section 9 — automatically detect potential handoffs: any place
     ownership, team, capability, or system changes between two
     consecutive stages that doesn't already have a defined handoff.
     ---------------------------------------------------------- */

  function detectPotentialHandoffs(vs, stateKey) {
    var stages = stagesFor(vs, stateKey);
    var handoffs = vs.data.handoffs || [];
    var suggestions = [];
    for (var i = 1; i < stages.length; i++) {
      var a = stages[i - 1], b = stages[i];
      var reasons = [];
      if ((a.owner || '').trim().toLowerCase() !== (b.owner || '').trim().toLowerCase() && (a.owner || b.owner)) reasons.push('owner');
      if ((a.team || '').trim().toLowerCase() !== (b.team || '').trim().toLowerCase() && (a.team || b.team)) reasons.push('team');
      if ((a.capability || '').trim().toLowerCase() !== (b.capability || '').trim().toLowerCase() && (a.capability || b.capability)) reasons.push('capability');
      if ((a.system || '').trim().toLowerCase() !== (b.system || '').trim().toLowerCase() && (a.system || b.system)) reasons.push('system');
      if (!reasons.length) continue;
      var exists = handoffs.some(function (h) { return h.fromStageId === a.id && h.toStageId === b.id; });
      if (!exists) suggestions.push({ fromStageId: a.id, toStageId: b.id, fromName: a.name, toName: b.name, reasons: reasons });
    }
    return suggestions;
  }

  /* ----------------------------------------------------------
     Section 8 — Flow Signals on queues. Named checks, not diagnoses.
     ---------------------------------------------------------- */

  function queueSignals(vs, queue) {
    var signals = [];
    var flow = calcFlow(vs, 'current');
    var waitHours = toHours(queue.avgWaitTimeValue, queue.avgWaitTimeUnit);
    var maxHours = toHours(queue.maxWaitTimeValue, queue.maxWaitTimeUnit);

    if (flow.totalWorkHours > 0 && waitHours > flow.totalWorkHours) {
      signals.push({ rule: 'Wait Time Significantly Exceeds Work Time', message: 'This queue alone waits longer (' + fmtHours(waitHours) + ') than all the value-creating work in the stream combined (' + fmtHours(flow.totalWorkHours) + ').' });
    }
    if (!queue.owner) signals.push({ rule: 'Queue Has No Owner', message: 'Nobody is named as accountable for what happens to items sitting in this queue.' });
    var arrival = parseFloat(queue.arrivalRate), processing = parseFloat(queue.processingRate);
    if (!isNaN(arrival) && !isNaN(processing) && arrival > processing) {
      signals.push({ rule: 'Arrival Rate Exceeds Processing Rate', message: 'Items are arriving (' + arrival + '/period) faster than they can be processed (' + processing + '/period). A queue with this imbalance grows over time.' });
    }
    if (maxHours > 0 && waitHours > 0 && maxHours > waitHours * 3) {
      signals.push({ rule: 'High Variability', message: 'The peak wait (' + fmtHours(maxHours) + ') is more than three times the average (' + fmtHours(waitHours) + '), meaning some items wait far longer than a typical case.' });
    }
    if (isYes(queue.growing)) signals.push({ rule: 'Queue Growing', message: 'This was entered as a queue that is currently growing, not holding steady.' });
    if (isYes(queue.requiresSeniorApproval)) signals.push({ rule: 'Queue Requires Senior Approval', message: 'Items in this queue cannot move without a senior approval step.' });
    if (isYes(queue.noPrioritizationRule)) signals.push({ rule: 'No Prioritization Rule', message: 'There is no defined rule for which item gets worked next — entered as first-in-first-out by default or genuinely undecided.' });
    if (!queue.avgItemsWaiting) signals.push({ rule: 'Unknown Queue Size', message: 'How many items are typically waiting here is not known.' });

    return signals;
  }

  /* ----------------------------------------------------------
     Section 12 — Handoff Health. Deterministic point rules, then a
     five-value status: Healthy / Watch / Weak / Critical / Unknown.
     ---------------------------------------------------------- */

  var HANDOFF_STATUS_ORDER = ['Unknown', 'Healthy', 'Watch', 'Weak', 'Critical'];

  function handoffFlags(vs, handoff) {
    var flags = [];
    var fromStage = byId(vs.data.stages, handoff.fromStageId);
    var toStage = byId(vs.data.stages, handoff.toStageId);

    if (!handoff.receiver) flags.push({ severity: 2, rule: 'No Clear Receiver', message: 'No specific person or role is named to receive this handoff.' });
    if (!handoff.acceptableDefinition) flags.push({ severity: 2, rule: 'No Acceptance Criteria', message: 'There is no defined standard for what makes the handoff acceptable.' });
    if (!handoff.expectedTimingValue) flags.push({ severity: 1, rule: 'No Timing Expectation', message: 'There is no expected timing for when this handoff should happen.' });
    if (!handoff.confirmationMethod) flags.push({ severity: 1, rule: 'No Confirmation', message: 'There is no way to confirm the receiving side actually got and accepted the handoff.' });
    if (isYes(handoff.incompleteInfoCommon)) flags.push({ severity: 2, rule: 'Incomplete Information Common', message: 'Incomplete information at this handoff was entered as a common occurrence.' });
    if (isYes(handoff.manualReentry)) flags.push({ severity: 1, rule: 'Handoff Requires Manual Re-Entry', message: 'Information has to be manually re-entered rather than transferred directly.' });
    if (fromStage && toStage && fromStage.system && toStage.system && fromStage.system.trim().toLowerCase() !== toStage.system.trim().toLowerCase()) {
      flags.push({ severity: 1, rule: 'Multiple Systems Used', message: '"' + fromStage.system + '" hands off to "' + toStage.system + '" — a system change at exactly the point ownership also changes.' });
    }
    if (!handoff.disputeResolution) flags.push({ severity: 1, rule: 'No Exception Owner', message: 'Nobody is named to resolve disputes or exceptions at this handoff.' });
    if (!handoff.escalation) flags.push({ severity: 1, rule: 'No Escalation Path', message: 'There is no defined escalation path if this handoff breaks down.' });
    var reworkHits = (vs.data.rework || []).filter(function (r) { return r.relatedHandoffId === handoff.id; }).length;
    if (reworkHits >= 1) flags.push({ severity: 2, rule: 'Rework Frequent', message: reworkHits + ' recorded rework loop' + (reworkHits === 1 ? '' : 's') + ' point back to this handoff.' });
    if (isYes(handoff.disputedOwnership)) flags.push({ severity: 2, rule: 'Disputed Ownership', message: 'Ownership at this handoff was entered as disputed or unclear.' });
    var highVolume = (fromStage && (fromStage.volume === 'High' || fromStage.volume === 'Very High'));
    if (highVolume && !handoff.acceptableDefinition) flags.push({ severity: 2, rule: 'High-Volume Handoff With No Standard', message: 'The stage feeding this handoff has High or Very High volume, but there is no defined acceptance standard.' });
    if (vs.criticality && (vs.criticality === 'High' || vs.criticality === 'Critical') && !handoff.metric) flags.push({ severity: 1, rule: 'Critical Handoff Without Metric', message: 'This value stream is marked ' + vs.criticality + ' criticality, but this handoff has no metric tracking its performance.' });

    return flags;
  }

  function handoffHealth(vs, handoff) {
    var hasAnyData = handoff.receiver || handoff.acceptableDefinition || handoff.expectedTimingValue || handoff.confirmationMethod || handoff.whatMoves;
    if (!hasAnyData) return { status: 'Unknown', flags: [], score: 0 };

    var flags = handoffFlags(vs, handoff);
    var score = flags.reduce(function (sum, f) { return sum + f.severity; }, 0);
    var criticalTier = flags.filter(function (f) { return f.severity === 2; }).length;

    var status = 'Healthy';
    if (score >= 6 || criticalTier >= 3) status = 'Critical';
    else if (score >= 3 || criticalTier >= 2) status = 'Weak';
    else if (score >= 1) status = 'Watch';

    return { status: status, flags: flags, score: score };
  }

  /* ----------------------------------------------------------
     Section 25/26 — Value-stream-level risk rules
     ---------------------------------------------------------- */

  function riskAnalysis(vs) {
    var d = vs.data;
    var flags = [];
    var stages = d.stages || [];

    var byOwner = {};
    stages.forEach(function (s) { if (s.owner) { var k = s.owner.trim().toLowerCase(); byOwner[k] = (byOwner[k] || []).concat([s]); } });
    Object.keys(byOwner).forEach(function (k) {
      var list = byOwner[k];
      var criticalOnes = list.filter(function (s) { return s.criticality === 'High' || s.criticality === 'Critical'; });
      if (criticalOnes.length >= 2) {
        flags.push({ severity: 'critical', rule: 'One Person Owns Multiple Critical Stages', message: list[0].owner + ' owns ' + criticalOnes.length + ' High/Critical stages (' + criticalOnes.map(function (s) { return s.name; }).join(', ') + ').', why: 'Two or more stages marked High or Critical criticality share the same named owner.' });
      }
    });

    (d.handoffs || []).forEach(function (h) {
      var health = handoffHealth(vs, h);
      var fromStage = byId(stages, h.fromStageId), toStage = byId(stages, h.toStageId);
      var highVolume = fromStage && (fromStage.volume === 'High' || fromStage.volume === 'Very High');
      if (highVolume && !h.acceptableDefinition) {
        flags.push({ severity: 'critical', rule: 'High-Volume Handoff Without Standard', message: 'The handoff from "' + (fromStage ? fromStage.name : '?') + '" to "' + (toStage ? toStage.name : '?') + '" is high-volume with no acceptance standard.', why: 'Feeding stage volume is High/Very High and the handoff has no acceptance definition.' });
      }
    });

    (d.queues || []).forEach(function (q) {
      if (!q.owner) flags.push({ severity: 'warning', rule: 'Queue Without Owner', message: '"' + q.name + '" has no named owner.', why: 'The owner field for this queue is empty.' });
    });

    stages.forEach(function (s) {
      if ((s.criticality === 'High' || s.criticality === 'Critical') && !isYes(s.hasBackup)) {
        flags.push({ severity: 'critical', rule: 'Critical Stage Without Backup', message: '"' + s.name + '" is marked ' + s.criticality + ' criticality with no backup owner.', why: 'Stage criticality is High/Critical and "backup owner exists" is not checked.' });
      }
    });

    var manualTransfers = (d.handoffs || []).filter(function (h) { return isYes(h.manualReentry); }).length;
    if (manualTransfers >= 2) {
      flags.push({ severity: 'warning', rule: 'Multiple Manual System Transfers', message: manualTransfers + ' handoffs require manual re-entry of information between systems.', why: 'Two or more handoffs have "requires manual re-entry" checked.' });
    }

    var flow = calcFlow(vs, 'current');
    if (flow.totalWorkHours > 0 && flow.totalWaitHours / flow.totalWorkHours >= 5) {
      flags.push({ severity: 'warning', rule: 'High Wait / Low Work Ratio', message: 'Total wait time is ' + round1(flow.totalWaitHours / flow.totalWorkHours) + 'x total work time (' + fmtHours(flow.totalWaitHours) + ' waiting vs. ' + fmtHours(flow.totalWorkHours) + ' working).', why: 'Total wait hours are five times or more total work hours.' });
    }

    var frequentRework = (d.rework || []).filter(function (r) { return r.frequency === 'Frequent' || r.frequency === 'Often'; });
    if (frequentRework.length) {
      flags.push({ severity: 'warning', rule: 'Frequent Rework Loop', message: frequentRework.length + ' rework loop(s) marked Frequent or Often.', why: 'A rework entry\'s frequency is set to Frequent or Often.' });
    }

    var approvalsNoPurpose = (d.approvals || []).filter(function (a) { return !a.riskControlled; });
    if (approvalsNoPurpose.length && (d.approvals || []).length) {
      flags.push({ severity: 'info', rule: 'Approval With No Defined Risk Purpose', message: approvalsNoPurpose.length + ' of ' + d.approvals.length + ' approval(s) have no stated risk they control.', why: 'The "what risk does this control" field is empty for at least one approval.' });
    }

    if (flow.ownershipChanges >= 3) {
      flags.push({ severity: 'warning', rule: 'Process Owner Changes Multiple Times', message: 'Ownership changes ' + flow.ownershipChanges + ' times across the stream.', why: 'Three or more consecutive stage pairs have a different named owner.' });
    }

    if ((vs.criticality === 'High' || vs.criticality === 'Critical') && !vs.owner) {
      flags.push({ severity: 'critical', rule: 'Critical Value Stream Has No End-To-End Owner', message: 'This value stream is marked ' + vs.criticality + ' criticality but has no named end-to-end owner.', why: 'Value stream criticality is High/Critical and the Value Stream Owner field is empty.' });
    }

    var metrics = d.metrics || [];
    if (metrics.length && stages.length) {
      var lastStageId = stages[stages.length - 1].id;
      var onlyFinal = metrics.every(function (m) { return !m.stageId || m.stageId === lastStageId; });
      if (onlyFinal) {
        flags.push({ severity: 'warning', rule: 'Metric Only Exists At Final Output', message: 'Every metric tracked is measured at the last stage. There is no visibility into how the stream is performing before the end.', why: 'No metric names a stage earlier than the final one.' });
      }
    }
    if (metrics.length && !metrics.some(function (m) { return isYes(m.isEarlyWarning); })) {
      flags.push({ severity: 'info', rule: 'No Early Warning Signal', message: 'None of the tracked metrics are marked as an early warning signal.', why: 'No metric has "early warning signal" checked.' });
    }

    return flags;
  }

  /* ----------------------------------------------------------
     Section 32 — Local Optimum check between current and target
     ---------------------------------------------------------- */

  function localOptimumCheck(vs) {
    if (!vs.data.hasTargetState || !vs.data.targetStages) return [];
    var findings = [];
    var current = vs.data.stages, target = vs.data.targetStages;

    target.forEach(function (ts) {
      var cs = byId(current, ts.sourceStageId || ts.id);
      if (!cs) return;
      var curWork = toHours(cs.workTimeValue, cs.workTimeUnit);
      var tgtWork = toHours(ts.workTimeValue, ts.workTimeUnit);
      if (tgtWork < curWork) {
        var idx = target.indexOf(ts);
        var downstream = target.slice(idx + 1);
        var worseDownstream = downstream.filter(function (d2) {
          var origDownstream = byId(current, d2.sourceStageId || d2.id);
          if (!origDownstream) return false;
          return toHours(d2.waitTimeValue, d2.waitTimeUnit) > toHours(origDownstream.waitTimeValue, origDownstream.waitTimeUnit);
        });
        if (worseDownstream.length) {
          findings.push({
            severity: 'warning', rule: 'Possible Local Optimum',
            message: '"' + ts.name + '" reduced its work time, but wait time increased downstream at ' + worseDownstream.map(function (d2) { return '"' + d2.name + '"'; }).join(', ') + '.',
            why: 'Improving one stage in isolation can push the burden it removed onto the stage after it, without improving the system overall.'
          });
        }
      }
    });

    return findings;
  }

  /* ----------------------------------------------------------
     Section 16 — Where Is Value Waiting?
     ---------------------------------------------------------- */

  function whereIsValueWaiting(vs) {
    var flow = calcFlow(vs, 'current');
    var locations = [];
    (vs.data.stages || []).forEach(function (s) {
      var hrs = toHours(s.waitTimeValue, s.waitTimeUnit);
      if (hrs > 0) locations.push({ label: s.name, type: 'Stage Wait', hours: hrs, owner: s.owner, system: s.system });
    });
    (vs.data.queues || []).forEach(function (q) {
      var hrs = toHours(q.avgWaitTimeValue, q.avgWaitTimeUnit);
      if (hrs > 0) locations.push({ label: q.name, type: 'Queue', hours: hrs, owner: q.owner, system: null });
    });
    (vs.data.approvals || []).forEach(function (a) {
      var hrs = toHours(a.waitTimeValue, a.waitTimeUnit);
      if (hrs > 0) locations.push({ label: a.decision, type: 'Approval', hours: hrs, owner: a.approver, system: null });
    });
    locations.sort(function (a, b) { return b.hours - a.hours; });
    return locations.map(function (l) {
      return Object.assign({}, l, { pctOfLead: flow.totalLeadHours > 0 ? round1((l.hours / flow.totalLeadHours) * 100) : 0 });
    });
  }

  /* ----------------------------------------------------------
     Sections 22-24 — Trace chains. Each node is labeled by how
     confident OMS is: OBSERVED (a direct computed fact), ENTERED (the
     user typed this), or INFERRED (OMS connected two entered facts).
     ---------------------------------------------------------- */

  function traceDelay(vs, locationType, locationLabel) {
    var chain = [];
    var flow = calcFlow(vs, 'current');
    if (locationType === 'Queue') {
      var q = (vs.data.queues || []).filter(function (x) { return x.name === locationLabel; })[0];
      if (q) {
        chain.push({ label: locationLabel + ' has a wait', confidence: 'OBSERVED' });
        if (q.commonReason) chain.push({ label: q.commonReason, confidence: 'ENTERED' });
        var arrival = parseFloat(q.arrivalRate), processing = parseFloat(q.processingRate);
        if (!isNaN(arrival) && !isNaN(processing) && arrival > processing) {
          chain.push({ label: 'Arrival rate (' + arrival + ') exceeds processing rate (' + processing + ')', confidence: 'OBSERVED' });
          chain.push({ label: 'Capacity below demand for this stage of work', confidence: 'INFERRED' });
        }
        if (isYes(q.noPrioritizationRule)) chain.push({ label: 'No rule exists for which item is worked next', confidence: 'ENTERED' });
        if (!q.owner) chain.push({ label: 'No one is named as accountable for this queue', confidence: 'ENTERED' });
      }
    } else if (locationType === 'Stage Wait') {
      var s = (vs.data.stages || []).filter(function (x) { return x.name === locationLabel; })[0];
      if (s) {
        chain.push({ label: locationLabel + ' has a wait before work starts', confidence: 'OBSERVED' });
        var incoming = (vs.data.handoffs || []).filter(function (h) { return h.toStageId === s.id; })[0];
        if (incoming) {
          var health = handoffHealth(vs, incoming);
          if (health.status === 'Weak' || health.status === 'Critical') {
            chain.push({ label: 'The handoff feeding this stage is rated ' + health.status, confidence: 'OBSERVED' });
            chain.push({ label: 'Work sits waiting for a clean, confirmed handoff', confidence: 'INFERRED' });
          }
        }
        if (s.commonException) chain.push({ label: 'Common exception at this stage: ' + s.commonException, confidence: 'ENTERED' });
      }
    } else if (locationType === 'Approval') {
      var a = (vs.data.approvals || []).filter(function (x) { return x.decision === locationLabel; })[0];
      if (a) {
        chain.push({ label: locationLabel + ' requires approval before proceeding', confidence: 'OBSERVED' });
        if (!a.threshold) chain.push({ label: 'No threshold exists to route common, low-risk cases around case-by-case approval', confidence: 'ENTERED' });
        if (a.approver) chain.push({ label: 'Every case routes to ' + a.approver + ' regardless of risk', confidence: 'ENTERED' });
      }
    }
    return chain;
  }

  function traceRework(vs, reworkId) {
    var r = byId(vs.data.rework, reworkId);
    if (!r) return [];
    var chain = [];
    var fromStage = byId(vs.data.stages, r.fromStageId), toStage = byId(vs.data.stages, r.toStageId);
    chain.push({ label: (toStage ? toStage.name : 'Work') + ' returns to ' + (fromStage ? fromStage.name : 'an earlier stage'), confidence: 'OBSERVED' });
    if (r.cause) chain.push({ label: r.cause, confidence: 'ENTERED' });
    if (r.missingInfo) chain.push({ label: 'Missing information: ' + r.missingInfo, confidence: 'ENTERED' });
    if (r.relatedHandoffId) {
      var h = byId(vs.data.handoffs, r.relatedHandoffId);
      if (h && !h.acceptableDefinition) chain.push({ label: 'The handoff that feeds this stage has no defined acceptance criteria', confidence: 'INFERRED' });
    }
    return chain;
  }

  function traceEscalation(vs, approvalId) {
    var a = byId(vs.data.approvals, approvalId);
    if (!a) return [];
    var chain = [];
    chain.push({ label: a.decision + ' cannot be resolved at the level it first reaches', confidence: 'OBSERVED' });
    if (!a.threshold) chain.push({ label: 'No threshold defines what can be decided without escalating', confidence: 'ENTERED' });
    if (!a.escalation) chain.push({ label: 'Authority for exceptions is unclear', confidence: 'INFERRED' });
    chain.push({ label: 'Likely a Decision Rights gap, not a people problem', confidence: 'INFERRED' });
    return chain;
  }

  /* ----------------------------------------------------------
     Section 30 — Change impact between current and target state
     ---------------------------------------------------------- */

  function changeImpact(vs) {
    if (!vs.data.hasTargetState) return null;
    var current = calcFlow(vs, 'current');
    var target = calcFlow(vs, 'target');
    return {
      current: current, target: target,
      leadTimeDeltaHours: current.totalLeadHours - target.totalLeadHours,
      handoffDelta: current.handoffCount - target.handoffCount,
      approvalDelta: current.approvalCount - target.approvalCount,
      systemChangeDelta: current.systemChanges - target.systemChanges,
      waitRemovedHours: current.totalWaitHours - target.totalWaitHours
    };
  }

  var FUTURE_STATE_CHALLENGE_QUESTIONS = [
    'Did we remove work, or merely move it somewhere else in the stream?',
    'Did we reduce waiting, or just relabel it?',
    'Did we remove a required control, or route it around risk?',
    'Did we move a bottleneck instead of resolving it?',
    'Did we create excessive utilization anywhere in the redesigned flow?',
    'Did we increase dependency on one person?',
    'Did we simplify how information moves, or add another system to it?',
    'Did we reduce unnecessary approvals, or just rename them?',
    'Did we preserve what the customer actually values?',
    'Did we introduce a new failure point while removing an old one?'
  ];

  global.OMSValueStream = {
    STORAGE_KEY: STORAGE_KEY,
    newId: newId,
    blankData: blankData,
    store: store,
    logActivity: logActivity,
    byId: byId,
    isYes: isYes,
    toHours: toHours,
    fmtHours: fmtHours,
    stagesFor: stagesFor,
    calcFlow: calcFlow,
    detectPotentialHandoffs: detectPotentialHandoffs,
    queueSignals: queueSignals,
    handoffFlags: handoffFlags,
    handoffHealth: handoffHealth,
    riskAnalysis: riskAnalysis,
    localOptimumCheck: localOptimumCheck,
    whereIsValueWaiting: whereIsValueWaiting,
    traceDelay: traceDelay,
    traceRework: traceRework,
    traceEscalation: traceEscalation,
    changeImpact: changeImpact,
    FUTURE_STATE_CHALLENGE_QUESTIONS: FUTURE_STATE_CHALLENGE_QUESTIONS
  };
})(window);
