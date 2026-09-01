/*
 * Operations Maturity System
 * Operational Health — page controller.
 *
 * Drives pages/operational-health.html on top of js/health-core.js. Same
 * launcher/wizard/viewer shape as the other flagship tools. Health is not
 * maturity and not performance — the whole page is built around keeping
 * those three separate: what is functioning right now, what results came
 * out, and how developed the system is are three different questions.
 */
(function (global) {
  'use strict';

  var B = null;   // OMSBuilder (shared field widgets)
  var H = null;   // OMSHealth (data model + engine)
  var VS = null;  // OMSValueStream (import integration)
  var Cap = null; // OMSCapacity (import integration)
  var BP = null;  // OMSBlueprint (link picker)
  var Rhy = null; // OMSRhythm (reviewed-in lookup)
  var els = {};
  var project = null;
  var viewerState = { tab: 'overview', openDimIndex: 0, exceptionOnly: false };
  var importState = { open: null }; // 'valuestream' | 'capacity' | null

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
     Wizard — Step 1: The System
     ---------------------------------------------------------- */

  function valueStreamOptions() { return VS ? VS.store.list().map(function (v) { return { value: v.id, label: v.name }; }) : []; }
  function capacityOptions() { return Cap ? Cap.store.list().map(function (m) { return { value: m.id, label: m.name }; }) : []; }

  function stepSystem(container, proj, ctrl) {
    container.innerHTML =
      '<h3>What system are you checking the health of?</h3>' +
      '<p class="lede">Health is not maturity and not performance. It is whether this system is functioning as intended right now.</p>' +
      '<div class="builder-scope-grid" id="scope-grid" style="margin:var(--space-5) 0"></div>' +
      '<div class="builder-field-grid" id="system-fields"></div>';

    var grid = container.querySelector('#scope-grid');
    grid.innerHTML = H.SCOPE_TYPES.map(function (t) {
      return '<button type="button" class="builder-scope-tile' + (proj.data.scopeType === t ? ' is-selected' : '') + '" data-scope="' + t + '">' + t + '</button>';
    }).join('');
    grid.querySelectorAll('[data-scope]').forEach(function (btn) {
      btn.addEventListener('click', function () { proj.data.scopeType = btn.getAttribute('data-scope'); ctrl.persist(); stepSystem(container, proj, ctrl); });
    });

    var mount = container.querySelector('#system-fields');
    var fields = [
      { key: 'name', label: 'Model name', wide: true, placeholder: 'e.g. Customer Onboarding Health' },
      { key: 'owner', label: 'Owner' }
    ];
    mount.innerHTML = fields.map(function (f) {
      return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, proj[f.key], 'health-' + f.key) + '</div>';
    }).join('');
    B.bindFieldEvents(mount, proj, fields, ctrl.persist);

    var relMount = document.createElement('div');
    relMount.className = 'builder-field-grid';
    relMount.style.marginTop = 'var(--space-4)';
    container.appendChild(relMount);
    var dataFields = [
      { key: 'businessOutcome', label: 'What business outcome does this system ultimately affect?', wide: true },
      { key: 'performanceStatus', label: 'Is this outcome currently on target?', type: 'select', options: H.PERFORMANCE_STATUSES },
      { key: 'relatedValueStreamId', label: 'Related Value Stream (optional)', type: 'select', options: valueStreamOptions() },
      { key: 'relatedCapacityModelId', label: 'Related Capacity Model (optional)', type: 'select', options: capacityOptions() }
    ];
    relMount.innerHTML = dataFields.map(function (f) {
      return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, proj.data[f.key], 'health-data-' + f.key) + '</div>';
    }).join('');
    B.bindFieldEvents(relMount, proj.data, dataFields, ctrl.persist);

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
          '<div class="builder-field">' + B.fieldHtml({ key: 'bp', label: 'Blueprint', type: 'select', options: bps.map(function (b) { return { value: b.id, label: b.name }; }) }, bpId, 'health-bp') + '</div>' +
          '<div class="builder-field">' + B.fieldHtml({ key: 'bptype', label: 'Object type', type: 'select', options: BP_LINK_TYPES.map(function (t) { return { value: t, label: BP.ENTITY_META[t].plural }; }) }, type, 'health-bptype') + '</div>' +
          '<div class="builder-field">' + B.fieldHtml({ key: 'bpobj', label: 'Object', type: 'select', options: objects.map(function (o) { return { value: o.id, label: BP.entityName(type, o) }; }) }, proj.data.relatedBlueprintId, 'health-bpobj') + '</div>' +
        '</div>';
      bpMount.querySelector('#health-bp').addEventListener('change', function (e) { proj.data.relatedBlueprintProjectId = e.target.value; proj.data.relatedBlueprintId = ''; ctrl.persist(); render(); });
      bpMount.querySelector('#health-bptype').addEventListener('change', function (e) { proj.data.relatedBlueprintType = e.target.value; proj.data.relatedBlueprintId = ''; ctrl.persist(); render(); });
      bpMount.querySelector('#health-bpobj').addEventListener('change', function (e) { proj.data.relatedBlueprintId = e.target.value; ctrl.persist(); });
    }
    render();
  }

  /* ----------------------------------------------------------
     Wizard — Step 2: Health Dimensions
     ---------------------------------------------------------- */

  function dimensionFields() {
    return [
      { key: 'name', label: 'Dimension name', wide: true, placeholder: 'e.g. Onboarding Flow' },
      { key: 'category', label: 'Dimension type', type: 'select', options: H.HEALTH_DIMENSIONS },
      { key: 'whatHealthyLooksLike', label: 'What does healthy look like?', type: 'textarea', wide: true },
      { key: 'signal', label: 'What signal represents it?', wide: true },
      { key: 'deteriorationLooksLike', label: 'What would deterioration look like?', type: 'textarea', wide: true },
      { key: 'earlyWarning', label: 'What is the early warning?', type: 'textarea', wide: true },
      { key: 'whenToAct', label: 'When should someone act?', wide: true },
      { key: 'whoActs', label: 'Who acts?' },
      { key: 'statusMode', label: 'How is status determined?', type: 'select', options: H.STATUS_MODES },
      { key: 'direction', label: 'Direction', type: 'select', options: H.DIRECTIONS },
      { key: 'currentValue', label: 'Current value' },
      { key: 'targetValue', label: 'Target' },
      { key: 'watchThreshold', label: 'Watch threshold' },
      { key: 'criticalThreshold', label: 'Critical threshold' },
      { key: 'thresholdSource', label: H.THRESHOLD_CHALLENGE_QUESTION, type: 'select', options: H.THRESHOLD_SOURCES },
      { key: 'manualStatus', label: 'Manual status (used only if status mode is Judgment)', type: 'select', options: H.STATUS_VALUES },
      { key: 'whyStatusNote', label: 'Why this status? (used only if status mode is Judgment)', type: 'textarea', wide: true },
      { key: 'reviewRhythm', label: 'Review rhythm', type: 'select', options: H.REVIEW_RHYTHMS },
      { key: 'reportingLocation', label: 'Reporting location' },
      { key: 'decisionOnOffTrack', label: 'What decision happens when this goes off track?', wide: true }
    ];
  }

  function stepDimensions(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Define Each Health Dimension</h3>' +
      '<p class="lede">A metric without an owner, threshold, or decision is not operationally mature. Fill in what you actually know.</p>' +
      '<div id="dims-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#dims-mount'), project: proj, dataKey: 'dimensions',
      addLabel: 'Add Health Dimension', itemLabel: function (item) { return item.name || 'Untitled dimension'; },
      defaults: function () { return { statusMode: 'Threshold', direction: 'Lower Is Better', timeSeries: [] }; },
      onChange: ctrl.persist,
      fields: dimensionFields()
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 3: Signal Cascade
     ---------------------------------------------------------- */

  function stepSignals(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Signal Cascade</h3>' +
      '<p class="lede">Show how an early signal moves through the system before it becomes a business outcome. Example: Handoff Defects rising &rarr; Rework rising &rarr; Onboarding Time rising &rarr; Retention Risk rising.</p>' +
      '<div id="cascade-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#cascade-mount'), project: proj, dataKey: 'signalCascades',
      addLabel: 'Add Signal Cascade', itemLabel: function (item) { return item.earlySignal || 'Signal cascade'; }, onChange: ctrl.persist,
      fields: [
        { key: 'earlySignal', label: 'Early signal', wide: true },
        { key: 'operatingCondition', label: 'Operating condition', wide: true },
        { key: 'performanceImpact', label: 'Performance impact', wide: true },
        { key: 'businessOutcome', label: 'Business outcome', wide: true }
      ]
    });
  }

  var WIZARD_STEPS = [
    { id: 'system', label: 'The System', render: stepSystem },
    { id: 'dimensions', label: 'Health Dimensions', render: stepDimensions },
    { id: 'signals', label: 'Signal Cascade', render: stepSignals }
  ];

  function enterWizard() {
    els.launcher.hidden = true;
    els.viewer.hidden = true;
    if (els.viewerSection) els.viewerSection.hidden = true;
    els.wizard.hidden = false;
    els.projectName.textContent = project.name;
    B.initWizard({ project: project, steps: WIZARD_STEPS, store: H.store, els: { progress: els.progress, body: els.stepBody, prev: els.prev, next: els.next, stepLabel: els.stepLabel } });
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
      ' this is the Northstar Software Customer Onboarding Health sample. Time to Value is still on target, but the operating system underneath it is already deteriorating. It does not represent your organization.'
    );
    global.OMSData.bindSampleBanner(els.sampleBanner, {
      onExit: function () { backToLauncher(); },
      onClear: function () {
        if (!global.confirm('Delete the sample Health Model? This cannot be undone.')) return;
        H.store.remove(project.id);
        project = null;
        backToLauncher();
      }
    });
  }

  var VIEWER_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'dimensions', label: 'Dimensions' },
    { id: 'signals', label: 'Signal Cascade' },
    { id: 'coverage', label: 'Coverage' },
    { id: 'summary', label: 'Executive View' }
  ];

  function renderViewer() {
    els.viewerBody.innerHTML = '<div class="bp-toolbar"><div class="bp-tabs" id="health-tabs"></div></div><div id="health-tab-body"></div>';
    var tabsEl = els.viewerBody.querySelector('#health-tabs');
    tabsEl.innerHTML = VIEWER_TABS.map(function (t) { return '<button type="button" data-tab="' + t.id + '" class="' + (viewerState.tab === t.id ? 'is-active' : '') + '">' + t.label + '</button>'; }).join('');
    tabsEl.querySelectorAll('[data-tab]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.tab = btn.getAttribute('data-tab'); renderViewer(); }); });
    var body = els.viewerBody.querySelector('#health-tab-body');
    if (viewerState.tab === 'dimensions') renderDimensionsTab(body);
    else if (viewerState.tab === 'signals') renderSignalsTab(body);
    else if (viewerState.tab === 'coverage') renderCoverageTab(body);
    else if (viewerState.tab === 'summary') renderSummaryTab(body);
    else renderOverviewTab(body);
  }

  /* ----------------------------------------------------------
     Overview — overall health, quadrant, exception view
     ---------------------------------------------------------- */

  function renderOverviewTab(mount) {
    var dims = project.data.dimensions || [];
    var overall = H.overallHealth(project);
    var quad = H.quadrant(project.data.performanceStatus, overall.status);

    var shown = viewerState.exceptionOnly
      ? dims.filter(function (d) { var s = H.dimensionStatus(d).status; return s === 'Watch' || s === 'Weak' || s === 'Critical'; })
      : dims;

    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">Operational Health</span><h3>Is this system functioning as intended right now?</h3></div>' +
      '<div class="card" style="margin-bottom:var(--space-6)">' +
        '<div class="build-project-row__meta">' + healthBadge(overall.status) + '<strong>Overall Health</strong></div>' +
        '<p class="text-muted" style="margin-top:var(--space-2)">' + esc(overall.why) + '</p>' +
        '<div class="build-project-row__meta" style="margin-top:var(--space-3)">' +
          '<span class="badge badge--outline">Business outcome: ' + esc(project.data.businessOutcome || 'Not named') + '</span>' +
          '<span class="badge badge--outline">Performance: ' + esc(project.data.performanceStatus || 'Unknown') + '</span>' +
        '</div>' +
      '</div>' +
      (quad.label ? '<div class="constraint-panel" style="margin-bottom:var(--space-6)"><span class="eyebrow">Health vs. Performance</span><h4 style="margin:var(--space-2) 0">' + esc(quad.label) + '</h4><p class="text-muted">' + esc(quad.note) + '</p></div>'
        : '<p class="callout" style="margin-bottom:var(--space-6)">' + esc(quad.note) + '</p>') +
      '<div class="section-head" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-2)">' +
        '<span class="eyebrow">Health Dimensions</span>' +
        '<label class="builder-check"><input type="checkbox" id="exception-toggle"' + (viewerState.exceptionOnly ? ' checked' : '') + '> Show Only Watch / Weak / Critical</label>' +
      '</div>' +
      (shown.length ? shown.map(function (d) {
        var idx = dims.indexOf(d);
        var s = H.dimensionStatus(d);
        var t = H.trendForDimension(d);
        return '<div class="trace-node" style="cursor:pointer" data-open-dim="' + idx + '"><span>' + healthBadge(s.status) + ' <strong>' + esc(d.name || 'Untitled') + '</strong> <span class="badge badge--outline">' + esc(d.category || '') + '</span> <span class="badge badge--outline">' + esc(t.label) + '</span></span><span class="trace-node__relation">View &rarr;</span></div>';
      }).join('') : '<p class="callout">' + (dims.length ? 'No dimensions match this filter — the system is Healthy everywhere else.' : 'No health dimensions defined yet.') + '</p>') +
      '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-4)">Healthy systems should not require equal attention everywhere.</p>';

    var toggle = mount.querySelector('#exception-toggle');
    if (toggle) toggle.addEventListener('change', function () { viewerState.exceptionOnly = toggle.checked; renderOverviewTab(mount); });
    mount.querySelectorAll('[data-open-dim]').forEach(function (n) {
      n.addEventListener('click', function () { viewerState.tab = 'dimensions'; viewerState.openDimIndex = parseInt(n.getAttribute('data-open-dim'), 10); renderViewer(); });
    });
  }

  /* ----------------------------------------------------------
     Dimensions — full detail, threshold challenge, trend entry
     ---------------------------------------------------------- */

  function reviewedInHtml(dim) {
    if (!Rhy) return '';
    var rhythms = Rhy.store.list().filter(function (r) { return (r.data.signals || []).some(function (s) { return s.relatedHealthDimensionId === dim.id; }); });
    if (!rhythms.length) {
      return '<div class="callout" style="margin-top:var(--space-4)">This dimension is not reviewed in any Operating Rhythm yet. <a href="' + operatingRhythmHref() + '">Design one &rarr;</a></div>';
    }
    return '<span class="eyebrow" style="margin-top:var(--space-5);display:block">Reviewed In</span>' +
      '<div class="build-project-row__meta" style="margin-top:var(--space-2)">' +
      rhythms.map(function (r) { return '<a class="badge badge--outline" href="' + operatingRhythmHref(r.id) + '">' + esc(r.name) + ' &rarr;</a>'; }).join('') +
      '</div>';
  }

  function operatingRhythmHref(rhythmId) {
    var base = global.OMSData ? global.OMSData.href('pages/operating-rhythm.html') : 'operating-rhythm.html';
    return rhythmId ? base + '?rhythm=' + encodeURIComponent(rhythmId) : base;
  }

  function renderDimensionsTab(mount) {
    var dims = project.data.dimensions || [];
    if (!dims.length) { mount.innerHTML = '<p class="callout">No health dimensions defined yet. Add them from the wizard.</p>'; return; }
    var openIndex = Math.min(viewerState.openDimIndex || 0, dims.length - 1);

    mount.innerHTML = '<div class="bp-tabs" id="dim-picker" style="margin-bottom:var(--space-5);flex-wrap:wrap"></div><div id="dim-detail-body"></div>';
    var picker = mount.querySelector('#dim-picker');
    picker.innerHTML = dims.map(function (d, i) { return '<button type="button" data-idx="' + i + '" class="' + (i === openIndex ? 'is-active' : '') + '">' + esc(d.name || 'Untitled') + '</button>'; }).join('');
    picker.querySelectorAll('[data-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () { viewerState.openDimIndex = parseInt(btn.getAttribute('data-idx'), 10); renderDimensionsTab(mount); });
    });

    var dim = dims[openIndex];
    var status = H.dimensionStatus(dim);
    var trend = H.trendForDimension(dim);
    var flags = H.dimensionFlags(dim);

    mount.querySelector('#dim-detail-body').innerHTML =
      '<div class="card">' +
        '<div class="bp-chain-section__header"><h3 style="margin:0">' + esc(dim.name || 'Untitled') + '</h3>' +
          healthBadge(status.status) + '<span class="badge badge--outline">' + esc(dim.category || '') + '</span><span class="badge badge--outline">Trend: ' + esc(trend.label) + '</span>' +
        '</div>' +
        '<p class="text-muted" style="margin-top:var(--space-2)"><strong>Why this status?</strong> ' + esc(status.why) + '</p>' +
        '<p class="text-muted"><strong>Why this trend?</strong> ' + esc(trend.why) + '</p>' +
        '<dl class="dva-row" style="margin-top:var(--space-4)">' +
          '<div class="dva-row__col"><h5>What Healthy Looks Like</h5><p style="font-size:var(--step--1)">' + esc(dim.whatHealthyLooksLike || '—') + '<br><strong>Signal:</strong> ' + esc(dim.signal || '—') + '</p></div>' +
          '<div class="dva-row__col"><h5>Deterioration &amp; Early Warning</h5><p style="font-size:var(--step--1)"><strong>Deterioration:</strong> ' + esc(dim.deteriorationLooksLike || '—') + '<br><strong>Early warning:</strong> ' + esc(dim.earlyWarning || '—') + '</p></div>' +
        '</dl>' +
        '<dl class="dva-row" style="margin-top:var(--space-3)">' +
          '<div class="dva-row__col"><h5>Threshold Challenge</h5><p style="font-size:var(--step--1)"><em>' + esc(H.THRESHOLD_CHALLENGE_QUESTION) + '</em><br><strong>Source:</strong> ' + esc(dim.thresholdSource || 'Unknown') + '<br><strong>Target / Watch / Critical:</strong> ' + esc(dim.targetValue || '—') + ' / ' + esc(dim.watchThreshold || '—') + ' / ' + esc(dim.criticalThreshold || '—') + ' (' + esc(dim.direction || '') + ')</p></div>' +
          '<div class="dva-row__col"><h5>When To Act</h5><p style="font-size:var(--step--1)"><strong>Act when:</strong> ' + esc(dim.whenToAct || '—') + '<br><strong>Who acts:</strong> ' + esc(dim.whoActs || '—') + '<br><strong>Decision off track:</strong> ' + esc(dim.decisionOnOffTrack || '—') + '</p></div>' +
        '</dl>' +
        '<div class="build-project-row__meta" style="margin-top:var(--space-4)">' +
          '<span class="badge badge--outline">Reviewed: ' + esc(dim.reviewRhythm || 'Never') + '</span>' +
          '<span class="badge badge--outline">Reported at: ' + esc(dim.reportingLocation || 'Not set') + '</span>' +
        '</div>' +
        (flags.length ? '<span class="eyebrow" style="margin-top:var(--space-5);display:block">Coverage Gaps</span><ul style="margin:var(--space-2) 0 0 1.2em;font-size:var(--step--1)">' + flags.map(function (f) { return '<li><strong>' + esc(f.rule) + ':</strong> ' + esc(f.message) + '</li>'; }).join('') + '</ul>' : '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-4)">No coverage gaps for this dimension.</p>') +
        reviewedInHtml(dim) +
        '<span class="eyebrow" style="margin-top:var(--space-5);display:block">Health Trend (Manual Entry)</span>' +
        '<p class="text-dim" style="font-size:var(--step--1)">Add a data point per review period. At least three are needed to describe a trend — this is a simple transparent calculation, not statistical process control.</p>' +
        '<div id="trend-mount"></div>' +
        '<div class="inspector-panel__actions" style="margin-top:var(--space-4)"><button type="button" class="btn btn--ghost" data-save-finding="' + openIndex + '">Save To Workbench</button></div>' +
      '</div>';

    B.repeatableList({
      mount: mount.querySelector('#trend-mount'), project: { data: dim }, dataKey: 'timeSeries',
      addLabel: 'Add Data Point', itemLabel: function (item) { return item.label || 'Data point'; },
      defaults: function () { return { label: 'Week ' + ((dim.timeSeries || []).length + 1), value: '' }; },
      onChange: function () { H.store.save(project); renderDimensionsTab(mount); },
      fields: [{ key: 'label', label: 'Period label' }, { key: 'value', label: 'Value' }]
    });

    var saveBtn = mount.querySelector('[data-save-finding]');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      project.data.findings.push({ id: H.newId('find'), type: 'Health: ' + dim.name, message: 'Status: ' + status.status + '. ' + status.why, why: 'From Health Model "' + project.name + '".', savedAt: new Date().toISOString() });
      H.logActivity(project, 'Saved finding to Workbench: ' + dim.name);
      H.store.save(project);
      saveBtn.textContent = 'Saved ✓';
      saveBtn.disabled = true;
    });
  }

  /* ----------------------------------------------------------
     Signal Cascade + Early Warning Architecture
     ---------------------------------------------------------- */

  function renderSignalsTab(mount) {
    var cascades = project.data.signalCascades || [];
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">Signal Cascade</span></div>' +
      (cascades.length ? cascades.map(function (c) {
        return '<div class="trace-chain" style="margin-bottom:var(--space-5)">' +
          '<div class="trace-chain__node">Early Signal<div style="font-size:var(--step--1);margin-top:4px">' + esc(c.earlySignal) + '</div></div>' +
          '<span class="trace-chain__arrow">&darr;</span>' +
          '<div class="trace-chain__node">Operating Condition<div style="font-size:var(--step--1);margin-top:4px">' + esc(c.operatingCondition) + '</div></div>' +
          '<span class="trace-chain__arrow">&darr;</span>' +
          '<div class="trace-chain__node">Performance Impact<div style="font-size:var(--step--1);margin-top:4px">' + esc(c.performanceImpact) + '</div></div>' +
          '<span class="trace-chain__arrow">&darr;</span>' +
          '<div class="trace-chain__node">Business Outcome<div style="font-size:var(--step--1);margin-top:4px">' + esc(c.businessOutcome) + '</div></div>' +
        '</div>';
      }).join('') : '<p class="callout">No signal cascades mapped yet.</p>') +
      '<div class="constraint-panel" style="margin-top:var(--space-7)">' +
        '<span class="eyebrow">Early Warning Architecture</span>' +
        '<p class="text-muted" style="margin-top:var(--space-2)">Ask this for any outcome that matters.</p>' +
        '<ul style="margin:var(--space-3) 0 0 1.2em">' + H.EARLY_WARNING_QUESTIONS.map(function (q) { return '<li style="margin-bottom:var(--space-2)">' + esc(q) + '</li>'; }).join('') + '</ul>' +
      '</div>';
  }

  /* ----------------------------------------------------------
     Coverage — measurement coverage per dimension
     ---------------------------------------------------------- */

  function renderCoverageTab(mount) {
    var dims = project.data.dimensions || [];
    var findings = H.modelFindings(project);
    var checks = ['signal', 'earlyWarning', 'whoActs', 'reviewRhythm', 'decisionOnOffTrack'];
    var checkLabels = { signal: 'Has Signal?', earlyWarning: 'Has Early Warning?', whoActs: 'Has Owner?', reviewRhythm: 'Has Review Rhythm?', decisionOnOffTrack: 'Has Decision?' };

    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">Measurement Coverage</span><h3>Does every dimension actually have what it needs?</h3></div>' +
      (findings.length ? findings.map(function (f) {
        return '<div class="risk-flag risk-flag--' + f.severity + '" style="margin-bottom:var(--space-3)">' +
          '<div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--' + f.severity + '">' + esc(f.rule) + '</span></div>' +
          '<p class="risk-flag__message">' + esc(f.message) + '</p>' +
        '</div>';
      }).join('') : '') +
      (dims.length ? '<div class="builder-table-wrap"><table class="builder-table"><thead><tr><th>Dimension</th>' + checks.map(function (c) { return '<th>' + checkLabels[c] + '</th>'; }).join('') + '<th>Has Threshold?</th></tr></thead><tbody>' +
        dims.map(function (d) {
          var hasThreshold = !!(d.targetValue || d.watchThreshold || d.criticalThreshold) || d.statusMode === 'Judgment';
          return '<tr><td>' + esc(d.name || 'Untitled') + '</td>' + checks.map(function (c) {
            return '<td>' + (d[c] ? '<span class="badge badge--outline">Yes</span>' : '<span class="badge badge--outline" style="border-color:var(--color-caution);color:var(--color-caution)">No</span>') + '</td>';
          }).join('') + '<td>' + (hasThreshold ? '<span class="badge badge--outline">Yes</span>' : '<span class="badge badge--outline" style="border-color:var(--color-caution);color:var(--color-caution)">No</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="callout">No dimensions to show coverage for yet.</p>');
  }

  /* ----------------------------------------------------------
     Executive Health View — Section 48
     ---------------------------------------------------------- */

  function renderSummaryTab(mount) {
    var overall = H.overallHealth(project);
    var worstDim = (project.data.dimensions || []).filter(function (d) { return d.name === overall.dimension; })[0];
    var trend = worstDim ? H.trendForDimension(worstDim) : null;
    var quad = H.quadrant(project.data.performanceStatus, overall.status);
    var findings = H.modelFindings(project);

    mount.innerHTML =
      '<div class="card">' +
        '<span class="eyebrow">Executive Health View</span>' +
        '<h2 style="margin:var(--space-2) 0">' + esc(project.name) + '</h2>' +
        '<dl class="dva-row">' +
          '<div class="dva-row__col"><h5>System</h5><p style="font-size:var(--step--1)">' + esc(project.data.scopeType || '—') + ' &middot; Owner: ' + esc(project.owner || 'Not named') + '</p></div>' +
          '<div class="dva-row__col"><h5>Outcome</h5><p style="font-size:var(--step--1)">' + esc(project.data.businessOutcome || 'Not named') + ' (' + esc(project.data.performanceStatus || 'Unknown') + ')</p></div>' +
        '</dl>' +
        '<dl class="dva-row" style="margin-top:var(--space-3)">' +
          '<div class="dva-row__col"><h5>Health</h5><p style="font-size:var(--step--1)">' + healthBadge(overall.status) + '<br>' + esc(overall.why) + '</p></div>' +
          '<div class="dva-row__col"><h5>Trend</h5><p style="font-size:var(--step--1)">' + esc(trend ? trend.label : 'No dimension trend available') + '</p></div>' +
        '</dl>' +
        '<dl class="dva-row" style="margin-top:var(--space-3)">' +
          '<div class="dva-row__col"><h5>Primary Risk</h5><p style="font-size:var(--step--1)">' + esc(quad.label || quad.note) + '</p></div>' +
          '<div class="dva-row__col"><h5>Decision Needed</h5><p style="font-size:var(--step--1)">' + esc(worstDim ? (worstDim.decisionOnOffTrack || 'None recorded') : 'None recorded') + '</p></div>' +
        '</dl>' +
        '<span class="eyebrow" style="margin-top:var(--space-5);display:block">Model Findings</span>' +
        (findings.length ? '<ul style="margin:var(--space-2) 0 0 1.2em">' + findings.map(function (f) { return '<li>' + esc(f.rule) + '</li>'; }).join('') + '</ul>' : '<p class="text-dim">None flagged.</p>') +
      '</div>' +
      '<div class="hero__actions" style="margin-top:var(--space-5)"><button type="button" class="btn btn--secondary" id="health-export-btn">Export JSON</button><button type="button" class="btn btn--secondary" id="health-print-btn">Print / Save As PDF</button></div>';
    mount.querySelector('#health-export-btn').addEventListener('click', function () { B.exportJson(project); });
    mount.querySelector('#health-print-btn').addEventListener('click', function () { global.print(); });
  }

  /* ----------------------------------------------------------
     Launcher + Import From Value Stream / Capacity
     ---------------------------------------------------------- */

  var VS_CANDIDATES = [
    { label: 'Lead Time', category: 'Flow' }, { label: 'Wait Time', category: 'Flow' },
    { label: 'Flow Efficiency', category: 'Flow' }, { label: 'Queue Age', category: 'Flow' },
    { label: 'Rework Rate', category: 'Quality' }, { label: 'Handoff Defect Rate', category: 'Quality' },
    { label: 'First-Pass Quality', category: 'Quality' }, { label: 'Throughput', category: 'Flow' },
    { label: 'Exception Rate', category: 'Risk' }
  ];
  var CAP_CANDIDATES = [
    { label: 'Demand Load', category: 'Capacity' }, { label: 'Capacity Buffer', category: 'Capacity' },
    { label: 'Queue Growth', category: 'Capacity' }, { label: 'Rework Tax', category: 'Quality' },
    { label: 'Failure Demand', category: 'Quality' }, { label: 'Skill Coverage', category: 'Employee' },
    { label: 'Utilization', category: 'Capacity' }, { label: 'Demand Variability', category: 'Capacity' }
  ];

  function renderImportPanel() {
    if (!els.importPanel) return;
    if (!importState.open) { els.importPanel.innerHTML = ''; els.importPanel.hidden = true; return; }
    els.importPanel.hidden = false;
    var isVs = importState.open === 'valuestream';
    var options = isVs ? valueStreamOptions() : capacityOptions();
    var candidates = isVs ? VS_CANDIDATES : CAP_CANDIDATES;
    var relKey = isVs ? 'relatedValueStreamId' : 'relatedCapacityModelId';

    els.importPanel.innerHTML =
      '<div class="card" style="margin-top:var(--space-4)">' +
        '<span class="eyebrow">Import From ' + (isVs ? 'Value Stream' : 'Capacity Model') + '</span>' +
        '<p class="text-muted" style="margin-top:var(--space-2)">Candidate metrics only — nothing is added until you pick which ones matter here.</p>' +
        '<div class="builder-field-grid" style="margin-top:var(--space-3)">' +
          '<div class="builder-field">' + B.fieldHtml({ key: 'source', label: 'Source ' + (isVs ? 'Value Stream' : 'Capacity Model'), type: 'select', options: options }, importState.presetSourceId || '', 'import-source') + '</div>' +
        '</div>' +
        '<div class="builder-check-group" id="import-candidates" style="margin-top:var(--space-3)">' +
          candidates.map(function (c, i) { return '<label class="builder-check"><input type="checkbox" data-cand="' + i + '"> ' + esc(c.label) + '</label>'; }).join('') +
        '</div>' +
        '<div style="display:flex;gap:var(--space-3);margin-top:var(--space-4)">' +
          '<button type="button" class="btn btn--primary" id="import-confirm-btn">Add To Health Model</button>' +
          '<button type="button" class="btn btn--ghost" id="import-cancel-btn">Cancel</button>' +
        '</div>' +
      '</div>';

    els.importPanel.querySelector('#import-cancel-btn').addEventListener('click', function () { importState.open = null; importState.presetSourceId = null; renderImportPanel(); });
    els.importPanel.querySelector('#import-confirm-btn').addEventListener('click', function () {
      var sourceId = els.importPanel.querySelector('[data-key="source"]').value;
      var checked = Array.prototype.slice.call(els.importPanel.querySelectorAll('[data-cand]:checked')).map(function (i) { return parseInt(i.getAttribute('data-cand'), 10); });
      if (!checked.length) return;
      var sourceModel = sourceId ? (isVs ? VS.store.get(sourceId) : Cap.store.get(sourceId)) : null;
      var data = H.blankData();
      data.scopeType = 'Value Stream';
      if (isVs) data.relatedValueStreamId = sourceId; else data.relatedCapacityModelId = sourceId;
      data.dimensions = checked.map(function (i) {
        var c = candidates[i];
        return { id: H.newId('dim'), name: c.label, category: c.category, signal: c.label, statusMode: 'Threshold', direction: 'Lower Is Better', timeSeries: [] };
      });
      var name = (sourceModel ? sourceModel.name : (isVs ? 'Value Stream' : 'Capacity Model')) + ' — Health';
      project = H.store.create(name, data, false);
      importState.open = null;
      enterWizard();
    });
  }

  function renderResumeList() {
    var list = H.store.list().slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
    if (!els.resumeList) return;
    if (!list.length) { els.resumeList.innerHTML = ''; return; }
    els.resumeList.innerHTML = '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">My Health Models</span></div>' +
      list.map(function (m) {
        var overall = H.overallHealth(m);
        return '<div class="build-project-row" data-id="' + m.id + '">' +
          '<div class="build-project-row__meta">' +
            (m.isSample ? '<span class="badge badge--accent">Sample</span>' : '') +
            healthBadge(overall.status) +
            '<strong>' + esc(m.name) + '</strong>' +
            '<span class="text-dim text-mono" style="font-size:var(--step--1)">' + (m.data.dimensions || []).length + ' dimensions &middot; Updated ' + B.formatDate(m.updatedAt) + '</span>' +
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

    els.resumeList.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { project = H.store.get(b.getAttribute('data-open')); enterViewer(); }); });
    els.resumeList.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { project = H.store.get(b.getAttribute('data-edit')); enterWizard(); }); });
    els.resumeList.querySelectorAll('[data-duplicate]').forEach(function (b) { b.addEventListener('click', function () { H.store.duplicate(b.getAttribute('data-duplicate')); renderResumeList(); }); });
    els.resumeList.querySelectorAll('[data-export]').forEach(function (b) { b.addEventListener('click', function () { B.exportJson(H.store.get(b.getAttribute('data-export'))); }); });
    els.resumeList.querySelectorAll('[data-delete]').forEach(function (b) {
      b.addEventListener('click', function () { if (global.confirm('Delete this Health Model? This cannot be undone.')) { H.store.remove(b.getAttribute('data-delete')); renderResumeList(); } });
    });
  }

  function backToLauncher() {
    els.launcher.hidden = false;
    els.wizard.hidden = true;
    els.viewer.hidden = true;
    if (els.viewerSection) els.viewerSection.hidden = true;
    importState.open = null;
    importState.presetSourceId = null;
    renderImportPanel();
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
    H = global.OMSHealth;
    VS = global.OMSValueStream;
    Cap = global.OMSCapacity;
    BP = global.OMSBlueprint;
    Rhy = global.OMSRhythm;

    els.launcher = byId('health-launcher');
    els.wizard = byId('health-wizard');
    els.viewer = byId('health-viewer');
    els.viewerBody = byId('health-viewer-body');
    els.viewerSection = byId('health-viewer-section');
    els.sampleBanner = byId('health-sample-banner');
    els.resumeList = byId('health-resume-list');
    els.importPanel = byId('health-import-panel');
    els.progress = byId('builder-progress');
    els.stepBody = byId('builder-step-body');
    els.prev = byId('builder-prev');
    els.next = byId('builder-next');
    els.stepLabel = byId('builder-step-label');
    els.projectName = byId('builder-project-name');

    var newBtn = byId('new-health-btn');
    var sampleBtn = byId('load-sample-health-btn');
    var importVsBtn = byId('import-vs-health-btn');
    var importCapBtn = byId('import-cap-health-btn');
    var exitBtn = byId('builder-exit');
    var viewerExitBtn = byId('viewer-exit');
    var viewerEditBtn = byId('viewer-edit');

    if (newBtn) newBtn.addEventListener('click', function () {
      var name = global.prompt('Name this Health Model:', 'New Health Model');
      if (name === null) return;
      project = H.store.create(name || 'New Health Model', H.blankData(), false);
      enterWizard();
    });
    if (sampleBtn) sampleBtn.addEventListener('click', function () {
      var built = global.OMSHealthSample.build();
      project = H.store.create('Customer Onboarding Health — Sample', built.data, true);
      project.owner = built.owner;
      H.store.save(project);
      enterViewer();
    });
    if (importVsBtn) importVsBtn.addEventListener('click', function () { importState.open = 'valuestream'; renderImportPanel(); });
    if (importCapBtn) importCapBtn.addEventListener('click', function () { importState.open = 'capacity'; renderImportPanel(); });
    if (exitBtn) exitBtn.addEventListener('click', backToLauncher);
    if (viewerExitBtn) viewerExitBtn.addEventListener('click', backToLauncher);
    if (viewerEditBtn) viewerEditBtn.addEventListener('click', function () { enterWizard(); });

    var params = new URLSearchParams(global.location.search);
    var requestedId = params.get('model');
    var existing = requestedId ? H.store.get(requestedId) : null;
    var importVsId = params.get('importVs');
    var importCapId = params.get('importCap');

    if (existing) { project = existing; enterViewer(); }
    else {
      backToLauncher();
      if (importVsId) { importState.open = 'valuestream'; importState.presetSourceId = importVsId; renderImportPanel(); }
      else if (importCapId) { importState.open = 'capacity'; importState.presetSourceId = importCapId; renderImportPanel(); }
    }
  }

  global.OMSHealthPage = { init: init, get project() { return project; } };
})(window);
