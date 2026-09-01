/*
 * Operations Maturity System
 * Operating Rhythm Designer — page controller.
 *
 * Drives pages/operating-rhythm.html on top of js/rhythm-core.js. Same
 * launcher/wizard/viewer shape as the other flagship tools. The wizard
 * starts with what the rhythm exists to manage, not with a meeting name —
 * a meeting is not an operating rhythm.
 */
(function (global) {
  'use strict';

  var B = null;    // OMSBuilder
  var R = null;    // OMSRhythm
  var VS = null;   // OMSValueStream
  var Cap = null;  // OMSCapacity
  var K = null;    // OMSKpi
  var H = null;    // OMSHealth
  var BP = null;   // OMSBlueprint
  var els = {};
  var project = null;
  var viewerState = { tab: 'overview', importOpen: null };

  function byId(id) { return document.getElementById(id); }
  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function statusClass(status) { return (status || 'unknown').toLowerCase(); }
  function healthBadge(status) { return '<span class="health-badge health-badge--' + statusClass(status) + '">' + esc(status || 'Unknown') + '</span>'; }
  function metricGrid(metrics) {
    return '<div class="metric-grid">' + metrics.map(function (m) {
      return '<div class="metric-card"><span class="metric-card__label">' + esc(m.label) + '</span>' +
        '<span class="metric-card__value metric-card__value--accent">' + m.value + '</span>' +
        (m.note ? '<span class="metric-card__note">' + esc(m.note) + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  }

  /* ----------------------------------------------------------
     Wizard — Step 1: Purpose (Sections 3, 7, 8)
     ---------------------------------------------------------- */

  function valueStreamOptions() { return VS ? VS.store.list().map(function (v) { return { value: v.id, label: v.name }; }) : []; }
  function capacityOptions() { return Cap ? Cap.store.list().map(function (m) { return { value: m.id, label: m.name }; }) : []; }
  function kpiModelOptions() { return K ? K.store.list().map(function (m) { return { value: m.id, label: m.name }; }) : []; }
  function healthModelOptions() { return H ? H.store.list().map(function (m) { return { value: m.id, label: m.name }; }) : []; }
  function decisionRightsOptions() { return B ? B.store.list('decision-rights').map(function (p) { return { value: p.id, label: p.name }; }) : []; }

  function stepPurpose(container, proj, ctrl) {
    container.innerHTML =
      '<h3>What does this rhythm exist to manage?</h3>' +
      '<p class="lede">A meeting is not an operating rhythm. Start from what needs managing, not from a meeting name.</p>' +
      '<div class="builder-scope-grid" id="purpose-grid" style="margin:var(--space-5) 0"></div>' +
      '<div class="builder-field-grid" id="purpose-fields"></div>' +
      '<div class="builder-field-grid" id="cadence-fields" style="margin-top:var(--space-4)"></div>' +
      '<div class="builder-field-grid" id="trigger-fields" style="margin-top:var(--space-4)"></div>';

    var grid = container.querySelector('#purpose-grid');
    grid.innerHTML = R.PURPOSE_CATEGORIES.map(function (t) {
      return '<button type="button" class="builder-scope-tile' + (proj.data.purposeCategory === t ? ' is-selected' : '') + '" data-scope="' + t + '">' + t + '</button>';
    }).join('');
    grid.querySelectorAll('[data-scope]').forEach(function (btn) {
      btn.addEventListener('click', function () { proj.data.purposeCategory = btn.getAttribute('data-scope'); ctrl.persist(); stepPurpose(container, proj, ctrl); });
    });

    var pFields = [
      { key: 'name', label: 'Rhythm name', wide: true, placeholder: 'e.g. Weekly Capacity Review' },
      { key: 'purpose', label: 'Purpose — what does this rhythm exist to manage?', type: 'textarea', wide: true },
      { key: 'systemScope', label: 'System / scope' },
      { key: 'owner', label: 'Owner' }
    ];
    var pMount = container.querySelector('#purpose-fields');
    pMount.innerHTML = pFields.map(function (f) {
      var val = f.key === 'purpose' || f.key === 'systemScope' ? proj.data[f.key] : proj[f.key];
      return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, val, 'rhythm-' + f.key) + '</div>';
    }).join('');
    B.bindFieldEvents(pMount, proj, [pFields[0], { key: 'owner' }], ctrl.persist);
    B.bindFieldEvents(pMount, proj.data, [pFields[1], pFields[2]], ctrl.persist);

    var cMount = container.querySelector('#cadence-fields');
    var cFields = [
      { key: 'cadence', label: 'Cadence', type: 'select', options: R.CADENCES },
      { key: 'cadenceCustom', label: 'If custom, describe it' },
      { key: 'estimatedDurationMinutes', label: 'Typical duration (minutes)' },
      { key: 'cadenceRationale', label: 'Why does this cadence match the speed of the system being managed?', type: 'textarea', wide: true }
    ];
    cMount.innerHTML = cFields.map(function (f) { return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, proj.data[f.key], 'rhythm-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(cMount, proj.data, cFields, ctrl.persist);

    var tMount = container.querySelector('#trigger-fields');
    tMount.innerHTML =
      '<div class="builder-field builder-field--wide"><label class="builder-field__label">Is this governance triggered by an event or threshold rather than a calendar?</label>' +
        '<select class="builder-field__input" id="rhythm-triggered"><option value="No"' + (!proj.data.isTriggered ? ' selected' : '') + '>No</option><option value="Yes"' + (proj.data.isTriggered ? ' selected' : '') + '>Yes</option></select></div>' +
      (proj.data.isTriggered ? [
        { key: 'triggerCondition', label: 'Trigger condition', wide: true },
        { key: 'triggerThreshold', label: 'Threshold' },
        { key: 'triggerOwner', label: 'Trigger owner' },
        { key: 'triggerParticipants', label: 'Participants when triggered' },
        { key: 'triggerDecisionRequired', label: 'Decision required' },
        { key: 'triggerResponseTime', label: 'Expected response time' }
      ].map(function (f) { return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, proj.data[f.key], 'rhythm-' + f.key) + '</div>'; }).join('') : '');
    tMount.querySelector('#rhythm-triggered').addEventListener('change', function (e) { proj.data.isTriggered = e.target.value === 'Yes'; ctrl.persist(); stepPurpose(container, proj, ctrl); });
    if (proj.data.isTriggered) {
      B.bindFieldEvents(tMount, proj.data, [
        { key: 'triggerCondition' }, { key: 'triggerThreshold' }, { key: 'triggerOwner' },
        { key: 'triggerParticipants' }, { key: 'triggerDecisionRequired' }, { key: 'triggerResponseTime' }
      ], ctrl.persist);
    }

    renderBlueprintLinkPicker(container, proj, ctrl);

    var relMount = document.createElement('div');
    relMount.className = 'builder-field-grid';
    relMount.style.marginTop = 'var(--space-5)';
    container.appendChild(relMount);
    var relFields = [
      { key: 'relatedValueStreamId', label: 'Related Value Stream (optional)', type: 'select', options: valueStreamOptions() },
      { key: 'relatedCapacityModelId', label: 'Related Capacity Model (optional)', type: 'select', options: capacityOptions() },
      { key: 'relatedKpiModelId', label: 'Related KPI Model (optional)', type: 'select', options: kpiModelOptions() },
      { key: 'relatedHealthModelId', label: 'Related Health Model (optional)', type: 'select', options: healthModelOptions() },
      { key: 'relatedDecisionRightsProjectId', label: 'Related Decision Rights project (optional)', type: 'select', options: decisionRightsOptions() }
    ];
    relMount.innerHTML = relFields.map(function (f) { return '<div class="builder-field">' + B.fieldHtml(f, proj.data[f.key], 'rhythm-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(relMount, proj.data, relFields, ctrl.persist);
  }

  var BP_LINK_TYPES = ['teams', 'roles', 'processes', 'capabilities', 'valueStreams', 'technology'];

  function renderBlueprintLinkPicker(container, proj, ctrl) {
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
          '<div class="builder-field">' + B.fieldHtml({ key: 'bp', label: 'Blueprint', type: 'select', options: bps.map(function (b) { return { value: b.id, label: b.name }; }) }, bpId, 'rhythm-bp') + '</div>' +
          '<div class="builder-field">' + B.fieldHtml({ key: 'bptype', label: 'Object type', type: 'select', options: BP_LINK_TYPES.map(function (t) { return { value: t, label: BP.ENTITY_META[t].plural }; }) }, type, 'rhythm-bptype') + '</div>' +
          '<div class="builder-field">' + B.fieldHtml({ key: 'bpobj', label: 'Object', type: 'select', options: objects.map(function (o) { return { value: o.id, label: BP.entityName(type, o) }; }) }, proj.data.relatedBlueprintId, 'rhythm-bpobj') + '</div>' +
        '</div>';
      bpMount.querySelector('#rhythm-bp').addEventListener('change', function (e) { proj.data.relatedBlueprintProjectId = e.target.value; proj.data.relatedBlueprintId = ''; ctrl.persist(); render(); });
      bpMount.querySelector('#rhythm-bptype').addEventListener('change', function (e) { proj.data.relatedBlueprintType = e.target.value; proj.data.relatedBlueprintId = ''; ctrl.persist(); render(); });
      bpMount.querySelector('#rhythm-bpobj').addEventListener('change', function (e) { proj.data.relatedBlueprintId = e.target.value; ctrl.persist(); });
    }
    render();
  }

  /* ----------------------------------------------------------
     Wizard — Step 2: Decisions (Sections 4, 12)
     ---------------------------------------------------------- */

  function decisionLabel(item) { return item.name || 'Untitled decision'; }

  function stepDecisions(container, proj, ctrl) {
    container.innerHTML =
      '<h3>What decisions must happen here?</h3>' +
      '<p class="lede">A rhythm with no defined decisions should be challenged. Metrics without decisions are reporting, not management.</p>' +
      '<div id="decisions-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#decisions-mount'), project: proj, dataKey: 'decisions',
      addLabel: 'Add Decision', itemLabel: decisionLabel, onChange: ctrl.persist,
      fields: [
        { key: 'name', label: 'Decision', wide: true },
        { key: 'owner', label: 'Decision owner' },
        { key: 'requiredInputs', label: 'Required inputs' },
        { key: 'authorityLevel', label: 'Authority level', type: 'select', options: R.AUTHORITY_LEVELS },
        { key: 'frequency', label: 'Frequency', type: 'select', options: ['Daily', 'Weekly', 'Biweekly', 'Monthly', 'Quarterly', 'Ad hoc'] },
        { key: 'expectedSpeed', label: 'Expected decision speed' },
        { key: 'escalationThreshold', label: 'Escalation threshold' },
        { key: 'executionOwner', label: 'Execution owner' },
        { key: 'action', label: 'Action', wide: true },
        { key: 'expectedResult', label: 'Expected result', wide: true },
        { key: 'relatedMetric', label: 'Related metric / signal' },
        { key: 'escalationIf', label: 'Escalation if' },
        { key: 'reviewDate', label: 'Review date', help: 'YYYY-MM-DD' }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 3: Signals (Section 5)
     ---------------------------------------------------------- */

  function signalLabel(item) { return item.name || 'Untitled signal'; }

  function stepSignals(container, proj, ctrl) {
    container.innerHTML =
      '<h3>What signals are required?</h3>' +
      '<p class="lede">For each signal, ask: what decision changes if this number changes? Import where possible from KPI or Health models instead of retyping.</p>' +
      '<div id="signal-import-mount" style="margin-bottom:var(--space-5)"></div>' +
      '<div id="signals-mount"></div>';
    renderSignalImportPanel(container.querySelector('#signal-import-mount'), proj, ctrl);
    B.repeatableList({
      mount: container.querySelector('#signals-mount'), project: proj, dataKey: 'signals',
      addLabel: 'Add Signal', itemLabel: signalLabel, onChange: ctrl.persist,
      fields: [
        { key: 'name', label: 'Metric / signal', wide: true },
        { key: 'whyReviewed', label: 'Why reviewed', wide: true },
        { key: 'decisionSupported', label: 'Decision supported', wide: true },
        { key: 'owner', label: 'Owner' },
        { key: 'threshold', label: 'Threshold' },
        { key: 'status', label: 'Status', type: 'select', options: R.STATUS_VALUES },
        { key: 'trend', label: 'Trend', type: 'select', options: R.TREND_VALUES },
        { key: 'dataConfidence', label: 'Data confidence', type: 'select', options: R.DATA_CONFIDENCE },
        { key: 'disposition', label: 'Disposition', type: 'select', options: R.DISPOSITIONS }
      ]
    });
  }

  function renderSignalImportPanel(mount, proj, ctrl) {
    var candidates = [];
    if (K) K.store.list().forEach(function (m) { (m.data.kpis || []).forEach(function (k) { candidates.push({ kind: 'kpi', modelId: m.id, modelName: m.name, id: k.id, name: k.name, extra: k }); }); });
    if (H) H.store.list().forEach(function (m) { (m.data.dimensions || []).forEach(function (d) { candidates.push({ kind: 'health', modelId: m.id, modelName: m.name, id: d.id, name: d.name, extra: d }); }); });
    if (!candidates.length) { mount.innerHTML = ''; return; }
    mount.innerHTML =
      '<div class="card">' +
        '<span class="eyebrow">Import From KPI / Health Model</span>' +
        '<div class="builder-check-group" id="signal-import-candidates" style="margin-top:var(--space-3)">' +
          candidates.map(function (c, i) { return '<label class="builder-check"><input type="checkbox" data-cand="' + i + '"> ' + esc(c.name) + ' <span class="text-dim" style="font-size:var(--step--1)">(' + (c.kind === 'kpi' ? 'KPI' : 'Health') + ': ' + esc(c.modelName) + ')</span></label>'; }).join('') +
        '</div>' +
        '<button type="button" class="btn btn--secondary" id="signal-import-btn" style="margin-top:var(--space-3)">Add Selected As Signals</button>' +
      '</div>';
    mount.querySelector('#signal-import-btn').addEventListener('click', function () {
      var checked = Array.prototype.slice.call(mount.querySelectorAll('[data-cand]:checked')).map(function (i) { return parseInt(i.getAttribute('data-cand'), 10); });
      if (!checked.length) return;
      proj.data.signals = proj.data.signals || [];
      checked.forEach(function (i) {
        var c = candidates[i];
        var sig = { id: R.newId('sig'), name: c.name, whyReviewed: '', decisionSupported: c.kind === 'kpi' ? (c.extra.decisionEnabled || c.extra.decision || '') : '', owner: c.extra.owner || '', threshold: c.kind === 'kpi' ? (c.extra.target || '') : (c.extra.targetValue || ''), status: c.kind === 'health' ? (H.dimensionStatus(c.extra).status) : '', trend: 'Unknown', dataConfidence: c.extra.dataConfidence || 'Unknown', disposition: '' };
        if (c.kind === 'kpi') { sig.relatedKpiModelId = c.modelId; sig.relatedKpiId = c.id; }
        else { sig.relatedHealthModelId = c.modelId; sig.relatedHealthDimensionId = c.id; }
        proj.data.signals.push(sig);
      });
      ctrl.persist();
      stepSignals(mount.parentElement, proj, ctrl);
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 4: Participants (Section 6)
     ---------------------------------------------------------- */

  function participantLabel(item) { return item.role || 'Untitled role'; }

  function stepParticipants(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Who needs to be here, and why?</h3>' +
      '<p class="lede">Challenge unnecessary attendance. Ask: what would break if this person were not present? Do not optimize purely for smaller meetings.</p>' +
      '<div id="participants-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#participants-mount'), project: proj, dataKey: 'participants',
      addLabel: 'Add Participant', itemLabel: participantLabel, onChange: ctrl.persist,
      fields: [
        { key: 'role', label: 'Role', wide: true },
        { key: 'whyRequired', label: 'Why required — what would break if absent?', wide: true, type: 'textarea' },
        { key: 'decisionAuthority', label: 'Decision authority', type: 'select', options: R.PARTICIPANT_ROLES },
        { key: 'inputResponsibility', label: 'Input responsibility' },
        { key: 'executionResponsibility', label: 'Execution responsibility' },
        { key: 'informationOnly', label: 'Information-only?', type: 'select', options: ['Yes', 'No'] }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 5: Inputs (Section 9)
     ---------------------------------------------------------- */

  function stepInputs(container, proj, ctrl) {
    container.innerHTML =
      '<h3>What feeds this rhythm?</h3>' +
      '<p class="lede">Only show what is actually relevant here — not everything that could be reviewed.</p>' +
      '<div id="inputs-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#inputs-mount'), project: proj, dataKey: 'inputs',
      addLabel: 'Add Input', itemLabel: function (item) { return item.type || 'Input'; }, onChange: ctrl.persist,
      fields: [
        { key: 'type', label: 'Input type', type: 'select', options: R.INPUT_TYPES },
        { key: 'description', label: 'Description', wide: true }
      ]
    });
  }

  var WIZARD_STEPS = [
    { id: 'purpose', label: 'Purpose', render: stepPurpose },
    { id: 'decisions', label: 'Decisions', render: stepDecisions },
    { id: 'signals', label: 'Signals', render: stepSignals },
    { id: 'participants', label: 'Participants', render: stepParticipants },
    { id: 'inputs', label: 'Inputs', render: stepInputs }
  ];

  function enterWizard() {
    els.launcher.hidden = true;
    els.viewer.hidden = true;
    if (els.viewerSection) els.viewerSection.hidden = true;
    els.wizard.hidden = false;
    els.projectName.textContent = project.name;
    B.initWizard({ project: project, steps: WIZARD_STEPS, store: R.store, els: { progress: els.progress, body: els.stepBody, prev: els.prev, next: els.next, stepLabel: els.stepLabel } });
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
      ' this is one of five Northstar Software sample rhythms, loaded together so you can see the duplication and gaps across the set. It does not represent your organization.'
    );
    global.OMSData.bindSampleBanner(els.sampleBanner, {
      onExit: function () { backToLauncher(); },
      onClear: function () {
        if (!global.confirm('Delete all sample Operating Rhythms? This cannot be undone.')) return;
        R.store.list().filter(function (r) { return r.isSample; }).forEach(function (r) { R.store.remove(r.id); });
        project = null;
        backToLauncher();
      }
    });
  }

  var VIEWER_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'decisions', label: 'Decisions & Signals' },
    { id: 'participants', label: 'Participants' },
    { id: 'health', label: 'Rhythm Health' },
    { id: 'allrhythms', label: 'All Rhythms' },
    { id: 'summary', label: 'Summary' }
  ];

  function renderViewer() {
    els.viewerBody.innerHTML = '<div class="bp-toolbar"><div class="bp-tabs" id="rhythm-tabs"></div></div><div id="rhythm-tab-body"></div>';
    var tabsEl = els.viewerBody.querySelector('#rhythm-tabs');
    tabsEl.innerHTML = VIEWER_TABS.map(function (t) { return '<button type="button" data-tab="' + t.id + '" class="' + (viewerState.tab === t.id ? 'is-active' : '') + '">' + t.label + '</button>'; }).join('');
    tabsEl.querySelectorAll('[data-tab]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.tab = btn.getAttribute('data-tab'); renderViewer(); }); });
    var body = els.viewerBody.querySelector('#rhythm-tab-body');
    if (viewerState.tab === 'decisions') renderDecisionsTab(body);
    else if (viewerState.tab === 'participants') renderParticipantsTab(body);
    else if (viewerState.tab === 'health') renderHealthTab(body);
    else if (viewerState.tab === 'allrhythms') renderAllRhythmsTab(body);
    else if (viewerState.tab === 'summary') renderSummaryTab(body);
    else renderOverviewTab(body);
  }

  /* ----------------------------------------------------------
     Overview — purpose, standard structure, flags
     ---------------------------------------------------------- */

  function renderOverviewTab(mount) {
    var d = project.data;
    var overall = R.overallHealth(project);
    var flags = R.rhythmFlags(project);
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">' + esc(d.purposeCategory || 'Rhythm') + '</span><h3>What This Rhythm Exists To Manage</h3></div>' +
      '<div class="card" style="margin-bottom:var(--space-6)">' +
        '<p class="text-muted">' + esc(d.purpose || 'No purpose recorded.') + '</p>' +
        '<div class="build-project-row__meta" style="margin-top:var(--space-3)">' +
          healthBadge(overall.status) +
          '<span class="badge badge--outline">Cadence: ' + esc(R.cadenceLabel(project) || 'Not set') + '</span>' +
          '<span class="badge badge--outline">Scope: ' + esc(d.systemScope || 'Not set') + '</span>' +
          '<span class="badge badge--outline">Owner: ' + esc(project.owner || 'Not named') + '</span>' +
        '</div>' +
        '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-3)">' + esc(overall.why) + '</p>' +
        (d.isTriggered ? '<p class="text-muted" style="margin-top:var(--space-3)"><strong>Trigger:</strong> ' + esc(d.triggerCondition || '—') + ' &mdash; threshold: ' + esc(d.triggerThreshold || '—') + '</p>' : '') +
      '</div>' +
      '<div class="section-head"><span class="eyebrow">Standard Operating Sequence</span></div>' +
      '<div class="trace-chain" style="flex-wrap:wrap;margin-bottom:var(--space-6)">' +
        R.STRUCTURE_STEPS.map(function (s, i) { return (i > 0 ? '<span class="trace-chain__arrow">&darr;</span>' : '') + '<div class="trace-chain__node">' + (i + 1) + '. ' + esc(s) + '</div>'; }).join('') +
      '</div>' +
      '<div class="section-head"><span class="eyebrow">Rhythm Anti-Patterns</span></div>' +
      (flags.length ? flags.map(function (f) {
        return '<div class="risk-flag risk-flag--' + f.severity + '" style="margin-bottom:var(--space-3)">' +
          '<div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--' + f.severity + '">' + esc(f.rule) + '</span></div>' +
          '<p class="risk-flag__message">' + esc(f.message) + '</p>' +
          '<p class="risk-flag__why text-dim">Rule: ' + esc(f.why) + '</p>' +
        '</div>';
      }).join('') : '<p class="callout">No anti-patterns flagged by the rules below.</p>');
  }

  /* ----------------------------------------------------------
     Decisions & Signals
     ---------------------------------------------------------- */

  function renderDecisionsTab(mount) {
    var decisions = project.data.decisions || [];
    var signals = project.data.signals || [];
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">Decisions</span></div>' +
      (decisions.length ? decisions.map(function (dec) {
        return '<div class="card" style="margin-bottom:var(--space-4)">' +
          '<div class="bp-chain-section__header"><h4 style="margin:0">' + esc(dec.name || 'Untitled decision') + '</h4><span class="badge badge--outline">' + esc(dec.authorityLevel || 'No authority set') + '</span></div>' +
          '<dl class="dva-row"><div class="dva-row__col"><h5>Decision</h5><p style="font-size:var(--step--1)"><strong>Owner:</strong> ' + esc(dec.owner || '—') + '<br><strong>Frequency:</strong> ' + esc(dec.frequency || '—') + '<br><strong>Speed:</strong> ' + esc(dec.expectedSpeed || '—') + '<br><strong>Inputs:</strong> ' + esc(dec.requiredInputs || '—') + '</p></div>' +
          '<div class="dva-row__col"><h5>Action &amp; Follow-Through</h5><p style="font-size:var(--step--1)"><strong>Action:</strong> ' + esc(dec.action || '—') + '<br><strong>Execution owner:</strong> ' + esc(dec.executionOwner || '—') + '<br><strong>Review date:</strong> ' + esc(dec.reviewDate || '—') + '<br><strong>Escalation if:</strong> ' + esc(dec.escalationIf || dec.escalationThreshold || '—') + '</p></div></dl>' +
        '</div>';
      }).join('') : '<p class="callout">No decisions defined yet. Add them from the wizard.</p>') +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Signals</span></div>' +
      (signals.length ? '<div class="builder-table-wrap"><table class="builder-table"><thead><tr><th>Signal</th><th>Decision Supported</th><th>Status</th><th>Trend</th><th>Disposition</th></tr></thead><tbody>' +
        signals.map(function (s) {
          return '<tr><td>' + esc(s.name || 'Untitled') + '</td><td>' + esc(s.decisionSupported || '&mdash;') + '</td><td>' + healthBadge(s.status) + '</td><td>' + esc(s.trend || '&mdash;') + '</td><td>' + esc(s.disposition || '&mdash;') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="callout">No signals defined yet.</p>');
  }

  /* ----------------------------------------------------------
     Participants
     ---------------------------------------------------------- */

  function renderParticipantsTab(mount) {
    var participants = project.data.participants || [];
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">Participants By Role</span></div>' +
      (participants.length ? participants.map(function (p) {
        return '<div class="trace-node" style="cursor:default"><span><strong>' + esc(p.role || 'Untitled role') + '</strong> <span class="badge badge--outline">' + esc(p.decisionAuthority || 'Not set') + '</span>' + (p.informationOnly === 'Yes' ? ' <span class="badge badge--outline">Information-only</span>' : '') + '<br><span class="text-dim" style="font-size:var(--step--1)">' + esc(p.whyRequired || 'No reason recorded for attendance.') + '</span></span></div>';
      }).join('') : '<p class="callout">No participants defined yet.</p>') +
      '<div class="constraint-panel" style="margin-top:var(--space-7)">' +
        '<span class="eyebrow">Challenge Unnecessary Attendance</span>' +
        '<p class="text-muted" style="margin-top:var(--space-2)">For every participant: what would break if this person were not present? Do not optimize purely for smaller meetings.</p>' +
      '</div>';
  }

  /* ----------------------------------------------------------
     Rhythm Health — Section 13
     ---------------------------------------------------------- */

  function renderHealthTab(mount) {
    var dims = R.dimensionStatus(project);
    var labels = { purpose: 'Purpose', signals: 'Signals', decisions: 'Decisions', authority: 'Authority', participation: 'Participation', cadence: 'Cadence', thresholds: 'Thresholds', actionOwnership: 'Action Ownership', followThrough: 'Follow-Through' };
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">Operating Rhythm Health</span><h3>Nine dimensions, deterministically scored</h3></div>' +
      Object.keys(labels).map(function (key) {
        var s = dims[key];
        return '<div class="trace-node" style="cursor:default"><span>' + healthBadge(s.status) + ' <strong>' + labels[key] + '</strong><br><span class="text-dim" style="font-size:var(--step--1)">' + esc(s.why) + '</span></span></div>';
      }).join('');
  }

  /* ----------------------------------------------------------
     All Rhythms — cross-rhythm rollups (Sections 23, 26-28, 30)
     ---------------------------------------------------------- */

  function renderAllRhythmsTab(mount) {
    var all = R.store.list();
    var load = R.managementLoad(all);
    var yield_ = R.decisionYield(all);
    var crossFlags = R.crossRhythmFindings(all);
    var byCadence = {};
    all.forEach(function (r) { var c = R.cadenceLabel(r) || 'Not Set'; byCadence[c] = byCadence[c] || []; byCadence[c].push(r); });
    var cadenceOrder = ['Daily', 'Weekly', 'Biweekly', 'Monthly', 'Quarterly', 'Event-Triggered', 'Threshold-Triggered', 'Custom', 'Not Set'];

    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">Management Load</span></div>' +
      metricGrid([
        { label: 'Total Rhythms', value: load.totalRhythms }, { label: 'Monthly Hours', value: load.monthlyHours },
        { label: 'Participant Hours / Month', value: load.participantMonthlyHours }, { label: 'Metrics Reviewed', value: load.metricsReviewed },
        { label: 'Decisions Produced', value: load.decisionsProduced }, { label: 'Duplicate Reviews', value: load.duplicateReviews }
      ]) +
      '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-3)">High management load is not automatically bad — ask whether it produces sufficient decision value.</p>' +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Decision Yield</span></div>' +
      metricGrid([
        { label: 'Rhythms Held', value: yield_.rhythmsHeld }, { label: 'Decisions Made', value: yield_.decisionsMade },
        { label: 'Actions Created', value: yield_.actionsCreated }, { label: 'Issues Resolved', value: yield_.issuesResolved },
        { label: 'Repeated Unresolved', value: yield_.repeatedUnresolved }
      ]) +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Rhythm Stack — By Cadence</span></div>' +
      cadenceOrder.filter(function (c) { return byCadence[c]; }).map(function (c) {
        return '<div class="vs-timeline-row" style="grid-template-columns:120px 1fr;align-items:start"><span class="vs-timeline-row__label text-mono" style="text-transform:uppercase;font-size:var(--step--1)">' + esc(c) + '</span><div>' +
          byCadence[c].map(function (r) { return '<div class="trace-node" style="cursor:pointer" data-open-rhythm="' + r.id + '"><span><strong>' + esc(r.name) + '</strong> — ' + esc(r.data.purpose ? r.data.purpose.slice(0, 60) : 'No purpose recorded') + '</span><span class="trace-node__relation">Open &rarr;</span></div>'; }).join('') +
        '</div></div>';
      }).join('') +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Governance Duplication</span></div>' +
      (crossFlags.length ? crossFlags.map(function (f) {
        return '<div class="risk-flag risk-flag--' + f.severity + '" style="margin-bottom:var(--space-3)">' +
          '<div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--' + f.severity + '">' + esc(f.rule) + '</span></div>' +
          '<p class="risk-flag__message">' + esc(f.message) + '</p><p class="risk-flag__why text-dim">' + esc(f.why) + '</p>' +
        '</div>';
      }).join('') : '<p class="callout">No duplication detected across your rhythms yet.</p>');

    mount.querySelectorAll('[data-open-rhythm]').forEach(function (n) {
      n.addEventListener('click', function () { project = R.store.get(n.getAttribute('data-open-rhythm')); viewerState.tab = 'overview'; enterViewer(); });
    });
  }

  /* ----------------------------------------------------------
     Summary
     ---------------------------------------------------------- */

  function renderSummaryTab(mount) {
    var overall = R.overallHealth(project);
    var flags = R.rhythmFlags(project);
    mount.innerHTML =
      '<div class="card">' +
        '<span class="eyebrow">Operating Rhythm Summary</span>' +
        '<h2 style="margin:var(--space-2) 0">' + esc(project.name) + '</h2>' +
        '<p><strong>Purpose:</strong> ' + esc(project.data.purposeCategory || '—') + ' &nbsp; <strong>Owner:</strong> ' + esc(project.owner || 'No owner named') + '</p>' +
        metricGrid([
          { label: 'Decisions', value: (project.data.decisions || []).length }, { label: 'Signals', value: (project.data.signals || []).length },
          { label: 'Participants', value: (project.data.participants || []).length }, { label: 'Overall Health', value: overall.status }
        ]) +
        '<span class="eyebrow" style="margin-top:var(--space-5);display:block">Anti-Patterns Flagged</span>' +
        (flags.length ? '<ul style="margin:var(--space-2) 0 0 1.2em">' + flags.map(function (f) { return '<li>' + esc(f.rule) + '</li>'; }).join('') + '</ul>' : '<p class="text-dim">None flagged.</p>') +
      '</div>' +
      '<div class="hero__actions" style="margin-top:var(--space-5)">' +
        '<button type="button" class="btn btn--secondary" id="rhythm-export-btn">Export JSON</button>' +
        '<button type="button" class="btn btn--secondary" id="rhythm-print-btn">Print Rhythm</button>' +
        (project.data.relatedDecisionRightsProjectId ? '<a class="btn btn--secondary" href="' + decisionRightsHref(project.data.relatedDecisionRightsProjectId) + '">Open Decision Architect &rarr;</a>' : '') +
        '<button type="button" class="btn btn--ghost" id="rhythm-save-finding-btn">Save Findings To Workbench</button>' +
      '</div>';
    mount.querySelector('#rhythm-export-btn').addEventListener('click', function () { B.exportJson(project); });
    mount.querySelector('#rhythm-print-btn').addEventListener('click', function () { global.print(); });
    mount.querySelector('#rhythm-save-finding-btn').addEventListener('click', function (e) {
      flags.forEach(function (f) {
        project.data.findings.push({ id: R.newId('find'), type: 'Rhythm: ' + project.name, message: f.rule + ' — ' + f.message, why: f.why, savedAt: new Date().toISOString() });
      });
      R.logActivity(project, 'Saved ' + flags.length + ' finding(s) to Workbench.');
      R.store.save(project);
      e.target.textContent = 'Saved ✓';
      e.target.disabled = true;
    });
  }

  function decisionRightsHref(projectId) {
    var base = global.OMSData ? global.OMSData.href('pages/decision-rights.html') : 'decision-rights.html';
    return base + '?project=' + encodeURIComponent(projectId);
  }

  /* ----------------------------------------------------------
     Launcher
     ---------------------------------------------------------- */

  function renderResumeList() {
    var list = R.store.list().slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
    if (!els.resumeList) return;
    if (!list.length) { els.resumeList.innerHTML = ''; return; }
    els.resumeList.innerHTML = '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">My Operating Rhythms</span></div>' +
      list.map(function (r) {
        var overall = R.overallHealth(r);
        return '<div class="build-project-row" data-id="' + r.id + '">' +
          '<div class="build-project-row__meta">' +
            (r.isSample ? '<span class="badge badge--accent">Sample</span>' : '') +
            healthBadge(overall.status) +
            '<strong>' + esc(r.name) + '</strong>' +
            '<span class="text-dim text-mono" style="font-size:var(--step--1)">' + esc(R.cadenceLabel(r) || 'No cadence') + ' &middot; Updated ' + B.formatDate(r.updatedAt) + '</span>' +
          '</div>' +
          '<div class="build-project-row__actions">' +
            '<button type="button" class="btn btn--secondary" data-open="' + r.id + '">Open</button>' +
            '<button type="button" class="btn btn--ghost" data-edit="' + r.id + '">Edit</button>' +
            '<button type="button" class="btn btn--ghost" data-duplicate="' + r.id + '">Duplicate</button>' +
            '<button type="button" class="btn btn--ghost" data-export="' + r.id + '">Export</button>' +
            '<button type="button" class="btn btn--ghost" data-delete="' + r.id + '">Delete</button>' +
          '</div>' +
        '</div>';
      }).join('');

    els.resumeList.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { project = R.store.get(b.getAttribute('data-open')); enterViewer(); }); });
    els.resumeList.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { project = R.store.get(b.getAttribute('data-edit')); enterWizard(); }); });
    els.resumeList.querySelectorAll('[data-duplicate]').forEach(function (b) { b.addEventListener('click', function () { R.store.duplicate(b.getAttribute('data-duplicate')); renderResumeList(); }); });
    els.resumeList.querySelectorAll('[data-export]').forEach(function (b) { b.addEventListener('click', function () { B.exportJson(R.store.get(b.getAttribute('data-export'))); }); });
    els.resumeList.querySelectorAll('[data-delete]').forEach(function (b) {
      b.addEventListener('click', function () { if (global.confirm('Delete this Operating Rhythm? This cannot be undone.')) { R.store.remove(b.getAttribute('data-delete')); renderResumeList(); } });
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
    var qs = project ? '?rhythm=' + project.id : '';
    global.history.replaceState(null, '', global.location.pathname + qs);
  }

  /* ----------------------------------------------------------
     Init
     ---------------------------------------------------------- */

  function init() {
    B = global.OMSBuilder;
    R = global.OMSRhythm;
    VS = global.OMSValueStream;
    Cap = global.OMSCapacity;
    K = global.OMSKpi;
    H = global.OMSHealth;
    BP = global.OMSBlueprint;

    els.launcher = byId('rhythm-launcher');
    els.wizard = byId('rhythm-wizard');
    els.viewer = byId('rhythm-viewer');
    els.viewerBody = byId('rhythm-viewer-body');
    els.viewerSection = byId('rhythm-viewer-section');
    els.sampleBanner = byId('rhythm-sample-banner');
    els.resumeList = byId('rhythm-resume-list');
    els.progress = byId('builder-progress');
    els.stepBody = byId('builder-step-body');
    els.prev = byId('builder-prev');
    els.next = byId('builder-next');
    els.stepLabel = byId('builder-step-label');
    els.projectName = byId('builder-project-name');

    var newBtn = byId('new-rhythm-btn');
    var sampleBtn = byId('load-sample-rhythm-btn');
    var exitBtn = byId('builder-exit');
    var viewerExitBtn = byId('viewer-exit');
    var viewerEditBtn = byId('viewer-edit');

    if (newBtn) newBtn.addEventListener('click', function () {
      var name = global.prompt('Name this Operating Rhythm:', 'New Operating Rhythm');
      if (name === null) return;
      project = R.store.create(name || 'New Operating Rhythm', R.blankData(), false);
      enterWizard();
    });
    if (sampleBtn) sampleBtn.addEventListener('click', function () {
      var built = global.OMSRhythmSample.build();
      var created = built.rhythms.map(function (r) {
        var p = R.store.create(r.name, r.data, true);
        p.owner = r.owner;
        R.store.save(p);
        return p;
      });
      project = created[0];
      viewerState.tab = 'allrhythms';
      enterViewer();
    });
    if (exitBtn) exitBtn.addEventListener('click', backToLauncher);
    if (viewerExitBtn) viewerExitBtn.addEventListener('click', backToLauncher);
    if (viewerEditBtn) viewerEditBtn.addEventListener('click', function () { enterWizard(); });

    var params = new URLSearchParams(global.location.search);
    var requestedId = params.get('rhythm');
    var existing = requestedId ? R.store.get(requestedId) : null;
    var fromCapacityId = params.get('fromCapacity');
    var fromValueStreamId = params.get('fromValueStream');

    if (existing) { project = existing; enterViewer(); }
    else if (fromCapacityId && Cap) { project = createFromCapacity(fromCapacityId); enterWizard(); }
    else if (fromValueStreamId && VS) { project = createFromValueStream(fromValueStreamId); enterWizard(); }
    else { backToLauncher(); }
  }

  var CAP_SIGNAL_CANDIDATES = ['Demand Load', 'Capacity Buffer', 'Queue Growth', 'Skill Coverage', 'Demand Forecast'];
  var VS_SIGNAL_CANDIDATES = ['Lead Time', 'Wait Time', 'Rework Rate', 'Handoff Defect Rate', 'Queue Age', 'First-Pass Quality'];

  function createFromCapacity(capId) {
    var cap = Cap.store.get(capId);
    var data = R.blankData();
    data.purposeCategory = 'Capacity';
    data.purpose = 'Review demand against capacity before SLAs are missed, not after.';
    data.systemScope = cap ? cap.name : '';
    data.cadence = 'Weekly';
    data.relatedCapacityModelId = capId;
    data.signals = CAP_SIGNAL_CANDIDATES.map(function (name) { return { id: R.newId('sig'), name: name, whyReviewed: '', decisionSupported: '', owner: '', threshold: '', status: '', trend: 'Unknown', dataConfidence: 'Unknown', disposition: '' }; });
    var name = (cap ? cap.name : 'Capacity Model') + ' — Weekly Review';
    var p = R.store.create(name, data, false);
    R.logActivity(p, 'Created from Capacity Model "' + (cap ? cap.name : capId) + '".');
    R.store.save(p);
    return p;
  }

  function createFromValueStream(vsId) {
    var vs = VS.store.get(vsId);
    var data = R.blankData();
    data.purposeCategory = 'Delivery';
    data.purpose = 'Review the end-to-end flow, not one function\'s slice of it.';
    data.systemScope = vs ? vs.name : '';
    data.cadence = 'Weekly';
    data.relatedValueStreamId = vsId;
    data.signals = VS_SIGNAL_CANDIDATES.map(function (name) { return { id: R.newId('sig'), name: name, whyReviewed: '', decisionSupported: '', owner: '', threshold: '', status: '', trend: 'Unknown', dataConfidence: 'Unknown', disposition: '' }; });
    var name = (vs ? vs.name : 'Value Stream') + ' — End-To-End Review';
    var p = R.store.create(name, data, false);
    R.logActivity(p, 'Created from Value Stream "' + (vs ? vs.name : vsId) + '".');
    R.store.save(p);
    return p;
  }

  global.OMSRhythmPage = { init: init, get project() { return project; } };
})(window);
