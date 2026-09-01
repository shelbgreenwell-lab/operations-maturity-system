/*
 * Operations Maturity System
 * Organization Blueprint — page controller.
 *
 * Drives pages/blueprint.html. Two modes share one page:
 * - the WIZARD: setup plus 15 entity-entry steps, built entirely on
 *   the same shared widgets (js/builder-core.js) the three flagship
 *   builders use — repeatable item cards, object forms, a freely
 *   jumpable progress bar — so a Blueprint is edited the same way
 *   an Operating Model or Process is.
 * - the VIEWER: the actual "see the system" experience — a
 *   progressive-disclosure Overview, a searchable/filterable Full
 *   System browser, a Health & Risk view, and a Trace / Blast Radius
 *   tool — all reading live from js/blueprint-core.js's relationship
 *   graph, plus a System Inspector side panel for any object.
 *
 * Sample data (Northstar Software) lives in js/blueprint-sample.js.
 */

(function (global) {
  'use strict';

  var B = null;  // OMSBuilder (shared field widgets + wizard shell)
  var BP = null; // OMSBlueprint (data model + analysis engine)
  var els = {};
  var project = null;
  var viewerState = { tab: 'overview', query: '', filters: {}, focus: null, traceType: 'blast', traceTarget: null };

  function byId(id) { return document.getElementById(id); }

  function opts(list, nameFieldOrFn) {
    return (list || []).map(function (item) {
      return { value: item.id, label: typeof nameFieldOrFn === 'function' ? nameFieldOrFn(item) : item[nameFieldOrFn] };
    });
  }

  function capName(project) { return function (id) { var c = BP.byId(project.data.capabilities, id); return c ? c.name : id; }; }

  function nameOf(data, type, id) {
    var item = BP.byId(data[type], id);
    return item ? BP.entityName(type, item) : null;
  }

  /* ----------------------------------------------------------
     Wizard: setup step
     ---------------------------------------------------------- */

  var MAPPING_OPTIONS = [
    { value: 'organization', label: 'Entire Organization' },
    { value: 'business-unit', label: 'Business Unit' },
    { value: 'function', label: 'Function' },
    { value: 'program', label: 'Program' },
    { value: 'team', label: 'Team' },
    { value: 'other', label: 'Other' }
  ];

  function stepSetup(container, proj, ctrl) {
    container.innerHTML =
      '<h3>What are you mapping?</h3>' +
      '<div class="builder-scope-grid" id="mapping-grid" style="margin:var(--space-5) 0"></div>' +
      '<div class="builder-field-grid">' +
        '<div class="builder-field builder-field--wide"><label class="builder-field__label">Blueprint name</label>' +
          '<input type="text" class="builder-field__input" id="bp-name-input" value="' + (proj.name || '').replace(/"/g, '&quot;') + '"></div>' +
        '<div class="builder-field builder-field--wide" id="purpose-mount"></div>' +
        '<div class="builder-field builder-field--wide" id="customer-mount"></div>' +
      '</div>';

    var grid = container.querySelector('#mapping-grid');
    grid.innerHTML = MAPPING_OPTIONS.map(function (opt) {
      var selected = proj.data.meta.mapping === opt.value;
      return '<button type="button" class="builder-scope-tile' + (selected ? ' is-selected' : '') + '" data-mapping="' + opt.value + '">' + opt.label + '</button>';
    }).join('');
    grid.querySelectorAll('[data-mapping]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        proj.data.meta.mapping = btn.getAttribute('data-mapping');
        ctrl.persist();
        stepSetup(container, proj, ctrl);
      });
    });

    container.querySelector('#bp-name-input').addEventListener('input', function (e) {
      proj.name = e.target.value;
      ctrl.persist();
    });

    container.querySelector('#purpose-mount').innerHTML =
      '<label class="builder-field__label">Primary purpose &mdash; what is this operating system expected to accomplish?</label>' +
      '<textarea class="builder-field__input builder-field__input--area" id="meta-purpose" rows="2">' + (proj.data.meta.purpose || '') + '</textarea>';
    container.querySelector('#meta-purpose').addEventListener('input', function (e) { proj.data.meta.purpose = e.target.value; ctrl.persist(); });

    container.querySelector('#customer-mount').innerHTML =
      '<label class="builder-field__label">Primary customer / value recipient</label>' +
      '<input type="text" class="builder-field__input" id="meta-customer" value="' + (proj.data.meta.customer || '').replace(/"/g, '&quot;') + '">';
    container.querySelector('#meta-customer').addEventListener('input', function (e) { proj.data.meta.customer = e.target.value; ctrl.persist(); });
  }

  /* ----------------------------------------------------------
     Wizard: 15 entity steps
     ---------------------------------------------------------- */

  function entityStep(opts) {
    return {
      id: opts.type, label: opts.label,
      render: function (container, proj, ctrl) {
        container.innerHTML = '<h3>' + opts.title + '</h3>' +
          (opts.lede ? '<p class="lede">' + opts.lede + '</p>' : '') +
          (opts.extra ? '<div id="' + opts.type + '-extra"></div>' : '') +
          '<div id="' + opts.type + '-mount"></div>';
        if (opts.extra) opts.extra(container.querySelector('#' + opts.type + '-extra'), proj, ctrl);
        B.repeatableList({
          mount: container.querySelector('#' + opts.type + '-mount'),
          project: proj, dataKey: opts.type, addLabel: opts.addLabel || ('Add ' + BP.ENTITY_META[opts.type].label),
          itemLabel: opts.itemLabel || function (item, i) { return BP.entityName(opts.type, item) || ((i + 1) + ''); },
          defaults: opts.defaults,
          onChange: ctrl.persist,
          fields: opts.fields(proj)
        });
      }
    };
  }

  function suggestHandoffs(proj) {
    var d = proj.data;
    var added = 0;
    (d.valueStreams || []).forEach(function (vs) {
      var ids = vs.capabilityIds || [];
      for (var i = 0; i < ids.length - 1; i++) {
        var fromId = ids[i], toId = ids[i + 1];
        var exists = (d.handoffs || []).some(function (h) { return h.fromCapabilityId === fromId && h.toCapabilityId === toId; });
        if (!exists) {
          d.handoffs.push({
            id: BP.newId('ho'), fromCapabilityId: fromId, toCapabilityId: toId, from: '', to: '',
            whatMoves: '', status: 'Undefined', impact: '', valueStreamId: vs.id, auto: true
          });
          added++;
        }
      }
    });
    return added;
  }

  function handoffLabel(data, item) {
    var from = item.from || (item.fromCapabilityId && nameOf(data, 'capabilities', item.fromCapabilityId)) || '?';
    var to = item.to || (item.toCapabilityId && nameOf(data, 'capabilities', item.toCapabilityId)) || '?';
    return from + ' → ' + to;
  }

  var CRIT4 = ['Low', 'Medium', 'High', 'Critical'];
  var CRIT3 = ['High', 'Medium', 'Low'];
  var MATURITY5 = ['Reactive', 'Repeatable', 'Defined', 'Managed', 'Adaptive'];

  var ENTITY_STEPS = [
    entityStep({
      type: 'outcomes', label: 'Outcomes', title: 'What outcomes must this operating system reliably produce?',
      defaults: function () { return { name: '', description: '', priority: '', successMeasure: '', owner: '' }; },
      fields: function () { return [
        { key: 'name', label: 'Outcome', type: 'text', help: 'Examples: revenue growth, customer retention, service quality, operational efficiency, speed, innovation, compliance, employee productivity.' },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'priority', label: 'Priority', type: 'select', options: CRIT3 },
        { key: 'successMeasure', label: 'Success measure', type: 'text', help: 'How will you know this is happening?' },
        { key: 'owner', label: 'Owner', type: 'text', help: 'Who is accountable if this outcome isn\'t met?' }
      ]; }
    }),
    entityStep({
      type: 'valueRecipients', label: 'Value', title: 'Who receives value, and what do they expect?',
      lede: 'Organizations do not exist to execute processes. Processes exist to create value.',
      defaults: function () { return { recipient: '', expectation: '', confirmation: '', outcomeIds: [] }; },
      fields: function (proj) { return [
        { key: 'recipient', label: 'Who receives value?', type: 'text' },
        { key: 'expectation', label: 'What value do they expect?', type: 'textarea' },
        { key: 'confirmation', label: 'How do we know they received it?', type: 'text' },
        { key: 'outcomeIds', label: 'Connected outcomes', type: 'multiselect', options: function () { return opts(proj.data.outcomes, 'name'); } }
      ]; }
    }),
    entityStep({
      type: 'capabilities', label: 'Capabilities', title: 'What capabilities are required to create that value?',
      defaults: function () { return { name: '', purpose: '', owner: '', criticality: '', maturity: '', outcomeIds: [], valueStreamIds: [] }; },
      fields: function (proj) { return [
        { key: 'name', label: 'Capability', type: 'text', help: 'Examples: Sales, Marketing, Customer Success, Operations, Service Delivery, Finance, Data & Analytics, Technology, Enablement, Quality, Workforce Management, Product.' },
        { key: 'purpose', label: 'Purpose', type: 'textarea' },
        { key: 'owner', label: 'Owner', type: 'text' },
        { key: 'criticality', label: 'Criticality', type: 'select', options: CRIT3 },
        { key: 'maturity', label: 'Current maturity', type: 'select', options: MATURITY5 },
        { key: 'outcomeIds', label: 'Outcomes supported', type: 'multiselect', options: function () { return opts(proj.data.outcomes, 'name'); } },
        { key: 'valueStreamIds', label: 'Value streams supported', type: 'multiselect', options: function () { return opts(proj.data.valueStreams, 'name'); }, help: 'Value streams come next — revisit this once you\'ve added them.' }
      ]; }
    }),
    entityStep({
      type: 'valueStreams', label: 'Value Streams', title: 'What major flows cross the organization?',
      defaults: function () { return { name: '', start: '', end: '', valueCreated: '', capabilityIds: [], owner: '', stages: '' }; },
      fields: function (proj) { return [
        { key: 'name', label: 'Value stream', type: 'text', help: 'Examples: Lead → Customer, Order → Delivery, Issue → Resolution, Idea → Launch, Hire → Productive Employee, Customer Feedback → Product Change, Request → Decision.' },
        { key: 'start', label: 'Start', type: 'text' },
        { key: 'end', label: 'End', type: 'text' },
        { key: 'valueCreated', label: 'Value created', type: 'textarea' },
        { key: 'capabilityIds', label: 'Capabilities involved (roughly in flow order)', type: 'multiselect', options: function () { return opts(proj.data.capabilities, 'name'); }, help: 'This order also powers automatic handoff suggestions later.' },
        { key: 'owner', label: 'Owner', type: 'text' },
        { key: 'stages', label: 'Major stages', type: 'textarea', help: 'Free text is fine, roughly in order.' }
      ]; }
    }),
    entityStep({
      type: 'teams', label: 'Teams', title: 'What groups execute these capabilities?',
      lede: 'Focus on operating responsibility, not reporting hierarchy.',
      defaults: function () { return { name: '', purpose: '', capabilityIds: [], valueStreamIds: [], leader: '' }; },
      fields: function (proj) { return [
        { key: 'name', label: 'Team / function', type: 'text' },
        { key: 'purpose', label: 'Purpose', type: 'textarea' },
        { key: 'capabilityIds', label: 'Capabilities supported', type: 'multiselect', options: function () { return opts(proj.data.capabilities, 'name'); } },
        { key: 'valueStreamIds', label: 'Value streams supported', type: 'multiselect', options: function () { return opts(proj.data.valueStreams, 'name'); } },
        { key: 'leader', label: 'Leader / owner', type: 'text' }
      ]; }
    }),
    entityStep({
      type: 'roles', label: 'Roles', title: 'What critical roles own this work?',
      defaults: function () { return { name: '', purpose: '', teamId: '', capabilityIds: [], processIds: [], decisionIds: [], metricIds: [], governanceIds: [] }; },
      fields: function (proj) { return [
        { key: 'name', label: 'Role', type: 'text' },
        { key: 'purpose', label: 'Purpose', type: 'text', help: 'What is this role accountable for that no other role is?' },
        { key: 'teamId', label: 'Team', type: 'select', options: function () { return opts(proj.data.teams, 'name'); } },
        { key: 'capabilityIds', label: 'Capabilities supported', type: 'multiselect', options: function () { return opts(proj.data.capabilities, 'name'); } },
        { key: 'processIds', label: 'Processes owned', type: 'multiselect', options: function () { return opts(proj.data.processes, 'name'); }, help: 'Processes, decisions, metrics, and governance come later — revisit this step once you\'ve added them.' },
        { key: 'decisionIds', label: 'Decisions owned', type: 'multiselect', options: function () { return opts(proj.data.decisions, 'name'); } },
        { key: 'metricIds', label: 'Metrics owned', type: 'multiselect', options: function () { return opts(proj.data.metrics, 'name'); } },
        { key: 'governanceIds', label: 'Governance responsibilities', type: 'multiselect', options: function () { return opts(proj.data.governance, 'mechanism'); } }
      ]; }
    }),
    entityStep({
      type: 'decisions', label: 'Decisions', title: 'What major recurring decisions run through this system?',
      defaults: function () { return { name: '', owner: '', frequency: '', impact: '', escalationOwner: '', roleId: '', processId: '' }; },
      fields: function (proj) { return [
        { key: 'name', label: 'Decision', type: 'text', help: 'Examples: pricing exception, hiring approval, capacity allocation, customer escalation, product prioritization, budget allocation, process change.' },
        { key: 'owner', label: 'Owner', type: 'text' },
        { key: 'frequency', label: 'Frequency', type: 'select', options: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Ad Hoc'] },
        { key: 'impact', label: 'Impact', type: 'select', options: CRIT4 },
        { key: 'escalationOwner', label: 'Escalation owner', type: 'text' },
        { key: 'roleId', label: 'Owning role', type: 'select', options: function () { return opts(proj.data.roles, 'name'); } },
        { key: 'processId', label: 'Related process', type: 'select', options: function () { return opts(proj.data.processes, 'name'); }, help: 'Processes come next — revisit this after adding them.' }
      ]; }
    }),
    entityStep({
      type: 'processes', label: 'Processes', title: 'What major processes produce these outcomes?',
      defaults: function () { return { name: '', purpose: '', owner: '', capabilityId: '', valueStreamId: '', criticality: '', outcomeId: '' }; },
      fields: function (proj) { return [
        { key: 'name', label: 'Process', type: 'text' },
        { key: 'purpose', label: 'Purpose', type: 'textarea' },
        { key: 'owner', label: 'Who has authority to change this process when it stops working?', type: 'text' },
        { key: 'capabilityId', label: 'Capability', type: 'select', options: function () { return opts(proj.data.capabilities, 'name'); } },
        { key: 'valueStreamId', label: 'Value stream', type: 'select', options: function () { return opts(proj.data.valueStreams, 'name'); } },
        { key: 'criticality', label: 'Criticality', type: 'select', options: CRIT4 },
        { key: 'outcomeId', label: 'Outcome supported', type: 'select', options: function () { return opts(proj.data.outcomes, 'name'); } }
      ]; }
    }),
    {
      id: 'handoffs', label: 'Handoffs',
      render: function (container, proj, ctrl) {
        container.innerHTML = '<h3>Where does ownership change hands?</h3>' +
          '<p class="lede">Suggest handoffs automatically from your value streams, then refine them.</p>' +
          '<button type="button" class="btn btn--secondary" id="suggest-handoffs-btn" style="margin-bottom:var(--space-5)">Suggest Handoffs From Value Streams</button>' +
          '<div id="handoffs-mount"></div>';
        container.querySelector('#suggest-handoffs-btn').addEventListener('click', function () {
          var added = suggestHandoffs(proj);
          ctrl.persist();
          renderList();
          global.alert(added ? ('Added ' + added + ' suggested handoff(s).') : 'No new handoffs to suggest — try adding capabilities to a value stream first.');
        });
        function renderList() {
          B.repeatableList({
            mount: container.querySelector('#handoffs-mount'), project: proj, dataKey: 'handoffs', addLabel: 'Add Handoff',
            itemLabel: function (item) { return handoffLabel(proj.data, item) + (item.auto ? ' (Auto-Detected)' : ''); },
            defaults: function () { return { fromCapabilityId: '', toCapabilityId: '', from: '', to: '', whatMoves: '', status: '', impact: '', valueStreamId: '', auto: false }; },
            onChange: ctrl.persist,
            fields: [
              { key: 'fromCapabilityId', label: 'From capability', type: 'select', options: function () { return opts(proj.data.capabilities, 'name'); } },
              { key: 'toCapabilityId', label: 'To capability', type: 'select', options: function () { return opts(proj.data.capabilities, 'name'); } },
              { key: 'from', label: 'Or name the sending team/role', type: 'text' },
              { key: 'to', label: 'Or name the receiving team/role', type: 'text' },
              { key: 'whatMoves', label: 'What moves?', type: 'text' },
              { key: 'status', label: 'Status', type: 'select', options: ['Defined', 'Partially Defined', 'Undefined'] },
              { key: 'impact', label: 'Impact if this fails', type: 'select', options: CRIT4 },
              { key: 'valueStreamId', label: 'Value stream', type: 'select', options: function () { return opts(proj.data.valueStreams, 'name'); } }
            ]
          });
        }
        renderList();
      }
    },
    entityStep({
      type: 'technology', label: 'Technology', title: 'What systems support this work?',
      defaults: function () { return { name: '', purpose: '', processIds: [], capabilityIds: [], dataProduced: '', owner: '', criticality: '' }; },
      fields: function (proj) { return [
        { key: 'name', label: 'System / tool', type: 'text' },
        { key: 'purpose', label: 'Purpose', type: 'text' },
        { key: 'processIds', label: 'Processes supported', type: 'multiselect', options: function () { return opts(proj.data.processes, 'name'); } },
        { key: 'capabilityIds', label: 'Capabilities supported', type: 'multiselect', options: function () { return opts(proj.data.capabilities, 'name'); } },
        { key: 'dataProduced', label: 'Data produced', type: 'text' },
        { key: 'owner', label: 'Owner', type: 'text' },
        { key: 'criticality', label: 'Criticality', type: 'select', options: CRIT4 }
      ]; }
    }),
    entityStep({
      type: 'data', label: 'Data', title: 'What critical information assets does this system depend on?',
      defaults: function () { return { name: '', source: '', owner: '', systemIds: [], processIds: [], metricIds: [], criticality: '' }; },
      fields: function (proj) { return [
        { key: 'name', label: 'Data asset', type: 'text', help: 'Examples: customer data, revenue data, pipeline data, capacity data, quality data, employee data, operational performance data.' },
        { key: 'source', label: 'Source', type: 'text' },
        { key: 'owner', label: 'Owner', type: 'text' },
        { key: 'systemIds', label: 'Systems', type: 'multiselect', options: function () { return opts(proj.data.technology, 'name'); } },
        { key: 'processIds', label: 'Processes', type: 'multiselect', options: function () { return opts(proj.data.processes, 'name'); } },
        { key: 'metricIds', label: 'Metrics enabled', type: 'multiselect', options: function () { return opts(proj.data.metrics, 'name'); }, help: 'Metrics come next — revisit this after adding them.' },
        { key: 'criticality', label: 'Criticality', type: 'select', options: CRIT4 }
      ]; }
    }),
    entityStep({
      type: 'metrics', label: 'Metrics', title: 'What critical operating metrics does this system produce?',
      lede: 'Every metric should support a decision.',
      defaults: function () { return { name: '', outcomeId: '', processId: '', owner: '', frequency: '', type: '', decisionEnabled: '' }; },
      fields: function (proj) { return [
        { key: 'name', label: 'Metric', type: 'text' },
        { key: 'outcomeId', label: 'Outcome supported', type: 'select', options: function () { return opts(proj.data.outcomes, 'name'); } },
        { key: 'processId', label: 'Process measured', type: 'select', options: function () { return opts(proj.data.processes, 'name'); } },
        { key: 'owner', label: 'Owner', type: 'text' },
        { key: 'frequency', label: 'Frequency', type: 'text' },
        { key: 'type', label: 'Leading / lagging', type: 'select', options: ['Leading', 'Lagging'] },
        { key: 'decisionEnabled', label: 'What decision does this metric support?', type: 'text' }
      ]; }
    }),
    entityStep({
      type: 'rhythms', label: 'Rhythms', title: 'What recurring mechanisms manage this system day to day?',
      defaults: function () { return { name: '', purpose: '', cadence: '', owner: '', metricIds: [], decisionIds: [], processIds: [] }; },
      fields: function (proj) { return [
        { key: 'name', label: 'Operating rhythm', type: 'text', help: 'Examples: daily operations review, weekly performance review, monthly business review, capacity review, risk review, quarterly strategy review.' },
        { key: 'purpose', label: 'Purpose', type: 'text' },
        { key: 'cadence', label: 'Cadence', type: 'text' },
        { key: 'owner', label: 'Owner', type: 'text' },
        { key: 'metricIds', label: 'Metrics reviewed', type: 'multiselect', options: function () { return opts(proj.data.metrics, 'name'); } },
        { key: 'decisionIds', label: 'Decisions made here', type: 'multiselect', options: function () { return opts(proj.data.decisions, 'name'); } },
        { key: 'processIds', label: 'Processes governed', type: 'multiselect', options: function () { return opts(proj.data.processes, 'name'); } }
      ]; }
    }),
    entityStep({
      type: 'governance', label: 'Governance', title: 'How is this operating model governed?',
      defaults: function () { return { mechanism: '', whatIsGoverned: '', owner: '', cadence: '', threshold: '', decisionAuthority: '', escalationPath: '', rhythmIds: [] }; },
      itemLabel: function (item, i) { return item.mechanism || 'Mechanism ' + (i + 1); },
      fields: function (proj) { return [
        { key: 'mechanism', label: 'Governance mechanism', type: 'text' },
        { key: 'whatIsGoverned', label: 'What is governed', type: 'text' },
        { key: 'owner', label: 'Owner', type: 'text' },
        { key: 'cadence', label: 'Cadence', type: 'text' },
        { key: 'threshold', label: 'Threshold', type: 'text' },
        { key: 'decisionAuthority', label: 'Decision authority', type: 'text' },
        { key: 'escalationPath', label: 'Escalation path', type: 'text' },
        { key: 'rhythmIds', label: 'Fed by which operating rhythms?', type: 'multiselect', options: function () { return opts(proj.data.rhythms, 'name'); } }
      ]; }
    }),
    entityStep({
      type: 'improvementMechanisms', label: 'Improvement', title: 'How does this operating system improve?',
      defaults: function () { return { name: '', inputs: '', owner: '', cadence: '', howTested: '', howStandardized: '', governanceIds: [] }; },
      fields: function (proj) { return [
        { key: 'name', label: 'Improvement mechanism', type: 'text', help: 'Examples: operational health review, root cause analysis, structured experiments, process improvement backlog, innovation pipeline.' },
        { key: 'inputs', label: 'Inputs', type: 'text', help: 'What feeds this mechanism — health signals, root cause findings, experiments?' },
        { key: 'owner', label: 'Owner', type: 'text' },
        { key: 'cadence', label: 'Cadence', type: 'text' },
        { key: 'howTested', label: 'How are changes tested?', type: 'textarea' },
        { key: 'howStandardized', label: 'How do changes become standardized?', type: 'textarea' },
        { key: 'governanceIds', label: 'Driven by which governance mechanisms?', type: 'multiselect', options: function () { return opts(proj.data.governance, 'mechanism'); } }
      ]; }
    })
  ];

  function stepFinish(container, proj) {
    var completeness = BP.completeness(proj);
    container.innerHTML =
      '<h3>Explore your Blueprint</h3>' +
      '<p class="lede">You can come back and edit any step at any time &mdash; nothing here is final.</p>' +
      '<div class="completeness-ring" style="margin:var(--space-6) 0">' +
        '<span class="completeness-ring__value">' + completeness.percent + '%</span>' +
        '<span class="text-muted">Blueprint Completeness</span>' +
      '</div>' +
      '<button type="button" class="btn btn--primary" id="go-to-viewer-btn">Explore This Blueprint &rarr;</button>';
    container.querySelector('#go-to-viewer-btn').addEventListener('click', function () { enterViewer(); });
  }

  var WIZARD_STEPS = [{ id: 'setup', label: 'Setup', render: stepSetup }]
    .concat(ENTITY_STEPS)
    .concat([{ id: 'finish', label: 'Explore', render: stepFinish }]);

  /* ----------------------------------------------------------
     Mode switching
     ---------------------------------------------------------- */

  function enterWizard() {
    els.launcher.hidden = true;
    els.wizard.hidden = false;
    els.viewer.hidden = true;
    if (els.viewerSection) els.viewerSection.hidden = true;
    if (els.projectName) els.projectName.textContent = project.name;
    B.initWizard({
      project: project, steps: WIZARD_STEPS,
      els: { progress: els.progress, body: els.stepBody, prev: els.prev, next: els.next, stepLabel: els.stepLabel }
    });
    updateUrl();
  }

  function enterViewer() {
    if (viewerState.projectId !== project.id) {
      viewerState = { tab: 'overview', query: '', filters: {}, focus: null, traceType: 'blast', traceTarget: null, projectId: project.id, expandedLayers: {}, heatmapView: 'blueprint' };
    }
    els.launcher.hidden = true;
    els.wizard.hidden = true;
    els.viewer.hidden = false;
    if (els.viewerSection) els.viewerSection.hidden = false;
    renderViewer();
    updateUrl();
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
    var qs = project ? '?blueprint=' + project.id : '';
    global.history.replaceState(null, '', global.location.pathname + qs);
  }

  /* ----------------------------------------------------------
     Launcher
     ---------------------------------------------------------- */

  function renderResumeList() {
    var list = BP.store.list().slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
    if (!els.resumeList) return;
    if (!list.length) { els.resumeList.innerHTML = ''; return; }
    els.resumeList.innerHTML = '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">My Blueprints</span></div>' +
      list.map(function (bp) {
        var c = BP.completeness(bp);
        return '' +
          '<div class="build-project-row" data-id="' + bp.id + '">' +
            '<div class="build-project-row__meta">' +
              (bp.isSample ? '<span class="badge badge--accent">Sample Organization</span>' : '') +
              '<strong>' + bp.name + '</strong>' +
              '<span class="text-dim text-mono" style="font-size:var(--step--1)">' + c.percent + '% complete &middot; Updated ' + B.formatDate(bp.updatedAt) + '</span>' +
            '</div>' +
            '<div class="build-project-row__actions">' +
              '<button type="button" class="btn btn--secondary" data-open="' + bp.id + '">Open</button>' +
              '<button type="button" class="btn btn--ghost" data-edit="' + bp.id + '">Edit</button>' +
              '<button type="button" class="btn btn--ghost" data-duplicate="' + bp.id + '">Duplicate</button>' +
              '<button type="button" class="btn btn--ghost" data-export="' + bp.id + '">Export</button>' +
              '<button type="button" class="btn btn--ghost" data-delete="' + bp.id + '">Delete</button>' +
            '</div>' +
          '</div>';
      }).join('');

    els.resumeList.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { project = BP.store.get(b.getAttribute('data-open')); enterViewer(); }); });
    els.resumeList.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { project = BP.store.get(b.getAttribute('data-edit')); enterWizard(); }); });
    els.resumeList.querySelectorAll('[data-duplicate]').forEach(function (b) { b.addEventListener('click', function () { BP.store.duplicate(b.getAttribute('data-duplicate')); renderResumeList(); }); });
    els.resumeList.querySelectorAll('[data-export]').forEach(function (b) { b.addEventListener('click', function () { exportBlueprint(BP.store.get(b.getAttribute('data-export'))); }); });
    els.resumeList.querySelectorAll('[data-delete]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (global.confirm('Delete this Blueprint? This cannot be undone.')) { BP.store.remove(b.getAttribute('data-delete')); renderResumeList(); }
      });
    });
  }

  function exportBlueprint(bp) {
    var blob = new Blob([JSON.stringify(bp, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (bp.name || 'blueprint').replace(/[^a-z0-9\-_]+/gi, '-') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importBlueprint(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        parsed.id = BP.newId();
        parsed.name = (parsed.name || 'Imported Blueprint') + ' (Imported)';
        parsed.updatedAt = new Date().toISOString();
        BP.store.save(parsed);
        renderResumeList();
        global.alert('Blueprint imported.');
      } catch (e) {
        global.alert('That file could not be read as a Blueprint export.');
      }
    };
    reader.readAsText(file);
  }

  function init() {
    B = global.OMSBuilder;
    BP = global.OMSBlueprint;

    els.launcher = byId('blueprint-launcher');
    els.wizard = byId('blueprint-wizard');
    els.viewer = byId('blueprint-viewer');
    els.viewerBody = byId('blueprint-viewer-body');
    els.viewerSection = byId('blueprint-viewer-section');
    els.resumeList = byId('bp-resume-list');
    els.progress = byId('builder-progress');
    els.stepBody = byId('builder-step-body');
    els.prev = byId('builder-prev');
    els.next = byId('builder-next');
    els.stepLabel = byId('builder-step-label');
    els.projectName = byId('builder-project-name');

    var newBtn = byId('new-blueprint-btn');
    var sampleBtn = byId('load-sample-blueprint-btn');
    var importInput = byId('import-blueprint-input');
    var exitBtn = byId('builder-exit');
    var viewerExitBtn = byId('viewer-exit');
    var viewerEditBtn = byId('viewer-edit');
    var viewerExportBtn = byId('viewer-export');

    if (newBtn) newBtn.addEventListener('click', function () {
      var name = global.prompt('Name this Blueprint:', 'New Blueprint');
      if (name === null) return;
      project = BP.store.create(name || 'New Blueprint', BP.blankData(), false);
      enterWizard();
    });

    if (sampleBtn) sampleBtn.addEventListener('click', function () {
      project = BP.store.create('Northstar Software — Sample', global.OMSBlueprintSample.build(), true);
      enterViewer();
    });

    if (importInput) importInput.addEventListener('change', function (e) {
      if (e.target.files[0]) importBlueprint(e.target.files[0]);
      e.target.value = '';
    });

    if (exitBtn) exitBtn.addEventListener('click', backToLauncher);
    if (viewerExitBtn) viewerExitBtn.addEventListener('click', backToLauncher);
    if (viewerEditBtn) viewerEditBtn.addEventListener('click', function () { enterWizard(); });
    if (viewerExportBtn) viewerExportBtn.addEventListener('click', function () { if (project) exportBlueprint(project); });

    var params = new URLSearchParams(global.location.search);
    var requestedId = params.get('blueprint');
    var focusType = params.get('focusType');
    var focusLayer = params.get('focusLayer');
    var existing = requestedId ? BP.store.get(requestedId) : null;

    function applyFocus() {
      if (!focusType && !focusLayer) return;
      viewerState.tab = 'fullsystem';
      viewerState.filters = focusType ? { type: focusType } : { layer: focusLayer };
      renderViewer();
    }

    if (existing) {
      project = existing;
      enterViewer();
      applyFocus();
    } else if (focusType || focusLayer) {
      var mostRecent = BP.store.mostRecent();
      if (mostRecent) {
        project = mostRecent;
        enterViewer();
        applyFocus();
      } else {
        backToLauncher();
      }
    } else {
      backToLauncher();
    }
  }

  /* ----------------------------------------------------------
     Viewer: "see the system" experience
     ---------------------------------------------------------- */

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function criticalityOf(item) { return item.criticality || item.priority || item.impact || null; }
  function ownerOf(item) { return item.owner || item.leader || null; }

  function healthBadgeHtml(status) {
    var s = status ? String(status).toLowerCase() : 'unknown';
    return '<span class="health-badge health-badge--' + s + '">' + esc(status || 'Unknown') + '</span>';
  }

  function allObjects(data) {
    var out = [];
    BP.ENTITY_ORDER.forEach(function (type) {
      (data[type] || []).forEach(function (item) { out.push({ type: type, id: item.id, item: item }); });
    });
    return out;
  }

  var OWNER_FIELD_TYPES = ['processes', 'decisions', 'metrics', 'outcomes', 'valueStreams', 'capabilities', 'technology', 'data', 'rhythms', 'governance'];
  function isUnowned(type, item) {
    if (type === 'teams') return !item.leader;
    if (OWNER_FIELD_TYPES.indexOf(type) === -1) return false;
    return !item.owner;
  }

  function riskFlaggedKeys() {
    var flags = BP.systemicRisks(project);
    var keys = {};
    allObjects(project.data).forEach(function (o) {
      var name = BP.entityName(o.type, o.item);
      if (!name || name.length < 3 || name === 'Untitled') return;
      flags.forEach(function (f) { if (f.message.indexOf(name) !== -1) keys[BP.key(o.type, o.id)] = true; });
    });
    return keys;
  }

  function ownershipGapKeys() {
    var flags = BP.ownershipGaps(project);
    var keys = {};
    allObjects(project.data).forEach(function (o) {
      var name = BP.entityName(o.type, o.item);
      flags.forEach(function (f) { if (f.message.indexOf('"' + name + '"') !== -1) keys[BP.key(o.type, o.id)] = true; });
    });
    return keys;
  }

  var QUICK_FILTERS = [
    { value: 'risks', label: 'Systemic Risks' },
    { value: 'gaps', label: 'Ownership Gaps' },
    { value: 'unowned', label: 'Unowned' },
    { value: 'critical', label: 'Critical' }
  ];

  var LAYERS = [
    { id: 'direction', label: 'Direction' },
    { id: 'design', label: 'Design' },
    { id: 'execution', label: 'Execution' },
    { id: 'management', label: 'Management' },
    { id: 'intelligence', label: 'Intelligence' },
    { id: 'evolution', label: 'Evolution' }
  ];
  var HEALTH_RANK = { critical: 4, weak: 3, watch: 2, healthy: 1, unknown: 0 };

  function assessmentSuggestionForLayer(layer) {
    var results = global.OMSData.storage.get('assessment', null);
    if (!results || !results.layerScores || results.layerScores[layer] == null) return null;
    var score = results.layerScores[layer];
    return { score: score, health: BP.suggestedHealthForLayer(score) };
  }

  function stepIndexForType(type) {
    var idx = BP.ENTITY_ORDER.indexOf(type);
    return idx === -1 ? 0 : idx + 1;
  }

  function editObject(type, id) {
    closeInspector();
    project.currentStep = stepIndexForType(type);
    enterWizard();
  }

  function traceFromInspector(type, id, mode) {
    closeInspector();
    viewerState.tab = 'trace';
    viewerState.traceTarget = { type: type, id: id };
    viewerState.traceType = mode;
    renderViewer();
  }

  function focusRelatedKeys(type, id) {
    var keys = {};
    keys[BP.key(type, id)] = true;
    BP.directDependencies(project, type, id).forEach(function (d) { keys[BP.key(d.node.type, d.node.id)] = true; });
    BP.directlyEnables(project, type, id).forEach(function (d) { keys[BP.key(d.node.type, d.node.id)] = true; });
    return keys;
  }

  function objectCardHtml(type, item, opts) {
    opts = opts || {};
    var name = BP.entityName(type, item);
    var health = BP.getHealth(project, type, item.id);
    var crit = criticalityOf(item);
    var owner = ownerOf(item);
    return '<button type="button" class="bp-object-card' + (opts.focusMatch ? ' is-focus-match' : '') + '" data-type="' + type + '" data-id="' + item.id + '">' +
      '<span class="bp-object-card__name">' + esc(name) + '</span>' +
      '<span class="bp-object-card__meta">' +
        (opts.showType ? '<span class="text-dim text-mono" style="font-size:10px;text-transform:uppercase">' + esc(BP.ENTITY_META[type].label) + '</span>' : '') +
        healthBadgeHtml(health) +
        (crit ? '<span class="badge badge--outline">' + esc(crit) + '</span>' : '') +
        (owner ? '<span class="text-dim" style="font-size:var(--step--1)">' + esc(owner) + '</span>' : '') +
      '</span>' +
    '</button>';
  }

  function bindObjectCards(root) {
    root.querySelectorAll('.bp-object-card[data-type]').forEach(function (el) {
      el.addEventListener('click', function () { openInspector(el.getAttribute('data-type'), el.getAttribute('data-id')); });
    });
  }

  function traceNodeHtml(n) {
    var name = nameOf(project.data, n.node.type, n.node.id) || BP.ENTITY_META[n.node.type].label;
    return '<button type="button" class="trace-node" data-node-type="' + n.node.type + '" data-node-id="' + n.node.id + '">' +
      '<span>' + esc(name) + '</span>' +
      '<span class="trace-node__relation">' + esc(n.relation) + '</span>' +
    '</button>';
  }

  function bindTraceNodes(root) {
    root.querySelectorAll('[data-node-type]').forEach(function (el) {
      el.addEventListener('click', function () { openInspector(el.getAttribute('data-node-type'), el.getAttribute('data-node-id')); });
    });
  }

  function renderFilterGroup(mount, options, activeValue, onSelect) {
    mount.innerHTML = options.map(function (opt) {
      return '<button type="button" class="resource-filter' + (opt.value === activeValue ? ' is-active' : '') + '" data-value="' + opt.value + '">' + esc(opt.label) + '</button>';
    }).join('');
    mount.querySelectorAll('.resource-filter').forEach(function (btn) {
      btn.addEventListener('click', function () { onSelect(btn.getAttribute('data-value')); });
    });
  }

  function saveFinding(flag, sourceType) {
    project.data.findings = project.data.findings || [];
    if (project.data.findings.some(function (f) { return f.message === flag.message; })) {
      global.alert('Already saved as a finding.');
      return;
    }
    project.data.findings.push({
      id: BP.newId('find'), type: flag.rule, severity: flag.severity, message: flag.message,
      why: flag.why, sourceType: sourceType, savedAt: new Date().toISOString()
    });
    BP.store.save(project);
    global.alert('Saved as a finding — findings will feed a future Workbench.');
  }

  function renderFlagList(mount, flags, sourceType) {
    if (!flags.length) {
      mount.innerHTML = '<p class="callout">No structural risks were detected by the rules below. That does not guarantee the design is right &mdash; it means it passed these specific checks.</p>';
      return;
    }
    var findings = project.data.findings || [];
    mount.innerHTML = flags.map(function (flag, i) {
      var saved = findings.some(function (f) { return f.message === flag.message; });
      var sevLabel = flag.severity === 'critical' ? 'Critical' : flag.severity === 'warning' ? 'Warning' : 'Worth Noting';
      return '' +
        '<div class="risk-flag risk-flag--' + flag.severity + '">' +
          '<div class="risk-flag__header">' +
            '<span class="badge risk-flag__badge risk-flag__badge--' + flag.severity + '">' + sevLabel + '</span>' +
            '<span class="risk-flag__rule">' + esc(flag.rule) + '</span>' +
          '</div>' +
          '<p class="risk-flag__message">' + esc(flag.message) + '</p>' +
          (flag.why ? '<p class="risk-flag__why text-dim">Rule: ' + esc(flag.why) + '</p>' : '') +
          '<button type="button" class="btn btn--ghost" data-save-finding="' + i + '"' + (saved ? ' disabled' : '') + ' style="margin-top:var(--space-2)">' + (saved ? 'Saved as Finding' : 'Save Finding') + '</button>' +
        '</div>';
    }).join('');
    mount.querySelectorAll('[data-save-finding]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        saveFinding(flags[parseInt(btn.getAttribute('data-save-finding'), 10)], sourceType);
        renderFlagList(mount, flags, sourceType);
      });
    });
  }

  var fullSystemListRefresh = null;

  function renderOverviewTab(mount) {
    var data = project.data;
    var completeness = BP.completeness(project);
    var findingsCount = BP.systemicRisks(project).length + BP.ownershipGaps(project).length;
    var mappingLabel = (MAPPING_OPTIONS.filter(function (m) { return m.value === data.meta.mapping; })[0] || {}).label || 'Not set';

    mount.innerHTML =
      '<div class="card" style="padding:var(--space-5);margin-bottom:var(--space-6);display:flex;flex-wrap:wrap;gap:var(--space-6);align-items:center">' +
        '<div class="completeness-ring">' +
          '<span class="completeness-ring__value">' + completeness.percent + '%</span>' +
          '<span class="text-muted">Blueprint Completeness</span>' +
        '</div>' +
        '<div style="flex:1;min-width:220px">' +
          '<p class="text-dim text-mono" style="font-size:var(--step--1);margin:0 0 var(--space-2)">' + esc(mappingLabel) + (data.meta.customer ? ' &middot; For ' + esc(data.meta.customer) : '') + '</p>' +
          (data.meta.purpose ? '<p style="margin:0">' + esc(data.meta.purpose) + '</p>' : '<p class="text-dim" style="margin:0">No primary purpose recorded yet.</p>') +
        '</div>' +
      '</div>' +
      (completeness.gaps.length ? '<p class="text-dim" style="margin-bottom:var(--space-5)">' + completeness.gaps.slice(0, 3).join(' ') + (completeness.gaps.length > 3 ? ' (+' + (completeness.gaps.length - 3) + ' more)' : '') + '</p>' : '') +
      (findingsCount ? '<div class="callout" style="margin-bottom:var(--space-6)"><strong>' + findingsCount + ' finding' + (findingsCount === 1 ? '' : 's') + '</strong> across systemic risks and ownership gaps. <button type="button" class="btn btn--ghost" id="overview-see-risks" style="padding:0;text-decoration:underline">See Health &amp; Risk &rarr;</button></div>' : '') +
      '<div class="bp-chain-stack" id="overview-chain"></div>';

    var seeRisks = mount.querySelector('#overview-see-risks');
    if (seeRisks) seeRisks.addEventListener('click', function () { viewerState.tab = 'health'; renderViewer(); });

    var chainMount = mount.querySelector('#overview-chain');
    chainMount.innerHTML = BP.ENTITY_ORDER.map(function (type) {
      var list = data[type] || [];
      var isOpen = viewerState.expandedLayers[type] !== undefined ? viewerState.expandedLayers[type] : (type === 'outcomes' || type === 'capabilities' || type === 'valueStreams');
      return '' +
        '<div class="bp-chain-section">' +
          '<div class="bp-chain-section__header">' +
            '<button type="button" class="btn btn--ghost" data-toggle-layer="' + type + '" style="padding:0">' + (isOpen ? '▾ ' : '▸ ') + esc(BP.ENTITY_META[type].plural) + '</button>' +
            '<span class="text-dim text-mono" style="font-size:var(--step--1)">' + list.length + '</span>' +
          '</div>' +
          (isOpen ? '<div class="bp-object-list">' + (list.length ? list.map(function (item) { return objectCardHtml(type, item); }).join('') : '<p class="text-dim">No ' + esc(BP.ENTITY_META[type].gapNoun) + ' been mapped yet.</p>') + '</div>' : '') +
        '</div>';
    }).join('');

    chainMount.querySelectorAll('[data-toggle-layer]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = btn.getAttribute('data-toggle-layer');
        var current = viewerState.expandedLayers[t] !== undefined ? viewerState.expandedLayers[t] : (t === 'outcomes' || t === 'capabilities' || t === 'valueStreams');
        viewerState.expandedLayers[t] = !current;
        renderOverviewTab(mount);
      });
    });
    bindObjectCards(chainMount);
  }

  function renderFullSystemTab(mount) {
    var data = project.data;
    viewerState.filters = viewerState.filters || {};

    var focusName = viewerState.focus ? (nameOf(data, viewerState.focus.type, viewerState.focus.id) || 'this object') : '';
    var focusBanner = viewerState.focus ?
      '<div class="callout" style="margin-bottom:var(--space-4)">Focused on <strong>' + esc(focusName) + '</strong> &mdash; related objects are highlighted, everything else is dimmed. <button type="button" class="btn btn--ghost" id="clear-focus-btn" style="padding:0;text-decoration:underline">Clear focus</button></div>' : '';
    var layerBanner = viewerState.filters.layer ?
      '<div class="callout" style="margin-bottom:var(--space-4)">Filtered to the <strong>' + esc(viewerState.filters.layer) + '</strong> layer. <button type="button" class="btn btn--ghost" id="clear-layer-btn" style="padding:0;text-decoration:underline">Clear layer filter</button></div>' : '';

    mount.innerHTML = focusBanner + layerBanner +
      '<div class="bp-filter-row" id="type-filter-row"></div>' +
      '<div class="bp-filter-row" id="quick-filter-row"></div>' +
      '<div class="bp-object-list" id="fullsystem-list"></div>';

    var clearFocus = mount.querySelector('#clear-focus-btn');
    if (clearFocus) clearFocus.addEventListener('click', function () { viewerState.focus = null; renderFullSystemTab(mount); });
    var clearLayer = mount.querySelector('#clear-layer-btn');
    if (clearLayer) clearLayer.addEventListener('click', function () { delete viewerState.filters.layer; renderFullSystemTab(mount); });

    var typeOptions = [{ value: '', label: 'All Types' }].concat(BP.ENTITY_ORDER.map(function (t) { return { value: t, label: BP.ENTITY_META[t].plural }; }));
    renderFilterGroup(mount.querySelector('#type-filter-row'), typeOptions, viewerState.filters.type || '', function (v) { viewerState.filters.type = v; renderList(); });

    var quickOptions = [{ value: '', label: 'All Objects' }].concat(QUICK_FILTERS);
    renderFilterGroup(mount.querySelector('#quick-filter-row'), quickOptions, viewerState.filters.quick || '', function (v) { viewerState.filters.quick = v; renderList(); });

    function renderList() {
      renderFilterGroup(mount.querySelector('#type-filter-row'), typeOptions, viewerState.filters.type || '', function (v) { viewerState.filters.type = v; renderList(); });
      renderFilterGroup(mount.querySelector('#quick-filter-row'), quickOptions, viewerState.filters.quick || '', function (v) { viewerState.filters.quick = v; renderList(); });

      var listEl = mount.querySelector('#fullsystem-list');
      var q = (viewerState.query || '').toLowerCase();
      var typeFilter = viewerState.filters.type || '';
      var layerFilter = viewerState.filters.layer || '';
      var quick = viewerState.filters.quick || '';
      var riskKeys = quick === 'risks' ? riskFlaggedKeys() : null;
      var gapKeys = quick === 'gaps' ? ownershipGapKeys() : null;

      var matches = allObjects(data).filter(function (o) {
        if (typeFilter && o.type !== typeFilter) return false;
        if (layerFilter && BP.ENTITY_META[o.type].layer !== layerFilter) return false;
        if (q) {
          var name = (BP.entityName(o.type, o.item) || '').toLowerCase();
          var owner = (ownerOf(o.item) || '').toLowerCase();
          var purpose = (o.item.purpose || o.item.description || '').toLowerCase();
          if (name.indexOf(q) === -1 && owner.indexOf(q) === -1 && purpose.indexOf(q) === -1) return false;
        }
        if (quick === 'critical') { var c = criticalityOf(o.item); if (c !== 'High' && c !== 'Critical') return false; }
        if (quick === 'unowned' && !isUnowned(o.type, o.item)) return false;
        if (quick === 'risks' && !riskKeys[BP.key(o.type, o.id)]) return false;
        if (quick === 'gaps' && !gapKeys[BP.key(o.type, o.id)]) return false;
        return true;
      });

      var focus = viewerState.focus;
      listEl.className = 'bp-object-list' + (focus ? ' is-focused' : '');
      if (!matches.length) {
        listEl.innerHTML = '<p class="text-dim">No objects match these filters yet.</p>';
        return;
      }
      var relatedKeys = focus ? focusRelatedKeys(focus.type, focus.id) : null;
      listEl.innerHTML = matches.map(function (o) {
        var isMatch = relatedKeys && relatedKeys[BP.key(o.type, o.id)];
        return objectCardHtml(o.type, o.item, { showType: !typeFilter, focusMatch: isMatch });
      }).join('');
      bindObjectCards(listEl);
    }

    fullSystemListRefresh = renderList;
    renderList();
  }

  function renderHeatmap(mount) {
    var data = project.data;
    mount.innerHTML = LAYERS.map(function (layer) {
      var types = BP.ENTITY_ORDER.filter(function (t) { return BP.ENTITY_META[t].layer === layer.id; });
      var count = types.reduce(function (sum, t) { return sum + (data[t] || []).length; }, 0);
      var worst = 'unknown';
      types.forEach(function (t) {
        (data[t] || []).forEach(function (item) {
          var h = (BP.getHealth(project, t, item.id) || 'unknown').toLowerCase();
          if ((HEALTH_RANK[h] || 0) > (HEALTH_RANK[worst] || 0)) worst = h;
        });
      });
      var isHealthView = viewerState.heatmapView === 'health';
      var status = isHealthView ? worst : 'unknown';
      var suggestion = assessmentSuggestionForLayer(layer.id);
      return '<button type="button" class="heatmap-cell heatmap-cell--' + status + '" data-layer="' + layer.id + '">' +
        '<strong style="display:block;margin-bottom:var(--space-2)">' + layer.label + '</strong>' +
        '<span class="text-dim text-mono" style="font-size:var(--step--1)">' + count + ' object' + (count === 1 ? '' : 's') + '</span>' +
        (isHealthView ? '<div style="margin-top:var(--space-2)">' + healthBadgeHtml(worst === 'unknown' ? null : worst) + '</div>' : '') +
        (!isHealthView && suggestion ? '<div class="text-dim" style="font-size:10px;text-transform:uppercase;margin-top:var(--space-2)" title="Based on your Assessment score of ' + suggestion.score + '/5 for this layer. This suggests, but does not prove, how any one component here is functioning.">Suggested Health Signal: ' + esc(suggestion.health) + '</div>' : '') +
      '</button>';
    }).join('');
    mount.querySelectorAll('[data-layer]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        viewerState.tab = 'fullsystem';
        viewerState.filters = { layer: btn.getAttribute('data-layer') };
        renderViewer();
      });
    });
  }

  function renderHealthTab(mount) {
    var risks = BP.systemicRisks(project);
    var gaps = BP.ownershipGaps(project);
    var isHealthView = viewerState.heatmapView === 'health';

    mount.innerHTML =
      '<div style="margin-bottom:var(--space-6)">' +
        '<div class="bp-chain-section__header">' +
          '<span class="eyebrow">System Heatmap</span>' +
          '<div class="bp-tabs" id="heatmap-toggle">' +
            '<button type="button" data-view="blueprint" class="' + (!isHealthView ? 'is-active' : '') + '">Blueprint View</button>' +
            '<button type="button" data-view="health" class="' + (isHealthView ? 'is-active' : '') + '">Health View</button>' +
          '</div>' +
        '</div>' +
        '<p class="text-dim" style="margin:var(--space-2) 0 var(--space-4)">Health View shows the worst manually-set health signal in each OMS layer. Layers with no signals set show as Unknown &mdash; that is not the same as healthy.</p>' +
        '<div class="heatmap-grid" id="heatmap-grid"></div>' +
      '</div>' +
      '<div style="margin-bottom:var(--space-6)">' +
        '<h3>Systemic Risks</h3>' +
        '<p class="lede">Deterministic checks over the relationships you’ve mapped. These are structural signals, not a diagnosis.</p>' +
        '<div id="risk-flags"></div>' +
      '</div>' +
      '<div><h3>Ownership &amp; Clarity Gaps</h3><div id="gap-flags"></div></div>';

    renderHeatmap(mount.querySelector('#heatmap-grid'));
    mount.querySelectorAll('#heatmap-toggle [data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () { viewerState.heatmapView = btn.getAttribute('data-view'); renderHealthTab(mount); });
    });
    renderFlagList(mount.querySelector('#risk-flags'), risks, 'systemic-risk');
    renderFlagList(mount.querySelector('#gap-flags'), gaps, 'ownership-gap');
  }

  function renderTraceResult(mount, target, mode) {
    var name = nameOf(project.data, target.type, target.id) || 'Untitled';
    var header = '<p class="lede" style="margin-bottom:var(--space-5)">Focused on <strong>' + esc(name) + '</strong> (' + esc(BP.ENTITY_META[target.type].label) + ')</p>';

    if (mode === 'blast') {
      var tiers = BP.blastRadius(project, target.type, target.id);
      mount.innerHTML = header +
        '<p class="callout">What could be affected if this fails? This is dependency-based impact analysis, not a prediction.</p>' +
        (tiers.length ? tiers.map(function (tier) {
          return '<div class="trace-tier"><span class="trace-tier__label">' + esc(tier.label) + '</span><div class="trace-node-list">' +
            tier.nodes.map(traceNodeHtml).join('') + '</div></div>';
        }).join('') : '<p class="text-dim">Nothing downstream is connected to this object yet.</p>');
    } else {
      var tiersFn = mode === 'downstream' ? BP.traceDownstream : BP.traceUpstream;
      var t = tiersFn(project, target.type, target.id, 4);
      var explain = mode === 'downstream'
        ? 'Systemic consequences, walking forward from this object.'
        : 'What can cause a problem here, walking backward. The place where failure appears is often not the place where failure begins.';
      mount.innerHTML = header + '<p class="callout">' + explain + '</p>' +
        (t.length ? '<div class="trace-chain">' + t.map(function (tier, i) {
          var names = tier.nodes.map(function (n) { return nameOf(project.data, n.node.type, n.node.id) || BP.ENTITY_META[n.node.type].label; }).join(', ');
          return (i > 0 ? '<span class="trace-chain__arrow">' + (mode === 'downstream' ? '↓ affects' : '↑ caused by') + '</span>' : '') +
            '<div class="trace-chain__node">' + esc(names) + '</div>';
        }).join('') + '</div>' : '<p class="text-dim">Nothing ' + (mode === 'downstream' ? 'downstream' : 'upstream') + ' is connected to this object yet.</p>');
    }
    bindTraceNodes(mount);
  }

  function renderTraceTab(mount) {
    var data = project.data;
    var mode = viewerState.traceType || 'blast';

    var allOpts = BP.ENTITY_ORDER.reduce(function (acc, type) {
      return acc.concat((data[type] || []).map(function (item) {
        return { type: type, id: item.id, label: BP.ENTITY_META[type].label + ': ' + BP.entityName(type, item) };
      }));
    }, []);

    var target = viewerState.traceTarget;
    if ((!target || !BP.byId(data[target.type], target.id)) && allOpts.length) target = { type: allOpts[0].type, id: allOpts[0].id };
    viewerState.traceTarget = target;

    mount.innerHTML =
      '<div class="builder-field-grid" style="margin-bottom:var(--space-5)">' +
        '<div class="builder-field builder-field--wide"><label class="builder-field__label">Focus object</label>' +
          '<select class="builder-field__input" id="trace-target-select">' +
            (allOpts.length ? allOpts.map(function (o) {
              return '<option value="' + BP.key(o.type, o.id) + '"' + (target && o.type === target.type && o.id === target.id ? ' selected' : '') + '>' + esc(o.label) + '</option>';
            }).join('') : '<option value="">Add some objects first</option>') +
          '</select>' +
        '</div>' +
      '</div>' +
      '<div class="bp-tabs" id="trace-mode-tabs" style="margin-bottom:var(--space-5)">' +
        '<button type="button" data-mode="blast" class="' + (mode === 'blast' ? 'is-active' : '') + '">Show Blast Radius</button>' +
        '<button type="button" data-mode="downstream" class="' + (mode === 'downstream' ? 'is-active' : '') + '">Trace Downstream</button>' +
        '<button type="button" data-mode="upstream" class="' + (mode === 'upstream' ? 'is-active' : '') + '">Trace Upstream</button>' +
      '</div>' +
      '<div id="trace-result"></div>';

    var select = mount.querySelector('#trace-target-select');
    if (select) select.addEventListener('change', function (e) {
      var idx = e.target.value.indexOf(':');
      viewerState.traceTarget = { type: e.target.value.slice(0, idx), id: e.target.value.slice(idx + 1) };
      renderTraceTab(mount);
    });
    mount.querySelectorAll('#trace-mode-tabs [data-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () { viewerState.traceType = btn.getAttribute('data-mode'); renderTraceTab(mount); });
    });

    var resultMount = mount.querySelector('#trace-result');
    if (!target) { resultMount.innerHTML = '<p class="text-dim">Add objects to this Blueprint to trace their connections.</p>'; return; }
    renderTraceResult(resultMount, target, mode);
  }

  function renderDvaList(mount) {
    var diffs = project.data.designedActualDifferences || [];
    if (!diffs.length) { mount.innerHTML = '<p class="text-dim">No differences recorded yet.</p>'; return; }
    mount.innerHTML = diffs.map(function (d, i) {
      var name = nameOf(project.data, d.type, d.objectId) || 'Untitled';
      return '' +
        '<div class="dva-row">' +
          '<div class="dva-row__col"><h5>Designed &mdash; ' + esc(name) + '</h5><p>' + esc(d.designed) + '</p></div>' +
          '<div class="dva-row__col dva-row__col--actual"><h5>Actual</h5><p>' + esc(d.actual) + '</p>' +
            '<button type="button" class="btn btn--ghost" data-remove-dva="' + i + '" style="margin-top:var(--space-2)">Remove</button>' +
          '</div>' +
        '</div>';
    }).join('');
    mount.querySelectorAll('[data-remove-dva]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        project.data.designedActualDifferences.splice(parseInt(btn.getAttribute('data-remove-dva'), 10), 1);
        BP.store.save(project);
        renderDvaList(mount);
      });
    });
  }

  function renderDvaTab(mount) {
    var data = project.data;
    var gap = BP.designRealityGap(project);
    var sevClass = (gap.level === 'Critical' || gap.level === 'High') ? 'critical' : (gap.level === 'Moderate' ? 'warning' : 'info');
    var allOpts = BP.ENTITY_ORDER.reduce(function (acc, type) {
      return acc.concat((data[type] || []).map(function (item) { return { value: BP.key(type, item.id), label: BP.ENTITY_META[type].label + ': ' + BP.entityName(type, item) }; }));
    }, []);

    mount.innerHTML =
      '<div class="card" style="padding:var(--space-5);margin-bottom:var(--space-6)">' +
        '<span class="badge risk-flag__badge--' + sevClass + '">' + esc(gap.level) + '</span>' +
        ' <strong>Design/Reality Gap Score</strong>' +
        '<p class="text-dim" style="margin-top:var(--space-2)">Based on ' + gap.count + ' explicitly entered difference' + (gap.count === 1 ? '' : 's') + ' between how objects were designed and how they actually operate. This is not a scientifically validated score &mdash; it only reflects what you’ve entered.</p>' +
      '</div>' +
      '<h3>Record a Design/Reality Difference</h3>' +
      (allOpts.length ? '' +
        '<div class="builder-field-grid" style="margin-bottom:var(--space-4)">' +
          '<div class="builder-field builder-field--wide"><label class="builder-field__label">Object</label>' +
            '<select class="builder-field__input" id="dva-object-select">' + allOpts.map(function (o) { return '<option value="' + o.value + '">' + esc(o.label) + '</option>'; }).join('') + '</select></div>' +
          '<div class="builder-field"><label class="builder-field__label">Designed state</label><textarea class="builder-field__input builder-field__input--area" id="dva-designed" rows="2"></textarea></div>' +
          '<div class="builder-field"><label class="builder-field__label">Actual state</label><textarea class="builder-field__input builder-field__input--area" id="dva-actual" rows="2"></textarea></div>' +
        '</div>' +
        '<button type="button" class="btn btn--secondary" id="dva-add-btn" style="margin-bottom:var(--space-6)">Add Entry</button>'
        : '<p class="text-dim" style="margin-bottom:var(--space-6)">Add some objects to this Blueprint first.</p>') +
      '<div id="dva-list"></div>';

    var addBtn = mount.querySelector('#dva-add-btn');
    if (addBtn) addBtn.addEventListener('click', function () {
      var sel = mount.querySelector('#dva-object-select').value;
      var designed = mount.querySelector('#dva-designed').value.trim();
      var actual = mount.querySelector('#dva-actual').value.trim();
      if (!sel || !designed || !actual) { global.alert('Choose an object and fill in both designed and actual state.'); return; }
      var idx = sel.indexOf(':');
      data.designedActualDifferences = data.designedActualDifferences || [];
      data.designedActualDifferences.push({ id: BP.newId('dva'), type: sel.slice(0, idx), objectId: sel.slice(idx + 1), designed: designed, actual: actual, recordedAt: new Date().toISOString() });
      BP.store.save(project);
      renderDvaTab(mount);
    });

    renderDvaList(mount.querySelector('#dva-list'));
  }

  function closeInspector() {
    var overlay = byId('inspector-overlay');
    var panel = byId('inspector-panel');
    if (overlay) overlay.remove();
    if (panel) panel.remove();
  }

  function renderInspectorContent(panel, type, item) {
    var name = BP.entityName(type, item);
    var health = BP.getHealth(project, type, item.id);
    var deps = BP.directDependencies(project, type, item.id);
    var enables = BP.directlyEnables(project, type, item.id);
    var allFlags = BP.systemicRisks(project).concat(BP.ownershipGaps(project));
    var relatedFlags = allFlags.filter(function (f) { return name && name !== 'Untitled' && f.message.indexOf(name) !== -1; });
    var diffs = (project.data.designedActualDifferences || []).filter(function (d) { return d.type === type && d.objectId === item.id; });
    var purpose = item.purpose || item.description || item.expectation || item.whatIsGoverned || '';
    var owner = ownerOf(item);
    var maturity = item.maturity || '';
    var suggestion = assessmentSuggestionForLayer(BP.ENTITY_META[type].layer);

    panel.innerHTML =
      '<button type="button" class="inspector-panel__close" id="inspector-close">&times;</button>' +
      '<span class="text-mono text-dim" style="font-size:var(--step--1);text-transform:uppercase">' + esc(BP.ENTITY_META[type].label) + '</span>' +
      '<h3 style="margin-top:var(--space-1)">' + esc(name) + '</h3>' +
      (purpose ? '<p>' + esc(purpose) + '</p>' : '') +
      '<div class="bp-object-card__meta" style="margin:var(--space-4) 0">' +
        healthBadgeHtml(health) +
        (owner ? '<span class="badge badge--outline">Owner: ' + esc(owner) + '</span>' : '') +
        (maturity ? '<span class="badge badge--outline">Maturity: ' + esc(maturity) + '</span>' : '') +
      '</div>' +
      '<div class="builder-field" style="margin-bottom:var(--space-5)"><label class="builder-field__label">Health signal</label>' +
        '<select class="builder-field__input" id="inspector-health-select">' +
          ['', 'Healthy', 'Watch', 'Weak', 'Critical'].map(function (h) { return '<option value="' + h + '"' + ((health || '') === h ? ' selected' : '') + '>' + (h || 'Unknown / Not Set') + '</option>'; }).join('') +
        '</select>' +
        '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-1)">Set manually. Assessment data may suggest a signal below, but it will never silently override what you set here.</p>' +
        (suggestion ? '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-2)">Suggested Health Signal: <strong>' + esc(suggestion.health) + '</strong> &mdash; based on your Assessment score of ' + suggestion.score + '/5 for the ' + esc(BP.ENTITY_META[type].layer) + ' layer as a whole. That does not prove this specific ' + esc(BP.ENTITY_META[type].label.toLowerCase()) + ' is weak; it is one input to weigh alongside what you know directly.</p>' : '') +
      '</div>' +
      '<h5 class="text-mono text-dim" style="text-transform:uppercase;font-size:var(--step--1)">Depends On</h5>' +
      (deps.length ? '<div class="trace-node-list" style="margin-bottom:var(--space-5)">' + deps.map(traceNodeHtml).join('') + '</div>' : '<p class="text-dim" style="margin-bottom:var(--space-5)">Nothing explicitly linked yet.</p>') +
      '<h5 class="text-mono text-dim" style="text-transform:uppercase;font-size:var(--step--1)">What It Enables</h5>' +
      (enables.length ? '<div class="trace-node-list" style="margin-bottom:var(--space-5)">' + enables.map(traceNodeHtml).join('') + '</div>' : '<p class="text-dim" style="margin-bottom:var(--space-5)">Nothing explicitly linked yet.</p>') +
      (relatedFlags.length ? '<h5 class="text-mono text-dim" style="text-transform:uppercase;font-size:var(--step--1)">Risks</h5><div style="margin-bottom:var(--space-5)">' + relatedFlags.map(function (f) { return '<p class="risk-flag__message" style="margin:0 0 var(--space-2)">' + esc(f.message) + '</p>'; }).join('') + '</div>' : '') +
      (diffs.length ? '<h5 class="text-mono text-dim" style="text-transform:uppercase;font-size:var(--step--1)">Designed vs Actual</h5>' + diffs.map(function (d) {
        return '<div class="dva-row"><div class="dva-row__col"><h5>Designed</h5><p>' + esc(d.designed) + '</p></div><div class="dva-row__col dva-row__col--actual"><h5>Actual</h5><p>' + esc(d.actual) + '</p></div></div>';
      }).join('') : '') +
      '<h5 class="text-mono text-dim" style="text-transform:uppercase;font-size:var(--step--1);margin-top:var(--space-5)">Related OMS Resource / Builder / Diagnostic</h5>' +
      '<p class="text-dim">Not yet connected in this Blueprint &mdash; coming in a later iteration.</p>' +
      '<div class="inspector-panel__actions">' +
        '<button type="button" class="btn btn--secondary" id="insp-edit">Edit</button>' +
        '<button type="button" class="btn btn--secondary" id="insp-focus">Focus</button>' +
        '<button type="button" class="btn btn--ghost" id="insp-trace-up">Trace Upstream</button>' +
        '<button type="button" class="btn btn--ghost" id="insp-trace-down">Trace Downstream</button>' +
        '<button type="button" class="btn btn--ghost" id="insp-blast">Show Blast Radius</button>' +
      '</div>';

    panel.querySelector('#inspector-close').addEventListener('click', closeInspector);
    panel.querySelector('#inspector-health-select').addEventListener('change', function (e) {
      BP.setHealth(project, type, item.id, e.target.value || null);
      BP.store.save(project);
    });
    bindTraceNodes(panel);
    panel.querySelector('#insp-edit').addEventListener('click', function () { editObject(type, item.id); });
    panel.querySelector('#insp-focus').addEventListener('click', function () {
      viewerState.focus = { type: type, id: item.id };
      viewerState.tab = 'fullsystem';
      closeInspector();
      renderViewer();
    });
    panel.querySelector('#insp-trace-up').addEventListener('click', function () { traceFromInspector(type, item.id, 'upstream'); });
    panel.querySelector('#insp-trace-down').addEventListener('click', function () { traceFromInspector(type, item.id, 'downstream'); });
    panel.querySelector('#insp-blast').addEventListener('click', function () { traceFromInspector(type, item.id, 'blast'); });
  }

  function openInspector(type, id) {
    var item = BP.byId(project.data[type], id);
    if (!item) return;
    closeInspector();
    var overlay = document.createElement('div');
    overlay.className = 'inspector-overlay';
    overlay.id = 'inspector-overlay';
    overlay.addEventListener('click', closeInspector);
    var panel = document.createElement('div');
    panel.className = 'inspector-panel';
    panel.id = 'inspector-panel';
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    renderInspectorContent(panel, type, item);
  }

  var VIEWER_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'fullsystem', label: 'Full System' },
    { id: 'health', label: 'Health & Risk' },
    { id: 'trace', label: 'Trace & Blast Radius' },
    { id: 'dva', label: 'Designed vs Actual' }
  ];

  function renderViewer() {
    if (!project || !els.viewerBody) return;
    viewerState.expandedLayers = viewerState.expandedLayers || {};

    els.viewerBody.innerHTML =
      '<div class="bp-toolbar">' +
        '<input type="search" class="search-input" id="bp-search" placeholder="Search this Blueprint (name, owner, purpose)&hellip;" value="' + esc(viewerState.query || '') + '">' +
        '<div class="bp-tabs" id="bp-tabs"></div>' +
      '</div>' +
      '<div id="bp-tab-body"></div>';

    var tabsEl = els.viewerBody.querySelector('#bp-tabs');
    tabsEl.innerHTML = VIEWER_TABS.map(function (t) {
      return '<button type="button" data-tab="' + t.id + '" class="' + (viewerState.tab === t.id ? 'is-active' : '') + '">' + t.label + '</button>';
    }).join('');
    tabsEl.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { viewerState.tab = btn.getAttribute('data-tab'); renderViewer(); });
    });

    var searchInput = els.viewerBody.querySelector('#bp-search');
    searchInput.addEventListener('input', function (e) {
      var val = e.target.value;
      viewerState.query = val;
      if (viewerState.tab !== 'fullsystem') {
        viewerState.tab = 'fullsystem';
        renderViewer();
        var newInput = els.viewerBody.querySelector('#bp-search');
        if (newInput) { newInput.focus(); newInput.setSelectionRange(val.length, val.length); }
      } else if (fullSystemListRefresh) {
        fullSystemListRefresh();
      }
    });

    var tabBody = els.viewerBody.querySelector('#bp-tab-body');
    fullSystemListRefresh = null;
    if (viewerState.tab === 'fullsystem') renderFullSystemTab(tabBody);
    else if (viewerState.tab === 'health') renderHealthTab(tabBody);
    else if (viewerState.tab === 'trace') renderTraceTab(tabBody);
    else if (viewerState.tab === 'dva') renderDvaTab(tabBody);
    else renderOverviewTab(tabBody);
  }

  global.OMSBlueprintPage = { init: init, get project() { return project; }, get viewerState() { return viewerState; } };
})(window);
