/*
 * Operations Maturity System
 * KPI Architect — page controller.
 *
 * Drives pages/kpi-architect.html on top of js/kpi-core.js. Same
 * launcher/wizard/viewer shape as Value Streams and Capacity. The wizard
 * deliberately starts with the decision a measurement needs to support,
 * not with "what metric do you want" — that's what differentiates this
 * from a generic KPI tool.
 */
(function (global) {
  'use strict';

  var B = null;   // OMSBuilder (shared field widgets)
  var K = null;   // OMSKpi (data model + engine)
  var VS = null;  // OMSValueStream (import integration)
  var Cap = null; // OMSCapacity (import integration)
  var BP = null;  // OMSBlueprint (link picker)
  var els = {};
  var project = null;
  var viewerState = { tab: 'overview', qualityView: 'flags' };

  function byId(id) { return document.getElementById(id); }
  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var YES_NO = ['Yes', 'No'];

  function metricGrid(metrics) {
    return '<div class="metric-grid">' + metrics.map(function (m) {
      return '<div class="metric-card"><span class="metric-card__label">' + esc(m.label) + '</span>' +
        '<span class="metric-card__value metric-card__value--accent">' + m.value + '</span>' +
        (m.note ? '<span class="metric-card__note">' + esc(m.note) + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  }

  /* ----------------------------------------------------------
     Wizard — Step 1: Start With The System
     ---------------------------------------------------------- */

  function valueStreamOptions() { return VS ? VS.store.list().map(function (v) { return { value: v.id, label: v.name }; }) : []; }
  function capacityOptions() { return Cap ? Cap.store.list().map(function (m) { return { value: m.id, label: m.name }; }) : []; }

  function stepSystem(container, proj, ctrl) {
    container.innerHTML =
      '<h3>What are you measuring?</h3>' +
      '<p class="lede">Start from what this measurement system is actually for, not from a list of metrics.</p>' +
      '<div class="builder-scope-grid" id="scope-grid" style="margin:var(--space-5) 0"></div>' +
      '<div class="builder-field-grid" id="system-fields"></div>';

    var grid = container.querySelector('#scope-grid');
    grid.innerHTML = K.SCOPE_TYPES.map(function (t) {
      return '<button type="button" class="builder-scope-tile' + (proj.data.scopeType === t ? ' is-selected' : '') + '" data-scope="' + t + '">' + t + '</button>';
    }).join('');
    grid.querySelectorAll('[data-scope]').forEach(function (btn) {
      btn.addEventListener('click', function () { proj.data.scopeType = btn.getAttribute('data-scope'); ctrl.persist(); stepSystem(container, proj, ctrl); });
    });

    var mount = container.querySelector('#system-fields');
    var fields = [
      { key: 'name', label: 'Model name', wide: true, placeholder: 'e.g. Customer Onboarding Measures' },
      { key: 'owner', label: 'Owner' }
    ];
    mount.innerHTML = fields.map(function (f) {
      return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, proj[f.key], 'kpi-' + f.key) + '</div>';
    }).join('');
    B.bindFieldEvents(mount, proj, fields, ctrl.persist);

    var relMount = document.createElement('div');
    relMount.className = 'builder-field-grid';
    relMount.style.marginTop = 'var(--space-4)';
    container.appendChild(relMount);
    relMount.innerHTML =
      '<div class="builder-field">' + B.fieldHtml({ key: 'relatedValueStreamId', label: 'Related Value Stream (optional)', type: 'select', options: valueStreamOptions() }, proj.data.relatedValueStreamId, 'kpi-vs') + '</div>' +
      '<div class="builder-field">' + B.fieldHtml({ key: 'relatedCapacityModelId', label: 'Related Capacity Model (optional)', type: 'select', options: capacityOptions() }, proj.data.relatedCapacityModelId, 'kpi-cap') + '</div>';
    B.bindFieldEvents(relMount, proj.data, [{ key: 'relatedValueStreamId', type: 'select' }, { key: 'relatedCapacityModelId', type: 'select' }], ctrl.persist);

    renderBlueprintLinkPicker(container, proj, ctrl);
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
          '<div class="builder-field">' + B.fieldHtml({ key: 'bp', label: 'Blueprint', type: 'select', options: bps.map(function (b) { return { value: b.id, label: b.name }; }) }, bpId, 'kpi-bp') + '</div>' +
          '<div class="builder-field">' + B.fieldHtml({ key: 'bptype', label: 'Object type', type: 'select', options: BP_LINK_TYPES.map(function (t) { return { value: t, label: BP.ENTITY_META[t].plural }; }) }, type, 'kpi-bptype') + '</div>' +
          '<div class="builder-field">' + B.fieldHtml({ key: 'bpobj', label: 'Object', type: 'select', options: objects.map(function (o) { return { value: o.id, label: BP.entityName(type, o) }; }) }, proj.data.relatedBlueprintId, 'kpi-bpobj') + '</div>' +
        '</div>';
      bpMount.querySelector('#kpi-bp').addEventListener('change', function (e) { proj.data.relatedBlueprintProjectId = e.target.value; proj.data.relatedBlueprintId = ''; ctrl.persist(); render(); });
      bpMount.querySelector('#kpi-bptype').addEventListener('change', function (e) { proj.data.relatedBlueprintType = e.target.value; proj.data.relatedBlueprintId = ''; ctrl.persist(); render(); });
      bpMount.querySelector('#kpi-bpobj').addEventListener('change', function (e) { proj.data.relatedBlueprintId = e.target.value; ctrl.persist(); });
    }
    render();
  }

  /* ----------------------------------------------------------
     Wizard — Step 2: KPIs (Sections 4-6, 11, 13, 27, 28)
     ---------------------------------------------------------- */

  function kpiFields() {
    return [
      { key: 'name', label: 'KPI name', wide: true },
      { key: 'decision', label: 'What decision does this measurement need to support?', wide: true },
      { key: 'decisionOwner', label: 'Decision owner' },
      { key: 'decisionFrequency', label: 'Decision frequency', type: 'select', options: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Ad hoc', 'Event-driven'] },
      { key: 'consequenceLateWrong', label: 'What happens if the decision is late or wrong?', type: 'textarea', wide: true },
      { key: 'purpose', label: 'Purpose / what signal would help make this decision?', type: 'textarea', wide: true },
      { key: 'kpiType', label: 'KPI type', type: 'select', options: K.KPI_TYPES },
      { key: 'leadingLagging', label: 'Leading or lagging?', type: 'select', options: ['Leading', 'Lagging'] },
      { key: 'owner', label: 'Metric owner' },
      { key: 'dataOwner', label: 'Data owner' },
      { key: 'decisionEnabled', label: 'Decision this metric enables', wide: true },
      { key: 'formula', label: 'Formula / definition', wide: true },
      { key: 'dataSource', label: 'Data source' },
      { key: 'unit', label: 'Unit' },
      { key: 'frequency', label: 'Measurement frequency', type: 'select', options: ['Daily', 'Weekly', 'Monthly', 'Quarterly'] },
      { key: 'direction', label: 'Direction', type: 'select', options: K.DIRECTIONS },
      { key: 'target', label: 'Target' },
      { key: 'warningThreshold', label: 'Warning threshold' },
      { key: 'criticalThreshold', label: 'Critical threshold' },
      { key: 'thresholdSource', label: 'Where did this threshold come from?', type: 'select', options: K.THRESHOLD_SOURCES },
      { key: 'reportingLocation', label: 'Reporting location' },
      { key: 'reviewRhythm', label: 'Review rhythm', type: 'select', options: K.REVIEW_RHYTHMS },
      { key: 'actionOffTarget', label: 'Action when off target', wide: true },
      { key: 'dataConfidence', label: 'Data confidence', type: 'select', options: K.DATA_CONFIDENCE },
      { key: 'knownQualityIssue', label: 'Known data quality issue', wide: true },
      { key: 'gamingRisk', label: 'How could this metric be gamed?', wide: true },
      { key: 'activityOrValue', label: 'Does this measure activity or value?', type: 'select', options: ['Activity', 'Value'] },
      { key: 'hasOutcomeConnection', label: 'Linked to an outcome via the Metric Chain?', type: 'select', options: YES_NO },
      { key: 'reviewedButNoDecision', label: 'Reviewed regularly but no decision made from it?', type: 'select', options: YES_NO }
    ];
  }

  function stepKpis(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Define Each KPI</h3>' +
      '<p class="lede">A metric without an owner, definition, source, threshold, or decision is not operationally mature. Fill in what you actually know — gaps are useful signal too.</p>' +
      '<div id="kpis-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#kpis-mount'), project: proj, dataKey: 'kpis',
      addLabel: 'Add KPI', itemLabel: function (item) { return item.name || 'Untitled KPI'; },
      defaults: function () { return { leadingLagging: 'Lagging', activityOrValue: 'Value', reviewedButNoDecision: 'No' }; },
      onChange: ctrl.persist,
      fields: kpiFields()
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 3: Metric Chain + Outcome/Driver/Signal
     ---------------------------------------------------------- */

  var RELATIONS = ['Leads To', 'Influences', 'Measures', 'Warns About', 'Supports Decision'];

  function stepChains(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Metric Chain</h3><p class="lede">Show how metrics relate — not every metric needs a chain, but the ones that matter usually do.</p><div id="chain-mount"></div>' +
      '<h3 style="margin-top:var(--space-7)">Outcome &rarr; Driver &rarr; Signal</h3><p class="lede">See the difference between a business outcome and the operating signal that predicts it.</p><div id="odc-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#chain-mount'), project: proj, dataKey: 'chainLinks',
      addLabel: 'Add Relationship', itemLabel: function (item) { return (item.from || '?') + ' → ' + (item.to || '?'); }, onChange: ctrl.persist,
      fields: [
        { key: 'from', label: 'From metric', wide: true },
        { key: 'to', label: 'To metric', wide: true },
        { key: 'relation', label: 'Relationship', type: 'select', options: RELATIONS }
      ]
    });
    B.repeatableList({
      mount: container.querySelector('#odc-mount'), project: proj, dataKey: 'outcomeDriverChains',
      addLabel: 'Add Outcome Chain', itemLabel: function (item) { return item.outcome || 'Outcome chain'; }, onChange: ctrl.persist,
      fields: [
        { key: 'outcome', label: 'Outcome', wide: true },
        { key: 'driver', label: 'Driver', wide: true },
        { key: 'operatingSignal', label: 'Operating signal', wide: true },
        { key: 'earlyWarning', label: 'Early warning', wide: true }
      ]
    });
  }

  var WIZARD_STEPS = [
    { id: 'system', label: 'The System', render: stepSystem },
    { id: 'kpis', label: 'KPIs', render: stepKpis },
    { id: 'chains', label: 'Chains', render: stepChains }
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
      ' this is the Northstar Software Customer Onboarding measurement sample, used to show what a decision-first metric chain looks like. It does not represent your organization.'
    );
    global.OMSData.bindSampleBanner(els.sampleBanner, {
      onExit: function () { backToLauncher(); },
      onClear: function () {
        if (!global.confirm('Delete the sample KPI Model? This cannot be undone.')) return;
        K.store.remove(project.id);
        project = null;
        backToLauncher();
      }
    });
  }

  var VIEWER_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'detail', label: 'KPI Detail' },
    { id: 'chains', label: 'Chains' },
    { id: 'quality', label: 'Quality & Load' },
    { id: 'target', label: 'Target State' },
    { id: 'summary', label: 'Summary' }
  ];

  function renderViewer() {
    els.viewerBody.innerHTML = '<div class="bp-toolbar"><div class="bp-tabs" id="kpi-tabs"></div></div><div id="kpi-tab-body"></div>';
    var tabsEl = els.viewerBody.querySelector('#kpi-tabs');
    tabsEl.innerHTML = VIEWER_TABS.map(function (t) { return '<button type="button" data-tab="' + t.id + '" class="' + (viewerState.tab === t.id ? 'is-active' : '') + '">' + t.label + '</button>'; }).join('');
    tabsEl.querySelectorAll('[data-tab]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.tab = btn.getAttribute('data-tab'); renderViewer(); }); });
    var body = els.viewerBody.querySelector('#kpi-tab-body');
    if (viewerState.tab === 'detail') renderDetailTab(body);
    else if (viewerState.tab === 'chains') renderChainsTab(body);
    else if (viewerState.tab === 'quality') renderQualityTab(body);
    else if (viewerState.tab === 'target') renderTargetTab(body);
    else if (viewerState.tab === 'summary') renderSummaryTab(body);
    else renderOverviewTab(body);
  }

  /* ----------------------------------------------------------
     Overview — scorecard-style list of all KPIs
     ---------------------------------------------------------- */

  function statusPillForKpi(kpi) {
    if (!kpi.target && !kpi.warningThreshold && !kpi.criticalThreshold) return '';
    return '<span class="badge badge--outline">' + esc(kpi.leadingLagging || '') + '</span>';
  }

  function renderOverviewTab(mount) {
    var kpis = project.data.kpis || [];
    var load = K.measurementLoad(project);
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">Measurement Load</span><h3>What this model is actually measuring</h3></div>' +
      metricGrid([
        { label: 'Total KPIs', value: load.total },
        { label: 'Linked To A Decision', value: load.withDecision },
        { label: 'No Decision Linked', value: load.withoutDecision },
        { label: 'Actively Reviewed', value: load.activelyReviewed }
      ]) +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">KPIs</span></div>' +
      (kpis.length ? kpis.map(function (k, i) {
        var flags = K.kpiFlags(k);
        return '<div class="trace-node" style="cursor:pointer" data-open-kpi="' + i + '"><span><strong>' + esc(k.name || 'Untitled') + '</strong> ' + statusPillForKpi(k) + (flags.length ? ' <span class="badge badge--outline" style="border-color:var(--color-caution);color:var(--color-caution)">' + flags.length + ' quality flag' + (flags.length === 1 ? '' : 's') + '</span>' : '') + '</span><span class="trace-node__relation">View &rarr;</span></div>';
      }).join('') : '<p class="callout">No KPIs defined yet.</p>') +
      renderVanityChallenge();

    mount.querySelectorAll('[data-open-kpi]').forEach(function (n) {
      n.addEventListener('click', function () { viewerState.tab = 'detail'; viewerState.openKpiIndex = parseInt(n.getAttribute('data-open-kpi'), 10); renderViewer(); });
    });
  }

  function renderVanityChallenge() {
    return '<div class="constraint-panel" style="margin-top:var(--space-7)">' +
      '<span class="eyebrow">Does This Metric Actually Matter?</span>' +
      '<p class="text-muted" style="margin-top:var(--space-2)">One of the most useful questions to ask about any KPI before trusting it.</p>' +
      '<ul style="margin:var(--space-3) 0 0 1.2em">' + K.VANITY_QUESTIONS.map(function (q) { return '<li style="margin-bottom:var(--space-2)">' + esc(q) + '</li>'; }).join('') + '</ul>' +
    '</div>';
  }

  /* ----------------------------------------------------------
     KPI Detail — full definition + gaming + coverage per KPI
     ---------------------------------------------------------- */

  function renderDetailTab(mount) {
    var kpis = project.data.kpis || [];
    if (!kpis.length) { mount.innerHTML = '<p class="callout">No KPIs defined yet. Add them from the wizard.</p>'; return; }
    var openIndex = viewerState.openKpiIndex != null ? viewerState.openKpiIndex : 0;

    mount.innerHTML =
      '<div class="bp-tabs" id="kpi-picker" style="margin-bottom:var(--space-5);flex-wrap:wrap"></div><div id="kpi-detail-body"></div>';
    var picker = mount.querySelector('#kpi-picker');
    picker.innerHTML = kpis.map(function (k, i) { return '<button type="button" data-idx="' + i + '" class="' + (i === openIndex ? 'is-active' : '') + '">' + esc(k.name || 'Untitled') + '</button>'; }).join('');
    picker.querySelectorAll('[data-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () { viewerState.openKpiIndex = parseInt(btn.getAttribute('data-idx'), 10); renderDetailTab(mount); });
    });

    var kpi = kpis[openIndex];
    var flags = K.kpiFlags(kpi);
    mount.querySelector('#kpi-detail-body').innerHTML =
      '<div class="card">' +
        '<div class="bp-chain-section__header"><h3 style="margin:0">' + esc(kpi.name || 'Untitled') + '</h3>' +
          '<span class="badge badge--outline">' + esc(kpi.kpiType || '') + '</span><span class="badge badge--outline">' + esc(kpi.leadingLagging || '') + '</span>' +
        '</div>' +
        '<p class="text-muted">' + esc(kpi.purpose || 'No purpose recorded.') + '</p>' +
        '<dl class="dva-row">' +
          '<div class="dva-row__col"><h5>Decision</h5><p style="font-size:var(--step--1)"><strong>Decision:</strong> ' + esc(kpi.decision || '—') + '<br><strong>Owner:</strong> ' + esc(kpi.decisionOwner || '—') + '<br><strong>Frequency:</strong> ' + esc(kpi.decisionFrequency || '—') + '<br><strong>If late/wrong:</strong> ' + esc(kpi.consequenceLateWrong || '—') + '</p></div>' +
          '<div class="dva-row__col"><h5>Definition</h5><p style="font-size:var(--step--1)"><strong>Formula:</strong> ' + esc(kpi.formula || '—') + '<br><strong>Source:</strong> ' + esc(kpi.dataSource || '—') + '<br><strong>Owner:</strong> ' + esc(kpi.owner || '—') + '<br><strong>Data owner:</strong> ' + esc(kpi.dataOwner || '—') + '</p></div>' +
        '</dl>' +
        '<dl class="dva-row" style="margin-top:var(--space-3)">' +
          '<div class="dva-row__col"><h5>Thresholds</h5><p style="font-size:var(--step--1)"><strong>Target:</strong> ' + esc(kpi.target || '—') + ' (' + esc(kpi.direction || 'direction not set') + ')<br><strong>Warning:</strong> ' + esc(kpi.warningThreshold || '—') + '<br><strong>Critical:</strong> ' + esc(kpi.criticalThreshold || '—') + '<br><strong>Threshold source:</strong> ' + esc(kpi.thresholdSource || '—') + '</p></div>' +
          '<div class="dva-row__col"><h5>Review &amp; Action</h5><p style="font-size:var(--step--1)"><strong>Rhythm:</strong> ' + esc(kpi.reviewRhythm || '—') + '<br><strong>Reported at:</strong> ' + esc(kpi.reportingLocation || '—') + '<br><strong>Action off target:</strong> ' + esc(kpi.actionOffTarget || '—') + '</p></div>' +
        '</dl>' +
        '<div class="build-project-row__meta" style="margin-top:var(--space-4)">' +
          '<span class="badge badge--outline">Data confidence: ' + esc(kpi.dataConfidence || 'Unknown') + '</span>' +
          '<span class="badge badge--outline">' + esc(kpi.activityOrValue || '') + ' measure</span>' +
        '</div>' +
        (kpi.gamingRisk ? '<div class="risk-flag risk-flag--warning" style="margin-top:var(--space-4)"><div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--warning">Metric Distortion Risk</span></div><p class="risk-flag__message">' + esc(kpi.gamingRisk) + '</p></div>' : '') +
        (flags.length ? '<span class="eyebrow" style="margin-top:var(--space-5);display:block">Quality Flags</span><ul style="margin:var(--space-2) 0 0 1.2em;font-size:var(--step--1)">' + flags.map(function (f) { return '<li><strong>' + esc(f.rule) + ':</strong> ' + esc(f.message) + '</li>'; }).join('') + '</ul>' : '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-4)">No quality flags for this KPI.</p>') +
        '<div class="inspector-panel__actions" style="margin-top:var(--space-4)">' +
          (kpi.relatedProcessId ? '<a class="btn btn--secondary" href="' + processArchitectHref(kpi.relatedProcessId) + '">Open Process &rarr;</a>' : '<button type="button" class="btn btn--ghost" data-create-process="' + openIndex + '">Create Process</button>') +
          '<button type="button" class="btn btn--ghost" data-save-finding="' + openIndex + '">Save To Workbench</button>' +
        '</div>' +
      '</div>';

    var createBtn = mount.querySelector('[data-create-process]');
    if (createBtn) createBtn.addEventListener('click', function () {
      if (!global.OMSBuilder) return;
      var proc = global.OMSBuilder.store.create('process', kpi.name, {}, false);
      kpi.relatedProcessId = proc.id;
      K.store.save(project);
      renderDetailTab(mount);
    });
    var saveBtn = mount.querySelector('[data-save-finding]');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      project.data.findings.push({ id: K.newId('find'), type: 'KPI: ' + kpi.name, message: flags.length ? flags.map(function (f) { return f.rule; }).join('; ') : 'Flagged for visibility.', why: 'From KPI Architect model "' + project.name + '".', savedAt: new Date().toISOString() });
      K.logActivity(project, 'Saved finding to Workbench: ' + kpi.name);
      K.store.save(project);
      saveBtn.textContent = 'Saved ✓';
      saveBtn.disabled = true;
    });
  }

  function processArchitectHref(projectId) {
    var base = global.OMSData ? global.OMSData.href('pages/process-architect.html') : 'process-architect.html';
    return base + '?project=' + encodeURIComponent(projectId);
  }

  /* ----------------------------------------------------------
     Chains — Metric Chain + Outcome/Driver/Signal, rendered
     ---------------------------------------------------------- */

  function renderChainsTab(mount) {
    var links = project.data.chainLinks || [];
    var odc = project.data.outcomeDriverChains || [];
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">Metric Chain</span></div>' +
      (links.length ? links.map(function (l) {
        return '<div class="trace-chain" style="margin-bottom:var(--space-5)">' +
          '<div class="trace-chain__node">' + esc(l.from) + '</div>' +
          '<span class="trace-chain__arrow">↓ ' + esc(l.relation) + '</span>' +
          '<div class="trace-chain__node">' + esc(l.to) + '</div>' +
        '</div>';
      }).join('') : '<p class="callout">No metric relationships mapped yet.</p>') +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Outcome &rarr; Driver &rarr; Signal</span></div>' +
      (odc.length ? odc.map(function (c) {
        return '<div class="trace-chain" style="margin-bottom:var(--space-5)">' +
          '<div class="trace-chain__node">Outcome<div style="font-size:var(--step--1);margin-top:4px">' + esc(c.outcome) + '</div></div>' +
          '<span class="trace-chain__arrow">↓</span>' +
          '<div class="trace-chain__node">Driver<div style="font-size:var(--step--1);margin-top:4px">' + esc(c.driver) + '</div></div>' +
          '<span class="trace-chain__arrow">↓</span>' +
          '<div class="trace-chain__node">Operating Signal<div style="font-size:var(--step--1);margin-top:4px">' + esc(c.operatingSignal) + '</div></div>' +
          '<span class="trace-chain__arrow">↓</span>' +
          '<div class="trace-chain__node">Early Warning<div style="font-size:var(--step--1);margin-top:4px">' + esc(c.earlyWarning) + '</div></div>' +
        '</div>';
      }).join('') : '<p class="callout">No outcome chains mapped yet.</p>');
  }

  /* ----------------------------------------------------------
     Quality & Load — Sections 10, 30, 31, 33, 46
     ---------------------------------------------------------- */

  function renderQualityTab(mount) {
    var views = [{ id: 'flags', label: 'Findings' }, { id: 'load', label: 'Measurement Load' }, { id: 'maturity', label: 'Maturity Snapshot' }];
    mount.innerHTML = '<div class="bp-tabs" id="q-subtabs" style="margin-bottom:var(--space-5)"></div><div id="q-subbody"></div>';
    var tabs = mount.querySelector('#q-subtabs');
    tabs.innerHTML = views.map(function (v) { return '<button type="button" data-view="' + v.id + '" class="' + (viewerState.qualityView === v.id ? 'is-active' : '') + '">' + v.label + '</button>'; }).join('');
    tabs.querySelectorAll('[data-view]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.qualityView = btn.getAttribute('data-view'); renderQualityTab(mount); }); });
    var body = mount.querySelector('#q-subbody');
    if (viewerState.qualityView === 'load') renderLoadView(body);
    else if (viewerState.qualityView === 'maturity') renderMaturityView(body);
    else renderFlagsView(body);
  }

  function renderFlagsView(mount) {
    var flags = K.modelFindings(project);
    if (!flags.length) { mount.innerHTML = '<p class="callout">No model-level findings from the rules below. Individual KPIs may still have their own quality flags — see KPI Detail.</p>'; return; }
    mount.innerHTML = flags.map(function (f) {
      return '<div class="risk-flag risk-flag--' + f.severity + '" style="margin-bottom:var(--space-3)">' +
        '<div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--' + f.severity + '">' + esc(f.rule) + '</span></div>' +
        '<p class="risk-flag__message">' + esc(f.message) + '</p>' +
        '<p class="risk-flag__why text-dim">Rule: ' + esc(f.why) + '</p>' +
        (f.rule === 'KPI Explosion' ? '<p class="text-dim" style="font-size:var(--step--1)"><a href="' + antiPatternHref('dashboard-theater') + '">Related anti-pattern: Dashboard Theater</a></p>' : '') +
      '</div>';
    }).join('');
  }

  function antiPatternHref(id) { return global.OMSLinks ? global.OMSLinks.resolve({ type: 'antipattern', id: id }) : '#'; }

  function renderLoadView(mount) {
    var load = K.measurementLoad(project);
    var owners = Object.keys(load.byOwner);
    mount.innerHTML =
      metricGrid([
        { label: 'Total KPIs', value: load.total }, { label: 'With Decision', value: load.withDecision },
        { label: 'Without Decision', value: load.withoutDecision }, { label: 'Actively Reviewed', value: load.activelyReviewed }
      ]) +
      '<div class="section-head" style="margin-top:var(--space-6)"><span class="eyebrow">KPIs Per Owner</span></div>' +
      '<div class="card">' + owners.map(function (o) { return '<div class="vs-timeline-row" style="grid-template-columns:1fr auto"><span class="vs-timeline-row__label">' + esc(o) + '</span><span class="vs-timeline-row__meta">' + load.byOwner[o] + '</span></div>'; }).join('') + '</div>' +
      '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-4)">Seeing a number is not the same as managing the system. <a href="' + antiPatternHref('dashboard-theater') + '">Related: Dashboard Theater</a></p>';
  }

  function renderMaturityView(mount) {
    var snap = K.maturitySnapshot(project);
    if (!snap) { mount.innerHTML = '<p class="callout">No KPIs defined yet.</p>'; return; }
    mount.innerHTML =
      '<p class="lede">Measurement System Maturity Snapshot — a prototype review of this KPI model, not the full organizational maturity assessment.</p>' +
      metricGrid([
        { label: 'Definition', value: snap.definition + '%' }, { label: 'Ownership', value: snap.ownership + '%' },
        { label: 'Data', value: snap.data + '%' }, { label: 'Thresholds', value: snap.thresholds + '%' },
        { label: 'Decision Linkage', value: snap.decisionLinkage + '%' }, { label: 'Review Cadence', value: snap.reviewCadence + '%' },
        { label: 'Leading Indicators', value: snap.leadingIndicators + '%' }, { label: 'Actionability', value: snap.actionability + '%' }
      ]);
  }

  /* ----------------------------------------------------------
     Target State — Section 47
     ---------------------------------------------------------- */

  function renderTargetTab(mount) {
    if (!project.data.hasTargetState) {
      mount.innerHTML = '<p class="callout">Design a target measurement system once you understand the current one. This never overwrites the current KPI definitions.</p><button type="button" class="btn btn--primary" id="start-target-btn">Design Target Measurement System</button>';
      mount.querySelector('#start-target-btn').addEventListener('click', function () {
        project.data.targetState = { kpiCount: '', balancedNote: '', decisionLinkedNote: '', ownerNote: '' };
        project.data.hasTargetState = true;
        K.store.save(project);
        renderTargetTab(mount);
      });
      return;
    }
    var load = K.measurementLoad(project);
    mount.innerHTML =
      '<dl class="dva-row">' +
        '<div class="dva-row__col"><h5>Current Measurement System</h5>' + metricGrid([
          { label: 'KPIs', value: load.total }, { label: 'Lagging', value: (project.data.kpis || []).filter(function (k) { return k.leadingLagging === 'Lagging'; }).length },
          { label: 'Without Decision', value: load.withoutDecision }
        ]) + '</div>' +
        '<div class="dva-row__col"><h5>Target Measurement System</h5><div id="target-edit-mount"></div></div>' +
      '</dl>';
    var wrapper = { data: project.data.targetState };
    B.objectForm({
      mount: mount.querySelector('#target-edit-mount'), project: { data: { target: wrapper.data } }, dataKey: 'target', onChange: function () { K.store.save(project); },
      fields: [
        { key: 'kpiCount', label: 'Target KPI count' },
        { key: 'balancedNote', label: 'Balanced leading/lagging note', wide: true },
        { key: 'decisionLinkedNote', label: 'Decision linkage target', wide: true },
        { key: 'ownerNote', label: 'Ownership target', wide: true }
      ]
    });
  }

  /* ----------------------------------------------------------
     Summary — Section 48
     ---------------------------------------------------------- */

  function renderSummaryTab(mount) {
    var load = K.measurementLoad(project);
    var flags = K.modelFindings(project);
    mount.innerHTML =
      '<div class="card">' +
        '<span class="eyebrow">KPI Model Summary</span>' +
        '<h2 style="margin:var(--space-2) 0">' + esc(project.name) + '</h2>' +
        '<p><strong>Scope:</strong> ' + esc(project.data.scopeType || '—') + ' &nbsp; <strong>Owner:</strong> ' + esc(project.owner || 'No owner named') + '</p>' +
        metricGrid([{ label: 'Total KPIs', value: load.total }, { label: 'With Decision', value: load.withDecision }, { label: 'Actively Reviewed', value: load.activelyReviewed }]) +
        '<span class="eyebrow" style="margin-top:var(--space-5);display:block">Model Findings</span>' +
        (flags.length ? '<ul style="margin:var(--space-2) 0 0 1.2em">' + flags.map(function (f) { return '<li>' + esc(f.rule) + '</li>'; }).join('') + '</ul>' : '<p class="text-dim">None flagged.</p>') +
      '</div>' +
      '<div class="hero__actions" style="margin-top:var(--space-5)"><button type="button" class="btn btn--secondary" id="kpi-export-btn">Export JSON</button><button type="button" class="btn btn--secondary" id="kpi-print-btn">Print / Save As PDF</button></div>';
    mount.querySelector('#kpi-export-btn').addEventListener('click', function () { B.exportJson(project); });
    mount.querySelector('#kpi-print-btn').addEventListener('click', function () { global.print(); });
  }

  /* ----------------------------------------------------------
     Launcher
     ---------------------------------------------------------- */

  function renderResumeList() {
    var list = K.store.list().slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
    if (!els.resumeList) return;
    if (!list.length) { els.resumeList.innerHTML = ''; return; }
    els.resumeList.innerHTML = '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">My KPI Models</span></div>' +
      list.map(function (m) {
        var load = K.measurementLoad(m);
        return '<div class="build-project-row" data-id="' + m.id + '">' +
          '<div class="build-project-row__meta">' +
            (m.isSample ? '<span class="badge badge--accent">Sample</span>' : '') +
            '<strong>' + esc(m.name) + '</strong>' +
            '<span class="text-dim text-mono" style="font-size:var(--step--1)">' + load.total + ' KPIs &middot; Updated ' + B.formatDate(m.updatedAt) + '</span>' +
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
      b.addEventListener('click', function () { if (global.confirm('Delete this KPI Model? This cannot be undone.')) { K.store.remove(b.getAttribute('data-delete')); renderResumeList(); } });
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
    K = global.OMSKpi;
    VS = global.OMSValueStream;
    Cap = global.OMSCapacity;
    BP = global.OMSBlueprint;

    els.launcher = byId('kpi-launcher');
    els.wizard = byId('kpi-wizard');
    els.viewer = byId('kpi-viewer');
    els.viewerBody = byId('kpi-viewer-body');
    els.viewerSection = byId('kpi-viewer-section');
    els.sampleBanner = byId('kpi-sample-banner');
    els.resumeList = byId('kpi-resume-list');
    els.progress = byId('builder-progress');
    els.stepBody = byId('builder-step-body');
    els.prev = byId('builder-prev');
    els.next = byId('builder-next');
    els.stepLabel = byId('builder-step-label');
    els.projectName = byId('builder-project-name');

    var newBtn = byId('new-kpi-btn');
    var sampleBtn = byId('load-sample-kpi-btn');
    var exitBtn = byId('builder-exit');
    var viewerExitBtn = byId('viewer-exit');
    var viewerEditBtn = byId('viewer-edit');

    if (newBtn) newBtn.addEventListener('click', function () {
      var name = global.prompt('Name this KPI Model:', 'New KPI Model');
      if (name === null) return;
      project = K.store.create(name || 'New KPI Model', K.blankData(), false);
      enterWizard();
    });
    if (sampleBtn) sampleBtn.addEventListener('click', function () {
      var built = global.OMSKpiSample.build();
      project = K.store.create('Customer Onboarding Measures — Sample', built.data, true);
      project.owner = built.owner;
      K.store.save(project);
      enterViewer();
    });
    if (exitBtn) exitBtn.addEventListener('click', backToLauncher);
    if (viewerExitBtn) viewerExitBtn.addEventListener('click', backToLauncher);
    if (viewerEditBtn) viewerEditBtn.addEventListener('click', function () { enterWizard(); });

    var params = new URLSearchParams(global.location.search);
    var requestedId = params.get('model');
    var existing = requestedId ? K.store.get(requestedId) : null;

    if (existing) { project = existing; enterViewer(); }
    else { backToLauncher(); }
  }

  global.OMSKpiPage = { init: init, get project() { return project; } };
})(window);
