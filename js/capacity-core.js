/*
 * Operations Maturity System
 * Capacity Intelligence — data model, persistence, and analysis engine.
 *
 * Answers WHY work is waiting, once Value Stream Intelligence has already
 * shown WHERE it waits. The central discipline this file enforces:
 *
 *   A queue is evidence of imbalance. It is not proof that headcount is
 *   the constraint.
 *
 * Capacity is not headcount. It is the amount of useful work the system
 * can reliably produce — which is why this file keeps headcount,
 * available hours, skilled hours, productive capacity, and system
 * capacity as distinct, separately-calculated numbers rather than
 * collapsing them into one.
 *
 * Responsible for:
 * - the Capacity Model data model and its localStorage persistence
 * - transparent capacity math: scheduled → effective → output capacity,
 *   demand vs. capacity, buffer, utilization
 * - the capacity waterfall (where theoretical capacity actually goes)
 * - Rework Capacity Tax, Failure Demand, Meeting Capacity Tax
 * - deterministic Capacity Findings and the "Is This Really A Capacity
 *   Problem?" diagnosis signal — never a validated root cause
 * - stress tests, a 2x scale test, and scenario comparison
 * - a transparent headcount requirement estimate (only when asked for)
 *
 * Nothing here is scientific, benchmarked, or certified. Every number is
 * a named, explainable calculation over what a user actually entered.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'capacitymodels';

  /* ----------------------------------------------------------
     Persistence
     ---------------------------------------------------------- */

  function newId(prefix) {
    return (prefix || 'cap') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var LOSS_CATEGORIES = ['Coaching', 'Training', 'Administration', 'Breaks', 'System Downtime', 'PTO / Absence', 'Internal Projects', 'Quality Reviews', 'Required Documentation', 'Coordination', 'Context Switching', 'Other'];

  function blankData() {
    return {
      subjectType: '', relatedBlueprintProjectId: '', relatedBlueprintType: '', relatedBlueprintId: '',
      relatedValueStreamId: '', relatedValueStreamStageId: '', relatedQueueId: '', relatedProcessId: '',
      timePeriod: 'Weekly', unitOfWork: '',
      demand: { minimum: '', typical: '', peak: '', pattern: '', patternNote: '' },
      workTypes: [],
      resources: { numberOfPeople: '', scheduledHoursPerPerson: '', workingDaysPerPeriod: '', hoursPerDay: '' },
      capacityLosses: [],
      productivity: { avgRateValue: '', avgRateUnit: 'per hour' },
      queue: { name: '', arrivalRate: '', processingRate: '', waitTimeValue: '', waitTimeUnit: 'hours', queueSize: '', importedFromValueStream: false, sourceQueueId: '' },
      diagnosisAnswers: {},
      distribution: [],
      skills: [],
      allocation: { method: '', matchesWorkNote: '', agingIssue: false, cherryPicking: false, managerBottleneck: false },
      priorityLoad: [],
      rework: { pctOfCapacity: '', note: '', importedFromValueStream: false },
      failureDemand: [],
      meetings: [],
      contextSwitching: { queueCount: '', isHigh: false, note: '' },
      concentrationRisks: [],
      capacityOwner: '',
      operatingRhythm: { frequency: '', inputs: '', participants: '', decisions: '', actions: '' },
      forecast: { lowCase: '', expectedCase: '', highCase: '', period: '' },
      earlyWarningSignals: [],
      bufferAssumptionPct: '',
      scenarios: [],
      targetState: null,
      hasTargetState: false,
      findings: [],
      activity: []
    };
  }

  function loadAll() { return global.OMSData.storage.get(STORAGE_KEY, []); }
  function saveAll(list) { global.OMSData.storage.set(STORAGE_KEY, list); }

  var store = {
    list: function () { return loadAll(); },
    get: function (id) { return loadAll().filter(function (m) { return m.id === id; })[0] || null; },
    create: function (name, data, isSample) {
      var now = new Date().toISOString();
      var model = { id: newId(), name: name || 'New Capacity Model', owner: '', createdAt: now, updatedAt: now, isSample: !!isSample, currentStep: 0, data: data || blankData() };
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
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

  /* ----------------------------------------------------------
     Period conversion — every rate/loss is entered against a unit;
     everything is normalized to "per model period" (the time period
     chosen in Section 2) for the actual math.
     ---------------------------------------------------------- */

  var PERIOD_DAYS = { Daily: 1, Weekly: 5, Monthly: 21.7, Custom: 5 };

  function periodDays(model) { return PERIOD_DAYS[model.data.timePeriod] || PERIOD_DAYS.Weekly; }

  function hoursToUnit(hours, unit) {
    if (unit === 'minutes') return hours * 60;
    if (unit === 'days') return hours / 24;
    return hours;
  }
  function unitToHours(value, unit) { return num(value) * (unit === 'minutes' ? (1 / 60) : unit === 'days' ? 24 : 1); }

  /* ----------------------------------------------------------
     Section 6/8 — Scheduled vs. Effective Capacity
     ---------------------------------------------------------- */

  function scheduledHours(model) {
    var r = model.data.resources;
    return num(r.numberOfPeople) * num(r.workingDaysPerPeriod) * num(r.hoursPerDay);
  }

  function meetingHoursPerPeriod(model) {
    var days = periodDays(model);
    var freqPerPeriod = { Daily: days, Weekly: days / 5, Monthly: days / 21.7, 'One-time': 0 };
    return (model.data.meetings || []).reduce(function (sum, m) {
      var occurrences = freqPerPeriod[m.frequency] != null ? freqPerPeriod[m.frequency] : 1;
      return sum + (num(m.participants) * num(m.durationHours) * occurrences);
    }, 0);
  }

  function lossBreakdown(model) {
    var schedHours = scheduledHours(model);
    var meetingHours = meetingHoursPerPeriod(model);
    var lines = [{ category: 'Meetings', hours: meetingHours, computed: true }];
    (model.data.capacityLosses || []).forEach(function (l) {
      var hrs = l.mode === 'Percent' ? schedHours * (num(l.value) / 100) : num(l.value);
      lines.push({ category: l.category, hours: hrs, computed: false });
    });
    return lines;
  }

  function totalLossHours(model) {
    return lossBreakdown(model).reduce(function (sum, l) { return sum + l.hours; }, 0);
  }

  function effectiveCapacityHours(model) {
    return Math.max(0, scheduledHours(model) - totalLossHours(model));
  }

  /* ----------------------------------------------------------
     Section 9/10 — Productive / Output Capacity, Demand vs. Capacity
     ---------------------------------------------------------- */

  function productiveRatePerHour(model) {
    var p = model.data.productivity;
    var v = num(p.avgRateValue);
    if (!v) return 0;
    if (p.avgRateUnit === 'per day') return v / num(model.data.resources.hoursPerDay || 8);
    if (p.avgRateUnit === 'per week') return v / (5 * num(model.data.resources.hoursPerDay || 8));
    return v;
  }

  function outputCapacityUnits(model) {
    return round0(effectiveCapacityHours(model) * productiveRatePerHour(model));
  }

  function reworkDemandUnits(model) {
    var pct = num(model.data.rework.pctOfCapacity);
    if (!pct) return 0;
    var cap = outputCapacityUnits(model);
    return round0(cap * (pct / 100));
  }

  function failureDemandUnits(model) {
    return (model.data.failureDemand || []).reduce(function (sum, f) { return sum + num(f.volumePerPeriod); }, 0);
  }

  function round0(n) { return Math.round(n); }
  function round1(n) { return Math.round(n * 10) / 10; }

  function demandCapacityBalance(model) {
    var d = model.data.demand;
    var typical = num(d.typical);
    var peak = num(d.peak);
    var minimum = num(d.minimum);
    var capacity = outputCapacityUnits(model);
    var reworkUnits = reworkDemandUnits(model);
    var failureUnits = failureDemandUnits(model);
    var totalTypicalLoad = typical + reworkUnits + failureUnits;
    var totalPeakLoad = (peak || typical) + reworkUnits + failureUnits;

    return {
      minimum: minimum, typical: typical, peak: peak || typical,
      capacity: capacity, reworkUnits: reworkUnits, failureUnits: failureUnits,
      totalTypicalLoad: totalTypicalLoad, totalPeakLoad: totalPeakLoad,
      typicalBuffer: round0(capacity - totalTypicalLoad),
      peakBuffer: round0(capacity - totalPeakLoad),
      bufferPct: capacity > 0 ? round1(((capacity - totalTypicalLoad) / capacity) * 100) : null,
      utilization: capacity > 0 ? round1((totalTypicalLoad / capacity) * 100) : null,
      peakUtilization: capacity > 0 ? round1((totalPeakLoad / capacity) * 100) : null
    };
  }

  /* ----------------------------------------------------------
     Section 12 — Utilization banding. Prototype thresholds, labeled
     as such, never presented as scientific fact.
     ---------------------------------------------------------- */

  function utilizationBand(pct) {
    if (pct == null) return { band: 'Unknown', note: 'Not enough data to estimate utilization yet.' };
    if (pct < 60) return { band: 'Low Utilization', note: 'Capacity is comfortably ahead of typical demand.' };
    if (pct < 85) return { band: 'Balanced', note: 'Demand and capacity are roughly matched, with room to absorb normal variation.' };
    if (pct < 100) return { band: 'High Utilization', note: 'Little slack remains. Normal variability will start to produce visible wait.' };
    return { band: 'Fragile', note: 'Demand meets or exceeds capacity. A system operating permanently at maximum utilization has almost no ability to absorb variability.' };
  }

  /* ----------------------------------------------------------
     Section 15 — Basic queue behavior
     ---------------------------------------------------------- */

  function queueBehavior(model) {
    var q = model.data.queue;
    var arrival = num(q.arrivalRate), processing = num(q.processingRate);
    if (!arrival || !processing) return null;
    var structurallyGrowing = arrival > processing;
    return {
      arrivalRate: arrival, processingRate: processing, structurallyGrowing: structurallyGrowing,
      message: structurallyGrowing
        ? 'Work is arriving (' + arrival + '/period) faster than it can be processed (' + processing + '/period). If this holds for a sustained period, the backlog will keep growing unless something changes.'
        : 'Processing rate (' + processing + '/period) currently keeps pace with arrivals (' + arrival + '/period).'
    };
  }

  /* ----------------------------------------------------------
     Section 16 — "Is This Really A Capacity Problem?"
     Twelve yes/no/unknown questions, mapped to candidate signals.
     Never a validated diagnosis — always "systems to investigate."
     ---------------------------------------------------------- */

  var DIAGNOSIS_QUESTIONS = [
    { id: 'backlogRising', text: 'Is backlog rising?', signals: ['LIKELY TRUE CAPACITY SHORTAGE'] },
    { id: 'demandAboveOutput', text: 'Is demand above output capacity?', signals: ['LIKELY TRUE CAPACITY SHORTAGE'] },
    { id: 'waitDespiteAvailable', text: 'Is work waiting despite available people?', signals: ['LIKELY CAPACITY DISTRIBUTION PROBLEM', 'LIKELY PRIORITIZATION PROBLEM'] },
    { id: 'reworkConsuming', text: 'Is rework consuming capacity?', signals: ['LIKELY PROCESS / REWORK PROBLEM'] },
    { id: 'approvalsWait', text: 'Are approvals creating wait?', signals: ['LIKELY DECISION BOTTLENECK'] },
    { id: 'skillImbalance', text: 'Is one skill group constrained while others have availability?', signals: ['LIKELY CAPACITY DISTRIBUTION PROBLEM'] },
    { id: 'prioritiesChanging', text: 'Are priorities frequently changing?', signals: ['LIKELY PRIORITIZATION PROBLEM'] },
    { id: 'workOutsideProcess', text: 'Are people doing work outside the intended process?', signals: ['LIKELY PROCESS / REWORK PROBLEM'] },
    { id: 'workloadVaries', text: 'Does workload vary significantly?', signals: ['LIKELY DEMAND VARIABILITY PROBLEM'] },
    { id: 'waitingOnDecisions', text: 'Is the queue mostly waiting for decisions?', signals: ['LIKELY DECISION BOTTLENECK'] },
    { id: 'waitingOnInfo', text: 'Is the queue mostly waiting for information?', signals: ['LIKELY INFORMATION / HANDOFF PROBLEM'] },
    { id: 'concentratedWorkType', text: 'Is the queue concentrated in one work type?', signals: ['LIKELY WORK-MIX PROBLEM'] }
  ];

  function capacityDiagnosis(model) {
    var answers = model.data.diagnosisAnswers || {};
    var answered = DIAGNOSIS_QUESTIONS.filter(function (q) { return answers[q.id] === 'Yes' || answers[q.id] === 'No'; });
    if (answered.length < 4) {
      return { signal: 'INSUFFICIENT EVIDENCE', tally: {}, message: 'Answer more of the questions below for OMS to suggest which systems to investigate.' };
    }
    var tally = {};
    DIAGNOSIS_QUESTIONS.forEach(function (q) {
      if (answers[q.id] !== 'Yes') return;
      q.signals.forEach(function (s) { tally[s] = (tally[s] || 0) + 1; });
    });
    var ranked = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; });
    if (!ranked.length) return { signal: 'INSUFFICIENT EVIDENCE', tally: tally, message: 'None of the "yes" answers point at a specific system yet.' };
    return {
      signal: ranked[0], tally: tally,
      message: ranked.length > 1 ? 'Also worth investigating: ' + ranked.slice(1).join(', ') + '.' : 'This is the strongest signal from the answers given.'
    };
  }

  /* ----------------------------------------------------------
     Section 21/22/23 — Capacity taxes
     ---------------------------------------------------------- */

  function reworkTax(model) {
    var pct = num(model.data.rework.pctOfCapacity);
    var cap = outputCapacityUnits(model);
    return { pct: pct, units: reworkDemandUnits(model), capacity: cap };
  }

  function failureDemandSummary(model) {
    var items = model.data.failureDemand || [];
    var totalVolume = items.reduce(function (s, f) { return s + num(f.volumePerPeriod); }, 0);
    var totalHours = items.reduce(function (s, f) { return s + (num(f.volumePerPeriod) * unitToHours(f.avgEffortValue, f.avgEffortUnit)); }, 0);
    return { items: items, totalVolume: totalVolume, totalHours: totalHours };
  }

  function meetingTax(model) {
    var hours = meetingHoursPerPeriod(model);
    var schedHours = scheduledHours(model);
    return { hours: round1(hours), pctOfScheduled: schedHours > 0 ? round1((hours / schedHours) * 100) : null };
  }

  /* ----------------------------------------------------------
     Section 32 — Capacity Findings. Deterministic, explained.
     ---------------------------------------------------------- */

  function findings(model) {
    var flags = [];
    var d = demandCapacityBalance(model);
    var util = utilizationBand(d.utilization);

    if (d.capacity > 0 && d.totalTypicalLoad > d.capacity) {
      flags.push({ severity: 'critical', rule: 'Demand Exceeds Capacity', message: 'Typical demand plus rework and failure demand (' + d.totalTypicalLoad + ' ' + (model.data.unitOfWork || 'units') + ') exceeds estimated output capacity (' + d.capacity + ').', why: 'Total typical load is greater than calculated output capacity.' });
    }
    if (d.capacity > 0 && d.totalPeakLoad > d.capacity && d.totalTypicalLoad <= d.capacity) {
      flags.push({ severity: 'warning', rule: 'Peak Demand Exceeds Buffer', message: 'Typical demand fits within capacity, but peak demand (' + d.totalPeakLoad + ') does not (' + d.capacity + ').', why: 'Total peak load exceeds output capacity while typical load does not.' });
    }
    if (d.bufferPct != null && d.bufferPct >= 0 && d.bufferPct < 8) {
      flags.push({ severity: 'warning', rule: 'Very Low Capacity Buffer', message: 'Buffer is only ' + d.bufferPct + '% of capacity, leaving little room to absorb normal variation.', why: 'Buffer is positive but under 8% of output capacity.' });
    }
    var qb = queueBehavior(model);
    if (qb && qb.structurallyGrowing) {
      flags.push({ severity: 'critical', rule: 'Queue Structurally Growing', message: qb.message, why: 'Arrival rate exceeds processing rate.' });
    }
    var rt = reworkTax(model);
    if (rt.pct >= 10) {
      flags.push({ severity: 'warning', rule: 'Rework Consuming Material Capacity', message: rt.pct + '% of output capacity is estimated to go toward rework rather than new demand.', why: 'Rework is entered as 10% or more of capacity.' });
    }
    var fd = failureDemandSummary(model);
    if (fd.totalVolume > 0 && d.typical > 0 && (fd.totalVolume / d.typical) >= 0.1) {
      flags.push({ severity: 'warning', rule: 'Failure Demand High', message: 'Failure demand (' + fd.totalVolume + ') is ' + round1((fd.totalVolume / d.typical) * 100) + '% of typical productive demand.', why: 'Failure demand volume is 10% or more of typical demand.' });
    }
    var mt = meetingTax(model);
    if (mt.pctOfScheduled != null && mt.pctOfScheduled >= 15) {
      flags.push({ severity: 'warning', rule: 'Meeting Load High', message: 'Meetings consume an estimated ' + mt.pctOfScheduled + '% of scheduled time (' + mt.hours + ' hours/period).', why: 'Computed meeting hours are 15% or more of scheduled hours.' });
    }
    (model.data.skills || []).forEach(function (s) {
      if (isYes(s.isBottleneck)) flags.push({ severity: 'critical', rule: 'Skill Bottleneck', message: '"' + s.name + '" depends on ' + (s.peopleCount || 'a small number of') + ' people for ' + (s.criticalWorkPct || 'a significant share of') + '% of critical work.', why: 'This skill is flagged as a bottleneck.' });
    });

    var distByStage = model.data.distribution || [];
    var overloaded = distByStage.filter(function (x) { return num(x.demandLoadPct) > 100; });
    if (overloaded.length) {
      flags.push({ severity: 'warning', rule: 'Capacity Unevenly Distributed', message: overloaded.map(function (x) { return x.name + ' (' + x.demandLoadPct + '%)'; }).join(', ') + ' exceed 100% demand load while overall capacity may look sufficient.', why: 'At least one distribution entry exceeds 100% demand load.' });
    }

    var topWorkType = (model.data.workTypes || []).slice().sort(function (a, b) { return num(b.pctVolume) - num(a.pctVolume); })[0];
    if (topWorkType && num(topWorkType.pctVolume) >= 60 && topWorkType.reworkLikelihood === 'High') {
      flags.push({ severity: 'info', rule: 'Work Mix Driving Load', message: '"' + topWorkType.name + '" is ' + topWorkType.pctVolume + '% of volume and marked High rework likelihood.', why: 'The dominant work type carries 60% or more of volume and High rework likelihood.' });
    }

    var priorityLoad = model.data.priorityLoad || [];
    var highPriorityPct = priorityLoad.filter(function (p) { return p.priority === 'Critical' || p.priority === 'High'; }).reduce(function (s, p) { return s + num(p.pctOfWork); }, 0);
    if (priorityLoad.length && highPriorityPct >= 70) {
      flags.push({ severity: 'warning', rule: 'Excessive Priority Work', message: highPriorityPct + '% of work is classified Critical or High priority.', why: 'Critical + High priority work is 70% or more of total. Priority only works when something is allowed not to be priority.' });
    }

    var ownerConcentration = {};
    (model.data.skills || []).forEach(function (s) { if (num(s.peopleCount) === 1) ownerConcentration[s.name] = true; });
    if (Object.keys(ownerConcentration).length >= 1 && (model.data.concentrationRisks || []).some(function (c) { return c.type === 'Person'; })) {
      flags.push({ severity: 'critical', rule: 'Key Person Dependency', message: 'Critical work depends on a single named person with no backup.', why: 'A concentration risk of type Person is recorded alongside a single-person skill group.' });
    }

    var decisionDelayHours = num(model.data.queue.waitTimeValue) > 0 && model.data.diagnosisAnswers.waitingOnDecisions === 'Yes';
    if (decisionDelayHours) {
      flags.push({ severity: 'warning', rule: 'Decision Delay Consuming Flow', message: 'The queue is reported as mostly waiting on decisions, not on processing capacity.', why: '"Is the queue mostly waiting for decisions?" was answered Yes.' });
    }

    if (model.data.allocation.method === 'Manager Assigned' && isYes(model.data.allocation.managerBottleneck)) {
      flags.push({ severity: 'warning', rule: 'Manual Allocation Bottleneck', message: 'Work allocation depends on manager routing, which is flagged as a bottleneck.', why: 'Allocation method is Manager Assigned and the manager-bottleneck flag is set.' });
    }
    if (isYes(model.data.contextSwitching.isHigh)) {
      flags.push({ severity: 'info', rule: 'High Context Switching', message: 'Context switching across queues or work types is flagged as high, a likely productivity loss even without a precise measurement.', why: '"High context switching" is checked.' });
    }
    if (!model.owner && !model.data.capacityOwner) {
      flags.push({ severity: 'warning', rule: 'No Capacity Owner', message: 'Nobody is named as accountable for balancing demand and capacity here.', why: 'Both the model owner and capacity owner fields are empty.' });
    }
    if (!model.data.demand.typical && !model.data.demand.peak) {
      flags.push({ severity: 'warning', rule: 'No Demand Forecast', message: 'No demand figures have been entered yet.', why: 'Typical and peak demand are both empty.' });
    }
    if (!model.data.resources.numberOfPeople || !model.data.productivity.avgRateValue) {
      flags.push({ severity: 'info', rule: 'Unknown Effective Capacity', message: 'Resources or productivity are incomplete, so output capacity is only a partial estimate.', why: 'Number of people or average productive rate is missing.' });
    }

    return flags;
  }

  /* ----------------------------------------------------------
     Section 26/27 — Stress tests & 2x scale test
     ---------------------------------------------------------- */

  function runStressTest(model, assumptions) {
    var d = demandCapacityBalance(model);
    var demandMult = 1 + (num(assumptions.demandChangePct) / 100);
    var capMult = 1 - (num(assumptions.capacityChangePct) / 100);
    var reworkMult = assumptions.reworkMultiplier ? num(assumptions.reworkMultiplier) : 1;
    var peopleOut = num(assumptions.peopleUnavailable) || 0;
    var peopleTotal = num(model.data.resources.numberOfPeople) || 0;
    var peopleFactor = peopleTotal > 0 ? Math.max(0, (peopleTotal - peopleOut) / peopleTotal) : 1;

    var testedCapacity = round0(d.capacity * capMult * peopleFactor);
    var testedDemand = round0((d.typical * demandMult) + (d.reworkUnits * reworkMult) + d.failureUnits);
    var buffer = testedCapacity - testedDemand;

    return {
      demand: testedDemand, capacity: testedCapacity, buffer: buffer,
      backlogRisk: buffer < 0 ? 'Backlog likely to grow' : (testedCapacity > 0 && (testedDemand / testedCapacity) >= 0.95 ? 'Little margin left' : 'Likely to hold')
    };
  }

  function scaleTest(model, multiplier) {
    multiplier = multiplier || 2;
    var d = demandCapacityBalance(model);
    var testedDemand = round0(d.typical * multiplier + d.reworkUnits + d.failureUnits);
    var pctOfCapacity = d.capacity > 0 ? round1((testedDemand / d.capacity) * 100) : null;
    var constrainedDistribution = (model.data.distribution || []).filter(function (x) { return num(x.demandLoadPct) * multiplier > 100; });
    var constrainedSkills = (model.data.skills || []).filter(function (s) { return isYes(s.isBottleneck); });
    return {
      multiplier: multiplier, testedDemand: testedDemand, capacity: d.capacity, pctOfCapacity: pctOfCapacity,
      constrainedDistribution: constrainedDistribution, constrainedSkills: constrainedSkills,
      queueLikelyToGrow: !!(queueBehavior(model) && d.capacity > 0 && testedDemand > d.capacity)
    };
  }

  /* ----------------------------------------------------------
     Section 30 — Headcount requirement estimate
     ---------------------------------------------------------- */

  function headcountEstimate(model) {
    var d = model.data.demand;
    var target = num(d.typical) + reworkDemandUnits(model) + failureDemandUnits(model);
    var rate = productiveRatePerHour(model);
    if (!rate || !target) return null;
    var hoursNeeded = target / rate;
    var perPersonHours = effectiveCapacityHours(model) / (num(model.data.resources.numberOfPeople) || 1);
    if (!perPersonHours) return null;
    var baseNeed = hoursNeeded / perPersonHours;
    var bufferPct = num(model.data.bufferAssumptionPct) || 0;
    var withBuffer = baseNeed * (1 + bufferPct / 100);
    return {
      baseOperatingNeed: round1(baseNeed), bufferPct: bufferPct,
      estimatedTotal: Math.ceil(withBuffer),
      currentPeople: num(model.data.resources.numberOfPeople)
    };
  }

  /* ----------------------------------------------------------
     Section 44 — current vs. target (subset of fields worth comparing)
     ---------------------------------------------------------- */

  function changeImpact(model) {
    if (!model.data.hasTargetState || !model.data.targetState) return null;
    var currentBalance = demandCapacityBalance(model);
    var targetModel = { data: Object.assign({}, model.data, model.data.targetState), owner: model.owner };
    var targetBalance = demandCapacityBalance(targetModel);
    return { current: currentBalance, target: targetBalance };
  }

  global.OMSCapacity = {
    STORAGE_KEY: STORAGE_KEY,
    LOSS_CATEGORIES: LOSS_CATEGORIES,
    DIAGNOSIS_QUESTIONS: DIAGNOSIS_QUESTIONS,
    newId: newId,
    blankData: blankData,
    store: store,
    logActivity: logActivity,
    byId: byId,
    isYes: isYes,
    periodDays: periodDays,
    scheduledHours: scheduledHours,
    meetingHoursPerPeriod: meetingHoursPerPeriod,
    lossBreakdown: lossBreakdown,
    totalLossHours: totalLossHours,
    effectiveCapacityHours: effectiveCapacityHours,
    productiveRatePerHour: productiveRatePerHour,
    outputCapacityUnits: outputCapacityUnits,
    demandCapacityBalance: demandCapacityBalance,
    utilizationBand: utilizationBand,
    queueBehavior: queueBehavior,
    capacityDiagnosis: capacityDiagnosis,
    reworkTax: reworkTax,
    failureDemandSummary: failureDemandSummary,
    meetingTax: meetingTax,
    findings: findings,
    runStressTest: runStressTest,
    scaleTest: scaleTest,
    headcountEstimate: headcountEstimate,
    changeImpact: changeImpact
  };
})(window);
