/*
 * Operations Maturity System
 * Capacity Intelligence — page controller.
 *
 * Drives pages/capacity.html on top of js/capacity-core.js. Same
 * three-phase shape as Blueprint and Value Streams: a launcher (create,
 * import a Value Stream queue, load the Northstar sample, or resume a
 * saved model), a wizard built on the shared builder-core widgets, and a
 * tabbed viewer.
 *
 * The throughline every screen in this file has to respect: a queue is
 * evidence of imbalance, not proof that headcount is the constraint.
 * Capacity is not headcount — it is the useful work the system can
 * reliably produce. Findings and the diagnosis signal never claim to be
 * a validated root cause; they name systems worth investigating.
 */
(function (global) {
  'use strict';

  var B = null;   // OMSBuilder (shared field widgets)
  var C = null;   // OMSCapacity (data model + engine)
  var VS = null;  // OMSValueStream (import integration)
  var els = {};
  var project = null;
  var viewerState = { tab: 'overview', capView: 'waterfall', distView: 'distribution', taxView: 'rework', riskView: 'findings', scenarioView: 'stress', summaryView: 'summary' };

  function byId(id) { return document.getElementById(id); }
  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var YES_NO = ['Yes', 'No'];

  /* ----------------------------------------------------------
     Wizard — Step 1: Start With The System (Section 2)
     ---------------------------------------------------------- */

  var SUBJECT_TYPES = ['Team', 'Function', 'Process', 'Value Stream Stage', 'Queue', 'Service Operation', 'Program', 'Custom'];
  var TIME_PERIODS = ['Daily', 'Weekly', 'Monthly', 'Custom'];

  function valueStreamOptions() {
    if (!VS) return [];
    return VS.store.list().map(function (v) { return { value: v.id, label: v.name }; });
  }

  function stepSystem(container, proj, ctrl) {
    container.innerHTML =
      '<h3>What are you analyzing?</h3>' +
      '<p class="lede">Capacity means different things at different scopes — a team, a process, a single value stream stage. Naming the scope keeps the math honest.</p>' +
      '<div class="builder-scope-grid" id="subject-grid" style="margin:var(--space-5) 0"></div>' +
      '<div class="builder-field-grid" id="system-fields"></div>';

    var grid = container.querySelector('#subject-grid');
    grid.innerHTML = SUBJECT_TYPES.map(function (t) {
      return '<button type="button" class="builder-scope-tile' + (proj.data.subjectType === t ? ' is-selected' : '') + '" data-subject="' + t + '">' + t + '</button>';
    }).join('');
    grid.querySelectorAll('[data-subject]').forEach(function (btn) {
      btn.addEventListener('click', function () { proj.data.subjectType = btn.getAttribute('data-subject'); ctrl.persist(); stepSystem(container, proj, ctrl); });
    });

    var mount = container.querySelector('#system-fields');
    var fields = [
      { key: 'name', label: 'Model name', wide: true, placeholder: 'e.g. Implementation Operations' },
      { key: 'systemTeam', label: 'System / team' },
      { key: 'owner', label: 'Owner' }
    ];
    mount.innerHTML = fields.map(function (f) {
      return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, proj[f.key], 'cap-' + f.key) + '</div>';
    }).join('');
    B.bindFieldEvents(mount, proj, fields, ctrl.persist);

    var relMount = document.createElement('div');
    relMount.className = 'builder-field-grid';
    relMount.style.marginTop = 'var(--space-4)';
    container.appendChild(relMount);
    relMount.innerHTML =
      '<div class="builder-field builder-field--wide">' + B.fieldHtml({ key: 'relatedValueStreamId', label: 'Related Value Stream (optional)', type: 'select', options: valueStreamOptions() }, proj.data.relatedValueStreamId, 'cap-vs') + '</div>' +
      '<div class="builder-field">' + B.fieldHtml({ key: 'timePeriod', label: 'Time period', type: 'select', options: TIME_PERIODS }, proj.data.timePeriod, 'cap-period') + '</div>' +
      '<div class="builder-field">' + B.fieldHtml({ key: 'unitOfWork', label: 'Unit of work', placeholder: 'Cases, Tickets, Accounts, Orders…' }, proj.data.unitOfWork, 'cap-unit') + '</div>';
    B.bindFieldEvents(relMount, proj.data, [
      { key: 'relatedValueStreamId', type: 'select' }, { key: 'timePeriod', type: 'select' }, { key: 'unitOfWork' }
    ], ctrl.persist);

    renderBlueprintLinkPicker(container, proj, ctrl);
  }

  var BP_LINK_TYPES = ['teams', 'roles', 'processes', 'capabilities', 'valueStreams', 'technology'];

  function renderBlueprintLinkPicker(container, proj, ctrl) {
    var BP = global.OMSBlueprint;
    if (!BP) return;
    var bps = BP.store.list();
    if (!bps.length) return;
    var bpMount = document.createElement('div');
    bpMount.style.marginTop = 'var(--space-5)';
    container.appendChild(bpMount);

    function render() {
      var bpId = proj.data.relatedBlueprintProjectId || bps[0].id;
      var bp = BP.byId(bps, bpId);
      var type = proj.data.relatedBlueprintType;
      var objects = bp && type ? (bp.data[type] || []) : [];
      bpMount.innerHTML =
        '<span class="eyebrow">Related Blueprint Object (optional)</span>' +
        '<div class="builder-field-grid" style="margin-top:var(--space-3)">' +
          '<div class="builder-field">' + B.fieldHtml({ key: 'bp', label: 'Blueprint', type: 'select', options: bps.map(function (b) { return { value: b.id, label: b.name }; }) }, bpId, 'cap-bp') + '</div>' +
          '<div class="builder-field">' + B.fieldHtml({ key: 'bptype', label: 'Object type', type: 'select', options: BP_LINK_TYPES.map(function (t) { return { value: t, label: BP.ENTITY_META[t].plural }; }) }, type, 'cap-bptype') + '</div>' +
          '<div class="builder-field">' + B.fieldHtml({ key: 'bpobj', label: 'Object', type: 'select', options: objects.map(function (o) { return { value: o.id, label: BP.entityName(type, o) }; }) }, proj.data.relatedBlueprintId, 'cap-bpobj') + '</div>' +
        '</div>';
      bpMount.querySelector('#cap-bp').addEventListener('change', function (e) { proj.data.relatedBlueprintProjectId = e.target.value; proj.data.relatedBlueprintId = ''; ctrl.persist(); render(); });
      bpMount.querySelector('#cap-bptype').addEventListener('change', function (e) { proj.data.relatedBlueprintType = e.target.value; proj.data.relatedBlueprintId = ''; ctrl.persist(); render(); });
      bpMount.querySelector('#cap-bpobj').addEventListener('change', function (e) { proj.data.relatedBlueprintId = e.target.value; ctrl.persist(); });
    }
    render();
  }

  /* ----------------------------------------------------------
     Wizard — Step 2: Demand (Sections 3/4)
     ---------------------------------------------------------- */

  var DEMAND_PATTERNS = ['Relatively Stable', 'Seasonal', 'Day-of-Week Pattern', 'End-of-Month Spike', 'Campaign Driven', 'Event Driven', 'Batch', 'Highly Variable', 'Unknown'];

  function stepDemand(container, proj, ctrl) {
    container.innerHTML = '<h3>How much work is entering the system?</h3><p class="lede">Average demand can hide the conditions that actually break the system. Capture the range, not just one number.</p><div id="demand-fields"></div>';
    B.objectForm({
      mount: container.querySelector('#demand-fields'), project: proj, dataKey: 'demand', onChange: ctrl.persist,
      fields: [
        { key: 'minimum', label: 'Minimum demand (per ' + (proj.data.timePeriod || 'period').toLowerCase() + ')' },
        { key: 'typical', label: 'Typical demand' },
        { key: 'peak', label: 'Peak demand' },
        { key: 'pattern', label: 'How does demand arrive?', type: 'select', options: DEMAND_PATTERNS },
        { key: 'patternNote', label: 'Expected peaks / notes', type: 'textarea', wide: true }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 3: Work Mix (Section 5)
     ---------------------------------------------------------- */

  function stepWorkMix(container, proj, ctrl) {
    container.innerHTML = '<h3>Work Mix</h3><p class="lede">Not all work consumes the same capacity.</p><div id="worktypes-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#worktypes-mount'), project: proj, dataKey: 'workTypes',
      addLabel: 'Add Work Type', itemLabel: function (item) { return item.name || 'Work Type'; }, onChange: ctrl.persist,
      fields: [
        { key: 'name', label: 'Work type', wide: true },
        { key: 'pctVolume', label: '% of volume' },
        { key: 'avgEffortValue', label: 'Average effort' },
        { key: 'avgEffortUnit', label: 'Effort unit', type: 'select', options: ['minutes', 'hours', 'days'] },
        { key: 'skillRequired', label: 'Skill required' },
        { key: 'reworkLikelihood', label: 'Rework likelihood', type: 'select', options: ['Low', 'Medium', 'High'] },
        { key: 'priority', label: 'Priority', type: 'select', options: ['Critical', 'High', 'Normal', 'Low'] }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 4: Available Capacity & Losses (Sections 6/7)
     ---------------------------------------------------------- */

  function stepCapacity(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Available Capacity</h3><div id="resources-fields"></div>' +
      '<h3 style="margin-top:var(--space-7)">Capacity Losses</h3><p class="lede">Do not assume 100% of paid time is productive operating capacity.</p><div id="losses-mount"></div>';
    B.objectForm({
      mount: container.querySelector('#resources-fields'), project: proj, dataKey: 'resources', onChange: ctrl.persist,
      fields: [
        { key: 'numberOfPeople', label: 'Number of people / resources' },
        { key: 'workingDaysPerPeriod', label: 'Working days per period' },
        { key: 'hoursPerDay', label: 'Hours per day' }
      ]
    });
    B.repeatableList({
      mount: container.querySelector('#losses-mount'), project: proj, dataKey: 'capacityLosses',
      addLabel: 'Add Loss Category', itemLabel: function (item) { return item.category || 'Loss'; }, onChange: ctrl.persist,
      defaults: function () { return { mode: 'Percent' }; },
      fields: [
        { key: 'category', label: 'Category', type: 'select', options: C.LOSS_CATEGORIES },
        { key: 'mode', label: 'Entered as', type: 'select', options: ['Percent', 'Hours'] },
        { key: 'value', label: 'Value' }
      ]
    });
    var note = document.createElement('p');
    note.className = 'text-dim';
    note.style.fontSize = 'var(--step--1)';
    note.textContent = 'Meetings are captured separately on their own step and added to this waterfall automatically.';
    container.appendChild(note);
  }

  /* ----------------------------------------------------------
     Wizard — Step 5: Productivity (Section 9)
     ---------------------------------------------------------- */

  function stepProductivity(container, proj, ctrl) {
    container.innerHTML = '<h3>Productive Capacity</h3><p class="lede">Use rounded estimates. False precision here undermines everything downstream.</p><div id="prod-fields"></div>';
    B.objectForm({
      mount: container.querySelector('#prod-fields'), project: proj, dataKey: 'productivity', onChange: ctrl.persist,
      fields: [
        { key: 'avgRateValue', label: 'Average productive rate (per person)' },
        { key: 'avgRateUnit', label: 'Rate unit', type: 'select', options: ['per hour', 'per day', 'per week'] }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 6: Queue (Sections 14/15)
     ---------------------------------------------------------- */

  function stepQueue(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Queue</h3>' +
      '<p class="lede">If this model came from a Value Stream queue, import it instead of re-entering it.</p>' +
      (proj.data.relatedValueStreamId ? '<button type="button" class="btn btn--secondary" id="import-queue-btn" style="margin-bottom:var(--space-4)">Import Queue From Value Stream</button>' : '') +
      '<div id="queue-fields"></div>';
    B.objectForm({
      mount: container.querySelector('#queue-fields'), project: proj, dataKey: 'queue', onChange: ctrl.persist,
      fields: [
        { key: 'name', label: 'Queue name', wide: true },
        { key: 'arrivalRate', label: 'Arrival rate (per period)' },
        { key: 'processingRate', label: 'Processing rate (per period)' },
        { key: 'waitTimeValue', label: 'Wait time' },
        { key: 'waitTimeUnit', label: 'Wait time unit', type: 'select', options: ['hours', 'days'] },
        { key: 'queueSize', label: 'Queue size (items waiting)' }
      ]
    });
    var importBtn = container.querySelector('#import-queue-btn');
    if (importBtn) importBtn.addEventListener('click', function () { openQueueImportPicker(proj, ctrl, container); });
  }

  function openQueueImportPicker(proj, ctrl, container) {
    var vs = VS.store.get(proj.data.relatedValueStreamId);
    if (!vs || !(vs.data.queues || []).length) { global.alert('That Value Stream has no queues to import.'); return; }
    var html = '<button type="button" class="modal-panel__close" data-modal-close aria-label="Close">&times;</button>' +
      '<h3 style="margin-top:0">Import a Queue</h3>' +
      vs.data.queues.map(function (q, i) { return '<button type="button" class="trace-node" style="width:100%;margin-bottom:var(--space-2)" data-pick="' + i + '"><span>' + esc(q.name) + '</span><span class="trace-node__relation">Import &rarr;</span></button>'; }).join('');
    global.OMSNav.openModal(html, function (panel) {
      panel.querySelectorAll('[data-pick]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var q = vs.data.queues[parseInt(btn.getAttribute('data-pick'), 10)];
          var stage = VS.byId(vs.data.stages, q.afterStageId);
          proj.data.queue = {
            name: q.name, arrivalRate: q.arrivalRate, processingRate: q.processingRate,
            waitTimeValue: q.avgWaitTimeValue, waitTimeUnit: q.avgWaitTimeUnit, queueSize: q.avgItemsWaiting,
            importedFromValueStream: true, sourceQueueId: q.id
          };
          if (stage) {
            proj.data.relatedValueStreamStageId = stage.id;
            if (!proj.owner) proj.owner = stage.owner || '';
          }
          ctrl.persist();
          global.OMSNav.closeModal();
          stepQueue(container, proj, ctrl);
        });
      });
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 7: Rework & Failure Demand (Sections 21/22)
     ---------------------------------------------------------- */

  function stepReworkFailure(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Rework Capacity Tax</h3><p class="lede">Not all demand represents new value. Some demand exists because the system failed the first time.</p>' +
      (proj.data.relatedValueStreamId ? '<button type="button" class="btn btn--secondary" id="import-rework-btn" style="margin-bottom:var(--space-4)">Import Rework From Value Stream</button>' : '') +
      '<div id="rework-fields"></div>' +
      '<h3 style="margin-top:var(--space-7)">Failure Demand</h3><div id="failure-mount"></div>';
    B.objectForm({
      mount: container.querySelector('#rework-fields'), project: proj, dataKey: 'rework', onChange: ctrl.persist,
      fields: [
        { key: 'pctOfCapacity', label: '% of capacity consumed by rework' },
        { key: 'note', label: 'Note', type: 'textarea', wide: true }
      ]
    });
    B.repeatableList({
      mount: container.querySelector('#failure-mount'), project: proj, dataKey: 'failureDemand',
      addLabel: 'Add Failure Demand Source', itemLabel: function (item) { return item.type || 'Failure Demand'; }, onChange: ctrl.persist,
      fields: [
        { key: 'type', label: 'Type', wide: true, placeholder: 'Repeat contacts, reopened tickets, escalations…' },
        { key: 'volumePerPeriod', label: 'Volume (per period)' },
        { key: 'avgEffortValue', label: 'Average effort' },
        { key: 'avgEffortUnit', label: 'Effort unit', type: 'select', options: ['minutes', 'hours', 'days'] }
      ]
    });
    var importBtn = container.querySelector('#import-rework-btn');
    if (importBtn) importBtn.addEventListener('click', function () {
      var vs = VS.store.get(proj.data.relatedValueStreamId);
      var reworkCount = vs ? (vs.data.rework || []).length : 0;
      if (!reworkCount) { global.alert('That Value Stream has no rework loops recorded.'); return; }
      proj.data.rework.note = ((proj.data.rework.note || '') + ' Imported context: ' + reworkCount + ' rework loop(s) recorded in "' + vs.name + '" — ' + vs.data.rework.map(function (r) { return r.cause; }).filter(Boolean).join('; ') + '.').trim();
      proj.data.rework.importedFromValueStream = true;
      ctrl.persist();
      stepReworkFailure(container, proj, ctrl);
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 8: Meetings & Context Switching (Sections 23/24)
     ---------------------------------------------------------- */

  function stepMeetings(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Meeting Capacity Tax</h3><p class="lede">Do not automatically label meetings wasteful — ask what decision or coordination each one enables.</p><div id="meetings-mount"></div>' +
      '<h3 style="margin-top:var(--space-7)">Context Switching</h3><div id="switching-fields"></div>';
    B.repeatableList({
      mount: container.querySelector('#meetings-mount'), project: proj, dataKey: 'meetings',
      addLabel: 'Add Meeting', itemLabel: function (item) { return item.name || 'Meeting'; }, onChange: ctrl.persist,
      fields: [
        { key: 'name', label: 'Meeting', wide: true },
        { key: 'participants', label: 'Participants' },
        { key: 'durationHours', label: 'Duration (hours)' },
        { key: 'frequency', label: 'Frequency', type: 'select', options: ['Daily', 'Weekly', 'Monthly', 'One-time'] }
      ]
    });
    B.objectForm({
      mount: container.querySelector('#switching-fields'), project: proj, dataKey: 'contextSwitching', onChange: ctrl.persist,
      fields: [
        { key: 'queueCount', label: 'Number of concurrent queues / work types per person' },
        { key: 'isHigh', label: 'High context switching?', type: 'select', options: YES_NO },
        { key: 'note', label: 'Note', type: 'textarea', wide: true }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 9: Distribution, Skills & Allocation (Sections 17-19)
     ---------------------------------------------------------- */

  function stepDistribution(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Capacity Distribution</h3><p class="lede">Aggregate capacity can look sufficient while one stage or team is overloaded.</p><div id="dist-mount"></div>' +
      '<h3 style="margin-top:var(--space-7)">Skill Constraints</h3><div id="skills-mount"></div>' +
      '<h3 style="margin-top:var(--space-7)">Work Allocation</h3><div id="allocation-fields"></div>';
    B.repeatableList({
      mount: container.querySelector('#dist-mount'), project: proj, dataKey: 'distribution',
      addLabel: 'Add Distribution Entry', itemLabel: function (item) { return item.name || 'Entry'; }, onChange: ctrl.persist,
      fields: [
        { key: 'dimension', label: 'Dimension', type: 'select', options: ['Team', 'Skill', 'Role', 'Region', 'Shift', 'Work Type', 'Process Stage'] },
        { key: 'name', label: 'Name', wide: true },
        { key: 'demandLoadPct', label: '% demand load' }
      ]
    });
    B.repeatableList({
      mount: container.querySelector('#skills-mount'), project: proj, dataKey: 'skills',
      addLabel: 'Add Skill Group', itemLabel: function (item) { return item.name || 'Skill'; }, onChange: ctrl.persist,
      fields: [
        { key: 'name', label: 'Skill', wide: true },
        { key: 'peopleCount', label: 'People who can perform it' },
        { key: 'criticalWorkPct', label: '% of critical work depending on it' },
        { key: 'isBottleneck', label: 'Skill bottleneck?', type: 'select', options: YES_NO },
        { key: 'note', label: 'Note', wide: true }
      ]
    });
    B.objectForm({
      mount: container.querySelector('#allocation-fields'), project: proj, dataKey: 'allocation', onChange: ctrl.persist,
      fields: [
        { key: 'method', label: 'How is work assigned?', type: 'select', options: ['First In First Out', 'Round Robin', 'Skill Based', 'Priority Based', 'Account Ownership', 'Manager Assigned', 'Self Selected', 'Manual Queue', 'Automated Routing', 'Other'] },
        { key: 'matchesWorkNote', label: 'Does allocation match the work?', type: 'textarea', wide: true },
        { key: 'agingIssue', label: 'Work aging unnoticed?', type: 'select', options: YES_NO },
        { key: 'cherryPicking', label: 'Cherry picking?', type: 'select', options: YES_NO },
        { key: 'managerBottleneck', label: 'Manager routing bottleneck?', type: 'select', options: YES_NO }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 10: Priority Load & Concentration Risk (Sections 20/25)
     ---------------------------------------------------------- */

  function stepPriorityRisk(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Priority Load</h3><p class="lede">Priority only works when something is allowed not to be priority.</p><div id="priority-mount"></div>' +
      '<h3 style="margin-top:var(--space-7)">Concentration Risk</h3><div id="concentration-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#priority-mount'), project: proj, dataKey: 'priorityLoad',
      addLabel: 'Add Priority Level', itemLabel: function (item) { return item.priority || 'Priority'; }, onChange: ctrl.persist,
      fields: [
        { key: 'priority', label: 'Priority', type: 'select', options: ['Critical', 'High', 'Normal', 'Low'] },
        { key: 'pctOfWork', label: '% of actual workload' }
      ]
    });
    B.repeatableList({
      mount: container.querySelector('#concentration-mount'), project: proj, dataKey: 'concentrationRisks',
      addLabel: 'Add Concentration Risk', itemLabel: function (item) { return item.name || item.type || 'Risk'; }, onChange: ctrl.persist,
      fields: [
        { key: 'type', label: 'Depends heavily on…', type: 'select', options: ['Person', 'Shift', 'Geography', 'Skill', 'Vendor', 'System', 'Manager'] },
        { key: 'name', label: 'Name', wide: true },
        { key: 'note', label: 'Note', wide: true }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 11: Governance & Forecast (Sections 33-36)
     ---------------------------------------------------------- */

  function stepGovernance(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Capacity Owner &amp; Operating Rhythm</h3><div id="gov-fields"></div>' +
      '<h3 style="margin-top:var(--space-7)">Demand Forecast</h3><div id="forecast-fields"></div>' +
      '<h3 style="margin-top:var(--space-7)">Early Warning Signals</h3><p class="lede">What would tell you capacity is deteriorating before performance fails?</p><div id="ews-mount"></div>' +
      '<div class="builder-field" style="margin-top:var(--space-6)"><label class="builder-field__label">Buffer assumption for headcount estimate (%)</label>' +
      '<input type="text" class="builder-field__input" id="buffer-assumption" value="' + esc(proj.data.bufferAssumptionPct) + '"></div>';

    var govMount = container.querySelector('#gov-fields');
    govMount.innerHTML = '<div class="builder-field builder-field--wide">' + B.fieldHtml({ key: 'capacityOwner', label: 'Who owns balancing demand and capacity?' }, proj.data.capacityOwner, 'cap-owner') + '</div>';
    B.bindFieldEvents(govMount, proj.data, [{ key: 'capacityOwner' }], ctrl.persist);

    var rhythmMount = document.createElement('div');
    govMount.appendChild(rhythmMount);
    B.objectForm({
      mount: rhythmMount, project: proj, dataKey: 'operatingRhythm', onChange: ctrl.persist,
      fields: [
        { key: 'frequency', label: 'How often is demand/capacity reviewed?', type: 'select', options: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Ad hoc', 'Never'] },
        { key: 'inputs', label: 'Inputs' },
        { key: 'participants', label: 'Participants' },
        { key: 'decisions', label: 'Decisions' },
        { key: 'actions', label: 'What changes when imbalance appears?', wide: true }
      ]
    });

    B.objectForm({
      mount: container.querySelector('#forecast-fields'), project: proj, dataKey: 'forecast', onChange: ctrl.persist,
      fields: [
        { key: 'lowCase', label: 'Low case' },
        { key: 'expectedCase', label: 'Expected case' },
        { key: 'highCase', label: 'High case' },
        { key: 'period', label: 'Future period' }
      ]
    });

    B.repeatableList({
      mount: container.querySelector('#ews-mount'), project: proj, dataKey: 'earlyWarningSignals',
      addLabel: 'Add Early Warning Signal', itemLabel: function (item) { return item.signal || 'Signal'; }, onChange: ctrl.persist,
      fields: [
        { key: 'signal', label: 'Signal', wide: true, placeholder: 'Queue age, overtime, SLA misses, rework rate…' },
        { key: 'currentValue', label: 'Current value' },
        { key: 'note', label: 'Note', wide: true }
      ]
    });

    container.querySelector('#buffer-assumption').addEventListener('input', function (e) { proj.data.bufferAssumptionPct = e.target.value; ctrl.persist(); });
  }

  /* ----------------------------------------------------------
     Wizard — Step 12: Is This Really A Capacity Problem? (Section 16)
     ---------------------------------------------------------- */

  function stepDiagnosis(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Is This Really A Capacity Problem?</h3>' +
      '<p class="lede">Answer what you actually know. OMS will suggest systems to investigate — never a validated root cause.</p>' +
      '<div id="diag-mount"></div>';
    var mount = container.querySelector('#diag-mount');
    mount.innerHTML = C.DIAGNOSIS_QUESTIONS.map(function (q) {
      var val = proj.data.diagnosisAnswers[q.id] || '';
      return '<div class="builder-item-card" style="margin-bottom:var(--space-3)">' +
        '<div class="builder-item-card__header"><span class="builder-item-card__title">' + esc(q.text) + '</span></div>' +
        '<div class="bp-tabs" data-question="' + q.id + '">' +
          ['Yes', 'No', 'Unknown'].map(function (opt) { return '<button type="button" data-answer="' + opt + '" class="' + (val === opt ? 'is-active' : '') + '">' + opt + '</button>'; }).join('') +
        '</div>' +
      '</div>';
    }).join('');
    mount.querySelectorAll('[data-question]').forEach(function (row) {
      var qId = row.getAttribute('data-question');
      row.querySelectorAll('[data-answer]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          proj.data.diagnosisAnswers[qId] = btn.getAttribute('data-answer');
          ctrl.persist();
          stepDiagnosis(container, proj, ctrl);
        });
      });
    });
  }

  var WIZARD_STEPS = [
    { id: 'system', label: 'The System', render: stepSystem },
    { id: 'demand', label: 'Demand', render: stepDemand },
    { id: 'workmix', label: 'Work Mix', render: stepWorkMix },
    { id: 'capacity', label: 'Capacity & Losses', render: stepCapacity },
    { id: 'productivity', label: 'Productivity', render: stepProductivity },
    { id: 'queue', label: 'Queue', render: stepQueue },
    { id: 'rework', label: 'Rework & Failure Demand', render: stepReworkFailure },
    { id: 'meetings', label: 'Meetings & Switching', render: stepMeetings },
    { id: 'distribution', label: 'Distribution & Skills', render: stepDistribution },
    { id: 'priority', label: 'Priority & Risk', render: stepPriorityRisk },
    { id: 'governance', label: 'Governance & Forecast', render: stepGovernance },
    { id: 'diagnosis', label: 'Is This Really Capacity?', render: stepDiagnosis }
  ];

  function enterWizard() {
    els.launcher.hidden = true;
    els.viewer.hidden = true;
    if (els.viewerSection) els.viewerSection.hidden = true;
    els.wizard.hidden = false;
    els.projectName.textContent = project.name;
    B.initWizard({ project: project, steps: WIZARD_STEPS, store: C.store, els: { progress: els.progress, body: els.stepBody, prev: els.prev, next: els.next, stepLabel: els.stepLabel } });
    updateUrl();
  }

  /* ============================================================
     VIEWER
     ============================================================ */

  function enterViewer() {
    els.launcher.hidden = true;
    els.wizard.hidden = true;
    els.viewer.hidden = false;
    if (els.viewerSection) els.viewerSection.hidden = false;
    renderSampleBanner();
    renderViewer();
    updateUrl();
  }

  function renderSampleBanner() {
    if (!els.sampleBanner) return;
    if (!project || !project.isSample) { els.sampleBanner.innerHTML = ''; return; }
    els.sampleBanner.innerHTML = global.OMSData.sampleBannerHtml(
      ' this is the Northstar Software Implementation Operations sample, used to show that a backlog rarely has one single cause. It does not represent your organization.'
    );
    global.OMSData.bindSampleBanner(els.sampleBanner, {
      onExit: function () { backToLauncher(); },
      onClear: function () {
        if (!global.confirm('Delete the sample Capacity Model? This cannot be undone.')) return;
        C.store.remove(project.id);
        project = null;
        backToLauncher();
      }
    });
  }

  var VIEWER_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'detail', label: 'Capacity Detail' },
    { id: 'taxes', label: 'Capacity Taxes' },
    { id: 'risk', label: 'Risk & Findings' },
    { id: 'scenarios', label: 'Scenarios' },
    { id: 'target', label: 'Target State' },
    { id: 'summary', label: 'Summary' }
  ];

  function renderViewer() {
    els.viewerBody.innerHTML = '<div class="bp-toolbar"><div class="bp-tabs" id="cap-tabs"></div></div><div id="cap-tab-body"></div>';
    var tabsEl = els.viewerBody.querySelector('#cap-tabs');
    tabsEl.innerHTML = VIEWER_TABS.map(function (t) { return '<button type="button" data-tab="' + t.id + '" class="' + (viewerState.tab === t.id ? 'is-active' : '') + '">' + t.label + '</button>'; }).join('');
    tabsEl.querySelectorAll('[data-tab]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.tab = btn.getAttribute('data-tab'); renderViewer(); }); });
    var body = els.viewerBody.querySelector('#cap-tab-body');
    if (viewerState.tab === 'detail') renderDetailTab(body);
    else if (viewerState.tab === 'taxes') renderTaxesTab(body);
    else if (viewerState.tab === 'risk') renderRiskTab(body);
    else if (viewerState.tab === 'scenarios') renderScenariosTab(body);
    else if (viewerState.tab === 'target') renderTargetTab(body);
    else if (viewerState.tab === 'summary') renderSummaryTab(body);
    else renderOverviewTab(body);
  }

  function metricGrid(metrics) {
    return '<div class="metric-grid">' + metrics.map(function (m) {
      return '<div class="metric-card"><span class="metric-card__label">' + esc(m.label) + '</span>' +
        '<span class="metric-card__value metric-card__value--accent">' + m.value + '</span>' +
        (m.note ? '<span class="metric-card__note">' + esc(m.note) + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  }

  /* ----------------------------------------------------------
     Overview — Sections 10-12, 16
     ---------------------------------------------------------- */

  function renderOverviewTab(mount) {
    var unit = project.data.unitOfWork || 'units';
    var period = (project.data.timePeriod || 'period').toLowerCase();
    var d = C.demandCapacityBalance(project);
    var util = C.utilizationBand(d.utilization);

    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">Demand / Capacity Balance</span><h3>Typical vs. peak, against what the system can actually produce</h3></div>' +
      metricGrid([
        { label: 'Typical Demand', value: d.typical, note: unit + '/' + period },
        { label: 'Peak Demand', value: d.peak, note: unit + '/' + period },
        { label: 'Available Capacity', value: d.capacity, note: unit + '/' + period },
        { label: 'Typical Buffer', value: (d.typicalBuffer >= 0 ? '+' : '') + d.typicalBuffer },
        { label: 'Peak Buffer', value: (d.peakBuffer >= 0 ? '+' : '') + d.peakBuffer },
        { label: 'Utilization', value: d.utilization == null ? '—' : d.utilization + '%', note: util.band }
      ]) +
      '<div class="constraint-panel" style="margin-top:var(--space-5)">' +
        '<span class="eyebrow">Utilization — ' + util.band + '</span>' +
        '<p class="text-muted" style="margin-top:var(--space-2)">' + util.note + '</p>' +
        '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-2)">Thresholds used here (Low &lt;60%, Balanced 60&ndash;85%, High 85&ndash;100%, Fragile 100%+) are a labeled prototype scale, not an established scientific standard. More variability generally requires a greater buffer; critical systems may need resilience capacity beyond the average case.</p>' +
      '</div>' +
      (d.reworkUnits || d.failureUnits ? '<p class="text-muted" style="margin-top:var(--space-4)">Total typical load of ' + d.totalTypicalLoad + ' includes ' + d.typical + ' productive demand, ' + d.reworkUnits + ' rework, and ' + d.failureUnits + ' failure demand.</p>' : '') +
      renderDiagnosisPanel();
  }

  var NON_CAPACITY_SIGNALS = ['LIKELY CAPACITY DISTRIBUTION PROBLEM', 'LIKELY WORK-MIX PROBLEM', 'LIKELY PROCESS / REWORK PROBLEM', 'LIKELY PRIORITIZATION PROBLEM', 'LIKELY DECISION BOTTLENECK', 'LIKELY INFORMATION / HANDOFF PROBLEM'];

  function renderDiagnosisPanel() {
    var diag = C.capacityDiagnosis(project);
    var pointsAwayFromCapacity = NON_CAPACITY_SIGNALS.indexOf(diag.signal) !== -1;
    return '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Is This Really A Capacity Problem?</span><h3>Capacity Diagnosis Signal</h3></div>' +
      '<div class="constraint-panel">' +
        '<span class="eyebrow">Signal</span>' +
        '<h3 style="margin:var(--space-2) 0">' + esc(diag.signal) + '</h3>' +
        '<p class="text-muted">' + esc(diag.message) + '</p>' +
        '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-2)">This is a systems-to-investigate signal built from the yes/no questions answered in the wizard, never a validated root cause.</p>' +
        '<div style="display:flex;gap:var(--space-3);flex-wrap:wrap;margin-top:var(--space-3)">' +
          '<a class="btn btn--secondary" href="#" id="edit-diagnosis-btn">Edit Answers</a>' +
          (pointsAwayFromCapacity && project.data.relatedValueStreamId ? '<a class="btn btn--secondary" href="' + valueStreamReturnHref() + '">Wait Is Not Explained By Capacity — Return To Value Stream &rarr;</a>' : '') +
        '</div>' +
      '</div>';
  }

  function valueStreamReturnHref() {
    var base = global.OMSData ? global.OMSData.href('pages/value-streams.html') : 'value-streams.html';
    return base + '?valuestream=' + encodeURIComponent(project.data.relatedValueStreamId);
  }

  function operationalHealthHref(paramName, id) {
    var base = global.OMSData ? global.OMSData.href('pages/operational-health.html') : 'operational-health.html';
    return base + '?' + paramName + '=' + encodeURIComponent(id);
  }

  /* ----------------------------------------------------------
     Capacity Detail — waterfall, queue, distribution, skills,
     allocation, priority load (Sections 13, 15, 17-20)
     ---------------------------------------------------------- */

  function renderDetailTab(mount) {
    var views = [{ id: 'waterfall', label: 'Waterfall' }, { id: 'queue', label: 'Queue Behavior' }, { id: 'distribution', label: 'Distribution' }, { id: 'skills', label: 'Skills & Allocation' }, { id: 'priority', label: 'Priority Load' }];
    mount.innerHTML = '<div class="bp-tabs" id="detail-subtabs" style="margin-bottom:var(--space-5)"></div><div id="detail-subbody"></div>';
    var tabs = mount.querySelector('#detail-subtabs');
    tabs.innerHTML = views.map(function (v) { return '<button type="button" data-view="' + v.id + '" class="' + (viewerState.capView === v.id ? 'is-active' : '') + '">' + v.label + '</button>'; }).join('');
    tabs.querySelectorAll('[data-view]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.capView = btn.getAttribute('data-view'); renderDetailTab(mount); }); });
    var body = mount.querySelector('#detail-subbody');
    if (viewerState.capView === 'queue') renderQueueView(body);
    else if (viewerState.capView === 'distribution') renderDistributionView(body);
    else if (viewerState.capView === 'skills') renderSkillsView(body);
    else if (viewerState.capView === 'priority') renderPriorityView(body);
    else renderWaterfallView(body);
  }

  function renderWaterfallView(mount) {
    var scheduled = C.scheduledHours(project);
    var losses = C.lossBreakdown(project);
    var effective = C.effectiveCapacityHours(project);
    var d = C.demandCapacityBalance(project);

    var rows = [{ label: 'Scheduled Hours', hours: scheduled }].concat(
      losses.map(function (l) { return { label: l.category, hours: -l.hours }; })
    ).concat([{ label: 'Effective Operating Capacity', hours: effective, isTotal: true }]);

    mount.innerHTML =
      '<p class="lede">Where theoretical capacity actually goes, one step at a time.</p>' +
      '<div class="card">' + rows.map(function (r) {
        return '<div class="vs-timeline-row" style="grid-template-columns:1fr auto"><span class="vs-timeline-row__label' + (r.isTotal ? '' : '') + '">' + esc(r.label) + '</span><span class="vs-timeline-row__meta">' + (r.hours >= 0 && !r.isTotal ? '+' : '') + Math.round(r.hours) + ' hrs</span></div>';
      }).join('') + '</div>' +
      '<div class="constraint-panel" style="margin-top:var(--space-4)"><span class="eyebrow">How This Is Calculated</span><p class="text-muted" style="margin-top:var(--space-2)">Scheduled Hours (' + Math.round(scheduled) + ') &minus; Meetings &amp; Losses (' + Math.round(scheduled - effective) + ') = Available Operating Hours (' + Math.round(effective) + '). Output capacity then applies the productive rate: ' + Math.round(effective) + ' hrs &times; ' + round2(C.productiveRatePerHour(project)) + ' ' + (project.data.unitOfWork || 'units') + '/hr = ' + d.capacity + ' ' + (project.data.unitOfWork || 'units') + '.</p></div>';
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  function renderQueueView(mount) {
    var qb = C.queueBehavior(project);
    var q = project.data.queue;
    mount.innerHTML =
      '<p class="lede">Basic queue behavior only — not advanced queueing theory.</p>' +
      (q.importedFromValueStream ? '<p class="badge badge--outline">Imported from Value Stream</p>' : '') +
      metricGrid([
        { label: 'Arrival Rate', value: q.arrivalRate || '—' },
        { label: 'Processing Rate', value: q.processingRate || '—' },
        { label: 'Wait Time', value: q.waitTimeValue ? q.waitTimeValue + ' ' + q.waitTimeUnit : '—' },
        { label: 'Queue Size', value: q.queueSize || '—' }
      ]) +
      (qb ? '<div class="risk-flag risk-flag--' + (qb.structurallyGrowing ? 'critical' : 'low') + '" style="margin-top:var(--space-4)"><div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--' + (qb.structurallyGrowing ? 'critical' : 'low') + '">' + (qb.structurallyGrowing ? 'Structural Queue Growth' : 'Stable') + '</span></div><p class="risk-flag__message">' + esc(qb.message) + '</p></div>' : '<p class="text-dim" style="margin-top:var(--space-4)">Enter both arrival and processing rate to see queue behavior.</p>');
  }

  function renderDistributionView(mount) {
    var rows = project.data.distribution || [];
    if (!rows.length) { mount.innerHTML = '<p class="callout">No distribution entered yet. Total capacity can look sufficient while one stage or team is overloaded.</p>'; return; }
    mount.innerHTML = '<p class="lede">Aggregate capacity can appear sufficient while one part of the system is overloaded.</p>' +
      '<div class="heatmap-grid">' + rows.map(function (r) {
        var pct = parseFloat(r.demandLoadPct) || 0;
        var sev = pct > 110 ? 'critical' : pct > 100 ? 'weak' : pct > 85 ? 'watch' : 'healthy';
        return '<div class="heatmap-cell heatmap-cell--' + sev + '"><strong>' + esc(r.name) + '</strong><div class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-2)">' + esc(r.dimension) + ' &middot; ' + pct + '% demand load</div></div>';
      }).join('') + '</div>';
  }

  function renderSkillsView(mount) {
    var skills = project.data.skills || [];
    var a = project.data.allocation;
    mount.innerHTML =
      '<h4>Skill Constraints</h4>' +
      (skills.length ? skills.map(function (s) {
        return '<div class="card" style="margin-bottom:var(--space-3)"><strong>' + esc(s.name) + '</strong>' +
          (C.isYes(s.isBottleneck) ? ' <span class="health-badge health-badge--critical">Skill Bottleneck</span>' : '') +
          '<p class="text-muted" style="font-size:var(--step--1);margin-top:var(--space-2)">' + (s.peopleCount || '?') + ' people can perform this &middot; ' + (s.criticalWorkPct || '?') + '% of critical work depends on it</p>' +
          (s.note ? '<p class="text-dim" style="font-size:var(--step--1)">' + esc(s.note) + '</p>' : '') +
        '</div>';
      }).join('') : '<p class="callout">No skill groups entered yet.</p>') +
      '<h4 style="margin-top:var(--space-6)">Work Allocation</h4>' +
      '<p class="text-muted">Method: <strong>' + esc(a.method || 'Not entered') + '</strong></p>' +
      (a.matchesWorkNote ? '<p class="text-dim" style="font-size:var(--step--1)">' + esc(a.matchesWorkNote) + '</p>' : '') +
      '<div class="build-project-row__meta" style="margin-top:var(--space-3)">' +
        (C.isYes(a.agingIssue) ? '<span class="badge badge--outline">Work aging unnoticed</span>' : '') +
        (C.isYes(a.cherryPicking) ? '<span class="badge badge--outline">Cherry picking</span>' : '') +
        (C.isYes(a.managerBottleneck) ? '<span class="badge badge--outline">Manager routing bottleneck</span>' : '') +
      '</div>';
  }

  function renderPriorityView(mount) {
    var rows = project.data.priorityLoad || [];
    if (!rows.length) { mount.innerHTML = '<p class="callout">No priority breakdown entered yet.</p>'; return; }
    var highShare = rows.filter(function (r) { return r.priority === 'Critical' || r.priority === 'High'; }).reduce(function (s, r) { return s + (parseFloat(r.pctOfWork) || 0); }, 0);
    mount.innerHTML =
      metricGrid(rows.map(function (r) { return { label: r.priority, value: (r.pctOfWork || 0) + '%' }; })) +
      (highShare >= 70 ? '<div class="risk-flag risk-flag--warning" style="margin-top:var(--space-4)"><div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--warning">Excessive Priority Work</span></div><p class="risk-flag__message">' + highShare + '% of work is Critical or High priority. Priority only works when something is allowed not to be priority.</p></div>' : '') +
      '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-4)"><a href="' + antiPatternHref('everything-is-priority') + '">Related anti-pattern: Everything Is Priority</a></p>';
  }

  function antiPatternHref(id) { return global.OMSLinks ? global.OMSLinks.resolve({ type: 'antipattern', id: id }) : '#'; }

  /* ----------------------------------------------------------
     Capacity Taxes — Sections 21-24
     ---------------------------------------------------------- */

  function renderTaxesTab(mount) {
    var views = [{ id: 'rework', label: 'Rework Tax' }, { id: 'failure', label: 'Failure Demand' }, { id: 'meetings', label: 'Meeting Tax' }, { id: 'switching', label: 'Context Switching' }];
    mount.innerHTML = '<div class="bp-tabs" id="tax-subtabs" style="margin-bottom:var(--space-5)"></div><div id="tax-subbody"></div>';
    var tabs = mount.querySelector('#tax-subtabs');
    tabs.innerHTML = views.map(function (v) { return '<button type="button" data-view="' + v.id + '" class="' + (viewerState.taxView === v.id ? 'is-active' : '') + '">' + v.label + '</button>'; }).join('');
    tabs.querySelectorAll('[data-view]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.taxView = btn.getAttribute('data-view'); renderTaxesTab(mount); }); });
    var body = mount.querySelector('#tax-subbody');
    if (viewerState.taxView === 'failure') renderFailureView(body);
    else if (viewerState.taxView === 'meetings') renderMeetingsView(body);
    else if (viewerState.taxView === 'switching') renderSwitchingView(body);
    else renderReworkView(body);
  }

  function renderReworkView(mount) {
    var rt = C.reworkTax(project);
    mount.innerHTML =
      '<p class="lede">' + esc(project.data.rework.note || 'Rework consumes capacity without producing new value.') + '</p>' +
      metricGrid([
        { label: '% Of Capacity', value: rt.pct + '%' },
        { label: 'Estimated Units Consumed', value: rt.units, note: project.data.unitOfWork || 'units' },
        { label: 'Total Capacity', value: rt.capacity }
      ]) +
      (rt.pct >= 10 ? '<div class="risk-flag risk-flag--warning" style="margin-top:var(--space-4)"><div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--warning">Rework Consuming Material Capacity</span></div><p class="risk-flag__message">' + rt.pct + '% of output capacity is estimated to go toward rework rather than new demand.</p></div>' : '');
  }

  function renderFailureView(mount) {
    var fd = C.failureDemandSummary(project);
    if (!fd.items.length) { mount.innerHTML = '<p class="callout">No failure demand recorded yet. Not all demand represents new value — some exists because the system failed the first time.</p>'; return; }
    mount.innerHTML = metricGrid([
      { label: 'Total Volume', value: fd.totalVolume, note: project.data.unitOfWork || 'units' },
      { label: 'Total Effort', value: Math.round(fd.totalHours) + ' hrs' }
    ]) + '<div class="card" style="margin-top:var(--space-4)">' + fd.items.map(function (f) {
      return '<div class="vs-timeline-row" style="grid-template-columns:1fr auto"><span class="vs-timeline-row__label">' + esc(f.type) + '</span><span class="vs-timeline-row__meta">' + f.volumePerPeriod + ' &middot; ' + f.avgEffortValue + ' ' + f.avgEffortUnit + ' each</span></div>';
    }).join('') + '</div>';
  }

  function renderMeetingsView(mount) {
    var mt = C.meetingTax(project);
    var meetings = project.data.meetings || [];
    mount.innerHTML =
      metricGrid([
        { label: 'Total Meeting Hours', value: mt.hours, note: 'per ' + (project.data.timePeriod || 'period').toLowerCase() },
        { label: '% Of Scheduled Time', value: mt.pctOfScheduled == null ? '—' : mt.pctOfScheduled + '%' }
      ]) +
      '<div class="card" style="margin-top:var(--space-4)">' + (meetings.length ? meetings.map(function (m) {
        return '<div class="vs-timeline-row" style="grid-template-columns:1fr auto"><span class="vs-timeline-row__label">' + esc(m.name) + '</span><span class="vs-timeline-row__meta">' + m.participants + ' people &times; ' + m.durationHours + 'h &middot; ' + m.frequency + '</span></div>';
      }).join('') : '<p class="text-dim">No meetings recorded yet.</p>') + '</div>' +
      '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-4)">Not automatically wasteful — ask what decision or coordination each meeting enables. Related: Operating Rhythms.</p>';
  }

  function renderSwitchingView(mount) {
    var cs = project.data.contextSwitching;
    mount.innerHTML = metricGrid([{ label: 'Concurrent Queues / Work Types', value: cs.queueCount || '—' }]) +
      (C.isYes(cs.isHigh) ? '<div class="risk-flag risk-flag--info" style="margin-top:var(--space-4)"><div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--info">High Context Switching</span></div><p class="risk-flag__message">' + esc(cs.note || 'Flagged as high — treated as a likely productivity loss, not a precise measurement.') + '</p></div>' : '<p class="text-dim" style="margin-top:var(--space-4)">Not flagged as high.</p>');
  }

  /* ----------------------------------------------------------
     Risk & Findings — Sections 25, 32, 37
     ---------------------------------------------------------- */

  function renderRiskTab(mount) {
    var views = [{ id: 'findings', label: 'Findings' }, { id: 'concentration', label: 'Concentration Risk' }, { id: 'health', label: 'Capacity Health' }];
    mount.innerHTML = '<div class="bp-tabs" id="risk-subtabs" style="margin-bottom:var(--space-5)"></div><div id="risk-subbody"></div>';
    var tabs = mount.querySelector('#risk-subtabs');
    tabs.innerHTML = views.map(function (v) { return '<button type="button" data-view="' + v.id + '" class="' + (viewerState.riskView === v.id ? 'is-active' : '') + '">' + v.label + '</button>'; }).join('');
    tabs.querySelectorAll('[data-view]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.riskView = btn.getAttribute('data-view'); renderRiskTab(mount); }); });
    var body = mount.querySelector('#risk-subbody');
    if (viewerState.riskView === 'concentration') renderConcentrationView(body);
    else if (viewerState.riskView === 'health') renderHealthView(body);
    else renderFindingsView(body);
  }

  function renderFindingsView(mount) {
    var flags = C.findings(project);
    if (!flags.length) { mount.innerHTML = '<p class="callout">No structural findings from the rules below. That does not guarantee this system is healthy — it means it passed these specific checks.</p>'; return; }
    mount.innerHTML = flags.map(function (f, i) {
      return '<div class="risk-flag risk-flag--' + f.severity + '" style="margin-bottom:var(--space-3)" data-finding-idx="' + i + '">' +
        '<div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--' + f.severity + '">' + esc(f.rule) + '</span></div>' +
        '<p class="risk-flag__message">' + esc(f.message) + '</p>' +
        '<p class="risk-flag__why text-dim">Rule: ' + esc(f.why) + '</p>' +
        '<div class="inspector-panel__actions" style="margin-top:var(--space-3)"><button type="button" class="btn btn--ghost" data-save-finding="' + i + '">Save To Workbench</button></div>' +
      '</div>';
    }).join('');
    mount.querySelectorAll('[data-save-finding]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var f = flags[parseInt(btn.getAttribute('data-save-finding'), 10)];
        project.data.findings.push({ id: C.newId('find'), type: f.rule, message: f.message, why: f.why, savedAt: new Date().toISOString() });
        C.logActivity(project, 'Saved finding to Workbench: ' + f.rule);
        C.store.save(project);
        btn.textContent = 'Saved ✓';
        btn.disabled = true;
      });
    });
  }

  function renderConcentrationView(mount) {
    var risks = project.data.concentrationRisks || [];
    if (!risks.length) { mount.innerHTML = '<p class="callout">No concentration risks recorded yet.</p>'; return; }
    mount.innerHTML = risks.map(function (r) {
      return '<div class="risk-flag risk-flag--warning" style="margin-bottom:var(--space-3)"><div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--warning">Depends On One ' + esc(r.type) + '</span></div><p class="risk-flag__message">' + esc(r.name) + (r.note ? ' — ' + esc(r.note) : '') + '</p></div>';
    }).join('') + '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-3)">Related: Blueprint resilience concepts, Key Person Dependency.</p>';
  }

  var HEALTH_DIMENSIONS = [
    { key: 'demand', label: 'Demand Balance' }, { key: 'buffer', label: 'Buffer' }, { key: 'variability', label: 'Variability' },
    { key: 'queue', label: 'Queue' }, { key: 'rework', label: 'Rework' }, { key: 'skill', label: 'Skill Coverage' },
    { key: 'allocation', label: 'Allocation' }, { key: 'resilience', label: 'Resilience' }, { key: 'forecasting', label: 'Forecasting' }, { key: 'governance', label: 'Governance' }
  ];

  function healthSignal(project) {
    var d = C.demandCapacityBalance(project);
    var qb = C.queueBehavior(project);
    var signals = {};
    signals.demand = d.capacity > 0 && d.totalTypicalLoad > d.capacity ? 'Weak' : 'Healthy';
    signals.buffer = d.bufferPct == null ? 'Unknown' : d.bufferPct < 0 ? 'Critical' : d.bufferPct < 8 ? 'Watch' : 'Healthy';
    signals.variability = project.data.demand.pattern && project.data.demand.pattern !== 'Relatively Stable' && project.data.demand.pattern !== 'Unknown' ? 'Watch' : (project.data.demand.pattern === 'Unknown' || !project.data.demand.pattern ? 'Unknown' : 'Healthy');
    signals.queue = qb ? (qb.structurallyGrowing ? 'Critical' : 'Healthy') : 'Unknown';
    signals.rework = C.reworkTax(project).pct >= 10 ? 'Weak' : (project.data.rework.pctOfCapacity ? 'Healthy' : 'Unknown');
    signals.skill = (project.data.skills || []).some(function (s) { return C.isYes(s.isBottleneck); }) ? 'Weak' : (project.data.skills.length ? 'Healthy' : 'Unknown');
    signals.allocation = C.isYes(project.data.allocation.managerBottleneck) || C.isYes(project.data.allocation.agingIssue) ? 'Watch' : (project.data.allocation.method ? 'Healthy' : 'Unknown');
    signals.resilience = (project.data.concentrationRisks || []).length ? 'Watch' : 'Unknown';
    signals.forecasting = project.data.forecast.expectedCase ? 'Healthy' : 'Unknown';
    signals.governance = project.data.operatingRhythm.frequency && project.data.operatingRhythm.frequency !== 'Never' && project.data.operatingRhythm.frequency !== 'Ad hoc' ? 'Healthy' : 'Watch';
    return signals;
  }

  function renderHealthView(mount) {
    var signals = healthSignal(project);
    mount.innerHTML = '<p class="lede">Ten separate signals, not one mysterious score.</p><div class="heatmap-grid">' +
      HEALTH_DIMENSIONS.map(function (d) {
        var status = signals[d.key] || 'Unknown';
        var cellClass = { Healthy: 'healthy', Watch: 'watch', Weak: 'weak', Critical: 'critical', Unknown: 'unknown' }[status];
        return '<div class="heatmap-cell heatmap-cell--' + cellClass + '"><strong>' + esc(d.label) + '</strong><div class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-2)">' + status + '</div></div>';
      }).join('') + '</div>';
  }

  /* ----------------------------------------------------------
     Scenarios — Sections 26-30
     ---------------------------------------------------------- */

  function renderScenariosTab(mount) {
    var views = [{ id: 'stress', label: 'Stress Test' }, { id: 'scale', label: '2x Scale Test' }, { id: 'compare', label: 'Compare Scenarios' }, { id: 'headcount', label: 'Headcount Estimate' }];
    mount.innerHTML = '<div class="bp-tabs" id="scenario-subtabs" style="margin-bottom:var(--space-5)"></div><div id="scenario-subbody"></div>';
    var tabs = mount.querySelector('#scenario-subtabs');
    tabs.innerHTML = views.map(function (v) { return '<button type="button" data-view="' + v.id + '" class="' + (viewerState.scenarioView === v.id ? 'is-active' : '') + '">' + v.label + '</button>'; }).join('');
    tabs.querySelectorAll('[data-view]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.scenarioView = btn.getAttribute('data-view'); renderScenariosTab(mount); }); });
    var body = mount.querySelector('#scenario-subbody');
    if (viewerState.scenarioView === 'scale') renderScaleTestView(body);
    else if (viewerState.scenarioView === 'compare') renderCompareView(body);
    else if (viewerState.scenarioView === 'headcount') renderHeadcountView(body);
    else renderStressTestView(body);
  }

  function renderStressTestView(mount) {
    mount.innerHTML =
      '<p class="lede">Change the assumptions below and see what happens. This is scenario analysis, not prediction.</p>' +
      '<div class="builder-field-grid">' +
        '<div class="builder-field"><label class="builder-field__label">Demand change (%)</label><input type="text" class="builder-field__input" id="st-demand" value="0"></div>' +
        '<div class="builder-field"><label class="builder-field__label">Capacity change (%)</label><input type="text" class="builder-field__input" id="st-capacity" value="0"></div>' +
        '<div class="builder-field"><label class="builder-field__label">Rework multiplier</label><input type="text" class="builder-field__input" id="st-rework" value="1"></div>' +
        '<div class="builder-field"><label class="builder-field__label">Critical people unavailable</label><input type="text" class="builder-field__input" id="st-people" value="0"></div>' +
      '</div>' +
      '<div id="st-result" style="margin-top:var(--space-5)"></div>';
    function recalc() {
      var result = C.runStressTest(project, {
        demandChangePct: mount.querySelector('#st-demand').value, capacityChangePct: mount.querySelector('#st-capacity').value,
        reworkMultiplier: mount.querySelector('#st-rework').value, peopleUnavailable: mount.querySelector('#st-people').value
      });
      mount.querySelector('#st-result').innerHTML = metricGrid([
        { label: 'Demand', value: result.demand }, { label: 'Capacity', value: result.capacity },
        { label: 'Buffer', value: (result.buffer >= 0 ? '+' : '') + result.buffer }, { label: 'Backlog Risk', value: result.backlogRisk }
      ]);
    }
    ['#st-demand', '#st-capacity', '#st-rework', '#st-people'].forEach(function (sel) { mount.querySelector(sel).addEventListener('input', recalc); });
    recalc();
  }

  function renderScaleTestView(mount) {
    var scale = C.scaleTest(project, 2);
    mount.innerHTML =
      '<p class="lede">What happens if demand doubles without changing the operating model?</p>' +
      metricGrid([
        { label: 'Demand At 2x', value: scale.testedDemand }, { label: 'Current Capacity', value: scale.capacity },
        { label: '% Of Capacity', value: scale.pctOfCapacity == null ? '—' : scale.pctOfCapacity + '%' },
        { label: 'Queue Likely To Grow', value: scale.queueLikelyToGrow ? 'Yes' : 'No' }
      ]) +
      (scale.constrainedDistribution.length ? '<div class="risk-flag risk-flag--warning" style="margin-top:var(--space-4)"><div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--warning">Stages Exceeding Capacity At 2x</span></div><p class="risk-flag__message">' + scale.constrainedDistribution.map(function (x) { return x.name; }).join(', ') + '</p></div>' : '') +
      (scale.constrainedSkills.length ? '<div class="risk-flag risk-flag--warning" style="margin-top:var(--space-3)"><div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--warning">Skills Becoming Constrained</span></div><p class="risk-flag__message">' + scale.constrainedSkills.map(function (x) { return x.name; }).join(', ') + '</p></div>' : '') +
      '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-4)">Related: Scale Readiness.</p>';
  }

  var SCENARIO_TYPES = ['Add Headcount', 'Reduce Rework', 'Remove Approval Delay', 'Change Work Allocation', 'Reduce Meeting Load', 'Automate A Step', 'Shift Work Between Teams', 'Reduce Failure Demand', 'Custom'];

  function renderCompareView(mount) {
    mount.innerHTML =
      '<p class="lede">Compare interventions instead of defaulting to staffing.</p>' +
      '<div id="scenarios-mount"></div>';
    B.repeatableList({
      mount: mount.querySelector('#scenarios-mount'), project: project, dataKey: 'scenarios',
      addLabel: 'Add Scenario', itemLabel: function (item) { return item.name || 'Scenario'; },
      defaults: function () { return { type: 'Custom' }; },
      onChange: function () { C.store.save(project); renderScenarioResults(mount); },
      fields: [
        { key: 'name', label: 'Scenario name', wide: true },
        { key: 'type', label: 'Type', type: 'select', options: SCENARIO_TYPES },
        { key: 'headcountDelta', label: 'Headcount change' },
        { key: 'reworkReductionPct', label: 'Rework reduction (%)' },
        { key: 'approvalDelayRemovedHours', label: 'Approval delay removed (hours)' },
        { key: 'meetingReductionPct', label: 'Meeting reduction (%)' },
        { key: 'failureDemandReductionPct', label: 'Failure demand reduction (%)' },
        { key: 'costNote', label: 'Cost / notes', wide: true }
      ]
    });
    var resultsMount = document.createElement('div');
    resultsMount.id = 'scenario-results';
    resultsMount.style.marginTop = 'var(--space-6)';
    mount.appendChild(resultsMount);
    renderScenarioResults(mount);
  }

  function scenarioGap(project, scenario) {
    var d = C.demandCapacityBalance(project);
    var capacity = d.capacity * (1 + (parseFloat(scenario.headcountDelta) || 0) / (parseFloat(project.data.resources.numberOfPeople) || 1));
    var rework = d.reworkUnits * (1 - (parseFloat(scenario.reworkReductionPct) || 0) / 100);
    var failure = d.failureUnits * (1 - (parseFloat(scenario.failureDemandReductionPct) || 0) / 100);
    var load = d.typical + rework + failure;
    return Math.round(capacity - load);
  }

  function renderScenarioResults(mount) {
    var resultsMount = mount.querySelector('#scenario-results');
    if (!resultsMount) return;
    var current = C.demandCapacityBalance(project);
    var rows = [{ name: 'Current', gap: current.typicalBuffer }].concat(
      (project.data.scenarios || []).map(function (s) { return { name: s.name || s.type, gap: scenarioGap(project, s) }; })
    );
    resultsMount.innerHTML = '<div class="section-head"><span class="eyebrow">Capacity Gap By Scenario</span></div>' +
      metricGrid(rows.map(function (r) { return { label: r.name, value: (r.gap >= 0 ? '+' : '') + r.gap }; }));
  }

  function renderHeadcountView(mount) {
    var est = C.headcountEstimate(project);
    if (!est) { mount.innerHTML = '<p class="callout">Enter demand and productivity to see a headcount estimate.</p>'; return; }
    mount.innerHTML =
      '<p class="lede">Only use this where staffing analysis is actually the question. Assumptions are shown, not hidden.</p>' +
      metricGrid([
        { label: 'Base Operating Need', value: est.baseOperatingNeed, note: 'people' },
        { label: 'Buffer', value: est.bufferPct + '%' },
        { label: 'Estimated Total', value: est.estimatedTotal, note: 'people' },
        { label: 'Current People', value: est.currentPeople }
      ]) +
      '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-4)">Base need = demand (incl. rework &amp; failure demand) &divide; productive rate &divide; effective hours per person. Buffer assumption is set on the Governance &amp; Forecast wizard step.</p>';
  }

  /* ----------------------------------------------------------
     Target State — Section 44
     ---------------------------------------------------------- */

  var TARGET_FIELDS = ['demand', 'rework', 'meetings', 'queue', 'allocation'];

  function renderTargetTab(mount) {
    if (!project.data.hasTargetState) {
      mount.innerHTML = '<p class="callout">Design a target state once you understand the current one. It starts as a copy so current-state evidence is never overwritten.</p><button type="button" class="btn btn--primary" id="start-target-btn">Design Target State</button>';
      mount.querySelector('#start-target-btn').addEventListener('click', function () {
        project.data.targetState = { demand: JSON.parse(JSON.stringify(project.data.demand)), rework: JSON.parse(JSON.stringify(project.data.rework)), resources: JSON.parse(JSON.stringify(project.data.resources)), capacityLosses: JSON.parse(JSON.stringify(project.data.capacityLosses)), meetings: JSON.parse(JSON.stringify(project.data.meetings)), productivity: JSON.parse(JSON.stringify(project.data.productivity)) };
        project.data.hasTargetState = true;
        C.store.save(project);
        renderTargetTab(mount);
      });
      return;
    }
    var impact = C.changeImpact(project);
    mount.innerHTML =
      '<div class="bp-chain-section__header"><span class="eyebrow">Target State</span><button type="button" class="btn btn--ghost" id="target-edit-btn">Edit Target Assumptions</button></div>' +
      '<div id="target-edit-mount" hidden></div>' +
      '<div id="target-compare-mount"></div>';
    var editMount = mount.querySelector('#target-edit-mount');
    var editBtn = mount.querySelector('#target-edit-btn');
    var editing = false;
    editBtn.addEventListener('click', function () {
      editing = !editing;
      editMount.hidden = !editing;
      editBtn.textContent = editing ? 'Hide Editor' : 'Edit Target Assumptions';
      if (editing) {
        editMount.innerHTML = '<div id="t-demand"></div><div id="t-rework"></div><div id="t-resources"></div><div id="t-productivity"></div>';
        var wrapper = { data: project.data.targetState };
        B.objectForm({ mount: editMount.querySelector('#t-demand'), project: wrapper, dataKey: 'demand', onChange: function () { C.store.save(project); renderTargetCompare(mount); }, fields: [{ key: 'typical', label: 'Target typical demand' }, { key: 'peak', label: 'Target peak demand' }] });
        B.objectForm({ mount: editMount.querySelector('#t-rework'), project: wrapper, dataKey: 'rework', onChange: function () { C.store.save(project); renderTargetCompare(mount); }, fields: [{ key: 'pctOfCapacity', label: 'Target rework % of capacity' }] });
        B.objectForm({ mount: editMount.querySelector('#t-resources'), project: wrapper, dataKey: 'resources', onChange: function () { C.store.save(project); renderTargetCompare(mount); }, fields: [{ key: 'numberOfPeople', label: 'Target number of people' }, { key: 'workingDaysPerPeriod', label: 'Working days per period' }, { key: 'hoursPerDay', label: 'Hours per day' }] });
        B.objectForm({ mount: editMount.querySelector('#t-productivity'), project: wrapper, dataKey: 'productivity', onChange: function () { C.store.save(project); renderTargetCompare(mount); }, fields: [{ key: 'avgRateValue', label: 'Target productive rate' }, { key: 'avgRateUnit', label: 'Rate unit', type: 'select', options: ['per hour', 'per day', 'per week'] }] });
      }
    });
    renderTargetCompare(mount);
  }

  function renderTargetCompare(mount) {
    var compareMount = mount.querySelector('#target-compare-mount');
    var impact = C.changeImpact(project);
    if (!impact) { compareMount.innerHTML = ''; return; }
    compareMount.innerHTML =
      '<dl class="dva-row">' +
        '<div class="dva-row__col"><h5>Current State</h5>' + metricGrid([
          { label: 'Typical Demand', value: impact.current.typical }, { label: 'Capacity', value: impact.current.capacity },
          { label: 'Buffer', value: impact.current.typicalBuffer }, { label: 'Rework Units', value: impact.current.reworkUnits }
        ]) + '</div>' +
        '<div class="dva-row__col"><h5>Target State</h5>' + metricGrid([
          { label: 'Typical Demand', value: impact.target.typical }, { label: 'Capacity', value: impact.target.capacity },
          { label: 'Buffer', value: impact.target.typicalBuffer }, { label: 'Rework Units', value: impact.target.reworkUnits }
        ]) + '</div>' +
      '</dl>' +
      '<div class="callout" style="margin-top:var(--space-4)">Expected based on target design: buffer changes from ' + impact.current.typicalBuffer + ' to ' + impact.target.typicalBuffer + '. This is not a guaranteed business result.</div>';
  }

  /* ----------------------------------------------------------
     Summary — Section 45
     ---------------------------------------------------------- */

  function renderSummaryTab(mount) {
    mount.innerHTML = '<div class="bp-tabs" id="sum-subtabs" style="margin-bottom:var(--space-5)"></div><div id="sum-subbody"></div>';
    var views = [{ id: 'summary', label: 'Summary' }, { id: 'executive', label: 'Executive View' }];
    var tabs = mount.querySelector('#sum-subtabs');
    tabs.innerHTML = views.map(function (v) { return '<button type="button" data-view="' + v.id + '" class="' + (viewerState.summaryView === v.id ? 'is-active' : '') + '">' + v.label + '</button>'; }).join('');
    tabs.querySelectorAll('[data-view]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.summaryView = btn.getAttribute('data-view'); renderSummaryTab(mount); }); });
    var body = mount.querySelector('#sum-subbody');
    if (viewerState.summaryView === 'executive') renderExecutiveView(body);
    else renderDetailedSummary(body);
  }

  function renderDetailedSummary(mount) {
    var d = C.demandCapacityBalance(project);
    var diag = C.capacityDiagnosis(project);
    var flags = C.findings(project);
    mount.innerHTML =
      '<div class="card">' +
        '<span class="eyebrow">Capacity Summary</span>' +
        '<h2 style="margin:var(--space-2) 0">' + esc(project.name) + '</h2>' +
        '<p><strong>System:</strong> ' + esc(project.systemTeam || project.data.subjectType || '—') + ' &nbsp; <strong>Owner:</strong> ' + esc(project.owner || project.data.capacityOwner || 'No owner named') + '</p>' +
        metricGrid([
          { label: 'Typical Demand', value: d.typical }, { label: 'Peak Demand', value: d.peak }, { label: 'Capacity', value: d.capacity },
          { label: 'Buffer', value: d.typicalBuffer }, { label: 'Utilization', value: d.utilization == null ? '—' : d.utilization + '%' },
          { label: 'Rework Tax', value: project.data.rework.pctOfCapacity + '%' }
        ]) +
        '<span class="eyebrow" style="margin-top:var(--space-5);display:block">Diagnosis Signal</span><p>' + esc(diag.signal) + '</p>' +
        '<span class="eyebrow" style="margin-top:var(--space-5);display:block">Major Findings</span>' +
        (flags.length ? '<ul style="margin:var(--space-2) 0 0 1.2em">' + flags.slice(0, 6).map(function (f) { return '<li>' + esc(f.rule) + '</li>'; }).join('') + '</ul>' : '<p class="text-dim">None flagged.</p>') +
      '</div>' +
      '<div class="hero__actions" style="margin-top:var(--space-5)"><button type="button" class="btn btn--secondary" id="cap-export-btn">Export JSON</button><button type="button" class="btn btn--secondary" id="cap-print-btn">Print / Save As PDF</button><a class="btn btn--secondary" href="' + operationalHealthHref('importCap', project.id) + '">Send To Health Model</a></div>';
    mount.querySelector('#cap-export-btn').addEventListener('click', function () { B.exportJson(project); });
    mount.querySelector('#cap-print-btn').addEventListener('click', function () { global.print(); });
  }

  function renderExecutiveView(mount) {
    var d = C.demandCapacityBalance(project);
    var diag = C.capacityDiagnosis(project);
    var flags = C.findings(project);
    var qb = C.queueBehavior(project);
    mount.innerHTML =
      '<div class="card">' +
        '<span class="eyebrow">Executive Capacity View</span>' +
        '<h2 style="margin:var(--space-2) 0">' + esc(project.name) + '</h2>' +
        '<p><strong>System:</strong> ' + esc(project.systemTeam || '—') + '</p>' +
        metricGrid([{ label: 'Demand', value: d.typical }, { label: 'Capacity', value: d.capacity }, { label: 'Buffer', value: d.typicalBuffer }]) +
        '<p style="margin-top:var(--space-4)"><strong>Queue Trend:</strong> ' + (qb ? (qb.structurallyGrowing ? 'Growing' : 'Stable') : 'Unknown') + '</p>' +
        '<p><strong>Primary Constraint Signal:</strong> ' + esc(diag.signal) + '</p>' +
        '<p><strong>Main Capacity Loss:</strong> ' + esc(largestLoss(project)) + '</p>' +
        '<p><strong>Risk:</strong> ' + (flags[0] ? esc(flags[0].rule) : 'None flagged') + '</p>' +
        '<p><strong>Recommended Investigation:</strong> ' + esc(diag.message) + '</p>' +
      '</div>' +
      '<div class="hero__actions" style="margin-top:var(--space-5)"><button type="button" class="btn btn--secondary" id="cap-exec-print-btn">Print / Save As PDF</button></div>';
    mount.querySelector('#cap-exec-print-btn').addEventListener('click', function () { global.print(); });
  }

  function largestLoss(project) {
    var losses = C.lossBreakdown(project);
    var top = losses.slice().sort(function (a, b) { return b.hours - a.hours; })[0];
    return top ? top.category + ' (' + Math.round(top.hours) + ' hrs)' : 'Not enough data';
  }

  /* ----------------------------------------------------------
     Launcher
     ---------------------------------------------------------- */

  function renderResumeList() {
    var list = C.store.list().slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
    if (!els.resumeList) return;
    if (!list.length) { els.resumeList.innerHTML = ''; return; }
    els.resumeList.innerHTML = '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">My Capacity Models</span></div>' +
      list.map(function (m) {
        var d = C.demandCapacityBalance(m);
        return '<div class="build-project-row" data-id="' + m.id + '">' +
          '<div class="build-project-row__meta">' +
            (m.isSample ? '<span class="badge badge--accent">Sample</span>' : '') +
            '<strong>' + esc(m.name) + '</strong>' +
            '<span class="text-dim text-mono" style="font-size:var(--step--1)">' + (d.utilization == null ? 'Incomplete' : d.utilization + '% utilization') + ' &middot; Updated ' + B.formatDate(m.updatedAt) + '</span>' +
          '</div>' +
          '<div class="build-project-row__actions">' +
            '<button type="button" class="btn btn--secondary" data-open="' + m.id + '">Open</button>' +
            '<button type="button" class="btn btn--ghost" data-edit="' + m.id + '">Edit</button>' +
            '<button type="button" class="btn btn--ghost" data-duplicate="' + m.id + '">Duplicate</button>' +
            '<button type="button" class="btn btn--ghost" data-export="' + m.id + '">Export</button>' +
            '<button type="button" class="btn btn--ghost" data-delete="' + m.id + '">Delete</button>' +
          '</div>' +
        '</div>';
      }).join('');

    els.resumeList.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { project = C.store.get(b.getAttribute('data-open')); enterViewer(); }); });
    els.resumeList.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { project = C.store.get(b.getAttribute('data-edit')); enterWizard(); }); });
    els.resumeList.querySelectorAll('[data-duplicate]').forEach(function (b) { b.addEventListener('click', function () { C.store.duplicate(b.getAttribute('data-duplicate')); renderResumeList(); }); });
    els.resumeList.querySelectorAll('[data-export]').forEach(function (b) { b.addEventListener('click', function () { B.exportJson(C.store.get(b.getAttribute('data-export'))); }); });
    els.resumeList.querySelectorAll('[data-delete]').forEach(function (b) {
      b.addEventListener('click', function () { if (global.confirm('Delete this Capacity Model? This cannot be undone.')) { C.store.remove(b.getAttribute('data-delete')); renderResumeList(); } });
    });
  }

  function backToLauncher() {
    els.launcher.hidden = false;
    els.wizard.hidden = true;
    els.viewer.hidden = true;
    if (els.viewerSection) els.viewerSection.hidden = true;
    renderResumeList();
    updateUrl();
  }

  function updateUrl() {
    var qs = project ? '?model=' + project.id : '';
    global.history.replaceState(null, '', global.location.pathname + qs);
  }

  /* ----------------------------------------------------------
     Init
     ---------------------------------------------------------- */

  function init() {
    B = global.OMSBuilder;
    C = global.OMSCapacity;
    VS = global.OMSValueStream;

    els.launcher = byId('cap-launcher');
    els.wizard = byId('cap-wizard');
    els.viewer = byId('cap-viewer');
    els.viewerBody = byId('cap-viewer-body');
    els.viewerSection = byId('cap-viewer-section');
    els.sampleBanner = byId('cap-sample-banner');
    els.resumeList = byId('cap-resume-list');
    els.progress = byId('builder-progress');
    els.stepBody = byId('builder-step-body');
    els.prev = byId('builder-prev');
    els.next = byId('builder-next');
    els.stepLabel = byId('builder-step-label');
    els.projectName = byId('builder-project-name');

    var newBtn = byId('new-cap-btn');
    var sampleBtn = byId('load-sample-cap-btn');
    var exitBtn = byId('builder-exit');
    var viewerExitBtn = byId('viewer-exit');
    var viewerEditBtn = byId('viewer-edit');

    if (newBtn) newBtn.addEventListener('click', function () {
      var name = global.prompt('Name this Capacity Model:', 'New Capacity Model');
      if (name === null) return;
      project = C.store.create(name || 'New Capacity Model', C.blankData(), false);
      enterWizard();
    });
    if (sampleBtn) sampleBtn.addEventListener('click', function () {
      var built = global.OMSCapacitySample.build();
      project = C.store.create('Implementation Operations — Sample', built.data, true);
      project.owner = built.owner;
      project.systemTeam = built.systemTeam;
      C.store.save(project);
      enterViewer();
    });
    if (exitBtn) exitBtn.addEventListener('click', backToLauncher);
    if (viewerExitBtn) viewerExitBtn.addEventListener('click', backToLauncher);
    if (viewerEditBtn) viewerEditBtn.addEventListener('click', function () { enterWizard(); });

    els.viewerBody && els.viewerBody.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'edit-diagnosis-btn') {
        e.preventDefault();
        project.currentStep = WIZARD_STEPS.length - 1;
        C.store.save(project);
        enterWizard();
      }
    });

    var params = new URLSearchParams(global.location.search);
    var requestedId = params.get('model');
    var prefillQueueVs = params.get('fromValueStream');
    var prefillQueueId = params.get('queue');
    var existing = requestedId ? C.store.get(requestedId) : null;

    if (existing) { project = existing; enterViewer(); }
    else if (prefillQueueVs && VS) { createFromValueStreamQueue(prefillQueueVs, prefillQueueId); }
    else { backToLauncher(); }
  }

  function createFromValueStreamQueue(vsId, queueId) {
    var vs = VS.store.get(vsId);
    if (!vs) { backToLauncher(); return; }
    var q = queueId ? VS.byId(vs.data.queues, queueId) : (vs.data.queues || [])[0];
    var data = C.blankData();
    data.subjectType = 'Queue';
    data.relatedValueStreamId = vs.id;
    if (q) {
      var stage = VS.byId(vs.data.stages, q.afterStageId);
      data.relatedValueStreamStageId = stage ? stage.id : '';
      data.queue = { name: q.name, arrivalRate: q.arrivalRate, processingRate: q.processingRate, waitTimeValue: q.avgWaitTimeValue, waitTimeUnit: q.avgWaitTimeUnit, queueSize: q.avgItemsWaiting, importedFromValueStream: true, sourceQueueId: q.id };
    }
    project = C.store.create((q ? q.name : vs.name) + ' — Capacity', data, false);
    if (q && q.owner) project.owner = q.owner;
    C.store.save(project);
    enterWizard();
  }

  global.OMSCapacityPage = { init: init, get project() { return project; } };
})(window);
