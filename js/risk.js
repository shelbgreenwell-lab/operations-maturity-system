/*
 * Operations Maturity System
 * Operational Risk — page controller.
 *
 * Drives pages/risk.html on top of js/risk-core.js. Same launcher/wizard/
 * viewer shape as the other flagship tools. A system can be healthy and
 * still be fragile — this tool exists to make that visible: what a
 * system depends on, which dependencies have no real alternative, and
 * how exposed each recorded risk actually is.
 */
(function (global) {
  'use strict';

  var B = null;   // OMSBuilder
  var K = null;   // OMSRisk
  var BP = null;  // OMSBlueprint
  var VS = null;  // OMSValueStream
  var Cap = null; // OMSCapacity
  var els = {};
  var project = null;
  var viewerState = { tab: 'overview', depSubTab: 'dependencies', openRiskIndex: 0, mapType: '', mapId: '', mapMode: 'full' };

  function byId(id) { return document.getElementById(id); }
  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function levelClass(level) { return (level || 'unknown').toLowerCase(); }
  function levelPill(level) { return '<span class="friction-pill friction-pill--' + levelClass(level) + '">' + esc(level || 'Unknown') + '</span>'; }
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

  var BP_LINK_TYPES = ['teams', 'roles', 'processes', 'capabilities', 'valueStreams', 'technology'];

  function blueprintObjectOptions(proj) {
    if (!BP) return [];
    var bps = BP.store.list();
    var bpId = proj.data.relatedBlueprintProjectId || (bps[0] && bps[0].id);
    var bp = bpId ? BP.byId(bps, bpId) : null;
    if (!bp) return [];
    var opts = [];
    BP_LINK_TYPES.forEach(function (type) {
      (bp.data[type] || []).forEach(function (o) { opts.push({ value: type + '::' + o.id, label: BP.ENTITY_META[type].label + ': ' + BP.entityName(type, o) }); });
    });
    return opts;
  }

  /* ----------------------------------------------------------
     Wizard — Step 1: The System
     ---------------------------------------------------------- */

  function stepSystem(container, proj, ctrl) {
    container.innerHTML =
      '<h3>What system are you analyzing?</h3>' +
      '<p class="lede">Critical dependencies become dangerous when they are invisible. Start by naming the system, not the risk.</p>' +
      '<div class="builder-scope-grid" id="system-grid" style="margin:var(--space-5) 0"></div>' +
      '<div class="builder-field-grid" id="system-fields"></div>';

    var grid = container.querySelector('#system-grid');
    grid.innerHTML = K.SYSTEM_TYPES.map(function (t) {
      return '<button type="button" class="builder-scope-tile' + (proj.data.systemType === t ? ' is-selected' : '') + '" data-scope="' + t + '">' + t + '</button>';
    }).join('');
    grid.querySelectorAll('[data-scope]').forEach(function (btn) {
      btn.addEventListener('click', function () { proj.data.systemType = btn.getAttribute('data-scope'); ctrl.persist(); stepSystem(container, proj, ctrl); });
    });

    var fields = [
      { key: 'name', label: 'System name', wide: true },
      { key: 'owner', label: 'Owner' }
    ];
    var mount = container.querySelector('#system-fields');
    mount.innerHTML = fields.map(function (f) { return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, proj[f.key], 'risk-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(mount, proj, fields, ctrl.persist);

    var dFields = [
      { key: 'valueOutcomeSupported', label: 'What value or outcome does this system support?', type: 'textarea', wide: true },
      { key: 'stakeholdersAffected', label: 'Customers / stakeholders affected', wide: true }
    ];
    var dMount = document.createElement('div');
    dMount.className = 'builder-field-grid';
    dMount.style.marginTop = 'var(--space-4)';
    container.appendChild(dMount);
    dMount.innerHTML = dFields.map(function (f) { return '<div class="builder-field builder-field--wide">' + B.fieldHtml(f, proj.data[f.key], 'risk-data-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(dMount, proj.data, dFields, ctrl.persist);

    var relFields = [
      { key: 'relatedValueStreamId', label: 'Related Value Stream (optional)', type: 'select', options: VS ? VS.store.list().map(function (v) { return { value: v.id, label: v.name }; }) : [] },
      { key: 'relatedCapacityModelId', label: 'Related Capacity Model (optional)', type: 'select', options: Cap ? Cap.store.list().map(function (m) { return { value: m.id, label: m.name }; }) : [] }
    ];
    var relMount = document.createElement('div');
    relMount.className = 'builder-field-grid';
    relMount.style.marginTop = 'var(--space-4)';
    container.appendChild(relMount);
    relMount.innerHTML = relFields.map(function (f) { return '<div class="builder-field">' + B.fieldHtml(f, proj.data[f.key], 'risk-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(relMount, proj.data, relFields, ctrl.persist);

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
          '<div class="builder-field">' + B.fieldHtml({ key: 'bp', label: 'Blueprint', type: 'select', options: bps.map(function (b) { return { value: b.id, label: b.name }; }) }, bpId, 'risk-bp') + '</div>' +
          '<div class="builder-field">' + B.fieldHtml({ key: 'bptype', label: 'Object type', type: 'select', options: BP_LINK_TYPES.map(function (t) { return { value: t, label: BP.ENTITY_META[t].plural }; }) }, type, 'risk-bptype') + '</div>' +
          '<div class="builder-field">' + B.fieldHtml({ key: 'bpobj', label: 'Object', type: 'select', options: objects.map(function (o) { return { value: o.id, label: BP.entityName(type, o) }; }) }, proj.data.relatedBlueprintId, 'risk-bpobj') + '</div>' +
        '</div>';
      bpMount.querySelector('#risk-bp').addEventListener('change', function (e) { proj.data.relatedBlueprintProjectId = e.target.value; proj.data.relatedBlueprintId = ''; ctrl.persist(); render(); });
      bpMount.querySelector('#risk-bptype').addEventListener('change', function (e) { proj.data.relatedBlueprintType = e.target.value; proj.data.relatedBlueprintId = ''; ctrl.persist(); render(); });
      bpMount.querySelector('#risk-bpobj').addEventListener('change', function (e) { proj.data.relatedBlueprintId = e.target.value; ctrl.persist(); });
    }
    render();
  }

  /* ----------------------------------------------------------
     Wizard — Step 2: Criticality & Impact
     ---------------------------------------------------------- */

  function stepCriticality(container, proj, ctrl) {
    container.innerHTML =
      '<h3>If this system stopped working, what would happen?</h3>' +
      '<p class="lede">Do not infer criticality from category alone — explain it.</p>' +
      '<div class="builder-field-grid" id="crit-fields"></div>' +
      '<h3 style="margin-top:var(--space-7)">Impacts</h3><div id="impacts-mount"></div>';

    var fields = [
      { key: 'criticality', label: 'Criticality', type: 'select', options: K.CRITICALITY_LEVELS },
      { key: 'criticalityExplanation', label: 'Why?', type: 'textarea', wide: true }
    ];
    var mount = container.querySelector('#crit-fields');
    mount.innerHTML = fields.map(function (f) { return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, proj.data[f.key], 'risk-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(mount, proj.data, fields, ctrl.persist);

    B.repeatableList({
      mount: container.querySelector('#impacts-mount'), project: proj, dataKey: 'impacts',
      addLabel: 'Add Impact', itemLabel: function (item) { return item.category || 'Impact'; }, onChange: ctrl.persist,
      fields: [
        { key: 'category', label: 'Impact category', type: 'select', options: K.IMPACT_CATEGORIES },
        { key: 'whatWouldHappen', label: 'What would happen?', type: 'textarea', wide: true },
        { key: 'severity', label: 'Severity', type: 'select', options: K.CRITICALITY_LEVELS }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 3: Dependencies (Sections 5-8)
     ---------------------------------------------------------- */

  function stepDependencies(container, proj, ctrl) {
    container.innerHTML =
      '<h3>What does this system depend on?</h3>' +
      '<p class="lede">For each dependency, the question that matters most: is there a workable alternative?</p>' +
      '<div id="deps-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#deps-mount'), project: proj, dataKey: 'dependencies',
      addLabel: 'Add Dependency', itemLabel: function (item) { return item.whatDependedOn || 'Untitled dependency'; }, onChange: ctrl.persist,
      fields: [
        { key: 'category', label: 'Category', type: 'select', options: K.DEPENDENCY_CATEGORIES },
        { key: 'whatDependedOn', label: 'What is depended on?', wide: true },
        { key: 'why', label: 'Why?', type: 'textarea', wide: true },
        { key: 'strength', label: 'Strength of dependency', type: 'select', options: K.DEPENDENCY_STRENGTH },
        { key: 'alternativeAvailable', label: 'Alternative available?', type: 'select', options: K.YES_NO_UNSURE },
        { key: 'timeToSubstitute', label: 'Time to substitute', type: 'select', options: K.TIME_OPTIONS },
        { key: 'owner', label: 'Owner' },
        { key: 'evidence', label: 'Evidence', wide: true },
        { key: 'concentrationDescription', label: 'Concentration pattern, if any (e.g. "74% of complex cases require this")', type: 'textarea', wide: true }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 4: Technology, Data & Vendor Dependencies
     ---------------------------------------------------------- */

  function stepTechDataVendor(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Technology Dependencies</h3><div id="tech-mount"></div>' +
      '<h3 style="margin-top:var(--space-7)">Data Dependencies</h3><div id="data-mount"></div>' +
      '<h3 style="margin-top:var(--space-7)">Vendor Dependencies</h3><p class="lede">Kept intentionally light — this is not vendor-management software.</p><div id="vendor-mount"></div>';

    B.repeatableList({
      mount: container.querySelector('#tech-mount'), project: proj, dataKey: 'technologyDependencies',
      addLabel: 'Add Technology', itemLabel: function (item) { return item.system || 'Untitled system'; }, onChange: ctrl.persist,
      fields: [
        { key: 'system', label: 'System', wide: true }, { key: 'purpose', label: 'Purpose', wide: true },
        { key: 'owner', label: 'Owner' }, { key: 'criticalProcessesSupported', label: 'Critical processes supported' },
        { key: 'fallback', label: 'Fallback' }, { key: 'outageTolerance', label: 'Expected outage tolerance' },
        { key: 'manualWorkaround', label: 'Manual workaround' }, { key: 'manualWorkaroundTested', label: 'Manual workaround tested?', type: 'select', options: K.YES_NO_UNSURE },
        { key: 'integrationDependencies', label: 'Integration dependencies' }, { key: 'knownReliabilityIssue', label: 'Known reliability issue', wide: true },
        { key: 'dataDependency', label: 'Data dependency' }
      ]
    });

    B.repeatableList({
      mount: container.querySelector('#data-mount'), project: proj, dataKey: 'dataDependencies',
      addLabel: 'Add Data Source', itemLabel: function (item) { return item.dataSource || 'Untitled data source'; }, onChange: ctrl.persist,
      fields: [
        { key: 'dataSource', label: 'Data source', wide: true }, { key: 'systemOfRecord', label: 'System of record' },
        { key: 'owner', label: 'Owner' }, { key: 'consumers', label: 'Consumers' },
        { key: 'validation', label: 'Validation' }, { key: 'backup', label: 'Backup' },
        { key: 'recoveryMethod', label: 'Recovery method' }, { key: 'freshnessRequirement', label: 'Freshness requirement' },
        { key: 'impactIfUnavailable', label: 'Impact if incorrect or unavailable', wide: true },
        { key: 'usedInCriticalDecision', label: 'Used in a critical decision?', type: 'select', options: K.YES_NO_UNSURE },
        { key: 'dataConfidence', label: 'Data confidence', type: 'select', options: K.CONFIDENCE_LEVELS },
        { key: 'manuallyMaintained', label: 'Manually maintained?', type: 'select', options: K.YES_NO_UNSURE }
      ]
    });

    B.repeatableList({
      mount: container.querySelector('#vendor-mount'), project: proj, dataKey: 'vendorDependencies',
      addLabel: 'Add Vendor', itemLabel: function (item) { return item.vendor || 'Untitled vendor'; }, onChange: ctrl.persist,
      fields: [
        { key: 'vendor', label: 'Vendor', wide: true }, { key: 'service', label: 'Service', wide: true },
        { key: 'criticality', label: 'Criticality', type: 'select', options: K.CRITICALITY_LEVELS },
        { key: 'alternativeSupplier', label: 'Alternative supplier?', type: 'select', options: K.YES_NO_UNSURE },
        { key: 'switchingTime', label: 'Switching time', type: 'select', options: K.TIME_OPTIONS },
        { key: 'contractDependency', label: 'Contract dependency' }, { key: 'dataDependency', label: 'Data dependency' },
        { key: 'knowledgeDependency', label: 'Knowledge dependency' }, { key: 'operationalWorkaround', label: 'Operational workaround', wide: true }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 5: Knowledge Risk
     ---------------------------------------------------------- */

  function stepKnowledge(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Knowledge Risk</h3>' +
      '<p class="lede">If one person leaving can stop the process, the process is not actually owned by the organization.</p>' +
      '<div id="knowledge-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#knowledge-mount'), project: proj, dataKey: 'knowledgeRisks',
      addLabel: 'Add Knowledge Area', itemLabel: function (item) { return item.whatKnowledge || 'Untitled'; }, onChange: ctrl.persist,
      fields: [
        { key: 'whatKnowledge', label: 'What knowledge?', wide: true },
        { key: 'documented', label: 'Documented?', type: 'select', options: K.YES_NO_UNSURE },
        { key: 'current', label: 'Current?', type: 'select', options: K.YES_NO_UNSURE },
        { key: 'canOthersExecute', label: 'Can another person execute from it?', type: 'select', options: K.YES_NO_UNSURE },
        { key: 'backupTested', label: 'Has backup capability been tested?', type: 'select', options: K.YES_NO_UNSURE },
        { key: 'recoveryTime', label: 'How long would replacement take?', type: 'select', options: K.TIME_OPTIONS }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 6: Risk Register (Sections 33, 35-37)
     ---------------------------------------------------------- */

  function stepRisks(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Risk Register</h3>' +
      '<p class="lede">The goal is not to eliminate all risk. The goal is to understand which risks the operating system can and cannot absorb.</p>' +
      '<div id="risks-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#risks-mount'), project: proj, dataKey: 'risks',
      addLabel: 'Add Risk', itemLabel: function (item) { return item.risk || 'Untitled risk'; },
      defaults: function () { return { status: 'Open' }; }, onChange: ctrl.persist,
      fields: [
        { key: 'risk', label: 'Risk', wide: true },
        { key: 'system', label: 'System' },
        { key: 'cause', label: 'Cause / exposure', type: 'textarea', wide: true },
        { key: 'potentialImpact', label: 'Potential impact', type: 'textarea', wide: true },
        { key: 'likelihood', label: 'Likelihood', type: 'select', options: K.CRITICALITY_LEVELS },
        { key: 'impact', label: 'Impact', type: 'select', options: K.CRITICALITY_LEVELS },
        { key: 'owner', label: 'Owner' },
        { key: 'control', label: 'Control (name it exactly as recorded in Controls)' },
        { key: 'earlyWarning', label: 'Early warning' },
        { key: 'response', label: 'Response', type: 'textarea', wide: true },
        { key: 'recovery', label: 'Recovery', type: 'textarea', wide: true },
        { key: 'status', label: 'Status', type: 'select', options: K.RISK_STATUSES },
        { key: 'reviewRhythm', label: 'Review rhythm' },
        { key: 'evidence', label: 'Evidence', wide: true },
        { key: 'detectionMechanism', label: 'How would we know this failed?', wide: true },
        { key: 'automatedOrManual', label: 'Automated or manual?', type: 'select', options: ['Automated', 'Manual'] },
        { key: 'timeToImpact', label: 'Time to impact', type: 'select', options: K.TIME_OPTIONS },
        { key: 'fallbackExists', label: 'Fallback exists?', type: 'select', options: K.YES_NO_UNSURE },
        { key: 'backupExists', label: 'Backup exists?', type: 'select', options: K.YES_NO_UNSURE },
        { key: 'knowledgeExists', label: 'Knowledge exists?', type: 'select', options: K.YES_NO_UNSURE },
        { key: 'authorityExists', label: 'Authority exists to act?', type: 'select', options: K.YES_NO_UNSURE },
        { key: 'recoveryStepsExist', label: 'Recovery steps exist?', type: 'select', options: K.YES_NO_UNSURE },
        { key: 'recoveryTested', label: 'Has recovery been tested?', type: 'select', options: K.YES_NO_UNSURE },
        { key: 'responseTested', label: 'Has response been tested?', type: 'select', options: K.YES_NO_UNSURE },
        { key: 'linkedBlueprintObject', label: 'Related Blueprint object (optional, for blast radius)', type: 'select', options: blueprintObjectOptions(proj) }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 7: Controls (Sections 30-32)
     ---------------------------------------------------------- */

  function stepControls(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Controls</h3>' +
      '<p class="lede">A control that nobody monitors is not a control.</p>' +
      '<div id="controls-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#controls-mount'), project: proj, dataKey: 'controls',
      addLabel: 'Add Control', itemLabel: function (item) { return item.control || 'Untitled control'; }, onChange: ctrl.persist,
      fields: [
        { key: 'control', label: 'Control', wide: true },
        { key: 'riskAddressed', label: 'Risk addressed', wide: true },
        { key: 'owner', label: 'Owner' },
        { key: 'type', label: 'Type', type: 'select', options: K.CONTROL_TYPES },
        { key: 'frequency', label: 'Frequency' },
        { key: 'evidence', label: 'Evidence' },
        { key: 'monitoring', label: 'Is anyone monitoring it?', type: 'select', options: K.YES_NO_UNSURE },
        { key: 'failureResponse', label: 'Failure response', wide: true }
      ]
    });
  }

  var WIZARD_STEPS = [
    { id: 'system', label: 'System', render: stepSystem },
    { id: 'criticality', label: 'Criticality', render: stepCriticality },
    { id: 'dependencies', label: 'Dependencies', render: stepDependencies },
    { id: 'techdatavendor', label: 'Technology, Data & Vendors', render: stepTechDataVendor },
    { id: 'knowledge', label: 'Knowledge Risk', render: stepKnowledge },
    { id: 'risks', label: 'Risk Register', render: stepRisks },
    { id: 'controls', label: 'Controls', render: stepControls }
  ];

  function enterWizard() {
    els.launcher.hidden = true;
    els.viewer.hidden = true;
    if (els.viewerSection) els.viewerSection.hidden = true;
    els.wizard.hidden = false;
    els.projectName.textContent = project.name;
    B.initWizard({ project: project, steps: WIZARD_STEPS, store: K.store, els: { progress: els.progress, body: els.stepBody, prev: els.prev, next: els.next, stepLabel: els.stepLabel } });
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
      ' this is the Northstar Software Customer Onboarding risk sample. Current operations look healthy — the point of this sample is to show why that does not mean the system is safe. It does not represent your organization.'
    );
    global.OMSData.bindSampleBanner(els.sampleBanner, {
      onExit: function () { backToLauncher(); },
      onClear: function () {
        if (!global.confirm('Delete the sample Risk Model? This cannot be undone.')) return;
        K.store.remove(project.id);
        project = null;
        backToLauncher();
      }
    });
  }

  var VIEWER_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'dependencies', label: 'Dependencies' },
    { id: 'risks', label: 'Risk Register' },
    { id: 'controls', label: 'Controls' },
    { id: 'blast', label: 'Blast Radius & Top Risks' },
    { id: 'summary', label: 'Summary' }
  ];

  function renderViewer() {
    els.viewerBody.innerHTML = '<div class="bp-toolbar"><div class="bp-tabs" id="risk-tabs"></div></div><div id="risk-tab-body"></div>';
    var tabsEl = els.viewerBody.querySelector('#risk-tabs');
    tabsEl.innerHTML = VIEWER_TABS.map(function (t) { return '<button type="button" data-tab="' + t.id + '" class="' + (viewerState.tab === t.id ? 'is-active' : '') + '">' + t.label + '</button>'; }).join('');
    tabsEl.querySelectorAll('[data-tab]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.tab = btn.getAttribute('data-tab'); renderViewer(); }); });
    var body = els.viewerBody.querySelector('#risk-tab-body');
    if (viewerState.tab === 'dependencies') renderDependenciesTab(body);
    else if (viewerState.tab === 'risks') renderRisksTab(body);
    else if (viewerState.tab === 'controls') renderControlsTab(body);
    else if (viewerState.tab === 'blast') renderBlastTab(body);
    else if (viewerState.tab === 'summary') renderSummaryTab(body);
    else renderOverviewTab(body);
  }

  /* ----------------------------------------------------------
     Overview
     ---------------------------------------------------------- */

  function renderOverviewTab(mount) {
    var d = project.data;
    var findings = K.modelFindings(project);
    var spofs = K.singlePointsOfFailure(project);
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">' + esc(d.systemType || 'System') + '</span><h3>' + esc(project.name) + '</h3></div>' +
      '<div class="card" style="margin-bottom:var(--space-6)">' +
        '<div class="build-project-row__meta">' + levelPill(d.criticality) + '<strong>Criticality</strong></div>' +
        '<p class="text-muted" style="margin-top:var(--space-2)">' + esc(d.criticalityExplanation || 'No explanation recorded yet.') + '</p>' +
        '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-2)"><strong>Supports:</strong> ' + esc(d.valueOutcomeSupported || 'Not recorded') + '<br><strong>Stakeholders:</strong> ' + esc(d.stakeholdersAffected || 'Not recorded') + '</p>' +
      '</div>' +
      metricGrid([
        { label: 'Dependencies', value: (d.dependencies || []).length },
        { label: 'Single Points Of Failure', value: spofs.length },
        { label: 'Risks Recorded', value: (d.risks || []).length },
        { label: 'Controls', value: (d.controls || []).length }
      ]) +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Impacts If This Fails</span></div>' +
      ((d.impacts || []).length ? (d.impacts || []).map(function (i) {
        return '<div class="trace-node" style="cursor:default"><span>' + levelPill(i.severity) + ' <strong>' + esc(i.category) + '</strong><br><span class="text-dim" style="font-size:var(--step--1)">' + esc(i.whatWouldHappen || '') + '</span></span></div>';
      }).join('') : '<p class="callout">No impacts recorded yet.</p>') +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Findings</span></div>' +
      flagList(findings);
  }

  /* ----------------------------------------------------------
     Dependencies (with Technology / Data / Vendor / Knowledge
     sub-tabs)
     ---------------------------------------------------------- */

  function renderDependenciesTab(mount) {
    var subs = [
      { id: 'dependencies', label: 'Dependencies' }, { id: 'technology', label: 'Technology' },
      { id: 'data', label: 'Data' }, { id: 'vendors', label: 'Vendors' }, { id: 'knowledge', label: 'Knowledge Risk' }
    ];
    mount.innerHTML = '<div class="bp-tabs" id="dep-subtabs" style="margin-bottom:var(--space-5)"></div><div id="dep-subbody"></div>';
    var tabs = mount.querySelector('#dep-subtabs');
    tabs.innerHTML = subs.map(function (s) { return '<button type="button" data-view="' + s.id + '" class="' + (viewerState.depSubTab === s.id ? 'is-active' : '') + '">' + s.label + '</button>'; }).join('');
    tabs.querySelectorAll('[data-view]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.depSubTab = btn.getAttribute('data-view'); renderDependenciesTab(mount); }); });
    var body = mount.querySelector('#dep-subbody');
    if (viewerState.depSubTab === 'technology') renderTechView(body);
    else if (viewerState.depSubTab === 'data') renderDataView(body);
    else if (viewerState.depSubTab === 'vendors') renderVendorView(body);
    else if (viewerState.depSubTab === 'knowledge') renderKnowledgeView(body);
    else renderDependencyView(body);
  }

  function renderDependencyView(mount) {
    var deps = project.data.dependencies || [];
    if (!deps.length) { mount.innerHTML = '<p class="callout">No dependencies defined yet. Add them from the wizard.</p>'; return; }
    mount.innerHTML = deps.map(function (d) {
      var flags = K.dependencyFlags(d, project.data.criticality);
      return '<div class="card" style="margin-bottom:var(--space-4)">' +
        '<div class="bp-chain-section__header"><h4 style="margin:0">' + esc(d.whatDependedOn || 'Untitled') + '</h4><span class="badge badge--outline">' + esc(d.category || '') + '</span>' + levelPill(d.strength) + '</div>' +
        '<p class="text-muted">' + esc(d.why || 'No rationale recorded.') + '</p>' +
        '<p class="text-dim" style="font-size:var(--step--1)"><strong>Alternative available:</strong> ' + esc(d.alternativeAvailable || 'Unknown') + ' &middot; <strong>Time to substitute:</strong> ' + esc(d.timeToSubstitute || 'Unknown') + ' &middot; <strong>Owner:</strong> ' + esc(d.owner || 'Not named') + '</p>' +
        (flags.length ? '<div style="margin-top:var(--space-3)">' + flags.map(function (f) { return '<span class="badge risk-flag__badge risk-flag__badge--' + (f.rule === 'Single Point Of Failure' ? 'critical' : 'warning') + '" style="margin-right:var(--space-2)" title="' + esc(f.message) + '">' + esc(f.rule) + '</span>'; }).join('') + '</div>' : '') +
      '</div>';
    }).join('');
  }

  function renderTechView(mount) {
    var techs = project.data.technologyDependencies || [];
    var crossFlags = K.technologyConcentration(techs);
    mount.innerHTML =
      (techs.length ? techs.map(function (t) {
        var flags = K.technologyFlags(t);
        return '<div class="card" style="margin-bottom:var(--space-4)">' +
          '<h4 style="margin:0 0 var(--space-2)">' + esc(t.system || 'Untitled') + '</h4>' +
          '<p class="text-muted">' + esc(t.purpose || '') + '</p>' +
          '<p class="text-dim" style="font-size:var(--step--1)"><strong>Fallback:</strong> ' + esc(t.fallback || 'None') + ' &middot; <strong>Tested:</strong> ' + esc(t.manualWorkaroundTested || 'Unknown') + ' &middot; <strong>Outage tolerance:</strong> ' + esc(t.outageTolerance || 'Not set') + '</p>' +
          (flags.length ? flagList(flags.map(function (f) { return { severity: 'warning', rule: f.rule, message: f.message }; })) : '') +
        '</div>';
      }).join('') : '<p class="callout">No technology dependencies defined yet.</p>') +
      (crossFlags.length ? '<div class="section-head" style="margin-top:var(--space-6)"><span class="eyebrow">Cross-System Pattern</span></div>' + flagList(crossFlags.map(function (f) { return { severity: 'warning', rule: f.rule, message: f.message, why: f.why }; })) : '');
  }

  function renderDataView(mount) {
    var list = project.data.dataDependencies || [];
    mount.innerHTML = list.length ? list.map(function (d) {
      return '<div class="card" style="margin-bottom:var(--space-4)">' +
        '<h4 style="margin:0 0 var(--space-2)">' + esc(d.dataSource || 'Untitled') + '</h4>' +
        '<p class="text-dim" style="font-size:var(--step--1)"><strong>System of record:</strong> ' + esc(d.systemOfRecord || 'Not set') + ' &middot; <strong>Owner:</strong> ' + esc(d.owner || 'Not named') + ' &middot; <strong>Confidence:</strong> ' + esc(d.dataConfidence || 'Unknown') + '</p>' +
        flagList(K.dataFlags(d)) +
      '</div>';
    }).join('') : '<p class="callout">No data dependencies defined yet.</p>';
  }

  function renderVendorView(mount) {
    var list = project.data.vendorDependencies || [];
    mount.innerHTML = list.length ? list.map(function (v) {
      return '<div class="card" style="margin-bottom:var(--space-4)">' +
        '<h4 style="margin:0 0 var(--space-2)">' + esc(v.vendor || 'Untitled') + '</h4>' +
        '<p class="text-muted">' + esc(v.service || '') + '</p>' +
        '<p class="text-dim" style="font-size:var(--step--1)"><strong>Criticality:</strong> ' + esc(v.criticality || 'Not set') + ' &middot; <strong>Alternative supplier:</strong> ' + esc(v.alternativeSupplier || 'Unknown') + ' &middot; <strong>Switching time:</strong> ' + esc(v.switchingTime || 'Unknown') + '</p>' +
        flagList(K.vendorFlags(v)) +
      '</div>';
    }).join('') : '<p class="callout">No vendor dependencies defined yet.</p>';
  }

  function renderKnowledgeView(mount) {
    var list = project.data.knowledgeRisks || [];
    mount.innerHTML = list.length ? list.map(function (k) {
      return '<div class="card" style="margin-bottom:var(--space-4)">' +
        '<h4 style="margin:0 0 var(--space-2)">' + esc(k.whatKnowledge || 'Untitled') + '</h4>' +
        '<p class="text-dim" style="font-size:var(--step--1)"><strong>Documented:</strong> ' + esc(k.documented || 'Unknown') + ' &middot; <strong>Backup tested:</strong> ' + esc(k.backupTested || 'Unknown') + ' &middot; <strong>Recovery time:</strong> ' + esc(k.recoveryTime || 'Unknown') + '</p>' +
        flagList(K.knowledgeRiskFlags(k)) +
      '</div>';
    }).join('') : '<p class="callout">No knowledge risks defined yet.</p>';
  }

  /* ----------------------------------------------------------
     Risk Register
     ---------------------------------------------------------- */

  function renderRisksTab(mount) {
    var risks = project.data.risks || [];
    if (!risks.length) { mount.innerHTML = '<p class="callout">No risks defined yet. Add them from the wizard.</p>'; return; }
    var openIndex = Math.min(viewerState.openRiskIndex || 0, risks.length - 1);
    mount.innerHTML = '<div class="bp-tabs" id="risk-picker" style="margin-bottom:var(--space-5);flex-wrap:wrap"></div><div id="risk-detail-body"></div>';
    var picker = mount.querySelector('#risk-picker');
    picker.innerHTML = risks.map(function (r, i) { return '<button type="button" data-idx="' + i + '" class="' + (i === openIndex ? 'is-active' : '') + '">' + esc(r.risk || 'Untitled') + '</button>'; }).join('');
    picker.querySelectorAll('[data-idx]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.openRiskIndex = parseInt(btn.getAttribute('data-idx'), 10); renderRisksTab(mount); }); });

    var risk = risks[openIndex];
    var profile = K.exposureProfile(risk, project);
    var coverage = K.controlCoverage(risk, project.data.controls);
    mount.querySelector('#risk-detail-body').innerHTML =
      '<div class="card">' +
        '<div class="bp-chain-section__header"><h3 style="margin:0">' + esc(risk.risk || 'Untitled') + '</h3>' + levelPill(risk.likelihood) + levelPill(risk.impact) + '</div>' +
        '<p class="text-muted"><strong>Cause:</strong> ' + esc(risk.cause || '—') + '</p>' +
        '<p class="text-muted"><strong>Potential impact:</strong> ' + esc(risk.potentialImpact || '—') + '</p>' +
        '<dl class="dva-row">' +
          '<div class="dva-row__col"><h5>Response &amp; Recovery</h5><p style="font-size:var(--step--1)"><strong>Owner:</strong> ' + esc(risk.owner || '—') + '<br><strong>Response:</strong> ' + esc(risk.response || '—') + '<br><strong>Recovery:</strong> ' + esc(risk.recovery || '—') + '<br><strong>Status:</strong> ' + esc(risk.status || '—') + '</p></div>' +
          '<div class="dva-row__col"><h5>Detection</h5><p style="font-size:var(--step--1)"><strong>Mechanism:</strong> ' + esc(risk.detectionMechanism || '—') + '<br><strong>Early warning:</strong> ' + esc(risk.earlyWarning || '—') + '<br><strong>Automated/Manual:</strong> ' + esc(risk.automatedOrManual || '—') + '</p></div>' +
        '</dl>' +
        '<div class="section-head" style="margin-top:var(--space-5)"><span class="eyebrow">Exposure Profile</span></div>' +
        '<p class="text-dim" style="font-size:var(--step--1);margin-bottom:var(--space-3)">More useful than a single red/yellow/green rating — two risks with the same likelihood and impact can have very different blast radius, detectability, and recovery readiness.</p>' +
        metricGrid([
          { label: 'Likelihood', value: profile.likelihood }, { label: 'Impact', value: profile.impact },
          { label: 'Blast Radius', value: profile.blastRadius }, { label: 'Detectability', value: profile.detectability, note: profile.detectabilityWhy },
          { label: 'Time To Impact', value: profile.timeToImpact }, { label: 'Response Readiness', value: profile.responseReadiness },
          { label: 'Recovery Readiness', value: profile.recoveryReadiness, note: profile.recoveryReadinessWhy }, { label: 'Dependency Concentration', value: profile.dependencyConcentration },
          { label: 'Control Coverage', value: coverage }
        ]) +
        '<div class="inspector-panel__actions" style="margin-top:var(--space-4)"><button type="button" class="btn btn--ghost" data-save-finding="' + openIndex + '">Save To Workbench</button></div>' +
      '</div>';

    var saveBtn = mount.querySelector('[data-save-finding]');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      project.data.findings.push({ id: K.newId('find'), type: 'Risk: ' + risk.risk, message: 'Likelihood ' + risk.likelihood + ', Impact ' + risk.impact + '. ' + (risk.potentialImpact || ''), why: 'From Risk Model "' + project.name + '".', savedAt: new Date().toISOString() });
      K.logActivity(project, 'Saved finding to Workbench: ' + risk.risk);
      K.store.save(project);
      saveBtn.textContent = 'Saved ✓';
      saveBtn.disabled = true;
    });
  }

  /* ----------------------------------------------------------
     Controls
     ---------------------------------------------------------- */

  function renderControlsTab(mount) {
    var controls = project.data.controls || [];
    var risks = project.data.risks || [];
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">Controls</span></div>' +
      (controls.length ? controls.map(function (c) {
        return '<div class="card" style="margin-bottom:var(--space-4)">' +
          '<div class="bp-chain-section__header"><h4 style="margin:0">' + esc(c.control || 'Untitled') + '</h4><span class="badge badge--outline">' + esc(c.type || '') + '</span></div>' +
          '<p class="text-muted">' + esc(c.riskAddressed || 'No risk named.') + '</p>' +
          '<p class="text-dim" style="font-size:var(--step--1)"><strong>Owner:</strong> ' + esc(c.owner || 'Not named') + ' &middot; <strong>Frequency:</strong> ' + esc(c.frequency || 'Not set') + '</p>' +
          flagList(K.controlFlags(c)) +
        '</div>';
      }).join('') : '<p class="callout">No controls defined yet.</p>') +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Control Coverage</span></div>' +
      '<p class="text-dim" style="font-size:var(--step--1);margin-bottom:var(--space-3)">Controlled does not mean risk eliminated — it means a named, evidenced control exists.</p>' +
      (risks.length ? '<div class="builder-table-wrap"><table class="builder-table"><thead><tr><th>Risk</th><th>Named Control</th><th>Coverage</th></tr></thead><tbody>' +
        risks.map(function (r) { return '<tr><td>' + esc(r.risk || 'Untitled') + '</td><td>' + esc(r.control || '&mdash;') + '</td><td>' + esc(K.controlCoverage(r, controls)) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<p class="callout">No risks recorded yet.</p>');
  }

  /* ----------------------------------------------------------
     Blast Radius & Top Systemic Risks (Sections 15-16, 58)
     ---------------------------------------------------------- */

  function renderBlastTab(mount) {
    var options = blueprintObjectOptions(project);
    var ranked = K.topSystemicRisks(project);
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">Blast Radius</span><h3>If this fails, how far would the impact spread?</h3></div>' +
      (options.length ? '<div class="builder-field-grid">' +
        '<div class="builder-field"><label class="builder-field__label">Choose a Blueprint object</label><select class="builder-field__input" id="blast-select"><option value="">Select&hellip;</option>' +
          options.map(function (o) { return '<option value="' + o.value + '"' + (o.value === (viewerState.mapType + '::' + viewerState.mapId) ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('') + '</select></div>' +
        '<div class="builder-field"><label class="builder-field__label">Trace depth</label><select class="builder-field__input" id="blast-mode">' +
          ['first', 'second', 'full'].map(function (m) { return '<option value="' + m + '"' + (viewerState.mapMode === m ? ' selected' : '') + '>' + (m === 'first' ? 'First-Order Impact' : m === 'second' ? 'Second-Order Impact' : 'Full Trace') + '</option>'; }).join('') + '</select></div>' +
      '</div><div id="blast-chain-mount" style="margin-top:var(--space-5)"></div>'
        : '<p class="callout">Link a Blueprint object from the wizard to trace blast radius.</p>') +
      '<div class="section-head" style="margin-top:var(--space-8)"><span class="eyebrow">Top Systemic Risks</span></div>' +
      '<p class="text-dim" style="font-size:var(--step--1);margin-bottom:var(--space-3)">A transparent ranking from structural inputs — not a scientifically validated score. Click any risk to see exactly why it ranked where it did.</p>' +
      (ranked.length ? ranked.map(function (r, i) {
        return '<div class="trace-node" style="cursor:default;align-items:flex-start"><span><strong>#' + (i + 1) + ' ' + esc(r.risk.risk || 'Untitled') + '</strong> <span class="badge badge--outline">Score: ' + r.score + '</span>' +
          '<details style="margin-top:var(--space-2)"><summary class="text-dim" style="font-size:var(--step--1);cursor:pointer">Why is this ranked here?</summary><ul style="margin:var(--space-2) 0 0 1.2em;font-size:var(--step--1)">' + r.why.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></details></span></div>';
      }).join('') : '<p class="callout">No risks recorded yet.</p>');

    var select = mount.querySelector('#blast-select');
    var modeSelect = mount.querySelector('#blast-mode');
    if (select) {
      select.addEventListener('change', function (e) { var parts = e.target.value.split('::'); viewerState.mapType = parts[0] || ''; viewerState.mapId = parts[1] || ''; renderBlastChain(mount.querySelector('#blast-chain-mount')); });
      modeSelect.addEventListener('change', function (e) { viewerState.mapMode = e.target.value; renderBlastChain(mount.querySelector('#blast-chain-mount')); });
      if (viewerState.mapType && viewerState.mapId) renderBlastChain(mount.querySelector('#blast-chain-mount'));
    }
  }

  function renderBlastChain(mount) {
    if (!mount || !BP) return;
    var bp = project.data.relatedBlueprintProjectId ? BP.store.get(project.data.relatedBlueprintProjectId) : BP.store.mostRecent();
    if (!bp) { mount.innerHTML = '<p class="callout">No Blueprint available.</p>'; return; }
    var tiers = BP.blastRadius(bp, viewerState.mapType, viewerState.mapId);
    var limit = viewerState.mapMode === 'first' ? 1 : viewerState.mapMode === 'second' ? 2 : tiers.length;
    var shown = tiers.slice(0, limit);
    if (!shown.length) { mount.innerHTML = '<p class="callout">Nothing downstream is connected to this object yet.</p>'; return; }
    mount.innerHTML = shown.map(function (t) {
      return '<div class="trace-tier"><span class="trace-tier__label">' + esc(t.label) + '</span><div class="trace-node-list">' +
        t.nodes.map(function (n) { return '<div class="trace-node" style="cursor:default"><span>' + esc(BP.entityName(n.node.type, BP.byId(bp.data[n.node.type], n.node.id)) || BP.ENTITY_META[n.node.type].label) + '</span><span class="trace-node__relation">' + esc(n.relation) + '</span></div>'; }).join('') +
      '</div></div>';
    }).join('');
  }

  /* ----------------------------------------------------------
     Summary
     ---------------------------------------------------------- */

  function renderSummaryTab(mount) {
    var findings = K.modelFindings(project);
    var spofs = K.singlePointsOfFailure(project);
    mount.innerHTML =
      '<div class="card">' +
        '<span class="eyebrow">Risk Model Summary</span>' +
        '<h2 style="margin:var(--space-2) 0">' + esc(project.name) + '</h2>' +
        '<p><strong>System type:</strong> ' + esc(project.data.systemType || '—') + ' &nbsp; <strong>Owner:</strong> ' + esc(project.owner || 'No owner named') + '</p>' +
        metricGrid([
          { label: 'Criticality', value: project.data.criticality || 'Not set' }, { label: 'Dependencies', value: (project.data.dependencies || []).length },
          { label: 'Single Points Of Failure', value: spofs.length }, { label: 'Risks', value: (project.data.risks || []).length }
        ]) +
        '<span class="eyebrow" style="margin-top:var(--space-5);display:block">Findings</span>' +
        (findings.length ? '<ul style="margin:var(--space-2) 0 0 1.2em">' + findings.map(function (f) { return '<li>' + esc(f.rule) + '</li>'; }).join('') + '</ul>' : '<p class="text-dim">None flagged.</p>') +
      '</div>' +
      '<div class="hero__actions" style="margin-top:var(--space-5)">' +
        '<button type="button" class="btn btn--secondary" id="risk-export-btn">Export Risk Model JSON</button>' +
        '<button type="button" class="btn btn--secondary" id="risk-print-btn">Print Risk Profile</button>' +
        '<a class="btn btn--secondary" href="' + resilienceHref(project.id) + '">Analyze Resilience &rarr;</a>' +
      '</div>';
    mount.querySelector('#risk-export-btn').addEventListener('click', function () { B.exportJson(project); });
    mount.querySelector('#risk-print-btn').addEventListener('click', function () { global.print(); });
  }

  function resilienceHref(riskModelId) {
    var base = global.OMSData ? global.OMSData.href('pages/resilience.html') : 'resilience.html';
    return base + '?fromRisk=' + encodeURIComponent(riskModelId);
  }

  /* ----------------------------------------------------------
     Launcher
     ---------------------------------------------------------- */

  function renderResumeList() {
    var list = K.store.list().slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
    if (!els.resumeList) return;
    if (!list.length) { els.resumeList.innerHTML = ''; return; }
    els.resumeList.innerHTML = '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">My Risk Models</span></div>' +
      list.map(function (m) {
        return '<div class="build-project-row" data-id="' + m.id + '">' +
          '<div class="build-project-row__meta">' +
            (m.isSample ? '<span class="badge badge--accent">Sample</span>' : '') +
            levelPill(m.data.criticality) +
            '<strong>' + esc(m.name) + '</strong>' +
            '<span class="text-dim text-mono" style="font-size:var(--step--1)">' + (m.data.risks || []).length + ' risks &middot; Updated ' + B.formatDate(m.updatedAt) + '</span>' +
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

    els.resumeList.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { project = K.store.get(b.getAttribute('data-open')); enterViewer(); }); });
    els.resumeList.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { project = K.store.get(b.getAttribute('data-edit')); enterWizard(); }); });
    els.resumeList.querySelectorAll('[data-duplicate]').forEach(function (b) { b.addEventListener('click', function () { K.store.duplicate(b.getAttribute('data-duplicate')); renderResumeList(); }); });
    els.resumeList.querySelectorAll('[data-export]').forEach(function (b) { b.addEventListener('click', function () { B.exportJson(K.store.get(b.getAttribute('data-export'))); }); });
    els.resumeList.querySelectorAll('[data-delete]').forEach(function (b) {
      b.addEventListener('click', function () { if (global.confirm('Delete this Risk Model? This cannot be undone.')) { K.store.remove(b.getAttribute('data-delete')); renderResumeList(); } });
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
    K = global.OMSRisk;
    BP = global.OMSBlueprint;
    VS = global.OMSValueStream;
    Cap = global.OMSCapacity;

    els.launcher = byId('risk-launcher');
    els.wizard = byId('risk-wizard');
    els.viewer = byId('risk-viewer');
    els.viewerBody = byId('risk-viewer-body');
    els.viewerSection = byId('risk-viewer-section');
    els.sampleBanner = byId('risk-sample-banner');
    els.resumeList = byId('risk-resume-list');
    els.progress = byId('builder-progress');
    els.stepBody = byId('builder-step-body');
    els.prev = byId('builder-prev');
    els.next = byId('builder-next');
    els.stepLabel = byId('builder-step-label');
    els.projectName = byId('builder-project-name');

    var newBtn = byId('new-risk-btn');
    var sampleBtn = byId('load-sample-risk-btn');
    var importBpBtn = byId('import-bp-risk-btn');
    var exitBtn = byId('builder-exit');
    var viewerExitBtn = byId('viewer-exit');
    var viewerEditBtn = byId('viewer-edit');

    if (newBtn) newBtn.addEventListener('click', function () {
      var name = global.prompt('Name this Risk Model:', 'New Risk Model');
      if (name === null) return;
      project = K.store.create(name || 'New Risk Model', K.blankData(), false);
      enterWizard();
    });
    if (sampleBtn) sampleBtn.addEventListener('click', function () {
      var built = global.OMSRiskSample.build();
      project = K.store.create('Customer Onboarding — Risk', built.data, true);
      project.owner = built.owner;
      K.store.save(project);
      enterViewer();
    });
    if (importBpBtn) importBpBtn.addEventListener('click', function () {
      var bp = BP && BP.store.mostRecent();
      if (!bp) { global.alert('No Blueprint exists yet. Create one first from the Blueprint page.'); return; }
      var data = K.blankData();
      data.relatedBlueprintProjectId = bp.id;
      project = K.store.create(bp.name + ' — Risk', data, false);
      enterWizard();
    });
    if (exitBtn) exitBtn.addEventListener('click', backToLauncher);
    if (viewerExitBtn) viewerExitBtn.addEventListener('click', backToLauncher);
    if (viewerEditBtn) viewerEditBtn.addEventListener('click', function () { enterWizard(); });

    var params = new URLSearchParams(global.location.search);
    var requestedId = params.get('model');
    var existing = requestedId ? K.store.get(requestedId) : null;
    var fromVs = params.get('fromValueStream');
    var fromCap = params.get('fromCapacity');

    if (existing) { project = existing; enterViewer(); }
    else if (fromVs && VS && VS.store.get(fromVs)) {
      var vs = VS.store.get(fromVs);
      var vsData = K.blankData();
      vsData.systemType = 'Value Stream';
      vsData.relatedValueStreamId = vs.id;
      project = K.store.create(vs.name + ' — Risk', vsData, false);
      project.owner = vs.owner;
      K.store.save(project);
      enterWizard();
    }
    else if (fromCap && Cap && Cap.store.get(fromCap)) {
      var cap = Cap.store.get(fromCap);
      var capData = K.blankData();
      capData.systemType = 'Capability';
      capData.relatedCapacityModelId = cap.id;
      project = K.store.create(cap.name + ' — Risk', capData, false);
      project.owner = cap.owner;
      K.store.save(project);
      enterWizard();
    }
    else { backToLauncher(); }
  }

  global.OMSRiskPage = { init: init, get project() { return project; } };
})(window);
