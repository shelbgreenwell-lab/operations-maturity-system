/*
 * Operations Maturity System
 * Operational Health — data model, persistence, and analysis engine.
 *
 * Knows whether the operating system is functioning as intended right now.
 * This is deliberately NOT maturity (how developed the system is) and NOT
 * performance (what results it produced) — a mature system can be
 * temporarily unhealthy, and a low-maturity system can temporarily hit its
 * performance targets. Health answers a narrower question: is the system
 * behaving the way it is supposed to behave, today, and what would tell us
 * before the outcome fails?
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'healthmodels';

  function newId(prefix) {
    return (prefix || 'health') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var SCOPE_TYPES = ['Organization', 'Capability', 'Team', 'Value Stream', 'Process', 'Critical System', 'Program', 'Custom'];
  var HEALTH_DIMENSIONS = ['Outcome', 'Flow', 'Quality', 'Capacity', 'Reliability', 'Customer', 'Employee', 'Data', 'Risk', 'Control', 'Decision', 'Governance', 'Custom'];
  var STATUS_VALUES = ['Healthy', 'Watch', 'Weak', 'Critical', 'Unknown'];
  var STATUS_MODES = ['Threshold', 'Judgment'];
  var DIRECTIONS = ['Higher Is Better', 'Lower Is Better', 'Target Range', 'Binary'];
  var THRESHOLD_SOURCES = ['Customer Requirement', 'SLA', 'Historical Baseline', 'Contract', 'Risk Tolerance', 'Capacity Limit', 'Operational Standard', 'Leadership Target', 'Benchmark', 'User Judgment', 'Unknown'];
  var REVIEW_RHYTHMS = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Ad hoc', 'Never'];
  var PERFORMANCE_STATUSES = ['On Target', 'Off Target', 'Unknown'];
  var STATUS_RANK = { Unknown: 0, Healthy: 1, Watch: 2, Weak: 3, Critical: 4 };

  function blankData() {
    return {
      scopeType: '', businessOutcome: '', performanceStatus: 'Unknown',
      relatedBlueprintProjectId: '', relatedBlueprintType: '', relatedBlueprintId: '',
      relatedValueStreamId: '', relatedCapacityModelId: '',
      dimensions: [], signalCascades: [],
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
      var model = { id: newId(), name: name || 'New Health Model', owner: '', createdAt: now, updatedAt: now, isSample: !!isSample, currentStep: 0, data: data || blankData() };
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
  function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }

  /* ----------------------------------------------------------
     Section 16, 19 — deterministic status from thresholds, or an
     explicit human judgment call. Never invents a threshold.
     ---------------------------------------------------------- */

  function dimensionStatus(dim) {
    if (dim.statusMode === 'Judgment') {
      var s = STATUS_VALUES.indexOf(dim.manualStatus) !== -1 ? dim.manualStatus : 'Unknown';
      return { status: s, why: dim.whyStatusNote || 'Status was set by explicit human judgment, not a threshold calculation.' };
    }

    var current = num(dim.currentValue);
    var target = num(dim.targetValue);
    var watch = num(dim.watchThreshold);
    var critical = num(dim.criticalThreshold);

    if (current === null) return { status: 'Unknown', why: 'No current value recorded yet.' };

    if (dim.direction === 'Binary') {
      if (dim.currentValue === 'Yes' || dim.currentValue === true) return { status: 'Healthy', why: 'Binary condition is met.' };
      if (dim.currentValue === 'No' || dim.currentValue === false) return { status: 'Critical', why: 'Binary condition is not met.' };
      return { status: 'Unknown', why: 'Binary condition value is not Yes/No.' };
    }

    if (target === null && watch === null && critical === null) {
      return { status: 'Unknown', why: 'A current value is recorded, but no target, watch, or critical threshold is set.' };
    }

    var lowerBetter = dim.direction === 'Lower Is Better';
    var better = function (a, b) { return lowerBetter ? a <= b : a >= b; };

    if (dim.direction === 'Target Range') {
      var band = watch !== null ? Math.abs(watch) : (critical !== null ? Math.abs(critical) : 0);
      var criticalBand = critical !== null ? Math.abs(critical) : band * 2;
      if (target === null) return { status: 'Unknown', why: 'Target Range direction needs a target value to measure deviation from.' };
      var dev = Math.abs(current - target);
      if (dev <= band) return { status: 'Healthy', why: 'Current value ' + current + ' is within ' + band + ' of target ' + target + '.' };
      if (dev <= criticalBand) return { status: 'Weak', why: 'Current value ' + current + ' has drifted ' + dev + ' from target ' + target + ', beyond the watch band but inside the critical band.' };
      return { status: 'Critical', why: 'Current value ' + current + ' has drifted ' + dev + ' from target ' + target + ', beyond the critical band.' };
    }

    if (target !== null && better(current, target)) {
      return { status: 'Healthy', why: 'Current value ' + current + ' meets or beats target ' + target + ' (' + dim.direction + ').' };
    }
    if (watch !== null && better(current, watch)) {
      return { status: 'Watch', why: 'Current value ' + current + ' has not reached target ' + (target === null ? '?' : target) + ', but is still within the watch threshold of ' + watch + '.' };
    }
    if (critical !== null && better(current, critical)) {
      return { status: 'Weak', why: 'Current value ' + current + ' is past the watch threshold of ' + (watch === null ? '?' : watch) + ', but has not reached the critical threshold of ' + critical + '.' };
    }
    if (critical !== null) {
      return { status: 'Critical', why: 'Current value ' + current + ' is past the critical threshold of ' + critical + '.' };
    }
    return { status: 'Unknown', why: 'Not enough thresholds are set to place this value.' };
  }

  function overallHealth(model) {
    var dims = model.data.dimensions || [];
    if (!dims.length) return { status: 'Unknown', why: 'No health dimensions defined yet.', dimension: null };
    var worst = null;
    dims.forEach(function (d) {
      var s = dimensionStatus(d);
      if (!worst || STATUS_RANK[s.status] > STATUS_RANK[worst.status]) worst = { status: s.status, why: s.why, dimension: d.name || 'Unnamed dimension' };
    });
    return worst;
  }

  /* ----------------------------------------------------------
     Section 21 — Health Trend. Simple, transparent, no SPC.
     ---------------------------------------------------------- */

  function trendForDimension(dim) {
    var pts = (dim.timeSeries || []).map(function (p) { return num(p.value); }).filter(function (v) { return v !== null; });
    if (pts.length < 3) return { label: 'Insufficient Data', why: 'Fewer than three data points recorded — at least three are needed to describe a trend.' };

    var lowerBetter = dim.direction === 'Lower Is Better';
    var neutral = dim.direction === 'Target Range' || dim.direction === 'Binary';
    var dirMul = lowerBetter ? -1 : 1;

    var diffs = [];
    for (var i = 1; i < pts.length; i++) diffs.push(pts[i] - pts[i - 1]);
    var avgAbs = pts.reduce(function (a, b) { return a + Math.abs(b); }, 0) / pts.length;
    var epsilon = Math.max(avgAbs * 0.05, 0.0001);

    // Classify each step as good/bad/flat rather than requiring every single
    // step to individually clear the noise band — a small step in a
    // consistent direction should still read as a trend, not "volatile".
    var goodDiffs = diffs.map(function (d) { return neutral ? d : d * dirMul; });
    var hasGood = goodDiffs.some(function (d) { return d > epsilon; });
    var hasBad = goodDiffs.some(function (d) { return d < -epsilon; });
    var allFlat = goodDiffs.every(function (d) { return Math.abs(d) <= epsilon; });

    if (neutral) {
      if (allFlat) return { label: 'Stable', why: 'Values changed by less than 5% between each recorded point.' };
      return { label: 'Volatile', why: 'Direction is not scored as better/worse for this dimension, and the recorded values are moving — review manually.' };
    }
    if (allFlat) return { label: 'Stable', why: 'Values changed by less than 5% between each recorded point.' };
    if (hasGood && hasBad) return { label: 'Volatile', why: 'The recorded points move in both directions rather than a consistent trend.' };
    if (hasGood) return { label: 'Improving', why: 'No recorded step moved in the worsening direction (' + dim.direction + ').' };
    return { label: 'Deteriorating', why: 'No recorded step moved in the improving direction (' + dim.direction + ').' };
  }

  /* ----------------------------------------------------------
     Section 22 — Health vs Performance quadrant. Guidance, not
     an automatic diagnosis.
     ---------------------------------------------------------- */

  var QUADRANTS = {
    'good|good': { label: 'Sustainable Performance', note: 'Results are on target and the operating system underneath them looks healthy.' },
    'good|weak': { label: 'At-Risk Performance', note: 'Results are on target today, but the system underneath them is showing weak or critical health signals. This is often what deteriorates before an outcome fails.' },
    'weak|good': { label: 'Strategy, Market, or Target Question', note: 'The operating system looks healthy, but results are still off target. The question may not be an operating problem — it may be strategy, market conditions, or the target itself.' },
    'weak|weak': { label: 'System Intervention Likely Required', note: 'Results are off target and the operating system is showing weak or critical health signals. This is the combination most likely to need direct intervention.' }
  };

  function quadrant(performanceStatus, healthStatus) {
    if (performanceStatus === 'Unknown' || !performanceStatus) return { label: null, note: 'Set a performance status to place this system on the quadrant.' };
    if (healthStatus === 'Unknown' || !healthStatus) return { label: null, note: 'At least one health dimension needs a status before this system can be placed on the quadrant.' };
    var perfKey = performanceStatus === 'On Target' ? 'good' : 'weak';
    var healthKey = (healthStatus === 'Healthy' || healthStatus === 'Watch') ? 'good' : 'weak';
    return QUADRANTS[perfKey + '|' + healthKey];
  }

  /* ----------------------------------------------------------
     Section 18, 23, 32, 45 — per-dimension coverage / quality
     ---------------------------------------------------------- */

  function dimensionFlags(dim) {
    var flags = [];
    if (!dim.signal) flags.push({ rule: 'No Signal Defined', message: 'No signal is recorded for what "healthy" looks like on "' + (dim.name || 'this dimension') + '".' });
    if (!dim.earlyWarning) flags.push({ rule: 'No Early Warning', message: 'No early-warning signal is defined — nothing is recorded that would change before the deterioration becomes visible.' });
    if (!dim.whoActs) flags.push({ rule: 'No Owner', message: 'No one is named as responsible for acting on this dimension.' });
    if (dim.statusMode === 'Threshold' && !dim.targetValue && !dim.watchThreshold && !dim.criticalThreshold) {
      flags.push({ rule: 'No Threshold', message: 'This dimension is set to threshold-based status, but no target, watch, or critical value is recorded.' });
    }
    if (!dim.reviewRhythm || dim.reviewRhythm === 'Never') flags.push({ rule: 'No Review Rhythm', message: 'No regular review rhythm is set for this dimension.' });
    if (!dim.decisionOnOffTrack) flags.push({ rule: 'No Decision', message: 'No decision is recorded for what happens when this dimension goes off track.' });
    return flags;
  }

  function modelFindings(model) {
    var flags = [];
    var dims = model.data.dimensions || [];
    if (!dims.length) {
      flags.push({ severity: 'warning', rule: 'No Health Dimensions', message: 'This health model has no dimensions defined yet — there is nothing to monitor.', why: 'Zero dimensions recorded.' });
      return flags;
    }
    if (!model.data.businessOutcome) {
      flags.push({ severity: 'info', rule: 'No Business Outcome Named', message: 'This health model has no named business outcome — health signals work best when tied to something that ultimately matters.', why: 'businessOutcome is blank.' });
    }
    var unknownCount = dims.filter(function (d) { return dimensionStatus(d).status === 'Unknown'; }).length;
    if (unknownCount === dims.length) {
      flags.push({ severity: 'warning', rule: 'All Dimensions Unknown', message: 'Every dimension in this model has an Unknown status — no current values or judgments have been recorded.', why: 'All ' + dims.length + ' dimensions resolve to Unknown.' });
    }
    var noEarlyWarning = dims.filter(function (d) { return !d.earlyWarning; }).length;
    if (dims.length >= 2 && noEarlyWarning === dims.length) {
      flags.push({ severity: 'warning', rule: 'No Early Warnings Anywhere', message: 'None of the ' + dims.length + ' dimensions have an early-warning signal defined. This model can only report a failure after it is visible, not before.', why: 'earlyWarning is blank on every dimension.' });
    }
    return flags;
  }

  /* ----------------------------------------------------------
     Section 23 — Early Warning Architecture. Reflective
     questions, not stored answers.
     ---------------------------------------------------------- */

  var EARLY_WARNING_QUESTIONS = [
    'What fails first?',
    'What changes before the failure becomes visible?',
    'What signal would show that change?',
    'Who should see it?',
    'How quickly should they act?'
  ];

  var THRESHOLD_CHALLENGE_QUESTION = 'Where did this threshold come from?';

  global.OMSHealth = {
    STORAGE_KEY: STORAGE_KEY,
    SCOPE_TYPES: SCOPE_TYPES, HEALTH_DIMENSIONS: HEALTH_DIMENSIONS, STATUS_VALUES: STATUS_VALUES,
    STATUS_MODES: STATUS_MODES, DIRECTIONS: DIRECTIONS, THRESHOLD_SOURCES: THRESHOLD_SOURCES,
    REVIEW_RHYTHMS: REVIEW_RHYTHMS, PERFORMANCE_STATUSES: PERFORMANCE_STATUSES, STATUS_RANK: STATUS_RANK,
    EARLY_WARNING_QUESTIONS: EARLY_WARNING_QUESTIONS, THRESHOLD_CHALLENGE_QUESTION: THRESHOLD_CHALLENGE_QUESTION,
    newId: newId, blankData: blankData, store: store, logActivity: logActivity, isYes: isYes,
    dimensionStatus: dimensionStatus, overallHealth: overallHealth, trendForDimension: trendForDimension,
    quadrant: quadrant, dimensionFlags: dimensionFlags, modelFindings: modelFindings
  };
})(window);
