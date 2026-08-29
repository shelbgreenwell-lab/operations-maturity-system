/*
 * Operations Maturity System
 * Process Architect.
 *
 * Helps a user design a complete operational process — trigger,
 * inputs, sequential stages, handoffs, decision points, exception
 * paths, controls, metrics, and governance — rather than simply
 * writing an SOP. Ends with a builder-specific maturity snapshot,
 * a deterministic risk scan, and a generated process map.
 *
 * Drives js/builder-core.js. Page shell lives in pages/process-architect.html.
 */

(function (global) {
  'use strict';

  var B = null;

  var CRITICALITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];
  var YES_NO = ['Yes', 'No'];
  var METRIC_TYPES = ['Outcome', 'Quality', 'Speed / Cycle-Time', 'Efficiency', 'Exception', 'Capacity'];

  function stageNames(project) { return (project.data.stages || []).map(function (s) { return s.name; }).filter(Boolean); }
  function stageOptions(project) { return ['Before any stage'].concat(stageNames(project)); }

  /* ----------------------------------------------------------
     Process Maturity Snapshot (builder-specific, not the org score)
     ---------------------------------------------------------- */

  function maturitySnapshot(d) {
    var header = d.header || {};
    var stages = d.stages || [];
    var handoffs = d.handoffs || [];
    var exceptions = d.exceptions || [];
    var controls = d.controls || [];
    var metrics = d.metrics || [];
    var governance = d.governance || {};

    function level(strong, developing) { return strong ? 'strong' : (developing ? 'developing' : 'weak'); }

    var ownership = level(
      !!header.owner && stages.length > 0 && stages.every(function (s) { return s.owner; }),
      !!header.owner
    );

    var repeatability = level(
      stages.length >= 2 && stages.every(function (s) { return s.action && s.output; }),
      stages.length >= 1
    );

    var stagesNeedingHandoff = stages.filter(function (s) { return s.handoffRequired === 'Yes'; }).length;
    var handoffLevel = stagesNeedingHandoff === 0
      ? 'strong'
      : level(handoffs.length >= stagesNeedingHandoff && handoffs.every(function (h) { return h.acceptanceCriteria; }), handoffs.length > 0);

    var exceptionHandling = level(exceptions.length >= 2, exceptions.length === 1);
    var controlsLevel = level(controls.length >= 2, controls.length === 1);
    var measurement = level(
      metrics.length >= 2 && metrics.every(function (m) { return m.decisionSupported; }),
      metrics.length >= 1
    );
    var governanceLevel = level(!!governance.reviewer && !!governance.cadence, !!governance.reviewer || !!governance.cadence);
    var resilience = level(
      exceptionHandling === 'strong' && controlsLevel === 'strong',
      exceptionHandling !== 'weak' || controlsLevel !== 'weak'
    );

    return [
      { dimension: 'Ownership', level: ownership },
      { dimension: 'Repeatability', level: repeatability },
      { dimension: 'Handoffs', level: handoffLevel },
      { dimension: 'Exception Handling', level: exceptionHandling },
      { dimension: 'Controls', level: controlsLevel },
      { dimension: 'Measurement', level: measurement },
      { dimension: 'Governance', level: governanceLevel },
      { dimension: 'Resilience', level: resilience }
    ];
  }

  /* ----------------------------------------------------------
     Deterministic risk rule engine
     ---------------------------------------------------------- */

  function analyze(d) {
    var flags = [];
    var header = d.header || {};
    var stages = d.stages || [];
    var handoffs = d.handoffs || [];
    var decisions = d.decisions || [];
    var exceptions = d.exceptions || [];
    var controls = d.controls || [];
    var metrics = d.metrics || [];
    var governance = d.governance || {};

    if (!header.owner) {
      flags.push({ severity: 'critical', rule: 'No Process Owner', message: 'This process has no named owner.', why: 'The process header\'s owner field is empty.' });
    }
    if (!header.expectedOutcome) {
      flags.push({ severity: 'critical', rule: 'No Defined Outcome', message: 'This process has no stated expected outcome.', why: 'The expected outcome field is empty.' });
    }

    stages.forEach(function (s) {
      if (s.name && !s.owner) {
        flags.push({ severity: 'warning', rule: 'Stage Without Owner', message: '"' + s.name + '" has no owner.', why: 'A stage entered in Step 3 has an empty owner field.' });
      }
    });

    handoffs.forEach(function (h) {
      if (!h.acceptanceCriteria) {
        flags.push({ severity: 'warning', rule: 'Handoff Without Acceptance Criteria', message: 'The handoff from ' + (h.sender || '?') + ' to ' + (h.receiver || '?') + ' has no defined acceptance criteria.', why: 'The acceptance criteria field for this handoff is empty.' });
      }
    });

    decisions.forEach(function (dec) {
      if (dec.decision && !dec.owner) {
        flags.push({ severity: 'warning', rule: 'Decision Without Owner', message: '"' + dec.decision + '" has no decision owner.', why: 'A process decision point has an empty owner field.' });
      }
    });

    if (exceptions.length === 0) {
      flags.push({ severity: 'critical', rule: 'No Exception Path', message: 'No exception paths are defined. A process that only works when nothing goes wrong is not a mature process.', why: 'The exceptions list is empty.' });
    }

    if ((header.criticality === 'High' || header.criticality === 'Critical') && controls.length === 0) {
      flags.push({ severity: 'critical', rule: 'Critical Process Without Control', message: 'This process is marked ' + header.criticality + ' criticality but has no controls defined.', why: 'Criticality is High or Critical and the controls list is empty.' });
    }

    metrics.forEach(function (m) {
      if (m.name && !m.decisionSupported) {
        flags.push({ severity: 'info', rule: 'Metric Without Decision', message: '"' + m.name + '" doesn\'t say what decision it supports.', why: 'Metrics without a connected decision are reporting, not management.' });
      }
    });

    if (!governance.reviewer && !governance.cadence) {
      flags.push({ severity: 'warning', rule: 'Process Without Governance', message: 'No reviewer or review cadence is defined for this process.', why: 'Both the governance reviewer and cadence fields are empty.' });
    }

    var ownerCounts = {};
    stages.forEach(function (s) { if (s.owner) { var k = s.owner.trim().toLowerCase(); ownerCounts[k] = (ownerCounts[k] || 0) + 1; } });
    var keyPerson = Object.keys(ownerCounts).filter(function (k) { return stages.length >= 2 && ownerCounts[k] > stages.length / 2; });
    if (keyPerson.length) {
      flags.push({ severity: 'warning', rule: 'Key Person Dependency', message: 'One person owns more than half of this process\'s stages. Their unavailability would stall the whole process.', why: 'A single owner value appears on more than half of the entered stages.' });
    }

    var decisionStages = stages.filter(function (s) { return s.decisionRequired === 'Yes'; }).length;
    if (stages.length >= 2 && decisionStages > stages.length / 2) {
      flags.push({ severity: 'warning', rule: 'Excessive Approval', message: 'More than half of this process\'s stages require a decision or approval. That much gatekeeping usually slows the process down more than it protects it.', why: 'More than half of the entered stages have "decision required" set to Yes.' });
    }

    return flags;
  }

  /* ----------------------------------------------------------
     Steps
     ---------------------------------------------------------- */

  function stepHeader(container, project, ctrl) {
    container.innerHTML = '<h3>Name the process</h3><div id="header-mount"></div>';
    B.objectForm({
      mount: container.querySelector('#header-mount'), project: project, dataKey: 'header', onChange: ctrl.persist,
      fields: [
        { key: 'processName', label: 'Process name', type: 'text' },
        { key: 'processPurpose', label: 'Process purpose', type: 'textarea' },
        { key: 'expectedOutcome', label: 'Expected outcome', type: 'text' },
        { key: 'customer', label: 'Customer / value recipient', type: 'text' },
        { key: 'owner', label: 'Who has authority to change this process when it stops working?', type: 'text' },
        { key: 'criticality', label: 'Process criticality', type: 'select', options: CRITICALITY_OPTIONS }
      ]
    });
  }

  function stepTrigger(container, project, ctrl) {
    container.innerHTML = '<h3>What starts this process?</h3><div id="trigger-mount"></div>';
    B.objectForm({
      mount: container.querySelector('#trigger-mount'), project: project, dataKey: 'trigger', onChange: ctrl.persist,
      fields: [
        { key: 'type', label: 'Trigger', type: 'text', help: 'Examples: customer request, scheduled event, system event, business threshold, new opportunity, incident, manual request.' },
        { key: 'description', label: 'Describe it', type: 'textarea' }
      ]
    });
  }

  function stepInputs(container, project, ctrl) {
    container.innerHTML = '<h3>What must be in place before work begins?</h3><div id="inputs-mount"></div>';
    B.objectForm({
      mount: container.querySelector('#inputs-mount'), project: project, dataKey: 'inputs', onChange: ctrl.persist,
      fields: [
        { key: 'requiredInformation', label: 'Required information', type: 'textarea' },
        { key: 'requiredSystems', label: 'Required systems', type: 'text' },
        { key: 'requiredApprovals', label: 'Required approvals', type: 'text' },
        { key: 'requiredResources', label: 'Required resources', type: 'text' },
        { key: 'preconditions', label: 'What must be true before work begins?', type: 'textarea' }
      ]
    });
  }

  function stepStages(container, project, ctrl) {
    container.innerHTML = '<h3>Process Stages</h3><p class="lede">Build the sequence one stage at a time.</p><div id="stages-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#stages-mount'), project: project, dataKey: 'stages', addLabel: 'Add Stage',
      itemLabel: function (item, i) { return item.name || 'Stage ' + (i + 1); },
      defaults: function () { return { name: '', purpose: '', owner: '', inputs: '', action: '', output: '', system: '', expectedTime: '', qualityStandard: '', decisionRequired: '', handoffRequired: '' }; },
      onChange: ctrl.persist,
      fields: [
        { key: 'name', label: 'Stage name', type: 'text' },
        { key: 'purpose', label: 'Purpose', type: 'text' },
        { key: 'owner', label: 'Who has authority to change this stage when it stops working?', type: 'text' },
        { key: 'inputs', label: 'Inputs', type: 'text' },
        { key: 'action', label: 'Action', type: 'textarea' },
        { key: 'output', label: 'Output', type: 'text' },
        { key: 'system', label: 'System / tool', type: 'text' },
        { key: 'expectedTime', label: 'Expected time', type: 'text' },
        { key: 'qualityStandard', label: 'Quality standard', type: 'text' },
        { key: 'decisionRequired', label: 'Decision required?', type: 'select', options: YES_NO },
        { key: 'handoffRequired', label: 'Handoff required?', type: 'select', options: YES_NO }
      ]
    });
  }

  function stepHandoffs(container, project, ctrl) {
    container.innerHTML = '<h3>Handoffs</h3><p class="lede">Wherever ownership changes hands, make the handoff explicit.</p><div id="handoffs-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#handoffs-mount'), project: project, dataKey: 'handoffs', addLabel: 'Add Handoff',
      itemLabel: function (item, i) { return (item.sender && item.receiver) ? item.sender + ' → ' + item.receiver : 'Handoff ' + (i + 1); },
      defaults: function () { return { afterStage: '', sender: '', receiver: '', transferred: '', acceptanceCriteria: '', expectedTiming: '', ifIncomplete: '', receiptConfirmation: '' }; },
      onChange: ctrl.persist,
      fields: [
        { key: 'afterStage', label: 'Occurs after which stage?', type: 'select', options: function () { return stageOptions(project); } },
        { key: 'sender', label: 'Who sends?', type: 'text' },
        { key: 'receiver', label: 'Who receives?', type: 'text' },
        { key: 'transferred', label: 'What must be transferred?', type: 'textarea' },
        { key: 'acceptanceCriteria', label: 'Acceptance criteria', type: 'textarea' },
        { key: 'expectedTiming', label: 'Expected timing', type: 'text' },
        { key: 'ifIncomplete', label: 'What happens if incomplete?', type: 'text' },
        { key: 'receiptConfirmation', label: 'How is receipt confirmed?', type: 'text' }
      ]
    });
  }

  function stepDecisions(container, project, ctrl) {
    container.innerHTML = '<h3>Process Decision Points</h3><div id="decisions-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#decisions-mount'), project: project, dataKey: 'decisions', addLabel: 'Add Decision Point',
      itemLabel: function (item, i) { return item.decision || 'Decision ' + (i + 1); },
      defaults: function () { return { afterStage: '', decision: '', owner: '', requiredInformation: '', possibleOutcomes: '', escalationThreshold: '' }; },
      onChange: ctrl.persist,
      fields: [
        { key: 'afterStage', label: 'Occurs after which stage?', type: 'select', options: function () { return stageOptions(project); } },
        { key: 'decision', label: 'Decision', type: 'text' },
        { key: 'owner', label: 'Decision owner', type: 'text' },
        { key: 'requiredInformation', label: 'Required information', type: 'text' },
        { key: 'possibleOutcomes', label: 'Possible outcomes', type: 'text' },
        { key: 'escalationThreshold', label: 'Escalation threshold', type: 'text' }
      ]
    });
  }

  function stepExceptions(container, project, ctrl) {
    container.innerHTML = '<h3>What commonly goes wrong?</h3>' +
      '<div class="callout" style="margin-bottom:var(--space-5)">A process that only works when nothing goes wrong is not a mature process.</div>' +
      '<div id="exceptions-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#exceptions-mount'), project: project, dataKey: 'exceptions', addLabel: 'Add Exception Path',
      itemLabel: function (item, i) { return item.exception || 'Exception ' + (i + 1); },
      defaults: function () { return { exception: '', detection: '', owner: '', response: '', escalation: '', recovery: '' }; },
      onChange: ctrl.persist,
      fields: [
        { key: 'exception', label: 'Exception', type: 'text' },
        { key: 'detection', label: 'Detection', type: 'text', help: 'How would you notice this happened?' },
        { key: 'owner', label: 'Owner', type: 'text' },
        { key: 'response', label: 'Response', type: 'textarea' },
        { key: 'escalation', label: 'Escalation', type: 'text' },
        { key: 'recovery', label: 'Recovery', type: 'text' }
      ]
    });
  }

  function stepControls(container, project, ctrl) {
    container.innerHTML = '<h3>Controls</h3><p class="lede">You don\'t need all three control types for every risk.</p><div id="controls-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#controls-mount'), project: project, dataKey: 'controls', addLabel: 'Add Control',
      itemLabel: function (item, i) { return item.risk || 'Control ' + (i + 1); },
      defaults: function () { return { risk: '', preventive: '', detective: '', corrective: '', owner: '', evidence: '', frequency: '' }; },
      onChange: ctrl.persist,
      fields: [
        { key: 'risk', label: 'Risk', type: 'text' },
        { key: 'preventive', label: 'Preventive control', type: 'text' },
        { key: 'detective', label: 'Detective control', type: 'text' },
        { key: 'corrective', label: 'Corrective control', type: 'text' },
        { key: 'owner', label: 'Owner', type: 'text' },
        { key: 'evidence', label: 'Evidence', type: 'text' },
        { key: 'frequency', label: 'Frequency', type: 'text' }
      ]
    });
  }

  function stepMetrics(container, project, ctrl) {
    container.innerHTML = '<h3>How will we know the process is working?</h3><div id="metrics-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#metrics-mount'), project: project, dataKey: 'metrics', addLabel: 'Add Metric',
      itemLabel: function (item, i) { return item.name || 'Metric ' + (i + 1); },
      defaults: function () { return { name: '', type: '', decisionSupported: '' }; },
      onChange: ctrl.persist,
      fields: [
        { key: 'name', label: 'What signal would tell you this process is deteriorating before customers notice?', type: 'text' },
        { key: 'type', label: 'Metric type', type: 'select', options: METRIC_TYPES },
        { key: 'decisionSupported', label: 'What decision does this metric support?', type: 'text' }
      ]
    });
  }

  function stepGovernance(container, project, ctrl) {
    container.innerHTML = '<h3>Who reviews this process, and how often?</h3><div id="governance-mount"></div>';
    B.objectForm({
      mount: container.querySelector('#governance-mount'), project: project, dataKey: 'governance', onChange: ctrl.persist,
      fields: [
        { key: 'reviewer', label: 'Who reviews this process?', type: 'text' },
        { key: 'cadence', label: 'How often?', type: 'text' },
        { key: 'reviewTrigger', label: 'What triggers an off-cycle review?', type: 'text' },
        { key: 'changeAuthority', label: 'Who can change it?', type: 'text' },
        { key: 'communicationMethod', label: 'How are changes communicated?', type: 'text' },
        { key: 'retirementCriteria', label: 'When should it be retired or redesigned?', type: 'textarea' }
      ]
    });
  }

  function stepMaturityAndRisk(container, project, ctrl) {
    var snapshot = maturitySnapshot(project.data);
    var flags = analyze(project.data);
    container.innerHTML =
      '<h3>Process Maturity Snapshot</h3>' +
      '<p class="lede">A builder-specific internal check &mdash; not your overall organizational maturity score.</p>' +
      '<div class="metric-grid" id="maturity-mount" style="margin:var(--space-5) 0"></div>' +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Process Risk Flags</span></div>' +
      '<div id="risk-mount" style="margin-top:var(--space-4)"></div>';

    container.querySelector('#maturity-mount').innerHTML = snapshot.map(function (s) {
      return '<div class="metric-card"><span class="metric-card__label">' + s.dimension + '</span>' +
        '<span class="maturity-pill maturity-pill--' + s.level + '" style="width:fit-content">' + s.level + '</span></div>';
    }).join('');

    B.renderRiskFlags(container.querySelector('#risk-mount'), flags);
  }

  function flowNode(cls, title, body) {
    return '<div class="builder-flow__node ' + cls + '"><div class="builder-flow__node-title">' + title + '</div>' + body + '</div>' +
      '<div class="builder-flow__connector">&#8595;</div>';
  }

  function stepOutput(container, project, ctrl) {
    var d = project.data;
    var header = d.header || {};
    var stages = d.stages || [];
    var handoffs = d.handoffs || [];
    var decisions = d.decisions || [];
    var flags = analyze(d);

    function itemsAfter(list, stageName) {
      return list.filter(function (x) { return x.afterStage === stageName; });
    }

    var flowHtml = flowNode('', 'Trigger', (d.trigger && d.trigger.type) || '<span class="text-dim">Not defined</span>');
    flowHtml += flowNode('', 'Input', (d.inputs && d.inputs.requiredInformation) || '<span class="text-dim">Not defined</span>');

    var beforeAny = itemsAfter(decisions, 'Before any stage').concat(itemsAfter(handoffs, 'Before any stage'));
    beforeAny.forEach(function (item) {
      if (item.decision) flowHtml += flowNode('builder-flow__node--decision', 'Decision', item.decision);
      else flowHtml += flowNode('builder-flow__node--handoff', 'Handoff', (item.sender || '?') + ' &rarr; ' + (item.receiver || '?'));
    });

    stages.forEach(function (s) {
      flowHtml += flowNode('', 'Stage: ' + (s.name || 'Untitled'), (s.action || '<span class="text-dim">No action defined</span>') +
        (s.owner ? '<div class="text-dim" style="margin-top:var(--space-1);font-size:11px">Owner: ' + s.owner + '</div>' : ''));
      itemsAfter(decisions, s.name).forEach(function (dec) {
        flowHtml += flowNode('builder-flow__node--decision', 'Decision', dec.decision || 'Untitled decision');
      });
      itemsAfter(handoffs, s.name).forEach(function (h) {
        flowHtml += flowNode('builder-flow__node--handoff', 'Handoff', (h.sender || '?') + ' &rarr; ' + (h.receiver || '?'));
      });
    });

    flowHtml += '<div class="builder-flow__node"><div class="builder-flow__node-title">Output</div>' + (header.expectedOutcome || '<span class="text-dim">Not defined</span>') + '</div>';

    var exceptionsHtml = (d.exceptions || []).map(function (e) {
      return '<div class="builder-flow__node builder-flow__node--exception"><div class="builder-flow__node-title">Exception: ' + (e.exception || 'Untitled') + '</div>' + (e.response || '') + '</div>';
    }).join('');

    container.innerHTML =
      '<h3>Process Summary</h3>' +
      (project.isSample ? '<span class="badge badge--accent">Sample Project</span>' : '') +
      '<p class="lede">' + (header.processName || 'Untitled process') + ' &mdash; owned by ' + (header.owner || 'no one yet') + '</p>' +
      '<div class="builder-flow" style="margin:var(--space-6) 0">' + flowHtml + '</div>' +
      (exceptionsHtml ? '<div class="section-head"><span class="eyebrow">Exception Paths</span></div><div class="builder-flow" style="margin-bottom:var(--space-6)">' + exceptionsHtml + '</div>' : '') +
      '<div class="section-head"><span class="eyebrow">Risks (' + flags.length + ')</span></div>' +
      '<div id="output-risk-mount"></div>' +
      '<div class="section-head" style="margin-top:var(--space-6)"><span class="eyebrow">Questions To Investigate</span></div>' +
      '<ul>' +
        '<li class="operator-question">Which stage would be hardest to explain to someone new?</li>' +
        '<li class="operator-question">Where does this process currently depend on a workaround?</li>' +
        '<li class="operator-question">What would happen if volume through this process doubled?</li>' +
      '</ul>' +
      '<div class="section-head" style="margin-top:var(--space-6)"><span class="eyebrow">Related Systems</span></div>' +
      '<div class="related-links" id="next-systems-mount"></div>' +
      '<div id="output-actions-mount" style="margin-top:var(--space-7)"></div>';

    B.renderRiskFlags(container.querySelector('#output-risk-mount'), flags);

    container.querySelector('#next-systems-mount').innerHTML = global.OMSLinks.renderList([
      { label: 'Decision Rights Architect', type: 'page', id: 'decision-rights' },
      { label: 'Operating Model Designer', type: 'page', id: 'operating-model' },
      { label: 'Continuous Improvement', type: 'resource', id: 'continuous-improvement' }
    ]);

    B.renderOutputActions(container.querySelector('#output-actions-mount'), project, {
      learnLinks: [
        { label: 'Process Architecture', type: 'resource', id: 'process-architecture' },
        { label: 'Process Ownership', type: 'resource', id: 'process-ownership' },
        { label: 'Handoffs', type: 'resource', id: 'handoffs' },
        { label: 'Operational Controls', type: 'resource', id: 'operational-controls' }
      ],
      nextBuilder: { label: 'Open Operating Model Designer', href: global.OMSData.href('pages/operating-model.html') }
    });
  }

  var STEPS = [
    { id: 'header', label: 'Process', render: stepHeader },
    { id: 'trigger', label: 'Trigger', render: stepTrigger },
    { id: 'inputs', label: 'Inputs', render: stepInputs },
    { id: 'stages', label: 'Stages', render: stepStages },
    { id: 'handoffs', label: 'Handoffs', render: stepHandoffs },
    { id: 'decisions', label: 'Decisions', render: stepDecisions },
    { id: 'exceptions', label: 'Exceptions', render: stepExceptions },
    { id: 'controls', label: 'Controls', render: stepControls },
    { id: 'metrics', label: 'Metrics', render: stepMetrics },
    { id: 'governance', label: 'Governance', render: stepGovernance },
    { id: 'maturity', label: 'Maturity & Risk', render: stepMaturityAndRisk },
    { id: 'output', label: 'Output', render: stepOutput }
  ];

  /* ----------------------------------------------------------
     Sample project — Customer Onboarding
     ---------------------------------------------------------- */

  function sampleData() {
    return {
      header: {
        processName: 'Customer Onboarding', processPurpose: 'Turn a signed contract into a live, successfully using customer.',
        expectedOutcome: 'Customer reaches first value within 21 days of signing.', customer: 'New enterprise customer',
        owner: 'Director of Customer Success', criticality: 'High'
      },
      trigger: { type: 'Customer request', description: 'A contract is signed and countersigned in the CRM.' },
      inputs: {
        requiredInformation: 'Signed contract, technical contacts, use case notes from Sales',
        requiredSystems: 'CRM, onboarding project tool, product provisioning system',
        requiredApprovals: 'None required to begin',
        requiredResources: 'Assigned Customer Success Manager and Implementation Engineer',
        preconditions: 'Contract is fully executed and account is provisioned.'
      },
      stages: [
        { name: 'Kickoff', purpose: 'Align on goals and timeline', owner: 'Customer Success Manager', inputs: 'Signed contract, sales notes', action: 'Run kickoff call, confirm technical contacts and success criteria', output: 'Signed onboarding plan', system: 'CRM', expectedTime: '3 business days', qualityStandard: 'Plan confirmed by customer in writing', decisionRequired: 'No', handoffRequired: 'No' },
        { name: 'Technical Setup', purpose: 'Provision and configure the product', owner: 'Implementation Engineer', inputs: 'Onboarding plan', action: 'Provision environment and configure integrations', output: 'Working environment', system: 'Provisioning system', expectedTime: '5 business days', qualityStandard: 'Environment passes setup checklist', decisionRequired: 'No', handoffRequired: 'Yes' },
        { name: 'Training', purpose: 'Enable the customer team to use the product', owner: 'Customer Success Manager', inputs: 'Working environment', action: 'Run training sessions with end users', output: 'Trained users', system: '', expectedTime: '5 business days', qualityStandard: 'Training completion above 80%', decisionRequired: 'No', handoffRequired: 'No' },
        { name: 'Go-Live Review', purpose: 'Confirm the customer is ready to rely on the product', owner: '', inputs: 'Trained users, working environment', action: 'Review readiness with customer stakeholder', output: 'Go-live sign-off', system: '', expectedTime: '2 business days', qualityStandard: 'Sign-off received', decisionRequired: 'Yes', handoffRequired: 'Yes' }
      ],
      handoffs: [
        { afterStage: 'Technical Setup', sender: 'Implementation Engineer', receiver: 'Customer Success Manager', transferred: 'Environment access, configuration notes, open issues', acceptanceCriteria: 'Setup checklist fully signed off', expectedTiming: 'Within 1 business day of setup completion', ifIncomplete: 'Training is delayed until setup is confirmed complete', receiptConfirmation: 'CSM confirms in project tool' },
        { afterStage: 'Go-Live Review', sender: 'Customer Success Manager', receiver: 'Ongoing Account Team', transferred: 'Full account history and open follow-ups', acceptanceCriteria: '', expectedTiming: '', ifIncomplete: '', receiptConfirmation: '' }
      ],
      decisions: [
        { afterStage: 'Go-Live Review', decision: 'Is the customer ready to go live?', owner: 'Director of Customer Success', requiredInformation: 'Training completion rate, open technical issues', possibleOutcomes: 'Go live / delay go-live', escalationThreshold: 'Any unresolved critical technical issue' }
      ],
      exceptions: [
        { exception: 'Customer misses training sessions', detection: 'Attendance tracking shows low completion', owner: 'Customer Success Manager', response: 'Reschedule sessions and flag risk to account team', escalation: 'Escalate to Director if missed twice', recovery: 'Extend onboarding timeline' },
        { exception: 'Technical setup fails checklist', detection: 'Setup checklist has failed items', owner: 'Implementation Engineer', response: 'Fix and re-run checklist before handoff', escalation: 'Escalate to Engineering if unresolved after 2 attempts', recovery: 'Delay handoff until checklist passes' }
      ],
      controls: [
        { risk: 'Customer goes live with unresolved critical issues', preventive: 'Go-live checklist requires zero open critical issues', detective: 'Go-Live Review decision point', corrective: 'Delay go-live and remediate', owner: 'Director of Customer Success', evidence: 'Signed go-live checklist', frequency: 'Every onboarding' }
      ],
      metrics: [
        { name: 'Time to first value', type: 'Speed / Cycle-Time', decisionSupported: 'Whether the onboarding process needs to be redesigned' },
        { name: 'Training completion rate', type: 'Quality', decisionSupported: 'Whether to delay go-live for a specific customer' }
      ],
      governance: {
        reviewer: 'Director of Customer Success', cadence: 'Quarterly', reviewTrigger: 'Two consecutive missed time-to-value targets',
        changeAuthority: 'Director of Customer Success', communicationMethod: 'Team meeting and updated playbook', retirementCriteria: 'If onboarding is automated by self-serve setup'
      }
    };
  }

  function init(project) {
    B = global.OMSBuilder;
    var els = {
      progress: document.getElementById('builder-progress'),
      body: document.getElementById('builder-step-body'),
      prev: document.getElementById('builder-prev'),
      next: document.getElementById('builder-next'),
      stepLabel: document.getElementById('builder-step-label')
    };
    return B.initWizard({ project: project, steps: STEPS, els: els });
  }

  global.OMSBuilderProcess = { init: init, sampleData: sampleData, analyze: analyze, maturitySnapshot: maturitySnapshot, builderType: 'process', label: 'Process Architect' };
})(window);
