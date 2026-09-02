/*
 * Operations Maturity System
 * Resilience Intelligence — page controller.
 *
 * Drives pages/resilience.html on top of js/resilience-core.js. Risk asks
 * what could fail. This tool asks what happens when it does: can the
 * organization detect it, respond to it, keep operating through it, and
 * recover from it — without depending on heroics.
 */
(function (global) {
  'use strict';

  var B = null;    // OMSBuilder
  var Res = null;  // OMSResilience
  var Risk = null; // OMSRisk
  var H = null;    // OMSHealth
  var K = null;    // OMSKpi
  var BP = null;   // OMSBlueprint
  var els = {};
  var project = null;
  var viewerState = { tab: 'overview' };

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
  function flagList(flags) {
    if (!flags.length) return '<p class="callout">No issues flagged by the rules below.</p>';
    return flags.map(function (f) {
      return '<div class="risk-flag risk-flag--' + (f.severity || 'info') + '" style="margin-bottom:var(--space-3)">' +
        '<div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--' + (f.severity || 'info') + '">' + esc(f.rule) + '</span></div>' +
        '<p class="risk-flag__message">' + esc(f.message) + '</p>' +
        (f.why ? '<p class="risk-flag__why text-dim">' + esc(f.why) + '</p>' : '') +
      '</div>';
    }).join('');
  }
  function riskModelOptions() { return Risk ? Risk.store.list().map(function (m) { return { value: m.id, label: m.name }; }) : []; }
  function capacityModelOptions() { return global.OMSCapacity ? global.OMSCapacity.store.list().map(function (m) { return { value: m.id, label: m.name }; }) : []; }
  function healthModelOptions() { return H ? H.store.list().map(function (m) { return { value: m.id, label: m.name }; }) : []; }

  var BP_LINK_TYPES = ['teams', 'roles', 'processes', 'capabilities', 'valueStreams', 'technology'];

  /* ----------------------------------------------------------
     Wizard — Step 1: The System
     ---------------------------------------------------------- */

  function stepSystem(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Which system are you analyzing resilience for?</h3>' +
      '<p class="lede">Resilience is not the absence of failure. It is the ability to absorb, respond, recover, and learn.</p>' +
      '<div class="builder-field-grid" id="system-fields"></div>';
    var fields = [
      { key: 'name', label: 'Resilience model name', wide: true },
      { key: 'owner', label: 'Owner' }
    ];
    var mount = container.querySelector('#system-fields');
    mount.innerHTML = fields.map(function (f) { return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, proj[f.key], 'res-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(mount, proj, fields, ctrl.persist);

    var dFields = [
      { key: 'systemName', label: 'System name' }, { key: 'systemType', label: 'System type' },
      { key: 'criticality', label: 'Criticality (mirrors Risk Model if linked)', type: 'select', options: Risk ? Risk.CRITICALITY_LEVELS : ['Low', 'Moderate', 'High', 'Critical'] },
      { key: 'relatedRiskModelId', label: 'Linked Risk Model (optional but recommended)', type: 'select', options: riskModelOptions() },
      { key: 'relatedCapacityModelId', label: 'Linked Capacity Model (optional)', type: 'select', options: capacityModelOptions() }
    ];
    var dMount = document.createElement('div');
    dMount.className = 'builder-field-grid';
    dMount.style.marginTop = 'var(--space-4)';
    container.appendChild(dMount);
    dMount.innerHTML = dFields.map(function (f) { return '<div class="builder-field">' + B.fieldHtml(f, proj.data[f.key], 'res-data-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(dMount, proj.data, dFields, ctrl.persist);

    renderBlueprintLinkPicker(container, proj, ctrl);
  }

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
          '<div class="builder-field">' + B.fieldHtml({ key: 'bp', label: 'Blueprint', type: 'select', options: bps.map(function (b) { return { value: b.id, label: b.name }; }) }, bpId, 'res-bp') + '</div>' +
          '<div class="builder-field">' + B.fieldHtml({ key: 'bptype', label: 'Object type', type: 'select', options: BP_LINK_TYPES.map(function (t) { return { value: t, label: BP.ENTITY_META[t].plural }; }) }, type, 'res-bptype') + '</div>' +
          '<div class="builder-field">' + B.fieldHtml({ key: 'bpobj', label: 'Object', type: 'select', options: objects.map(function (o) { return { value: o.id, label: BP.entityName(type, o) }; }) }, proj.data.relatedBlueprintId, 'res-bpobj') + '</div>' +
        '</div>';
      bpMount.querySelector('#res-bp').addEventListener('change', function (e) { proj.data.relatedBlueprintProjectId = e.target.value; proj.data.relatedBlueprintId = ''; ctrl.persist(); render(); });
      bpMount.querySelector('#res-bptype').addEventListener('change', function (e) { proj.data.relatedBlueprintType = e.target.value; proj.data.relatedBlueprintId = ''; ctrl.persist(); render(); });
      bpMount.querySelector('#res-bpobj').addEventListener('change', function (e) { proj.data.relatedBlueprintId = e.target.value; ctrl.persist(); });
    }
    render();
  }

  /* ----------------------------------------------------------
     Wizard — Step 2: Resilience Chain (Sections 22-27)
     ---------------------------------------------------------- */

  function stepChain(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Resilience Chain</h3>' +
      '<p class="lede">Prevent &rarr; Detect &rarr; Respond &rarr; Continue &rarr; Recover &rarr; Learn.</p>' +
      '<div class="builder-field-grid" id="prevent-fields"></div>' +
      '<h4 style="margin-top:var(--space-6)">Detect</h4><p class="lede">Connect directly to KPI / Operational Health where possible.</p><div class="builder-field-grid" id="detect-fields"></div>' +
      '<h4 style="margin-top:var(--space-6)">Respond</h4><div class="builder-field-grid" id="respond-fields"></div>' +
      '<h4 style="margin-top:var(--space-6)">Continue</h4><p class="lede">Can the business keep operating?</p><div class="builder-field-grid" id="continue-fields"></div>' +
      '<h4 style="margin-top:var(--space-6)">Recover</h4><div class="builder-field-grid" id="recover-fields"></div>' +
      '<h4 style="margin-top:var(--space-6)">Learn</h4><div class="builder-field-grid" id="learn-fields"></div>';

    var pMount = container.querySelector('#prevent-fields');
    pMount.innerHTML =
      '<div class="builder-field builder-field--wide">' + B.fieldHtml({ key: 'mechanisms', label: 'What reduces likelihood?', type: 'multiselect', options: Res.PREVENTION_MECHANISMS }, proj.data.prevention.mechanisms, 'res-prevent-mech') + '</div>' +
      '<div class="builder-field builder-field--wide">' + B.fieldHtml({ key: 'description', label: 'Description', type: 'textarea' }, proj.data.prevention.description, 'res-prevent-desc') + '</div>';
    B.bindFieldEvents(pMount, proj.data.prevention, [{ key: 'mechanisms', type: 'multiselect' }, { key: 'description', type: 'textarea' }], ctrl.persist);

    var detFields = [
      { key: 'signal', label: 'What tells us the failure is occurring?', wide: true },
      { key: 'detectionMechanism', label: 'Detection mechanism' }, { key: 'owner', label: 'Owner' },
      { key: 'expectedDetectionTime', label: 'Expected detection time' },
      { key: 'automatedOrManual', label: 'Automated or manual?', type: 'select', options: Res.AUTOMATED_MANUAL },
      { key: 'relatedKpiModelId', label: 'Related KPI Model', type: 'select', options: K ? K.store.list().map(function (m) { return { value: m.id, label: m.name }; }) : [] },
      { key: 'relatedHealthModelId', label: 'Related Health Model', type: 'select', options: healthModelOptions() }
    ];
    var detMount = container.querySelector('#detect-fields');
    detMount.innerHTML = detFields.map(function (f) { return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, proj.data.detection[f.key], 'res-det-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(detMount, proj.data.detection, detFields, ctrl.persist);

    var respFields = [
      { key: 'whoResponds', label: 'Who responds?' }, { key: 'authorityOwner', label: 'Who has authority?' },
      { key: 'backupAuthorityExists', label: 'Does a backup authority exist?', type: 'select', options: Res.YES_NO_UNSURE },
      { key: 'firstAction', label: 'What is the first action?', wide: true }, { key: 'informationNeeded', label: 'What information is needed?', wide: true },
      { key: 'documented', label: 'Is the response documented?', type: 'select', options: Res.YES_NO_UNSURE },
      { key: 'tested', label: 'Has it been tested?', type: 'select', options: Res.YES_NO_UNSURE },
      { key: 'whoCommunicates', label: 'Who communicates?' }, { key: 'escalationTrigger', label: 'When does escalation occur?' },
      { key: 'expectedResponseTime', label: 'Expected response initiation time' }
    ];
    var respMount = container.querySelector('#respond-fields');
    respMount.innerHTML = respFields.map(function (f) { return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, proj.data.response[f.key], 'res-resp-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(respMount, proj.data.response, respFields, ctrl.persist);

    var contFields = [
      { key: 'continuityLevel', label: 'Can the business keep operating?', type: 'select', options: Res.CONTINUITY_LEVELS },
      { key: 'sustainDuration', label: 'How long can that state be sustained?' }
    ];
    var contMount = container.querySelector('#continue-fields');
    contMount.innerHTML = contFields.map(function (f) { return '<div class="builder-field">' + B.fieldHtml(f, proj.data.continuity[f.key], 'res-cont-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(contMount, proj.data.continuity, contFields, ctrl.persist);

    var recFields = [
      { key: 'recoveryProcess', label: 'Recovery process', wide: true }, { key: 'owner', label: 'Owner' },
      { key: 'dependencies', label: 'Dependencies' }, { key: 'expectedRecoveryTime', label: 'Expected recovery time' },
      { key: 'targetRecoveryTime', label: 'Target recovery time' }, { key: 'validationRequired', label: 'Validation required' },
      { key: 'returnToNormalCriteria', label: 'Return-to-normal criteria', wide: true }
    ];
    var recMount = container.querySelector('#recover-fields');
    recMount.innerHTML = recFields.map(function (f) { return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, proj.data.recovery[f.key], 'res-rec-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(recMount, proj.data.recovery, recFields, ctrl.persist);

    var learnFields = [
      { key: 'reviewer', label: 'Who reviews what happened?' }, { key: 'rootCauseMethod', label: 'How is root cause validated?' },
      { key: 'standardsUpdateProcess', label: 'How are standards changed?' }, { key: 'controlsUpdateProcess', label: 'How are controls changed?' },
      { key: 'documentationUpdateProcess', label: 'How is documentation updated?' }, { key: 'lessonsPropagationMethod', label: 'How are lessons propagated?' }
    ];
    var learnMount = container.querySelector('#learn-fields');
    learnMount.innerHTML = learnFields.map(function (f) { return '<div class="builder-field">' + B.fieldHtml(f, proj.data.learning[f.key], 'res-learn-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(learnMount, proj.data.learning, learnFields, ctrl.persist);
  }

  /* ----------------------------------------------------------
     Wizard — Step 3: Redundancy Review (Section 41)
     ---------------------------------------------------------- */

  function stepRedundancy(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Redundancy Review</h3>' +
      '<p class="lede">Redundancy is not always waste. Sometimes it is resilience. Where does redundancy create it here?</p>' +
      '<div id="redundancy-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#redundancy-mount'), project: proj, dataKey: 'redundancy',
      addLabel: 'Add Redundancy', itemLabel: function (item) { return item.what || 'Untitled'; }, onChange: ctrl.persist,
      fields: [
        { key: 'what', label: 'What redundancy exists?', wide: true },
        { key: 'category', label: 'Category', type: 'select', options: Res.REDUNDANCY_CATEGORIES },
        { key: 'classification', label: 'Is it...', type: 'select', options: Res.REDUNDANCY_CLASSIFICATIONS },
        { key: 'tested', label: 'Has it been tested?', type: 'select', options: Res.YES_NO_UNSURE }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 4: Stress Tests (Sections 42-43)
     ---------------------------------------------------------- */

  function stepStressTests(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Resilience Stress Test</h3>' +
      '<p class="lede">No advanced probabilistic simulation — describe what you would expect to happen, using what you already know about this system\'s dependencies.</p>' +
      '<div id="stress-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#stress-mount'), project: proj, dataKey: 'stressTests',
      addLabel: 'Add Stress Test', itemLabel: function (item) { return item.description || item.scenarioType || 'Untitled'; }, onChange: ctrl.persist,
      fields: [
        { key: 'scenarioType', label: 'Scenario', type: 'select', options: Res.STRESS_SCENARIO_TYPES },
        { key: 'description', label: 'Description', wide: true },
        { key: 'affectedDependencies', label: 'Affected dependencies', wide: true },
        { key: 'estimatedOperatingState', label: 'Estimated operating state', wide: true },
        { key: 'compoundFactor', label: 'Second simultaneous factor, if compound', wide: true }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 5: Resilience Testing (Section 46)
     ---------------------------------------------------------- */

  function stepTesting(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Resilience Testing</h3>' +
      '<p class="lede">A fallback that has never been tested is an assumption. Label untested controls clearly.</p>' +
      '<div id="tests-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#tests-mount'), project: proj, dataKey: 'resilienceTests',
      addLabel: 'Add Test', itemLabel: function (item) { return item.testType || 'Untitled test'; }, onChange: ctrl.persist,
      fields: [
        { key: 'testType', label: 'Test type', type: 'select', options: Res.TEST_TYPES },
        { key: 'system', label: 'System' }, { key: 'scenario', label: 'Scenario', wide: true },
        { key: 'date', label: 'Date', help: 'YYYY-MM-DD' },
        { key: 'expectedResult', label: 'Expected result', wide: true }, { key: 'actualResult', label: 'Actual result', wide: true },
        { key: 'gap', label: 'Gap', wide: true }, { key: 'action', label: 'Action', wide: true }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 6: Current vs Target (Section 44)
     ---------------------------------------------------------- */

  function stepCurrentTarget(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Resilience Gap</h3>' +
      '<p class="lede">Current resilience vs. target resilience.</p>' +
      '<dl class="dva-row"><div class="dva-row__col"><h5>Current</h5><div id="current-mount"></div></div>' +
      '<div class="dva-row__col"><h5>Target</h5><div id="target-mount"></div></div></dl>';
    B.repeatableList({
      mount: container.querySelector('#current-mount'), project: proj, dataKey: 'currentBullets',
      addLabel: 'Add Current Item', itemLabel: function (item) { return item.label || 'Item'; }, onChange: ctrl.persist,
      fields: [{ key: 'label', label: 'Observation', wide: true }, { key: 'note', label: 'Note', type: 'textarea', wide: true }]
    });
    B.repeatableList({
      mount: container.querySelector('#target-mount'), project: proj, dataKey: 'targetBullets',
      addLabel: 'Add Target Item', itemLabel: function (item) { return item.label || 'Item'; }, onChange: ctrl.persist,
      fields: [{ key: 'label', label: 'Design element', wide: true }, { key: 'note', label: 'Note', type: 'textarea', wide: true }]
    });
  }

  var WIZARD_STEPS = [
    { id: 'system', label: 'System', render: stepSystem },
    { id: 'chain', label: 'Resilience Chain', render: stepChain },
    { id: 'redundancy', label: 'Redundancy', render: stepRedundancy },
    { id: 'stress', label: 'Stress Tests', render: stepStressTests },
    { id: 'testing', label: 'Resilience Testing', render: stepTesting },
    { id: 'target', label: 'Current vs Target', render: stepCurrentTarget }
  ];

  function enterWizard() {
    els.launcher.hidden = true;
    els.viewer.hidden = true;
    if (els.viewerSection) els.viewerSection.hidden = true;
    els.wizard.hidden = false;
    els.projectName.textContent = project.name;
    B.initWizard({ project: project, steps: WIZARD_STEPS, store: Res.store, els: { progress: els.progress, body: els.stepBody, prev: els.prev, next: els.next, stepLabel: els.stepLabel } });
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
      ' this is the Northstar Software Customer Onboarding resilience sample, paired with the Risk sample of the same system. Operations currently look fine — the point of this sample is to show that functional does not mean resilient. It does not represent your organization.'
    );
    global.OMSData.bindSampleBanner(els.sampleBanner, {
      onExit: function () { backToLauncher(); },
      onClear: function () {
        if (!global.confirm('Delete the sample Resilience Model? This cannot be undone.')) return;
        Res.store.remove(project.id);
        project = null;
        backToLauncher();
      }
    });
  }

  var VIEWER_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'chain', label: 'Resilience Chain' },
    { id: 'redundancy', label: 'Redundancy' },
    { id: 'stress', label: 'Stress Tests' },
    { id: 'testing', label: 'Resilience Testing' },
    { id: 'target', label: 'Current vs Target' },
    { id: 'summary', label: 'Executive View' }
  ];

  function renderViewer() {
    els.viewerBody.innerHTML = '<div class="bp-toolbar"><div class="bp-tabs" id="res-tabs"></div></div><div id="res-tab-body"></div>';
    var tabsEl = els.viewerBody.querySelector('#res-tabs');
    tabsEl.innerHTML = VIEWER_TABS.map(function (t) { return '<button type="button" data-tab="' + t.id + '" class="' + (viewerState.tab === t.id ? 'is-active' : '') + '">' + t.label + '</button>'; }).join('');
    tabsEl.querySelectorAll('[data-tab]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.tab = btn.getAttribute('data-tab'); renderViewer(); }); });
    var body = els.viewerBody.querySelector('#res-tab-body');
    if (viewerState.tab === 'chain') renderChainTab(body);
    else if (viewerState.tab === 'redundancy') renderRedundancyTab(body);
    else if (viewerState.tab === 'stress') renderStressTab(body);
    else if (viewerState.tab === 'testing') renderTestingTab(body);
    else if (viewerState.tab === 'target') renderTargetTab(body);
    else if (viewerState.tab === 'summary') renderSummaryTab(body);
    else renderOverviewTab(body);
  }

  /* ----------------------------------------------------------
     Overview — profile, fragility, hidden fragility
     ---------------------------------------------------------- */

  function linkedHealthModel() {
    var d = project.data;
    if (!H) return null;
    if (d.detection && d.detection.relatedHealthModelId) return H.store.get(d.detection.relatedHealthModelId);
    return null;
  }

  function renderOverviewTab(mount) {
    var d = project.data;
    var overall = Res.overallHealth(project);
    var profile = Res.resilienceProfile(project);
    var healthModel = linkedHealthModel();
    var findings = Res.modelFindings(project, healthModel);
    var risk = Res.linkedRiskModel(project);

    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">' + esc(d.systemType || 'System') + '</span><h3>' + esc(d.systemName || project.name) + '</h3></div>' +
      '<div class="card" style="margin-bottom:var(--space-6)">' +
        '<div class="build-project-row__meta">' + healthBadge(overall.status) + '<strong>Overall Resilience</strong></div>' +
        '<p class="text-muted" style="margin-top:var(--space-2)">' + esc(overall.why) + '</p>' +
        (risk ? '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-2)">Linked Risk Model: <a href="risk.html?model=' + encodeURIComponent(risk.id) + '">' + esc(risk.name) + '</a></p>' : '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-2)">No Risk Model linked — link one from the wizard to assess dependency and knowledge resilience.</p>') +
      '</div>' +
      '<div class="section-head"><span class="eyebrow">Resilience Profile</span><h3>Ten dimensions, never collapsed into one score</h3></div>' +
      Object.keys(Res.DIMENSION_LABELS).map(function (key) {
        var s = profile[key];
        return '<div class="trace-node" style="cursor:default"><span>' + healthBadge(s.status) + ' <strong>' + Res.DIMENSION_LABELS[key] + '</strong><br><span class="text-dim" style="font-size:var(--step--1)">' + esc(s.why) + '</span></span></div>';
      }).join('') +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Findings</span></div>' +
      flagList(findings) +
      '<div class="constraint-panel" style="margin-top:var(--space-7)">' +
        '<span class="eyebrow">Efficiency vs. Resilience</span>' +
        '<p class="text-muted" style="margin-top:var(--space-2)">Not a verdict on whether these choices were wrong — a check on whether the tradeoff was ever seen.</p>' +
        '<ul style="margin:var(--space-3) 0 0 1.2em">' + Res.EFFICIENCY_VS_RESILIENCE_QUESTIONS.map(function (q) { return '<li style="margin-bottom:var(--space-2)">' + esc(q) + '</li>'; }).join('') + '</ul>' +
      '</div>';
  }

  /* ----------------------------------------------------------
     Resilience Chain
     ---------------------------------------------------------- */

  function renderChainTab(mount) {
    var d = project.data;
    var profile = Res.resilienceProfile(project);
    function stage(label, key, body) {
      return '<div class="card" style="margin-bottom:var(--space-4)">' +
        '<div class="bp-chain-section__header"><h4 style="margin:0">' + esc(label) + '</h4>' + healthBadge(profile[key].status) + '</div>' +
        body +
      '</div>';
    }
    mount.innerHTML =
      stage('Prevent', 'dependencyResilience', '<p class="text-muted">' + esc((d.prevention.mechanisms || []).join(', ') || 'No mechanisms recorded.') + '</p><p class="text-dim" style="font-size:var(--step--1)">' + esc(d.prevention.description || '') + '</p>') +
      stage('Detect', 'detection', '<p class="text-muted"><strong>Signal:</strong> ' + esc(d.detection.signal || '—') + '<br><strong>Mechanism:</strong> ' + esc(d.detection.detectionMechanism || '—') + '<br><strong>Expected detection time:</strong> ' + esc(d.detection.expectedDetectionTime || '—') + '</p>') +
      stage('Respond', 'response', '<p class="text-muted"><strong>Who responds:</strong> ' + esc(d.response.whoResponds || '—') + '<br><strong>Authority:</strong> ' + esc(d.response.authorityOwner || '—') + '<br><strong>Backup authority:</strong> ' + esc(d.response.backupAuthorityExists || 'Unknown') + '<br><strong>Documented / Tested:</strong> ' + esc(d.response.documented || 'Unknown') + ' / ' + esc(d.response.tested || 'Unknown') + '</p>') +
      stage('Continue', 'continuity', '<p class="text-muted"><strong>Continuity:</strong> ' + esc(d.continuity.continuityLevel || 'Not set') + '<br><strong>Sustainable for:</strong> ' + esc(d.continuity.sustainDuration || '—') + '</p>') +
      stage('Recover', 'recovery', '<p class="text-muted"><strong>Process:</strong> ' + esc(d.recovery.recoveryProcess || '—') + '<br><strong>Expected / Target time:</strong> ' + esc(d.recovery.expectedRecoveryTime || '—') + ' / ' + esc(d.recovery.targetRecoveryTime || '—') + '</p>') +
      stage('Learn', 'learning', '<p class="text-muted"><strong>Reviewer:</strong> ' + esc(d.learning.reviewer || '—') + '<br><strong>Root cause method:</strong> ' + esc(d.learning.rootCauseMethod || '—') + '</p>');
  }

  /* ----------------------------------------------------------
     Redundancy
     ---------------------------------------------------------- */

  function renderRedundancyTab(mount) {
    var list = project.data.redundancy || [];
    mount.innerHTML = list.length ? list.map(function (r) {
      return '<div class="trace-node" style="cursor:default"><span><strong>' + esc(r.what || 'Untitled') + '</strong> <span class="badge badge--outline">' + esc(r.category || '') + '</span> <span class="badge badge--outline">' + esc(r.classification || 'Unknown') + '</span>' +
        (r.tested === 'No' ? ' <span class="badge risk-flag__badge risk-flag__badge--warning">Untested</span>' : '') + '</span></div>';
    }).join('') : '<p class="callout">No redundancy recorded yet.</p>';
  }

  /* ----------------------------------------------------------
     Stress Tests
     ---------------------------------------------------------- */

  function renderStressTab(mount) {
    var tests = project.data.stressTests || [];
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">Resilience Stress Test</span><h3>What happens if this fails?</h3></div>' +
      (tests.length ? tests.map(function (t) {
        return '<div class="card" style="margin-bottom:var(--space-4)">' +
          '<h4 style="margin:0 0 var(--space-2)">' + esc(t.scenarioType || 'Scenario') + (t.compoundFactor ? ' + ' + esc(t.compoundFactor) : '') + '</h4>' +
          '<p class="text-muted">' + esc(t.description || '') + '</p>' +
          '<p class="text-dim" style="font-size:var(--step--1)"><strong>Affected dependencies:</strong> ' + esc(t.affectedDependencies || 'Not specified') + '<br><strong>Estimated operating state:</strong> ' + esc(t.estimatedOperatingState || 'Not specified') + '</p>' +
          ((t.cascadeEffects || []).length ? '<div class="trace-chain" style="flex-wrap:wrap;margin-top:var(--space-4)">' + t.cascadeEffects.map(function (c, i) { return (i > 0 ? '<span class="trace-chain__arrow">&darr;</span>' : '') + '<div class="trace-chain__node">' + esc(c.effect) + '</div>'; }).join('') + '</div>' : '') +
        '</div>';
      }).join('') : '<p class="callout">No stress tests defined yet. Add one from the wizard.</p>');
  }

  /* ----------------------------------------------------------
     Resilience Testing
     ---------------------------------------------------------- */

  function renderTestingTab(mount) {
    var tests = project.data.resilienceTests || [];
    mount.innerHTML = tests.length ? '<div class="builder-table-wrap"><table class="builder-table"><thead><tr><th>Test Type</th><th>System</th><th>Date</th><th>Expected</th><th>Actual</th><th>Gap</th><th>Action</th></tr></thead><tbody>' +
      tests.map(function (t) { return '<tr><td>' + esc(t.testType || '—') + '</td><td>' + esc(t.system || '—') + '</td><td>' + esc(t.date || '—') + '</td><td>' + esc(t.expectedResult || '—') + '</td><td>' + esc(t.actualResult || '—') + '</td><td>' + esc(t.gap || '—') + '</td><td>' + esc(t.action || '—') + '</td></tr>'; }).join('') +
      '</tbody></table></div>' : '<p class="callout">No resilience tests recorded yet. Anything untested is an assumption, not a fact.</p>';
  }

  /* ----------------------------------------------------------
     Current vs Target
     ---------------------------------------------------------- */

  function renderTargetTab(mount) {
    var current = project.data.currentBullets || [];
    var target = project.data.targetBullets || [];
    mount.innerHTML =
      '<dl class="dva-row">' +
        '<div class="dva-row__col"><h5>Current Resilience</h5>' + (current.length ? '<ul style="margin:0 0 0 1.2em">' + current.map(function (c) { return '<li style="margin-bottom:var(--space-2)"><strong>' + esc(c.label) + '</strong>' + (c.note ? '<br><span class="text-dim" style="font-size:var(--step--1)">' + esc(c.note) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="text-dim">Nothing recorded.</p>') + '</div>' +
        '<div class="dva-row__col"><h5>Target Resilience</h5>' + (target.length ? '<ul style="margin:0 0 0 1.2em">' + target.map(function (t) { return '<li style="margin-bottom:var(--space-2)"><strong>' + esc(t.label) + '</strong>' + (t.note ? '<br><span class="text-dim" style="font-size:var(--step--1)">' + esc(t.note) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="text-dim">Nothing recorded.</p>') + '</div>' +
      '</dl>';
  }

  /* ----------------------------------------------------------
     Executive View / Summary (Section 56)
     ---------------------------------------------------------- */

  function renderSummaryTab(mount) {
    var overall = Res.overallHealth(project);
    var findings = Res.modelFindings(project, linkedHealthModel());
    var risk = Res.linkedRiskModel(project);
    mount.innerHTML =
      '<div class="card">' +
        '<span class="eyebrow">Executive Resilience View</span>' +
        '<h2 style="margin:var(--space-2) 0">' + esc(project.data.systemName || project.name) + '</h2>' +
        '<dl class="dva-row">' +
          '<div class="dva-row__col"><h5>Primary Exposure</h5><p style="font-size:var(--step--1)">' + esc(risk ? (Risk.singlePointsOfFailure(risk).length + ' single point(s) of failure') : 'No Risk Model linked') + '</p></div>' +
          '<div class="dva-row__col"><h5>Owner</h5><p style="font-size:var(--step--1)">' + esc(project.data.owner || project.owner || 'Not named') + '</p></div>' +
        '</dl>' +
        '<dl class="dva-row" style="margin-top:var(--space-3)">' +
          '<div class="dva-row__col"><h5>Detection</h5><p style="font-size:var(--step--1)">' + esc(project.data.detection.signal || 'Not defined') + '</p></div>' +
          '<div class="dva-row__col"><h5>Continuity</h5><p style="font-size:var(--step--1)">' + esc(project.data.continuity.continuityLevel || 'Not defined') + '</p></div>' +
        '</dl>' +
        '<dl class="dva-row" style="margin-top:var(--space-3)">' +
          '<div class="dva-row__col"><h5>Recovery</h5><p style="font-size:var(--step--1)">' + esc(project.data.recovery.expectedRecoveryTime || 'Not defined') + '</p></div>' +
          '<div class="dva-row__col"><h5>Overall Resilience</h5><p style="font-size:var(--step--1)">' + healthBadge(overall.status) + '</p></div>' +
        '</dl>' +
        '<span class="eyebrow" style="margin-top:var(--space-5);display:block">Action Needed</span>' +
        (findings.length ? '<ul style="margin:var(--space-2) 0 0 1.2em">' + findings.map(function (f) { return '<li>' + esc(f.rule) + ': ' + esc(f.message) + '</li>'; }).join('') + '</ul>' : '<p class="text-dim">None flagged.</p>') +
      '</div>' +
      '<div class="hero__actions" style="margin-top:var(--space-5)">' +
        '<button type="button" class="btn btn--secondary" id="res-export-btn">Export Resilience Model JSON</button>' +
        '<button type="button" class="btn btn--secondary" id="res-print-btn">Print Executive View</button>' +
        '<button type="button" class="btn btn--ghost" id="res-save-finding-btn">Save Findings To Workbench</button>' +
      '</div>';
    mount.querySelector('#res-export-btn').addEventListener('click', function () { B.exportJson(project); });
    mount.querySelector('#res-print-btn').addEventListener('click', function () { global.print(); });
    mount.querySelector('#res-save-finding-btn').addEventListener('click', function (e) {
      findings.forEach(function (f) {
        project.data.findings.push({ id: Res.newId('find'), type: 'Resilience: ' + project.name, message: f.rule + ' — ' + f.message, why: f.why || '', savedAt: new Date().toISOString() });
      });
      Res.logActivity(project, 'Saved ' + findings.length + ' finding(s) to Workbench.');
      Res.store.save(project);
      e.target.textContent = 'Saved ✓';
      e.target.disabled = true;
    });
  }

  /* ----------------------------------------------------------
     Launcher
     ---------------------------------------------------------- */

  function renderResumeList() {
    var list = Res.store.list().slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
    if (!els.resumeList) return;
    if (!list.length) { els.resumeList.innerHTML = ''; return; }
    els.resumeList.innerHTML = '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">My Resilience Models</span></div>' +
      list.map(function (m) {
        var overall = Res.overallHealth(m);
        return '<div class="build-project-row" data-id="' + m.id + '">' +
          '<div class="build-project-row__meta">' +
            (m.isSample ? '<span class="badge badge--accent">Sample</span>' : '') +
            healthBadge(overall.status) +
            '<strong>' + esc(m.name) + '</strong>' +
            '<span class="text-dim text-mono" style="font-size:var(--step--1)">Updated ' + B.formatDate(m.updatedAt) + '</span>' +
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

    els.resumeList.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { project = Res.store.get(b.getAttribute('data-open')); enterViewer(); }); });
    els.resumeList.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { project = Res.store.get(b.getAttribute('data-edit')); enterWizard(); }); });
    els.resumeList.querySelectorAll('[data-duplicate]').forEach(function (b) { b.addEventListener('click', function () { Res.store.duplicate(b.getAttribute('data-duplicate')); renderResumeList(); }); });
    els.resumeList.querySelectorAll('[data-export]').forEach(function (b) { b.addEventListener('click', function () { B.exportJson(Res.store.get(b.getAttribute('data-export'))); }); });
    els.resumeList.querySelectorAll('[data-delete]').forEach(function (b) {
      b.addEventListener('click', function () { if (global.confirm('Delete this Resilience Model? This cannot be undone.')) { Res.store.remove(b.getAttribute('data-delete')); renderResumeList(); } });
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
    Res = global.OMSResilience;
    Risk = global.OMSRisk;
    H = global.OMSHealth;
    K = global.OMSKpi;
    BP = global.OMSBlueprint;

    els.launcher = byId('res-launcher');
    els.wizard = byId('res-wizard');
    els.viewer = byId('res-viewer');
    els.viewerBody = byId('res-viewer-body');
    els.viewerSection = byId('res-viewer-section');
    els.sampleBanner = byId('res-sample-banner');
    els.resumeList = byId('res-resume-list');
    els.progress = byId('builder-progress');
    els.stepBody = byId('builder-step-body');
    els.prev = byId('builder-prev');
    els.next = byId('builder-next');
    els.stepLabel = byId('builder-step-label');
    els.projectName = byId('builder-project-name');

    var newBtn = byId('new-res-btn');
    var sampleBtn = byId('load-sample-res-btn');
    var exitBtn = byId('builder-exit');
    var viewerExitBtn = byId('viewer-exit');
    var viewerEditBtn = byId('viewer-edit');

    if (newBtn) newBtn.addEventListener('click', function () {
      var name = global.prompt('Name this Resilience Model:', 'New Resilience Model');
      if (name === null) return;
      project = Res.store.create(name || 'New Resilience Model', Res.blankData(), false);
      enterWizard();
    });
    if (sampleBtn) sampleBtn.addEventListener('click', function () {
      var riskSample = Risk.store.list().filter(function (m) { return m.isSample && m.name.indexOf('Customer Onboarding') !== -1; })[0];
      if (!riskSample) {
        var riskBuilt = global.OMSRiskSample.build();
        riskSample = Risk.store.create('Customer Onboarding — Risk', riskBuilt.data, true);
        riskSample.owner = riskBuilt.owner;
        Risk.store.save(riskSample);
      }
      var built = global.OMSResilienceSample.build(riskSample.id);
      project = Res.store.create('Customer Onboarding — Resilience', built.data, true);
      project.owner = built.owner;
      Res.store.save(project);
      enterViewer();
    });
    if (exitBtn) exitBtn.addEventListener('click', backToLauncher);
    if (viewerExitBtn) viewerExitBtn.addEventListener('click', backToLauncher);
    if (viewerEditBtn) viewerEditBtn.addEventListener('click', function () { enterWizard(); });

    var params = new URLSearchParams(global.location.search);
    var requestedId = params.get('model');
    var existing = requestedId ? Res.store.get(requestedId) : null;
    var fromRisk = params.get('fromRisk');
    var withCapacity = params.get('withCapacity');

    if (existing) { project = existing; enterViewer(); }
    else if (fromRisk && Risk.store.get(fromRisk)) {
      var riskM = Risk.store.get(fromRisk);
      var data = Res.blankData();
      data.relatedRiskModelId = riskM.id;
      data.systemName = riskM.name;
      data.systemType = riskM.data.systemType;
      data.criticality = riskM.data.criticality;
      project = Res.store.create(riskM.name.replace(/ — Risk$/, '') + ' — Resilience', data, false);
      project.owner = riskM.owner;
      Res.store.save(project);
      enterWizard();
    }
    else if (withCapacity && global.OMSCapacity && global.OMSCapacity.store.get(withCapacity)) {
      var capM = global.OMSCapacity.store.get(withCapacity);
      var capData = Res.blankData();
      capData.relatedCapacityModelId = capM.id;
      capData.systemName = capM.name;
      capData.systemType = 'Capability';
      project = Res.store.create(capM.name + ' — Resilience', capData, false);
      project.owner = capM.owner;
      Res.store.save(project);
      enterWizard();
    }
    else { backToLauncher(); }
  }

  global.OMSResiliencePage = { init: init, get project() { return project; } };
})(window);
