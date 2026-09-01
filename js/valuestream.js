/*
 * Operations Maturity System
 * Value Stream Intelligence — page controller.
 *
 * Drives pages/value-streams.html on top of js/valuestream-core.js (data
 * model + deterministic rules). Three phases share one page, the same
 * pattern as the Organization Blueprint:
 * - LAUNCHER: create, load the Northstar sample, import from an existing
 *   Blueprint, or resume a saved Value Stream.
 * - WIZARD: Start With Value, then Stages, Queues, Handoffs, Friction,
 *   Rework, Approvals, Metrics, and Constraint — built on the same
 *   shared field widgets (js/builder-core.js) every other builder uses.
 * - VIEWER: Overview, Flow Detail (Queues/Handoffs/Rework/Approvals/
 *   Systems), Friction & Risk, Trace, Target State, and Summary — all
 *   reading live from js/valuestream-core.js.
 *
 * The Handoff Analyzer is not a separate tool. It lives inside the Flow
 * Detail tab's Handoffs view, on purpose — Value Streams and Handoffs
 * are meant to feel like one system, not two.
 */
(function (global) {
  'use strict';

  var B = null;   // OMSBuilder (shared field widgets)
  var VS = null;  // OMSValueStream (data model + engine)
  var BP = null;  // OMSBlueprint (import/export integration)
  var els = {};
  var project = null;
  var viewerState = { tab: 'overview', flowView: 'queues', frView: 'heatmap', traceView: 'delay', summaryView: 'summary', traceTarget: null };

  function byId(id) { return document.getElementById(id); }
  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function opts(list, nameField) {
    return (list || []).map(function (item) { return { value: item.id, label: typeof nameField === 'function' ? nameField(item) : item[nameField] }; });
  }
  function stageName(id) { var s = VS.byId(project.data.stages, id); return s ? s.name : '(unknown stage)'; }
  function stageOptions() { return opts(project.data.stages, 'name'); }
  function handoffOptions() { return opts(project.data.handoffs, function (h) { return stageName(h.fromStageId) + ' → ' + stageName(h.toStageId); }); }

  var UNIT_OPTIONS = ['minutes', 'hours', 'days'];
  var VOLUME_OPTIONS = ['Low', 'Medium', 'High', 'Very High'];
  var CRITICALITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];
  var YES_NO = ['Yes', 'No'];

  /* ----------------------------------------------------------
     Wizard — Step 1: Start With Value (Section 2)
     ---------------------------------------------------------- */

  function stepValue(container, proj, ctrl) {
    container.innerHTML =
      '<h3>What value are we trying to create?</h3>' +
      '<p class="lede">Define the value before mapping any internal steps. A value stream starts and ends with something a customer or recipient actually experiences &mdash; not with a department.</p>' +
      '<div class="builder-field-grid" id="value-fields"></div>';

    var mount = container.querySelector('#value-fields');
    var fields = [
      { key: 'name', label: 'Value stream name', wide: true, placeholder: 'e.g. Lead to Customer, Order to Delivery, Issue to Resolution' },
      { key: 'owner', label: 'Value stream owner (end-to-end)', placeholder: 'Who is accountable for the whole thing, not just one stage?' },
      { key: 'criticality', label: 'Criticality', type: 'select', options: CRITICALITY_OPTIONS }
    ];
    mount.innerHTML = fields.map(function (f) {
      return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, proj[f.key], 'vs-' + f.key) + '</div>';
    }).join('');
    B.bindFieldEvents(mount, proj, fields, ctrl.persist);

    var metaMount = document.createElement('div');
    metaMount.className = 'builder-field-grid';
    metaMount.style.marginTop = 'var(--space-5)';
    container.appendChild(metaMount);
    B.objectForm({
      mount: metaMount, project: proj, dataKey: 'meta', onChange: ctrl.persist,
      fields: [
        { key: 'customer', label: 'Customer / value recipient', wide: true, placeholder: 'Who receives the value?' },
        { key: 'trigger', label: 'Trigger', wide: true, placeholder: 'What starts this value stream?' },
        { key: 'expectedValue', label: 'Expected value', type: 'textarea', wide: true, placeholder: 'What does the recipient actually get at the end?' },
        { key: 'startingCondition', label: 'Starting condition', placeholder: 'What is true right before this stream begins?' },
        { key: 'endingCondition', label: 'Ending condition', placeholder: 'What is true once this stream is complete?' },
        { key: 'businessOutcome', label: 'Business outcome', wide: true, placeholder: 'Why does this matter to the organization?' }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 2: Stages (Section 3/4)
     ---------------------------------------------------------- */

  function stageFields() {
    return [
      { key: 'name', label: 'Stage name', wide: true },
      { key: 'purpose', label: 'Purpose', type: 'textarea', wide: true },
      { key: 'owner', label: 'Owner' },
      { key: 'team', label: 'Team / function' },
      { key: 'capability', label: 'Capability' },
      { key: 'input', label: 'Input' },
      { key: 'workPerformed', label: 'Work performed', type: 'textarea', wide: true },
      { key: 'output', label: 'Output' },
      { key: 'system', label: 'System / technology' },
      { key: 'dataRequired', label: 'Data required' },
      { key: 'decisionRequired', label: 'Decision required' },
      { key: 'volume', label: 'Approximate volume', type: 'select', options: VOLUME_OPTIONS },
      { key: 'workTimeValue', label: 'Work time (active, value-creating)' },
      { key: 'workTimeUnit', label: 'Work time unit', type: 'select', options: UNIT_OPTIONS },
      { key: 'waitTimeValue', label: 'Wait time (before next action)' },
      { key: 'waitTimeUnit', label: 'Wait time unit', type: 'select', options: UNIT_OPTIONS },
      { key: 'quality', label: 'Quality requirement' },
      { key: 'commonException', label: 'Common exception' },
      { key: 'criticality', label: 'Criticality', type: 'select', options: CRITICALITY_OPTIONS },
      { key: 'hasBackup', label: 'Backup owner exists?', type: 'select', options: YES_NO },
      { key: 'handoffAfter', label: 'Handoff after this stage?', type: 'select', options: YES_NO }
    ];
  }

  function blankStage() {
    return { workTimeUnit: 'hours', waitTimeUnit: 'hours' };
  }

  function stepStages(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Value Stream Stages</h3>' +
      '<p class="lede">Every stage distinguishes work time (actively creating value) from wait time (sitting before the next action). That distinction is the point &mdash; a long cycle time usually means waiting, not slow work.</p>' +
      '<div id="stages-mount"></div>' +
      '<div id="suggested-handoffs-mount" style="margin-top:var(--space-6)"></div>';

    B.repeatableList({
      mount: container.querySelector('#stages-mount'), project: proj, dataKey: 'stages',
      addLabel: 'Add Stage', itemLabel: function (item, i) { return item.name || 'Stage ' + (i + 1); },
      defaults: blankStage, onChange: function () { ctrl.persist(); renderSuggestedHandoffs(container.querySelector('#suggested-handoffs-mount'), proj, ctrl); },
      fields: stageFields()
    });

    renderSuggestedHandoffs(container.querySelector('#suggested-handoffs-mount'), proj, ctrl);
  }

  function renderSuggestedHandoffs(mount, proj, ctrl) {
    var suggestions = VS.detectPotentialHandoffs(proj, 'current');
    if (!suggestions.length) { mount.innerHTML = ''; return; }
    mount.innerHTML =
      '<div class="callout">' +
        '<strong style="display:block;margin-bottom:var(--space-2)">Define the handoff</strong>' +
        'Ownership, team, capability, or system changes between these stages. That is usually where a handoff exists whether or not anyone designed one.' +
      '</div>' +
      suggestions.map(function (s) {
        return '<div class="trace-node" style="cursor:default;margin-top:var(--space-3)">' +
          '<span>' + esc(s.fromName) + ' → ' + esc(s.toName) + ' <span class="text-dim" style="font-size:var(--step--1)">(' + s.reasons.join(', ') + ' changes)</span></span>' +
          '<button type="button" class="btn btn--secondary" data-define="' + s.fromStageId + '|' + s.toStageId + '">Define The Handoff</button>' +
        '</div>';
      }).join('');
    mount.querySelectorAll('[data-define]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ids = btn.getAttribute('data-define').split('|');
        proj.data.handoffs.push({ id: VS.newId('handoff'), fromStageId: ids[0], toStageId: ids[1] });
        ctrl.persist();
        renderSuggestedHandoffs(mount, proj, ctrl);
        global.alert('Handoff added. Fill in its details on the Handoffs step.');
      });
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 3: Queues (Section 7)
     ---------------------------------------------------------- */

  function stepQueues(container, proj, ctrl) {
    container.innerHTML = '<h3>Queues</h3><p class="lede">Where does work sit waiting between stages? A queue is not a failure by itself &mdash; but an unowned, growing, or highly variable one usually is a sign of something.</p><div id="queues-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#queues-mount'), project: proj, dataKey: 'queues',
      addLabel: 'Add Queue', itemLabel: function (item, i) { return item.name || 'Queue ' + (i + 1); },
      defaults: function () { return { avgWaitTimeUnit: 'hours', maxWaitTimeUnit: 'hours' }; }, onChange: ctrl.persist,
      fields: [
        { key: 'name', label: 'Queue name', wide: true },
        { key: 'whatIsWaiting', label: 'What is waiting?', wide: true },
        { key: 'owner', label: 'Queue owner' },
        { key: 'afterStageId', label: 'Sits after which stage?', type: 'select', options: stageOptions() },
        { key: 'avgItemsWaiting', label: 'Average items waiting' },
        { key: 'avgWaitTimeValue', label: 'Average wait time' },
        { key: 'avgWaitTimeUnit', label: 'Average wait unit', type: 'select', options: UNIT_OPTIONS },
        { key: 'maxWaitTimeValue', label: 'Max / peak wait' },
        { key: 'maxWaitTimeUnit', label: 'Max wait unit', type: 'select', options: UNIT_OPTIONS },
        { key: 'arrivalRate', label: 'Arrival rate (if known)' },
        { key: 'processingRate', label: 'Processing rate (if known)' },
        { key: 'commonReason', label: 'Common reason for wait', type: 'textarea', wide: true },
        { key: 'growing', label: 'Is this queue currently growing?', type: 'select', options: YES_NO },
        { key: 'requiresSeniorApproval', label: 'Requires senior approval to move?', type: 'select', options: YES_NO },
        { key: 'noPrioritizationRule', label: 'No prioritization rule exists?', type: 'select', options: YES_NO }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 4: Handoffs (Sections 9/11)
     ---------------------------------------------------------- */

  function stepHandoffs(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Handoffs</h3>' +
      '<p class="lede">The seams between teams are often where otherwise good systems fail. Each handoff becomes a lightweight operating agreement &mdash; a Handoff Contract &mdash; not a legal document.</p>' +
      '<div id="handoffs-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#handoffs-mount'), project: proj, dataKey: 'handoffs',
      addLabel: 'Add Handoff', itemLabel: function (item) { return stageName(item.fromStageId) + ' → ' + stageName(item.toStageId); },
      defaults: function () { return { expectedTimingUnit: 'days' }; }, onChange: ctrl.persist,
      fields: [
        { key: 'fromStageId', label: 'From stage', type: 'select', options: stageOptions() },
        { key: 'toStageId', label: 'To stage', type: 'select', options: stageOptions() },
        { key: 'whatMoves', label: 'What moves?', wide: true },
        { key: 'sender', label: 'Who sends it?' },
        { key: 'receiver', label: 'Who receives it?' },
        { key: 'requiredInfo', label: 'What information is required?', wide: true },
        { key: 'entryCriteria', label: 'What makes it ready to hand off?', wide: true },
        { key: 'acceptableDefinition', label: 'What makes it acceptable?', wide: true },
        { key: 'qualityStandard', label: 'Quality standard' },
        { key: 'expectedTimingValue', label: 'Expected timing' },
        { key: 'expectedTimingUnit', label: 'Expected timing unit', type: 'select', options: UNIT_OPTIONS },
        { key: 'confirmationMethod', label: 'How is receipt confirmed?' },
        { key: 'incompleteHandling', label: 'What happens if information is incomplete?', wide: true },
        { key: 'incompleteInfoCommon', label: 'Is incomplete information a common occurrence?', type: 'select', options: YES_NO },
        { key: 'rejectionConditions', label: 'Rejection conditions' },
        { key: 'escalation', label: 'Escalation path' },
        { key: 'disputeResolution', label: 'Who resolves disputes / exceptions?' },
        { key: 'contractOwner', label: 'Handoff owner' },
        { key: 'metric', label: 'Metric' },
        { key: 'manualReentry', label: 'Requires manual re-entry of information?', type: 'select', options: YES_NO },
        { key: 'disputedOwnership', label: 'Is ownership disputed or unclear?', type: 'select', options: YES_NO }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 5: Friction (Section 13)
     ---------------------------------------------------------- */

  var FRICTION_TYPES = ['Waiting', 'Rework', 'Approval', 'Searching For Information', 'Duplicate Entry', 'Unclear Ownership', 'System Switching', 'Manual Work', 'Exception', 'Escalation', 'Quality Failure', 'Priority Conflict', 'Capacity', 'Decision Delay'];

  function stepFriction(container, proj, ctrl) {
    container.innerHTML = '<h3>Friction</h3><p class="lede">Tag places where work gets harder than it should be. This is observation, not diagnosis.</p><div id="friction-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#friction-mount'), project: proj, dataKey: 'friction',
      addLabel: 'Add Friction Point', itemLabel: function (item) { return item.type || 'Friction'; }, onChange: ctrl.persist,
      fields: [
        { key: 'type', label: 'Type', type: 'select', options: FRICTION_TYPES },
        { key: 'description', label: 'Description', type: 'textarea', wide: true },
        { key: 'frequency', label: 'Frequency', type: 'select', options: ['Rare', 'Occasional', 'Frequent', 'Every case'] },
        { key: 'impact', label: 'Impact', type: 'select', options: CRITICALITY_OPTIONS },
        { key: 'stageId', label: 'Stage', type: 'select', options: stageOptions() },
        { key: 'owner', label: 'Owner' },
        { key: 'evidence', label: 'Observed evidence', wide: true }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 6: Rework (Section 17)
     ---------------------------------------------------------- */

  function stepRework(container, proj, ctrl) {
    container.innerHTML = '<h3>Where Does Work Come Back?</h3><p class="lede">Record when work returns to an earlier stage. This exposes loops that a one-way process map would hide.</p><div id="rework-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#rework-mount'), project: proj, dataKey: 'rework',
      addLabel: 'Add Rework Loop', itemLabel: function (item) { return stageName(item.toStageId) + ' → ' + stageName(item.fromStageId); },
      defaults: function () { return { timeImpactUnit: 'days' }; }, onChange: ctrl.persist,
      fields: [
        { key: 'toStageId', label: 'Rework starts at (the stage where the problem was found)', type: 'select', options: stageOptions() },
        { key: 'fromStageId', label: 'Work returns to', type: 'select', options: stageOptions() },
        { key: 'cause', label: 'Cause (if known)', type: 'textarea', wide: true },
        { key: 'frequency', label: 'Frequency', type: 'select', options: ['Rare', 'Occasional', 'Frequent', 'Often'] },
        { key: 'timeImpactValue', label: 'Estimated time impact' },
        { key: 'timeImpactUnit', label: 'Time impact unit', type: 'select', options: UNIT_OPTIONS },
        { key: 'missingInfo', label: 'Common missing information', wide: true },
        { key: 'relatedHandoffId', label: 'Related handoff', type: 'select', options: handoffOptions() }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 7: Approvals (Section 18)
     ---------------------------------------------------------- */

  function stepApprovals(container, proj, ctrl) {
    container.innerHTML = '<h3>Approvals</h3><p class="lede">For each approval point, ask what risk it actually controls &mdash; and whether a threshold could replace case-by-case sign-off.</p><div id="approvals-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#approvals-mount'), project: proj, dataKey: 'approvals',
      addLabel: 'Add Approval', itemLabel: function (item) { return item.decision || 'Approval'; },
      defaults: function () { return { waitTimeUnit: 'days' }; }, onChange: ctrl.persist,
      fields: [
        { key: 'decision', label: 'Decision', wide: true },
        { key: 'approver', label: 'Approver' },
        { key: 'stageId', label: 'Stage', type: 'select', options: stageOptions() },
        { key: 'requiredInfo', label: 'Required information', wide: true },
        { key: 'frequency', label: 'Frequency' },
        { key: 'waitTimeValue', label: 'Typical wait time' },
        { key: 'waitTimeUnit', label: 'Wait time unit', type: 'select', options: UNIT_OPTIONS },
        { key: 'threshold', label: 'Threshold (below which no approval is needed)', wide: true },
        { key: 'escalation', label: 'Escalation' },
        { key: 'riskControlled', label: 'What risk does this approval control?', wide: true }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 8: Metrics (Section 27) + Constraint (Section 21)
     ---------------------------------------------------------- */

  function stepMetrics(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Metrics</h3><p class="lede">For every metric, ask: what decision does this actually enable? A metric nobody acts on isn\'t worth tracking.</p><div id="metrics-mount"></div>' +
      '<h3 style="margin-top:var(--space-7)">Current Constraint</h3><p class="lede">What is most limiting this value stream right now? OMS will not declare a root cause for you.</p><div id="constraint-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#metrics-mount'), project: proj, dataKey: 'metrics',
      addLabel: 'Add Metric', itemLabel: function (item) { return item.name || 'Metric'; }, onChange: ctrl.persist,
      fields: [
        { key: 'name', label: 'Metric name', wide: true },
        { key: 'value', label: 'Current value' },
        { key: 'target', label: 'Target' },
        { key: 'unit', label: 'Unit' },
        { key: 'stageId', label: 'Measured at stage', type: 'select', options: stageOptions() },
        { key: 'isEarlyWarning', label: 'Early warning signal?', type: 'select', options: YES_NO },
        { key: 'decisionEnabled', label: 'What decision does this enable?', wide: true }
      ]
    });
    B.objectForm({
      mount: container.querySelector('#constraint-mount'), project: proj, dataKey: 'constraint', onChange: ctrl.persist,
      fields: [
        { key: 'type', label: 'Constraint type', type: 'select', options: ['Capacity', 'Decision', 'Handoff', 'Queue', 'Process', 'Technology', 'Data', 'Quality', 'Ownership', 'Policy', 'Prioritization', 'Unknown'] },
        { key: 'note', label: 'Note', type: 'textarea', wide: true },
        { key: 'systemsToInvestigate', label: 'Systems to investigate', wide: true }
      ]
    });
  }

  var WIZARD_STEPS = [
    { id: 'value', label: 'Start With Value', render: stepValue },
    { id: 'stages', label: 'Stages', render: stepStages },
    { id: 'queues', label: 'Queues', render: stepQueues },
    { id: 'handoffs', label: 'Handoffs', render: stepHandoffs },
    { id: 'friction', label: 'Friction', render: stepFriction },
    { id: 'rework', label: 'Rework', render: stepRework },
    { id: 'approvals', label: 'Approvals', render: stepApprovals },
    { id: 'metrics', label: 'Metrics & Constraint', render: stepMetrics }
  ];

  function enterWizard() {
    els.launcher.hidden = true;
    els.viewer.hidden = true;
    if (els.viewerSection) els.viewerSection.hidden = true;
    els.wizard.hidden = false;
    els.projectName.textContent = project.name;
    B.initWizard({ project: project, steps: WIZARD_STEPS, store: VS.store, els: { progress: els.progress, body: els.stepBody, prev: els.prev, next: els.next, stepLabel: els.stepLabel } });
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
      ' this is the Northstar Software "Lead to Live Customer" sample, used to show how the flow and handoff rules behave. It does not represent your organization.'
    );
    global.OMSData.bindSampleBanner(els.sampleBanner, {
      onExit: function () { backToLauncher(); },
      onClear: function () {
        if (!global.confirm('Delete the sample Value Stream? This cannot be undone.')) return;
        VS.store.remove(project.id);
        project = null;
        backToLauncher();
      }
    });
  }

  var VIEWER_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'flow', label: 'Flow Detail' },
    { id: 'friction', label: 'Friction & Risk' },
    { id: 'trace', label: 'Trace' },
    { id: 'target', label: 'Target State' },
    { id: 'summary', label: 'Summary' }
  ];

  function renderViewer() {
    els.viewerBody.innerHTML =
      '<div class="bp-toolbar"><div class="bp-tabs" id="vs-tabs"></div></div>' +
      '<div id="vs-tab-body"></div>';
    var tabsEl = els.viewerBody.querySelector('#vs-tabs');
    tabsEl.innerHTML = VIEWER_TABS.map(function (t) {
      return '<button type="button" data-tab="' + t.id + '" class="' + (viewerState.tab === t.id ? 'is-active' : '') + '">' + t.label + '</button>';
    }).join('');
    tabsEl.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { viewerState.tab = btn.getAttribute('data-tab'); renderViewer(); });
    });
    var body = els.viewerBody.querySelector('#vs-tab-body');
    if (viewerState.tab === 'flow') renderFlowTab(body);
    else if (viewerState.tab === 'friction') renderFrictionTab(body);
    else if (viewerState.tab === 'trace') renderTraceTab(body);
    else if (viewerState.tab === 'target') renderTargetTab(body);
    else if (viewerState.tab === 'summary') renderSummaryTab(body);
    else renderOverviewTab(body);
  }

  /* ----------------------------------------------------------
     Overview — Sections 2, 5, 6, 15
     ---------------------------------------------------------- */

  function metricGrid(metrics) {
    return '<div class="metric-grid">' + metrics.map(function (m) {
      return '<div class="metric-card"><span class="metric-card__label">' + esc(m.label) + '</span>' +
        '<span class="metric-card__value metric-card__value--accent">' + m.value + '</span>' +
        (m.note ? '<span class="metric-card__note">' + esc(m.note) + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  }

  function renderOverviewTab(mount) {
    var flow = VS.calcFlow(project, 'current');
    var meta = project.data.meta || {};

    mount.innerHTML =
      '<div class="card" style="margin-bottom:var(--space-6)">' +
        '<span class="eyebrow">What Value Are We Trying To Create?</span>' +
        '<p style="margin:var(--space-3) 0"><strong>' + esc(meta.expectedValue || 'Not yet defined') + '</strong></p>' +
        '<div class="build-project-row__meta">' +
          (meta.customer ? '<span class="badge badge--outline">Customer: ' + esc(meta.customer) + '</span>' : '') +
          (meta.trigger ? '<span class="badge badge--outline">Trigger: ' + esc(meta.trigger) + '</span>' : '') +
          (project.owner ? '<span class="badge badge--outline">Owner: ' + esc(project.owner) + '</span>' : '<span class="badge badge--outline" style="border-color:var(--color-critical);color:var(--color-critical)">No end-to-end owner</span>') +
          (project.criticality ? '<span class="badge badge--outline">' + esc(project.criticality) + ' criticality</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="section-head"><span class="eyebrow">Flow, Calculated</span><h3>How this value stream actually moves</h3></div>' +
      metricGrid([
        { label: 'Total Lead Time', value: VS.fmtHours(flow.totalLeadHours) },
        { label: 'Work Time', value: VS.fmtHours(flow.totalWorkHours), note: 'value-creating' },
        { label: 'Wait Time', value: VS.fmtHours(flow.totalWaitHours), note: 'non-value-creating' },
        { label: 'Flow Efficiency', value: flow.flowEfficiency == null ? '—' : Math.round(flow.flowEfficiency * 100) + '%' },
        { label: 'Handoffs', value: flow.handoffCount },
        { label: 'Approvals', value: flow.approvalCount },
        { label: 'Ownership Changes', value: flow.ownershipChanges },
        { label: 'System Changes', value: flow.systemChanges },
        { label: 'Exception Points', value: flow.exceptionPoints },
        { label: 'Rework Occurrences', value: flow.reworkOccurrences }
      ]) +
      renderFlowEfficiencyExplainer(flow) +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Timeline</span><h3>Where the time actually goes</h3></div>' +
      renderTimeline(project.data.stages) +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Stages &amp; Process Architect</span><h3>Design one stage without redoing it here</h3></div>' +
      '<div id="vs-process-links"></div>' +
      renderConstraintPanel();

    renderProcessLinks(mount.querySelector('#vs-process-links'));
  }

  function renderProcessLinks(mount) {
    var stages = project.data.stages || [];
    if (!stages.length) { mount.innerHTML = '<p class="text-dim" style="font-size:var(--step--1)">No stages mapped yet.</p>'; return; }
    mount.innerHTML = stages.map(function (s) {
      var linked = s.relatedProcessId && B.store.get(s.relatedProcessId);
      return '<div class="trace-node" style="cursor:default"><span>' + esc(s.name) + '</span>' +
        (linked
          ? '<a class="btn btn--secondary" href="' + processArchitectHref(linked.id) + '">Open Process →</a>'
          : '<span style="display:flex;gap:var(--space-2)"><button type="button" class="btn btn--ghost" data-create-process="' + s.id + '">Create Process</button></span>') +
      '</div>';
    }).join('');
    mount.querySelectorAll('[data-create-process]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var stage = VS.byId(project.data.stages, btn.getAttribute('data-create-process'));
        var proc = B.store.create('process', stage.name, {}, false);
        stage.relatedProcessId = proc.id;
        VS.store.save(project);
        renderProcessLinks(mount);
      });
    });
  }

  function processArchitectHref(projectId) {
    var base = global.OMSData ? global.OMSData.href('pages/process-architect.html') : 'process-architect.html';
    return base + '?project=' + encodeURIComponent(projectId);
  }

  function renderFlowEfficiencyExplainer(flow) {
    if (flow.flowEfficiency == null) return '';
    var pct = Math.round(flow.flowEfficiency * 100);
    return '' +
      '<div class="constraint-panel" style="margin-top:var(--space-5)">' +
        '<span class="eyebrow">Flow Efficiency — How This Is Calculated</span>' +
        '<p class="text-muted" style="margin:var(--space-2) 0">Value-creating work time ÷ total elapsed time = ' + VS.fmtHours(flow.totalWorkHours) + ' ÷ ' + VS.fmtHours(flow.totalLeadHours) + ' = <strong>' + pct + '%</strong>.</p>' +
        '<p class="text-dim" style="font-size:var(--step--1)">This is not a certification score, and there is no universal "good" number &mdash; a highly regulated approval process and a same-day fulfillment flow look nothing alike. Use it to ask questions, not to judge the team.</p>' +
        '<div class="metric-grid" style="margin-top:var(--space-4)">' +
          '<div class="metric-card"><span class="metric-card__label">Value-Creating</span><span class="metric-card__value">' + pct + '%</span></div>' +
          '<div class="metric-card"><span class="metric-card__label">Waiting</span><span class="metric-card__value">' + (100 - pct) + '%</span></div>' +
        '</div>' +
        '<span class="eyebrow" style="margin-top:var(--space-5);display:block">Questions To Investigate</span>' +
        '<ul style="margin:var(--space-2) 0 0 1.2em">' +
          '<li>Which specific wait is the largest contributor? (See "Where Is Value Waiting?")</li>' +
          '<li>Is that wait caused by capacity, a queue, an approval, or a handoff?</li>' +
          '<li>Would removing that wait actually change the outcome the customer experiences?</li>' +
        '</ul>' +
      '</div>';
  }

  function renderTimeline(stages) {
    if (!stages || !stages.length) return '<p class="callout">No stages mapped yet.</p>';
    var rows = stages.map(function (s) {
      var workH = VS.toHours(s.workTimeValue, s.workTimeUnit);
      var waitH = VS.toHours(s.waitTimeValue, s.waitTimeUnit);
      var total = workH + waitH;
      var workPct = total > 0 ? Math.max(2, Math.round((workH / total) * 100)) : 50;
      var waitPct = total > 0 ? Math.max(2, 100 - workPct) : 50;
      return '<div class="vs-timeline-row">' +
        '<span class="vs-timeline-row__label">' + esc(s.name || 'Untitled stage') + '</span>' +
        '<div class="vs-timeline-bar"><span class="vs-timeline-bar__work" style="width:' + workPct + '%"></span><span class="vs-timeline-bar__wait" style="width:' + waitPct + '%"></span></div>' +
        '<span class="vs-timeline-row__meta">' + VS.fmtHours(workH) + ' work / ' + VS.fmtHours(waitH) + ' wait</span>' +
      '</div>';
    }).join('');
    return '<div class="vs-timeline-legend"><span class="is-work">Work Time</span><span class="is-wait">Wait Time</span></div>' +
      '<div class="card">' + rows + '</div>';
  }

  function renderConstraintPanel() {
    var c = project.data.constraint || {};
    return '<div class="constraint-panel" style="margin-top:var(--space-6)">' +
      '<span class="eyebrow">Current Constraint</span>' +
      (c.type ? '<h3 style="margin:var(--space-2) 0">' + esc(c.type) + '</h3>' : '<p class="text-dim" style="margin-top:var(--space-2)">Not yet identified.</p>') +
      (c.note ? '<p class="text-muted">' + esc(c.note) + '</p>' : '') +
      (c.systemsToInvestigate ? '<p class="text-dim" style="font-size:var(--step--1)">Systems to investigate: ' + esc(c.systemsToInvestigate) + '</p>' : '') +
      '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-2)">This is entered, not automatically declared. OMS does not name a root cause for you.</p>' +
    '</div>';
  }

  /* ----------------------------------------------------------
     Flow Detail — Sections 7/8, 9-12, 17, 18, 19
     ---------------------------------------------------------- */

  function renderFlowTab(mount) {
    var views = [
      { id: 'queues', label: 'Queues' },
      { id: 'handoffs', label: 'Handoffs' },
      { id: 'rework', label: 'Rework Loops' },
      { id: 'approvals', label: 'Approvals' },
      { id: 'systems', label: 'System Switching' }
    ];
    mount.innerHTML = '<div class="bp-tabs" id="flow-subtabs" style="margin-bottom:var(--space-5)"></div><div id="flow-subbody"></div>';
    var tabs = mount.querySelector('#flow-subtabs');
    tabs.innerHTML = views.map(function (v) { return '<button type="button" data-view="' + v.id + '" class="' + (viewerState.flowView === v.id ? 'is-active' : '') + '">' + v.label + '</button>'; }).join('');
    tabs.querySelectorAll('[data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () { viewerState.flowView = btn.getAttribute('data-view'); renderFlowTab(mount); });
    });
    var body = mount.querySelector('#flow-subbody');
    if (viewerState.flowView === 'handoffs') renderHandoffsView(body);
    else if (viewerState.flowView === 'rework') renderReworkView(body);
    else if (viewerState.flowView === 'approvals') renderApprovalsView(body);
    else if (viewerState.flowView === 'systems') renderSystemsView(body);
    else renderQueuesView(body);
  }

  function renderQueuesView(mount) {
    var queues = project.data.queues || [];
    if (!queues.length) { mount.innerHTML = '<p class="callout">No queues mapped yet. Add them from the wizard\'s Queues step.</p>'; return; }
    mount.innerHTML = queues.map(function (q) {
      var signals = VS.queueSignals(project, q);
      return '<div class="card" style="margin-bottom:var(--space-4)">' +
        '<div class="bp-chain-section__header"><h4 style="margin:0">' + esc(q.name || 'Untitled queue') + '</h4>' + (q.afterStageId ? '<span class="badge badge--outline">After: ' + esc(stageName(q.afterStageId)) + '</span>' : '') + '</div>' +
        '<p class="text-muted" style="font-size:var(--step--1)">' + esc(q.whatIsWaiting || '') + (q.owner ? ' · Owner: ' + esc(q.owner) : ' · No named owner') + '</p>' +
        '<div class="build-project-row__meta">' +
          '<span class="badge badge--outline">' + (q.avgItemsWaiting || '?') + ' items waiting</span>' +
          '<span class="badge badge--outline">Avg wait: ' + VS.fmtHours(VS.toHours(q.avgWaitTimeValue, q.avgWaitTimeUnit)) + '</span>' +
          '<span class="badge badge--outline">Peak: ' + VS.fmtHours(VS.toHours(q.maxWaitTimeValue, q.maxWaitTimeUnit)) + '</span>' +
        '</div>' +
        '<span class="eyebrow" style="margin-top:var(--space-4);display:block">Flow Signals</span>' +
        (signals.length
          ? '<div style="margin-top:var(--space-2)">' + signals.map(function (s) { return '<div class="risk-flag risk-flag--warning" style="margin-top:var(--space-2)"><div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--warning">' + esc(s.rule) + '</span></div><p class="risk-flag__message">' + esc(s.message) + '</p></div>'; }).join('') + '</div>'
          : '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-2)">No flow signals tripped for this queue. That does not guarantee it is healthy.</p>') +
        '<div class="inspector-panel__actions" style="margin-top:var(--space-4)"><button type="button" class="btn btn--ghost" data-save-finding="queue" data-id="' + q.id + '">Save To Workbench</button></div>' +
      '</div>';
    }).join('');
    bindSaveFindingButtons(mount);
  }

  function healthBadgeHtml(status) {
    return '<span class="health-badge health-badge--' + status.toLowerCase() + '">' + status + '</span>';
  }

  function renderHandoffsView(mount) {
    var handoffs = project.data.handoffs || [];
    mount.innerHTML =
      '<p class="lede">' + HANDOFF_HEADLINE + '</p>' +
      (handoffs.length ? '' : '<p class="callout">No handoffs defined yet. OMS automatically suggests one wherever ownership, team, capability, or system changes between stages &mdash; add stages first, then check the Stages step in the wizard.</p>') +
      handoffs.map(function (h) {
        var health = VS.handoffHealth(project, h);
        return '<div class="card" style="margin-bottom:var(--space-4)">' +
          '<div class="bp-chain-section__header"><h4 style="margin:0">' + esc(stageName(h.fromStageId)) + ' → ' + esc(stageName(h.toStageId)) + '</h4>' + healthBadgeHtml(health.status) + '</div>' +
          '<p class="text-muted" style="font-size:var(--step--1)">' + esc(h.whatMoves || 'What moves is not yet defined.') + '</p>' +
          '<dl class="dva-row" style="grid-template-columns:1fr 1fr;margin-top:var(--space-3)">' +
            '<div class="dva-row__col"><h5>Handoff Contract</h5>' +
              '<p style="font-size:var(--step--1)"><strong>From:</strong> ' + esc(h.sender || '—') + '<br><strong>To:</strong> ' + esc(h.receiver || '—') + '<br><strong>Entry criteria:</strong> ' + esc(h.entryCriteria || '—') + '<br><strong>Acceptance criteria:</strong> ' + esc(h.acceptableDefinition || '—') + '<br><strong>Expected timing:</strong> ' + (h.expectedTimingValue ? h.expectedTimingValue + ' ' + (h.expectedTimingUnit || '') : '—') + '</p>' +
            '</div>' +
            '<div class="dva-row__col"><h5>Escalation &amp; Confirmation</h5>' +
              '<p style="font-size:var(--step--1)"><strong>Confirmation:</strong> ' + esc(h.confirmationMethod || '—') + '<br><strong>Rejection conditions:</strong> ' + esc(h.rejectionConditions || '—') + '<br><strong>Escalation:</strong> ' + esc(h.escalation || '—') + '<br><strong>Dispute resolution:</strong> ' + esc(h.disputeResolution || '—') + '<br><strong>Metric:</strong> ' + esc(h.metric || '—') + '</p>' +
            '</div>' +
          '</dl>' +
          (health.flags.length
            ? '<span class="eyebrow" style="margin-top:var(--space-4);display:block">Why This Is Rated ' + health.status + '</span><ul style="margin:var(--space-2) 0 0 1.2em;font-size:var(--step--1)">' + health.flags.map(function (f) { return '<li><strong>' + esc(f.rule) + ':</strong> ' + esc(f.message) + '</li>'; }).join('') + '</ul>'
            : '') +
          '<div class="inspector-panel__actions" style="margin-top:var(--space-4)">' +
            '<button type="button" class="btn btn--secondary" data-export-contract="' + h.id + '">Export Handoff Contract</button>' +
            '<button type="button" class="btn btn--ghost" data-save-finding="handoff" data-id="' + h.id + '">Save To Workbench</button>' +
          '</div>' +
        '</div>';
      }).join('');

    mount.querySelectorAll('[data-export-contract]').forEach(function (btn) {
      btn.addEventListener('click', function () { exportHandoffContract(VS.byId(project.data.handoffs, btn.getAttribute('data-export-contract'))); });
    });
    bindSaveFindingButtons(mount);
  }

  var HANDOFF_HEADLINE = 'The seams between teams are often where otherwise good systems fail.';

  function exportHandoffContract(h) {
    var contract = {
      from: stageName(h.fromStageId), to: stageName(h.toStageId), whatMoves: h.whatMoves,
      sender: h.sender, receiver: h.receiver, requiredInfo: h.requiredInfo, entryCriteria: h.entryCriteria,
      acceptanceCriteria: h.acceptableDefinition, qualityStandard: h.qualityStandard,
      expectedTiming: h.expectedTimingValue ? h.expectedTimingValue + ' ' + h.expectedTimingUnit : '',
      confirmationMethod: h.confirmationMethod, rejectionConditions: h.rejectionConditions,
      escalation: h.escalation, disputeResolution: h.disputeResolution, owner: h.contractOwner, metric: h.metric
    };
    var blob = new Blob([JSON.stringify(contract, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'handoff-contract-' + (h.id || 'export') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function renderReworkView(mount) {
    var rework = project.data.rework || [];
    if (!rework.length) { mount.innerHTML = '<p class="callout">No rework loops recorded yet. This is something you observe over time, not something OMS can detect automatically.</p>'; return; }
    mount.innerHTML = rework.map(function (r) {
      return '<div class="card" style="margin-bottom:var(--space-4)">' +
        '<h4 style="margin:0 0 var(--space-2)">Rework Loop: ' + esc(stageName(r.toStageId)) + ' → ' + esc(stageName(r.fromStageId)) + '</h4>' +
        '<p class="text-muted" style="font-size:var(--step--1)">' + esc(r.cause || 'Cause not yet recorded.') + '</p>' +
        '<div class="build-project-row__meta">' +
          (r.frequency ? '<span class="badge badge--outline">' + esc(r.frequency) + '</span>' : '') +
          (r.timeImpactValue ? '<span class="badge badge--outline">~' + VS.fmtHours(VS.toHours(r.timeImpactValue, r.timeImpactUnit)) + ' impact</span>' : '') +
        '</div>' +
        (r.missingInfo ? '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-2)">Common missing information: ' + esc(r.missingInfo) + '</p>' : '') +
        '<div class="inspector-panel__actions" style="margin-top:var(--space-4)"><a class="btn btn--secondary" href="#" data-trace-rework="' + r.id + '">Trace The Rework</a><button type="button" class="btn btn--ghost" data-save-finding="rework" data-id="' + r.id + '">Save To Workbench</button></div>' +
      '</div>';
    }).join('');
    mount.querySelectorAll('[data-trace-rework]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); viewerState.tab = 'trace'; viewerState.traceView = 'rework'; viewerState.traceTarget = a.getAttribute('data-trace-rework'); renderViewer(); });
    });
    bindSaveFindingButtons(mount);
  }

  function renderApprovalsView(mount) {
    var approvals = project.data.approvals || [];
    if (!approvals.length) { mount.innerHTML = '<p class="callout">No approval points mapped yet.</p>'; return; }
    mount.innerHTML =
      '<div class="callout" style="margin-bottom:var(--space-5)">For every approval, ask: does this require approval? What risk is it controlling? Could a threshold replace case-by-case sign-off? Could authority live lower? <a href="' + decisionRightsHref() + '">Open Decision Rights Architect</a></div>' +
      approvals.map(function (a) {
        return '<div class="card" style="margin-bottom:var(--space-4)">' +
          '<h4 style="margin:0 0 var(--space-2)">' + esc(a.decision || 'Untitled approval') + '</h4>' +
          '<p class="text-muted" style="font-size:var(--step--1)">Approver: ' + esc(a.approver || '—') + (a.stageId ? ' · At: ' + esc(stageName(a.stageId)) : '') + '</p>' +
          '<div class="build-project-row__meta">' +
            '<span class="badge badge--outline">Wait: ' + VS.fmtHours(VS.toHours(a.waitTimeValue, a.waitTimeUnit)) + '</span>' +
            (a.threshold ? '<span class="badge badge--outline">Has a threshold</span>' : '<span class="badge badge--outline" style="border-color:var(--color-caution);color:var(--color-caution)">No threshold</span>') +
            (a.riskControlled ? '' : '<span class="badge badge--outline" style="border-color:var(--color-caution);color:var(--color-caution)">No stated risk purpose</span>') +
          '</div>' +
          (a.waitTimeValue && VS.toHours(a.waitTimeValue, a.waitTimeUnit) >= 24 ? '<div class="inspector-panel__actions" style="margin-top:var(--space-4)"><a class="btn btn--secondary" href="#" data-trace-escalation="' + a.id + '">Investigate Decision Rights</a></div>' : '') +
        '</div>';
      }).join('');
    mount.querySelectorAll('[data-trace-escalation]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); viewerState.tab = 'trace'; viewerState.traceView = 'escalation'; viewerState.traceTarget = a.getAttribute('data-trace-escalation'); renderViewer(); });
    });
  }

  function decisionRightsHref() {
    return global.OMSData ? global.OMSData.href('pages/decision-rights.html') : 'decision-rights.html';
  }

  function renderSystemsView(mount) {
    var stages = project.data.stages || [];
    var chain = [];
    stages.forEach(function (s) {
      if (!s.system) return;
      if (!chain.length || chain[chain.length - 1].system.trim().toLowerCase() !== s.system.trim().toLowerCase()) chain.push({ system: s.system, stage: s.name });
    });
    var distinctSystems = {};
    stages.forEach(function (s) { if (s.system) distinctSystems[s.system.trim().toLowerCase()] = true; });
    var systemCount = Object.keys(distinctSystems).length;
    var manualHandoffs = (project.data.handoffs || []).filter(function (h) { return VS.isYes(h.manualReentry); });

    mount.innerHTML =
      '<p class="lede">Automating a bad process just makes the bad process faster. This view is for seeing fragmentation, not recommending a tool.</p>' +
      (chain.length ? '<div class="trace-chain">' + chain.map(function (c, i) {
        return (i > 0 ? '<span class="trace-chain__arrow">↓</span>' : '') + '<div class="trace-chain__node">' + esc(c.system) + '<div class="text-dim" style="font-size:10px;margin-top:4px">' + esc(c.stage) + '</div></div>';
      }).join('') + '</div>' : '<p class="callout">No systems recorded on any stage yet.</p>') +
      (systemCount >= 4 ? '<div class="risk-flag risk-flag--warning" style="margin-top:var(--space-5)"><div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--warning">System Fragmentation</span></div><p class="risk-flag__message">' + systemCount + ' distinct systems are used across this value stream.</p></div>' : '') +
      (manualHandoffs.length ? '<div class="risk-flag risk-flag--warning" style="margin-top:var(--space-3)"><div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--warning">Manual Data Transfer</span></div><p class="risk-flag__message">' + manualHandoffs.length + ' handoff(s) require manually re-entering information between systems: ' + manualHandoffs.map(function (h) { return stageName(h.fromStageId) + ' → ' + stageName(h.toStageId); }).join(', ') + '.</p></div>' : '');
  }

  /* ----------------------------------------------------------
     Friction & Risk — Sections 13/14, 16, 25
     ---------------------------------------------------------- */

  function renderFrictionTab(mount) {
    var views = [{ id: 'heatmap', label: 'Friction Heatmap' }, { id: 'waiting', label: 'Where Is Value Waiting?' }, { id: 'risk', label: 'Risk Analysis' }];
    mount.innerHTML = '<div class="bp-tabs" id="fr-subtabs" style="margin-bottom:var(--space-5)"></div><div id="fr-subbody"></div>';
    var tabs = mount.querySelector('#fr-subtabs');
    tabs.innerHTML = views.map(function (v) { return '<button type="button" data-view="' + v.id + '" class="' + (viewerState.frView === v.id ? 'is-active' : '') + '">' + v.label + '</button>'; }).join('');
    tabs.querySelectorAll('[data-view]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.frView = btn.getAttribute('data-view'); renderFrictionTab(mount); }); });
    var body = mount.querySelector('#fr-subbody');
    if (viewerState.frView === 'waiting') renderWaitingView(body);
    else if (viewerState.frView === 'risk') renderRiskView(body);
    else renderHeatmapView(body);
  }

  function stageFrictionSeverity(stageId) {
    var items = (project.data.friction || []).filter(function (f) { return f.stageId === stageId; });
    var incomingHandoff = (project.data.handoffs || []).filter(function (h) { return h.toStageId === stageId; })[0];
    var health = incomingHandoff ? VS.handoffHealth(project, incomingHandoff) : null;
    if (!items.length && !health) return 'unknown';
    var hasHighImpact = items.some(function (f) { return f.impact === 'Critical' || f.impact === 'High'; });
    if (hasHighImpact || (health && health.status === 'Critical')) return 'critical';
    if ((health && health.status === 'Weak')) return 'weak';
    if (items.length || (health && health.status === 'Watch')) return 'watch';
    return 'healthy';
  }

  function renderHeatmapView(mount) {
    var stages = project.data.stages || [];
    if (!stages.length) { mount.innerHTML = '<p class="callout">No stages mapped yet.</p>'; return; }
    mount.innerHTML =
      '<p class="lede">One glance at where the value stream is under strain. Cells reflect recorded friction and the health of the handoff feeding that stage &mdash; not every possible problem.</p>' +
      '<div class="heatmap-grid">' + stages.map(function (s) {
        var sev = stageFrictionSeverity(s.id);
        return '<div class="heatmap-cell heatmap-cell--' + sev + '"><strong>' + esc(s.name) + '</strong><div class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-2);text-transform:capitalize">' + sev + '</div></div>';
      }).join('') + '</div>';
  }

  function renderWaitingView(mount) {
    var locations = VS.whereIsValueWaiting(project);
    if (!locations.length) { mount.innerHTML = '<p class="callout">No wait time recorded yet.</p>'; return; }
    mount.innerHTML =
      '<p class="lede">Ranked by elapsed time. This is where delay is visible &mdash; not automatically the root cause. Investigate why it exists.</p>' +
      '<div class="builder-table-wrap"><table class="builder-table"><thead><tr><th>Stage / Queue</th><th>Type</th><th>Wait Time</th><th>% Of Lead Time</th><th>Owner</th><th>Likely System</th></tr></thead><tbody>' +
      locations.map(function (l) {
        return '<tr><td>' + esc(l.label) + '</td><td>' + esc(l.type) + '</td><td>' + VS.fmtHours(l.hours) + '</td><td>' + l.pctOfLead + '%</td><td>' + esc(l.owner || '—') + '</td><td>' + esc(l.system || '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="inspector-panel__actions" style="margin-top:var(--space-5)"><a class="btn btn--secondary" href="#" id="trace-top-wait">Trace The Delay At The Top Wait</a></div>';
    var traceBtn = mount.querySelector('#trace-top-wait');
    if (traceBtn) traceBtn.addEventListener('click', function (e) {
      e.preventDefault();
      viewerState.tab = 'trace'; viewerState.traceView = 'delay';
      viewerState.traceTarget = locations[0].type + '::' + locations[0].label;
      renderViewer();
    });
  }

  function renderRiskView(mount) {
    var flags = VS.riskAnalysis(project);
    var localOptimum = VS.localOptimumCheck(project);
    var all = flags.concat(localOptimum);
    if (!all.length) { mount.innerHTML = '<p class="callout">No structural risks were detected by the rules below. That does not guarantee the design is right &mdash; it means it passed these specific checks.</p>'; return; }
    mount.innerHTML = all.map(function (f) {
      return '<div class="risk-flag risk-flag--' + f.severity + '" style="margin-bottom:var(--space-3)">' +
        '<div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--' + f.severity + '">' + esc(f.rule) + '</span></div>' +
        '<p class="risk-flag__message">' + esc(f.message) + '</p>' +
        '<p class="risk-flag__why text-dim">Rule: ' + esc(f.why) + '</p>' +
        (f.rule === 'Possible Local Optimum' ? '<p class="text-dim" style="font-size:var(--step--1)"><a href="' + antiPatternHref() + '">Related anti-pattern: Local Optimum</a></p>' : '') +
      '</div>';
    }).join('');
  }

  function antiPatternHref() {
    return global.OMSLinks ? global.OMSLinks.resolve({ type: 'antipattern', id: 'local-optimum' }) : '#';
  }

  /* ----------------------------------------------------------
     Trace — Sections 22-24
     ---------------------------------------------------------- */

  function renderTraceTab(mount) {
    var views = [{ id: 'delay', label: 'Trace The Delay' }, { id: 'rework', label: 'Trace The Rework' }, { id: 'escalation', label: 'Trace The Escalation' }];
    mount.innerHTML =
      '<p class="callout">Each step below is labeled by how confident OMS is: <strong>OBSERVED</strong> (a direct computed fact), <strong>ENTERED</strong> (something you typed), or <strong>INFERRED</strong> (OMS connected two entered facts). None of this is a certified diagnosis.</p>' +
      '<div class="bp-tabs" id="trace-subtabs" style="margin:var(--space-4) 0"></div><div id="trace-picker" style="margin-bottom:var(--space-5)"></div><div id="trace-result"></div>';
    var tabs = mount.querySelector('#trace-subtabs');
    tabs.innerHTML = views.map(function (v) { return '<button type="button" data-view="' + v.id + '" class="' + (viewerState.traceView === v.id ? 'is-active' : '') + '">' + v.label + '</button>'; }).join('');
    tabs.querySelectorAll('[data-view]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.traceView = btn.getAttribute('data-view'); viewerState.traceTarget = null; renderTraceTab(mount); }); });

    var picker = mount.querySelector('#trace-picker');
    var result = mount.querySelector('#trace-result');

    if (viewerState.traceView === 'rework') {
      var reworkOptions = opts(project.data.rework, function (r) { return stageName(r.toStageId) + ' → ' + stageName(r.fromStageId); });
      renderTracePicker(picker, reworkOptions, viewerState.traceTarget, function (id) { viewerState.traceTarget = id; renderTraceChain(result, VS.traceRework(project, id)); });
      if (viewerState.traceTarget) renderTraceChain(result, VS.traceRework(project, viewerState.traceTarget));
    } else if (viewerState.traceView === 'escalation') {
      var approvalOptions = opts(project.data.approvals, 'decision');
      renderTracePicker(picker, approvalOptions, viewerState.traceTarget, function (id) { viewerState.traceTarget = id; renderTraceChain(result, VS.traceEscalation(project, id)); });
      if (viewerState.traceTarget) renderTraceChain(result, VS.traceEscalation(project, viewerState.traceTarget));
    } else {
      var waitLocations = VS.whereIsValueWaiting(project);
      var delayOptions = waitLocations.map(function (l) { return { value: l.type + '::' + l.label, label: l.label + ' (' + l.type + ', ' + VS.fmtHours(l.hours) + ')' }; });
      renderTracePicker(picker, delayOptions, viewerState.traceTarget, function (val) {
        viewerState.traceTarget = val;
        var parts = val.split('::');
        renderTraceChain(result, VS.traceDelay(project, parts[0], parts[1]));
      });
      if (viewerState.traceTarget) {
        var parts = viewerState.traceTarget.split('::');
        renderTraceChain(result, VS.traceDelay(project, parts[0], parts[1]));
      }
    }
  }

  function renderTracePicker(mount, options, current, onPick) {
    if (!options.length) { mount.innerHTML = '<p class="text-dim">Nothing to trace yet.</p>'; return; }
    mount.innerHTML = '<select class="builder-field__input" id="trace-select"><option value="">Select&hellip;</option>' +
      options.map(function (o) { return '<option value="' + esc(o.value) + '"' + (o.value === current ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('') + '</select>';
    mount.querySelector('#trace-select').addEventListener('change', function (e) { if (e.target.value) onPick(e.target.value); });
  }

  function renderTraceChain(mount, chain) {
    if (!chain || !chain.length) { mount.innerHTML = '<p class="text-dim">Select something above to trace it.</p>'; return; }
    mount.innerHTML = '<div class="trace-chain">' + chain.map(function (node, i) {
      return (i > 0 ? '<span class="trace-chain__arrow">↓</span>' : '') +
        '<div class="trace-chain__node">' + esc(node.label) + '<div class="text-dim" style="font-size:10px;margin-top:4px;letter-spacing:.06em">' + node.confidence + '</div></div>';
    }).join('') + '</div>';
  }

  /* ----------------------------------------------------------
     Target State — Sections 29-32
     ---------------------------------------------------------- */

  function renderTargetTab(mount) {
    if (!project.data.hasTargetState) {
      mount.innerHTML = '<p class="callout">Design a future state once you understand the current one. Target State starts as a copy of your current stages so you never lose the original evidence &mdash; edit the copy freely.</p>' +
        '<button type="button" class="btn btn--primary" id="start-target-btn">Design Target State</button>';
      mount.querySelector('#start-target-btn').addEventListener('click', function () {
        project.data.targetStages = (project.data.stages || []).map(function (s) {
          var copy = JSON.parse(JSON.stringify(s));
          copy.id = VS.newId('stage');
          copy.sourceStageId = s.id;
          return copy;
        });
        project.data.hasTargetState = true;
        VS.store.save(project);
        VS.logActivity(project, 'Target State design started.');
        renderTargetTab(mount);
      });
      return;
    }

    mount.innerHTML =
      '<div class="bp-chain-section__header"><span class="eyebrow">Target State Stages</span><button type="button" class="btn btn--ghost" id="target-edit-btn">Edit Target Stages</button></div>' +
      '<div id="target-edit-mount" hidden></div>' +
      '<div id="target-compare-mount"></div>' +
      '<div id="target-challenge-mount" style="margin-top:var(--space-7)"></div>';

    var editMount = mount.querySelector('#target-edit-mount');
    var editBtn = mount.querySelector('#target-edit-btn');
    var editing = false;
    editBtn.addEventListener('click', function () {
      editing = !editing;
      editMount.hidden = !editing;
      editBtn.textContent = editing ? 'Hide Editor' : 'Edit Target Stages';
      if (editing) {
        B.repeatableList({
          mount: editMount, project: { data: { targetStages: project.data.targetStages } }, dataKey: 'targetStages',
          addLabel: 'Add Target Stage', itemLabel: function (item, i) { return item.name || 'Stage ' + (i + 1); },
          defaults: blankStage, onChange: function () { VS.store.save(project); renderTargetCompare(mount.querySelector('#target-compare-mount')); },
          fields: stageFields()
        });
      }
    });

    renderTargetCompare(mount.querySelector('#target-compare-mount'));

    mount.querySelector('#target-challenge-mount').innerHTML =
      '<div class="section-head"><span class="eyebrow">Future-State Challenge Questions</span><h3>Before you call this done</h3></div>' +
      '<ul style="margin-left:1.2em">' + VS.FUTURE_STATE_CHALLENGE_QUESTIONS.map(function (q) { return '<li style="margin-bottom:var(--space-2)">' + esc(q) + '</li>'; }).join('') + '</ul>';
  }

  function renderTargetCompare(mount) {
    var impact = VS.changeImpact(project);
    if (!impact) { mount.innerHTML = ''; return; }
    mount.innerHTML =
      '<div class="section-head" style="margin-top:var(--space-6)"><span class="eyebrow">Current vs. Target</span><h3>Expected change, based on your target design</h3></div>' +
      '<dl class="dva-row">' +
        '<div class="dva-row__col"><h5>Current State</h5>' + metricGrid([
          { label: 'Lead Time', value: VS.fmtHours(impact.current.totalLeadHours) },
          { label: 'Handoffs', value: impact.current.handoffCount },
          { label: 'Approvals', value: impact.current.approvalCount },
          { label: 'System Changes', value: impact.current.systemChanges }
        ]) + '</div>' +
        '<div class="dva-row__col"><h5>Target State</h5>' + metricGrid([
          { label: 'Lead Time', value: VS.fmtHours(impact.target.totalLeadHours) },
          { label: 'Handoffs', value: impact.target.handoffCount },
          { label: 'Approvals', value: impact.target.approvalCount },
          { label: 'System Changes', value: impact.target.systemChanges }
        ]) + '</div>' +
      '</dl>' +
      '<div class="callout" style="margin-top:var(--space-4)">' +
        '<strong>Expected based on target design:</strong> lead time changes by ' + VS.fmtHours(Math.abs(impact.leadTimeDeltaHours)) + (impact.leadTimeDeltaHours > 0 ? ' less' : ' more') + '; handoffs ' + impact.current.handoffCount + ' → ' + impact.target.handoffCount + '; approvals ' + impact.current.approvalCount + ' → ' + impact.target.approvalCount + '. This is not a guaranteed business result &mdash; it is what the numbers you designed imply.' +
      '</div>' +
      '<div id="local-optimum-mount" style="margin-top:var(--space-4)"></div>';

    var localOptimum = VS.localOptimumCheck(project);
    var loMount = mount.querySelector('#local-optimum-mount');
    if (localOptimum.length) {
      loMount.innerHTML = localOptimum.map(function (f) {
        return '<div class="risk-flag risk-flag--warning"><div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--warning">' + esc(f.rule) + '</span></div><p class="risk-flag__message">' + esc(f.message) + '</p><p class="risk-flag__why text-dim">' + esc(f.why) + ' <a href="' + antiPatternHref() + '">Related: Local Optimum</a></p></div>';
      }).join('');
    }
  }

  /* ----------------------------------------------------------
     Summary — Sections 39/40
     ---------------------------------------------------------- */

  function renderSummaryTab(mount) {
    mount.innerHTML = '<div class="bp-tabs" id="sum-subtabs" style="margin-bottom:var(--space-5)"></div><div id="sum-subbody"></div>';
    var views = [{ id: 'summary', label: 'Value Stream Summary' }, { id: 'executive', label: 'Executive View' }];
    var tabs = mount.querySelector('#sum-subtabs');
    tabs.innerHTML = views.map(function (v) { return '<button type="button" data-view="' + v.id + '" class="' + (viewerState.summaryView === v.id ? 'is-active' : '') + '">' + v.label + '</button>'; }).join('');
    tabs.querySelectorAll('[data-view]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.summaryView = btn.getAttribute('data-view'); renderSummaryTab(mount); }); });
    var body = mount.querySelector('#sum-subbody');
    if (viewerState.summaryView === 'executive') renderExecutiveView(body);
    else renderSummaryView(body);
  }

  function renderSummaryView(mount) {
    var flow = VS.calcFlow(project, 'current');
    var meta = project.data.meta || {};
    var waiting = VS.whereIsValueWaiting(project);
    var risks = VS.riskAnalysis(project);
    var friction = project.data.friction || [];

    mount.innerHTML =
      '<div class="card" id="vs-summary-print">' +
        '<span class="eyebrow">Value Stream Summary</span>' +
        '<h2 style="margin:var(--space-2) 0">' + esc(project.name) + '</h2>' +
        '<p><strong>Value created:</strong> ' + esc(meta.expectedValue || '—') + '</p>' +
        '<p><strong>Customer:</strong> ' + esc(meta.customer || '—') + ' &nbsp; <strong>Start → End:</strong> ' + esc(meta.startingCondition || '—') + ' → ' + esc(meta.endingCondition || '—') + '</p>' +
        '<p><strong>Owner:</strong> ' + esc(project.owner || 'No end-to-end owner named') + '</p>' +
        metricGrid([
          { label: 'Total Lead Time', value: VS.fmtHours(flow.totalLeadHours) },
          { label: 'Work Time', value: VS.fmtHours(flow.totalWorkHours) },
          { label: 'Wait Time', value: VS.fmtHours(flow.totalWaitHours) },
          { label: 'Handoffs', value: flow.handoffCount },
          { label: 'Approvals', value: flow.approvalCount },
          { label: 'Rework Occurrences', value: flow.reworkOccurrences },
          { label: 'Systems Used', value: flow.systemChanges + 1 },
          { label: 'Constraint Signal', value: (project.data.constraint && project.data.constraint.type) || 'Unidentified' }
        ]) +
        '<span class="eyebrow" style="margin-top:var(--space-5);display:block">Major Friction</span>' +
        (friction.length ? '<ul style="margin:var(--space-2) 0 0 1.2em">' + friction.slice(0, 5).map(function (f) { return '<li>' + esc(f.type) + ': ' + esc(f.description) + '</li>'; }).join('') + '</ul>' : '<p class="text-dim">None recorded.</p>') +
        '<span class="eyebrow" style="margin-top:var(--space-5);display:block">Major Risks</span>' +
        (risks.length ? '<ul style="margin:var(--space-2) 0 0 1.2em">' + risks.slice(0, 5).map(function (r) { return '<li>' + esc(r.rule) + '</li>'; }).join('') + '</ul>' : '<p class="text-dim">None flagged.</p>') +
        '<span class="eyebrow" style="margin-top:var(--space-5);display:block">Questions To Investigate</span>' +
        (waiting.length ? '<p class="text-muted">Start with the largest wait: ' + esc(waiting[0].label) + ' (' + VS.fmtHours(waiting[0].hours) + ', ' + waiting[0].pctOfLead + '% of lead time).</p>' : '<p class="text-dim">Not enough wait data yet to point anywhere specific.</p>') +
      '</div>' +
      '<div class="hero__actions" style="margin-top:var(--space-5)">' +
        '<button type="button" class="btn btn--secondary" id="vs-export-json-btn">Export JSON</button>' +
        '<button type="button" class="btn btn--secondary" id="vs-print-btn">Print / Save As PDF</button>' +
      '</div>';

    mount.querySelector('#vs-export-json-btn').addEventListener('click', function () { B.exportJson(project); });
    mount.querySelector('#vs-print-btn').addEventListener('click', function () { global.print(); });
  }

  function renderExecutiveView(mount) {
    var flow = VS.calcFlow(project, 'current');
    var waiting = VS.whereIsValueWaiting(project);
    var risks = VS.riskAnalysis(project);
    var friction = project.data.friction || [];
    mount.innerHTML =
      '<div class="card" id="vs-executive-print">' +
        '<span class="eyebrow">Executive Flow View</span>' +
        '<h2 style="margin:var(--space-2) 0">' + esc(project.name) + '</h2>' +
        metricGrid([
          { label: 'Current Performance', value: VS.fmtHours(flow.totalLeadHours), note: 'total lead time' },
          { label: 'Flow Efficiency', value: flow.flowEfficiency == null ? '—' : Math.round(flow.flowEfficiency * 100) + '%' }
        ]) +
        '<p style="margin-top:var(--space-4)"><strong>Primary Wait:</strong> ' + (waiting.length ? esc(waiting[0].label) + ' — ' + VS.fmtHours(waiting[0].hours) : 'Not yet identified') + '</p>' +
        '<p><strong>Primary Friction:</strong> ' + (friction.length ? esc(friction[0].type) + ' — ' + esc(friction[0].description) : 'None recorded') + '</p>' +
        '<p><strong>Primary Risk:</strong> ' + (risks.length ? esc(risks[0].rule) : 'None flagged') + '</p>' +
        '<p><strong>Owner:</strong> ' + esc(project.owner || 'No end-to-end owner named') + '</p>' +
        '<p><strong>What Needs Attention:</strong> ' + (risks.length ? esc(risks[0].message) : 'Nothing flagged by the current rules.') + '</p>' +
      '</div>' +
      '<div class="hero__actions" style="margin-top:var(--space-5)"><button type="button" class="btn btn--secondary" id="vs-exec-print-btn">Print / Save As PDF</button></div>';
    mount.querySelector('#vs-exec-print-btn').addEventListener('click', function () { global.print(); });
  }

  /* ----------------------------------------------------------
     Save to Workbench — Section 36
     ---------------------------------------------------------- */

  function bindSaveFindingButtons(mount) {
    mount.querySelectorAll('[data-save-finding]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var kind = btn.getAttribute('data-save-finding');
        var id = btn.getAttribute('data-id');
        saveFindingToWorkbench(kind, id);
        btn.textContent = 'Saved ✓';
        btn.disabled = true;
      });
    });
  }

  function saveFindingToWorkbench(kind, id) {
    var type, message, why, stageId;
    if (kind === 'queue') {
      var q = VS.byId(project.data.queues, id);
      var signals = VS.queueSignals(project, q);
      type = 'Queue: ' + q.name;
      message = signals.length ? signals.map(function (s) { return s.rule; }).join('; ') : 'Queue flagged for review.';
      why = 'Flow Signals detected on this queue in ' + project.name + '.';
    } else if (kind === 'handoff') {
      var h = VS.byId(project.data.handoffs, id);
      var health = VS.handoffHealth(project, h);
      type = 'Handoff: ' + stageName(h.fromStageId) + ' → ' + stageName(h.toStageId);
      message = 'Handoff Health rated ' + health.status + '.';
      why = health.flags.map(function (f) { return f.rule; }).join('; ') || 'No specific flags, but marked for visibility.';
    } else if (kind === 'rework') {
      var r = VS.byId(project.data.rework, id);
      type = 'Rework Loop: ' + stageName(r.toStageId) + ' → ' + stageName(r.fromStageId);
      message = r.cause || 'Recorded rework loop.';
      why = 'Frequency: ' + (r.frequency || 'unspecified') + '.';
    }
    project.data.findings.push({ id: VS.newId('find'), type: type, message: message, why: why, savedAt: new Date().toISOString() });
    VS.logActivity(project, 'Saved finding to Workbench: ' + type);
    VS.store.save(project);
  }

  /* ----------------------------------------------------------
     Launcher
     ---------------------------------------------------------- */

  function renderResumeList() {
    var list = VS.store.list().slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
    if (!els.resumeList) return;
    if (!list.length) { els.resumeList.innerHTML = ''; return; }
    els.resumeList.innerHTML = '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">My Value Streams</span></div>' +
      list.map(function (vs) {
        var flow = VS.calcFlow(vs, 'current');
        return '' +
          '<div class="build-project-row" data-id="' + vs.id + '">' +
            '<div class="build-project-row__meta">' +
              (vs.isSample ? '<span class="badge badge--accent">Sample</span>' : '') +
              '<strong>' + esc(vs.name) + '</strong>' +
              '<span class="text-dim text-mono" style="font-size:var(--step--1)">' + (vs.data.stages || []).length + ' stages &middot; Lead time ' + VS.fmtHours(flow.totalLeadHours) + ' &middot; Updated ' + B.formatDate(vs.updatedAt) + '</span>' +
            '</div>' +
            '<div class="build-project-row__actions">' +
              '<button type="button" class="btn btn--secondary" data-open="' + vs.id + '">Open</button>' +
              '<button type="button" class="btn btn--ghost" data-edit="' + vs.id + '">Edit</button>' +
              '<button type="button" class="btn btn--ghost" data-duplicate="' + vs.id + '">Duplicate</button>' +
              '<button type="button" class="btn btn--ghost" data-export="' + vs.id + '">Export</button>' +
              '<button type="button" class="btn btn--ghost" data-delete="' + vs.id + '">Delete</button>' +
            '</div>' +
          '</div>';
      }).join('');

    els.resumeList.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { project = VS.store.get(b.getAttribute('data-open')); enterViewer(); }); });
    els.resumeList.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { project = VS.store.get(b.getAttribute('data-edit')); enterWizard(); }); });
    els.resumeList.querySelectorAll('[data-duplicate]').forEach(function (b) { b.addEventListener('click', function () { VS.store.duplicate(b.getAttribute('data-duplicate')); renderResumeList(); }); });
    els.resumeList.querySelectorAll('[data-export]').forEach(function (b) { b.addEventListener('click', function () { B.exportJson(VS.store.get(b.getAttribute('data-export'))); }); });
    els.resumeList.querySelectorAll('[data-delete]').forEach(function (b) {
      b.addEventListener('click', function () { if (global.confirm('Delete this Value Stream? This cannot be undone.')) { VS.store.remove(b.getAttribute('data-delete')); renderResumeList(); } });
    });
  }

  function backToLauncher() {
    els.launcher.hidden = false;
    els.wizard.hidden = true;
    els.viewer.hidden = true;
    if (els.viewerSection) els.viewerSection.hidden = true;
    renderResumeList();
    renderFromBlueprintList();
    updateUrl();
  }

  function updateUrl() {
    var qs = project ? '?valuestream=' + project.id : '';
    global.history.replaceState(null, '', global.location.pathname + qs);
  }

  /* ----------------------------------------------------------
     Section 1/33 — Import from Blueprint's lightweight valueStreams
     ---------------------------------------------------------- */

  function renderFromBlueprintList() {
    if (!els.fromBlueprintMount || !BP) return;
    var candidates = [];
    BP.store.list().forEach(function (bp) {
      (bp.data.valueStreams || []).forEach(function (v) {
        var already = VS.store.list().some(function (existing) { return existing.sourceBlueprintValueStreamId === v.id; });
        if (!already) candidates.push({ bp: bp, entity: v });
      });
    });
    if (!candidates.length) { els.fromBlueprintMount.innerHTML = ''; return; }
    els.fromBlueprintMount.innerHTML =
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">From Your Blueprint</span></div>' +
      '<p class="text-muted" style="font-size:var(--step--1)">These value streams already exist in a Blueprint. Map one here instead of starting over.</p>' +
      candidates.map(function (c, i) {
        return '<div class="trace-node" style="cursor:default"><span>' + esc(c.entity.name || 'Untitled') + ' <span class="text-dim" style="font-size:var(--step--1)">(' + esc(c.bp.name) + ')</span></span>' +
          '<button type="button" class="btn btn--secondary" data-map-vs="' + i + '">Map This Value Stream</button></div>';
      }).join('');
    els.fromBlueprintMount.querySelectorAll('[data-map-vs]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var c = candidates[parseInt(btn.getAttribute('data-map-vs'), 10)];
        importFromBlueprintEntity(c.bp, c.entity);
      });
    });
  }

  function importFromBlueprintEntity(bp, entity) {
    var data = VS.blankData();
    data.relatedBlueprintId = bp.id;
    project = VS.store.create(entity.name || 'Imported Value Stream', data, false);
    project.owner = entity.owner || '';
    project.sourceBlueprintValueStreamId = entity.id;

    var relatedProcesses = (bp.data.processes || []).filter(function (p) { return p.valueStreamId === entity.id; });
    relatedProcesses.forEach(function (p, i) {
      project.data.stages.push(Object.assign(blankStage(), {
        id: VS.newId('stage'), order: i + 1, name: p.name, purpose: p.purpose || '', owner: p.owner || '',
        relatedProcessId: p.id
      }));
    });
    VS.logActivity(project, 'Imported from Blueprint "' + bp.name + '".');
    VS.store.save(project);
    enterWizard();
  }

  /* ----------------------------------------------------------
     Section 33 — Update Blueprint (non-destructive, preview first)
     ---------------------------------------------------------- */

  function updateBlueprint() {
    if (!BP) return;
    var bp = project.data.relatedBlueprintId ? BP.store.get(project.data.relatedBlueprintId) : BP.store.mostRecent();
    if (!bp) { global.alert('No Blueprint exists yet to update. Create one first from the Blueprint page.'); return; }

    var toCreateProcesses = (project.data.stages || []).filter(function (s) { return !s.relatedProcessId; });
    var vsEntity = (bp.data.valueStreams || []).filter(function (v) { return v.id === project.sourceBlueprintValueStreamId; })[0];

    var summary = 'This will, in "' + bp.name + '":\n' +
      (vsEntity ? '- Update 1 existing value stream entity\n' : '- Create 1 new value stream entity\n') +
      '- Create ' + toCreateProcesses.length + ' new process(es) for stages not yet linked to a Blueprint process\n' +
      'Nothing already in the Blueprint will be overwritten or removed.';
    if (!global.confirm(summary + '\n\nApply these changes?')) return;

    if (vsEntity) {
      vsEntity.name = project.name;
      vsEntity.owner = project.owner || vsEntity.owner;
    } else {
      var newVsEntity = { id: BP.newId(), name: project.name, owner: project.owner || '', capabilityIds: [] };
      bp.data.valueStreams = bp.data.valueStreams || [];
      bp.data.valueStreams.push(newVsEntity);
      project.sourceBlueprintValueStreamId = newVsEntity.id;
      vsEntity = newVsEntity;
    }

    toCreateProcesses.forEach(function (s) {
      var newProcess = { id: BP.newId(), name: s.name, purpose: s.purpose || '', owner: s.owner || '', valueStreamId: vsEntity.id, criticality: s.criticality || '' };
      bp.data.processes = bp.data.processes || [];
      bp.data.processes.push(newProcess);
      s.relatedProcessId = newProcess.id;
    });

    project.data.relatedBlueprintId = bp.id;
    BP.logActivity(bp, 'Updated from Value Stream "' + project.name + '".');
    BP.store.save(bp);
    VS.logActivity(project, 'Pushed updates to Blueprint "' + bp.name + '".');
    VS.store.save(project);
    global.alert('Blueprint updated.');
  }

  /* ----------------------------------------------------------
     Init
     ---------------------------------------------------------- */

  function init() {
    B = global.OMSBuilder;
    VS = global.OMSValueStream;
    BP = global.OMSBlueprint;

    els.launcher = byId('vs-launcher');
    els.wizard = byId('vs-wizard');
    els.viewer = byId('vs-viewer');
    els.viewerBody = byId('vs-viewer-body');
    els.viewerSection = byId('vs-viewer-section');
    els.sampleBanner = byId('vs-sample-banner');
    els.resumeList = byId('vs-resume-list');
    els.fromBlueprintMount = byId('vs-from-blueprint');
    els.progress = byId('builder-progress');
    els.stepBody = byId('builder-step-body');
    els.prev = byId('builder-prev');
    els.next = byId('builder-next');
    els.stepLabel = byId('builder-step-label');
    els.projectName = byId('builder-project-name');

    var newBtn = byId('new-vs-btn');
    var sampleBtn = byId('load-sample-vs-btn');
    var exitBtn = byId('builder-exit');
    var viewerExitBtn = byId('viewer-exit');
    var viewerEditBtn = byId('viewer-edit');
    var viewerUpdateBpBtn = byId('viewer-update-blueprint');

    if (newBtn) newBtn.addEventListener('click', function () {
      var name = global.prompt('Name this Value Stream (e.g. "Lead to Customer"):', 'New Value Stream');
      if (name === null) return;
      project = VS.store.create(name || 'New Value Stream', VS.blankData(), false);
      enterWizard();
    });
    if (sampleBtn) sampleBtn.addEventListener('click', function () {
      var built = global.OMSValueStreamSample.build();
      project = VS.store.create('Lead to Live Customer — Sample', built.data, true);
      project.owner = built.owner;
      project.criticality = built.criticality;
      VS.store.save(project);
      enterViewer();
    });
    if (exitBtn) exitBtn.addEventListener('click', backToLauncher);
    if (viewerExitBtn) viewerExitBtn.addEventListener('click', backToLauncher);
    if (viewerEditBtn) viewerEditBtn.addEventListener('click', function () { enterWizard(); });
    if (viewerUpdateBpBtn) viewerUpdateBpBtn.addEventListener('click', updateBlueprint);

    var params = new URLSearchParams(global.location.search);
    var requestedId = params.get('valuestream');
    var existing = requestedId ? VS.store.get(requestedId) : null;

    if (existing) { project = existing; enterViewer(); }
    else { backToLauncher(); }
  }

  global.OMSValueStreamPage = { init: init, get project() { return project; } };
})(window);
