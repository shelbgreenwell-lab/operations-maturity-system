/*
 * Operations Maturity System
 * Operating Model Designer.
 *
 * Helps a user define how an organization or team will repeatedly
 * convert strategy into outcomes: the outcomes it owes, who
 * receives value from it, the capabilities required, how those
 * capabilities are organized and owned, where they must interface,
 * the workflows that cross them, and how the whole thing is
 * governed. Ends with a deterministic risk scan and a generated
 * visual summary.
 *
 * Drives js/builder-core.js. Page shell lives in pages/operating-model.html.
 */

(function (global) {
  'use strict';

  var B = null; // OMSBuilder, resolved at init

  var SCOPE_OPTIONS = [
    { value: 'organization', label: 'Entire Organization' },
    { value: 'business-unit', label: 'Business Unit' },
    { value: 'function', label: 'Function' },
    { value: 'program', label: 'Program' },
    { value: 'team', label: 'Team' },
    { value: 'custom', label: 'Custom Operating System' }
  ];

  var CRITICALITY_OPTIONS = ['High', 'Medium', 'Low'];
  var MATURITY_OPTIONS = ['Reactive', 'Repeatable', 'Defined', 'Managed', 'Adaptive'];
  var PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];

  function capabilityNames(project) {
    return (project.data.capabilities || []).map(function (c) { return c.name; }).filter(Boolean);
  }

  function outcomeAndCapabilityNames(project) {
    var outcomes = (project.data.outcomes || []).map(function (o) { return o.outcome; }).filter(Boolean);
    return capabilityNames(project).concat(outcomes);
  }

  /* ----------------------------------------------------------
     Deterministic rule engine
     ---------------------------------------------------------- */

  function analyze(data) {
    var flags = [];
    var outcomes = data.outcomes || [];
    var capabilities = data.capabilities || [];
    var ownership = data.ownership || [];
    var interfaces = data.interfaces || [];
    var workflows = data.workflows || [];

    function ownersFor(itemType, itemName) {
      return ownership.filter(function (o) { return o.itemType === itemType && o.itemName === itemName; });
    }

    outcomes.forEach(function (o) {
      if (!o.outcome) return;
      if (o.priority === 'High' && ownersFor('Outcome', o.outcome).length === 0) {
        flags.push({
          severity: 'critical', rule: 'Critical Outcome Without Clear Owner',
          message: '"' + o.outcome + '" is marked high priority, but no one in Step 5 (Ownership) is accountable for it.',
          why: 'A high-priority outcome with no matching Ownership entry has no one responsible for whether it actually happens.'
        });
      }
    });

    capabilities.forEach(function (c) {
      if (!c.name) return;
      if (!c.owner || !c.owner.trim()) {
        flags.push({
          severity: 'critical', rule: 'Capability Without Owner',
          message: '"' + c.name + '" has no primary owner defined.',
          why: 'Every capability in Step 3 should have a named primary owner — see Process Ownership and Role Clarity.'
        });
      } else if (/,| and /i.test(c.owner)) {
        flags.push({
          severity: 'warning', rule: 'Too Many Shared Owners',
          message: '"' + c.name + '" lists more than one owner ("' + c.owner + '"). Shared ownership often means no one is actually accountable.',
          why: 'The owner field contains more than one name.'
        });
      }
    });

    ownership.forEach(function (o) {
      if (!o.itemName) return;
      if (o.hasAuthority === 'No' || o.hasAuthority === 'Unclear') {
        flags.push({
          severity: 'warning', rule: 'Owner Without Authority',
          message: '"' + (o.owner || 'This owner') + '" owns "' + o.itemName + '" but ' +
            (o.hasAuthority === 'No' ? 'does not have' : 'it is unclear whether they have') + ' authority to change how it works.',
          why: 'Ownership without authority to act is ownership in name only.'
        });
      }
    });

    var byOwner = {};
    capabilities.forEach(function (c) {
      if (c.criticality === 'High' && c.owner) {
        var key = c.owner.trim().toLowerCase();
        byOwner[key] = (byOwner[key] || []).concat([c.name]);
      }
    });
    Object.keys(byOwner).forEach(function (key) {
      if (byOwner[key].length >= 2) {
        flags.push({
          severity: 'warning', rule: 'Multiple High-Criticality Capabilities Depend On One Role',
          message: byOwner[key].join(' and ') + ' are all high-criticality capabilities owned by the same person. Their availability becomes a single point of failure.',
          why: 'Two or more capabilities marked High criticality share the same owner value.'
        });
      }
    });

    workflows.forEach(function (w) {
      var participants = w.participatingCapabilities || [];
      if (!w.name || participants.length < 2) return;
      var covered = interfaces.some(function (i) {
        return participants.indexOf(i.capabilityA) !== -1 && participants.indexOf(i.capabilityB) !== -1;
      });
      if (!covered) {
        flags.push({
          severity: 'warning', rule: 'Cross-Functional Workflow Without Coordination Interface',
          message: '"' + w.name + '" spans ' + participants.join(' + ') + ', but no interface in Step 6 connects those capabilities.',
          why: 'A workflow with two or more participating capabilities has no matching Interfaces entry describing how they coordinate.'
        });
      }
    });

    if (workflows.length > 0) {
      capabilities.forEach(function (c) {
        if (!c.name) return;
        var inWorkflow = workflows.some(function (w) { return (w.participatingCapabilities || []).indexOf(c.name) !== -1; });
        if (!inWorkflow) {
          flags.push({
            severity: 'info', rule: 'Capability May Not Support A Defined Outcome',
            message: '"' + c.name + '" doesn’t appear in any workflow entered in Step 7. That may simply mean the workflow list is incomplete.',
            why: 'Heuristic: this capability is not referenced by any workflow you have mapped so far.'
          });
        }
      });
    }

    var hasHighPriorityOutcome = outcomes.some(function (o) { return o.priority === 'High'; });
    if (hasHighPriorityOutcome) {
      capabilities.forEach(function (c) {
        if (c.name && c.maturity === 'Reactive') {
          flags.push({
            severity: 'warning', rule: 'Outcome May Depend On Low-Maturity Capability',
            message: '"' + c.name + '" is still Reactive maturity while at least one outcome is marked high priority. If this capability supports that outcome, it may be a constraint on delivering it.',
            why: 'Heuristic: a Reactive-maturity capability exists alongside a high-priority outcome.'
          });
        }
      });
    }

    return flags;
  }

  /* ----------------------------------------------------------
     Steps
     ---------------------------------------------------------- */

  function stepSetup(container, project, ctrl) {
    container.innerHTML =
      '<h3>What are you designing?</h3>' +
      '<p class="lede">Pick the scope of the operating system you’re about to design.</p>' +
      '<div class="builder-scope-grid" style="margin:var(--space-5) 0"></div>' +
      '<div class="builder-field" style="max-width:420px"><label class="builder-field__label">Give it a name</label>' +
      '<input type="text" class="builder-field__input" id="scope-name" placeholder="e.g. Acme Customer Operations" value="' +
      (project.data.scopeName || '').replace(/"/g, '&quot;') + '"></div>';

    var grid = container.querySelector('.builder-scope-grid');
    grid.innerHTML = SCOPE_OPTIONS.map(function (opt) {
      var selected = project.data.scope === opt.value;
      return '<button type="button" class="builder-scope-tile' + (selected ? ' is-selected' : '') + '" data-scope="' + opt.value + '">' + opt.label + '</button>';
    }).join('');

    grid.querySelectorAll('[data-scope]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        project.data.scope = btn.getAttribute('data-scope');
        ctrl.persist();
        stepSetup(container, project, ctrl);
      });
    });

    container.querySelector('#scope-name').addEventListener('input', function (e) {
      project.data.scopeName = e.target.value;
      ctrl.persist();
    });
  }

  function stepOutcomes(container, project, ctrl) {
    container.innerHTML = '<h3>What outcomes must this operating system reliably produce?</h3><div id="outcomes-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#outcomes-mount'),
      project: project, dataKey: 'outcomes', addLabel: 'Add Outcome',
      itemLabel: function (item, i) { return item.outcome || 'Outcome ' + (i + 1); },
      defaults: function () { return { outcome: '', whyItMatters: '', howRecognized: '', priority: '' }; },
      onChange: ctrl.persist,
      fields: [
        { key: 'outcome', label: 'Outcome', type: 'text', placeholder: 'e.g. Fast delivery', help: 'Examples: revenue growth, customer retention, fast delivery, quality, cost efficiency, innovation, compliance, employee productivity, service responsiveness.' },
        { key: 'whyItMatters', label: 'Why it matters', type: 'textarea' },
        { key: 'howRecognized', label: 'How success is recognized', type: 'text', help: 'What would you actually observe if this were true?' },
        { key: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTIONS }
      ]
    });
  }

  function stepRecipients(container, project, ctrl) {
    container.innerHTML = '<h3>Who receives value from this operating system?</h3><div id="recipients-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#recipients-mount'),
      project: project, dataKey: 'valueRecipients', addLabel: 'Add Value Recipient',
      itemLabel: function (item, i) { return item.type || 'Recipient ' + (i + 1); },
      defaults: function () { return { type: '', expectation: '' }; },
      onChange: ctrl.persist,
      fields: [
        { key: 'type', label: 'Who receives value?', type: 'text', help: 'Examples: external customer, internal customer, leadership, sales team, product team, partner, client, employee.' },
        { key: 'expectation', label: 'What value are they expecting?', type: 'textarea', help: 'Be specific. Operating systems exist to create value, not to run process for its own sake.' }
      ]
    });
  }

  function stepCapabilities(container, project, ctrl) {
    container.innerHTML = '<h3>What capabilities are required to produce the outcomes?</h3><div id="capabilities-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#capabilities-mount'),
      project: project, dataKey: 'capabilities', addLabel: 'Add Capability',
      itemLabel: function (item, i) { return item.name || 'Capability ' + (i + 1); },
      defaults: function () { return { name: '', purpose: '', owner: '', criticality: '', maturity: '' }; },
      onChange: ctrl.persist,
      fields: [
        { key: 'name', label: 'Capability', type: 'text', help: 'Examples: Sales, Marketing, Operations, Customer Success, Finance, Data, Technology, Enablement, Quality, Workforce Management, Product, Service Delivery.' },
        { key: 'purpose', label: 'Purpose', type: 'textarea' },
        { key: 'owner', label: 'Primary owner', type: 'text', help: 'Who has authority to change how this capability works when it stops working?' },
        { key: 'criticality', label: 'Criticality', type: 'select', options: CRITICALITY_OPTIONS },
        { key: 'maturity', label: 'Maturity', type: 'select', options: MATURITY_OPTIONS }
      ]
    });
  }

  function stepStructure(container, project, ctrl) {
    container.innerHTML = '<h3>How are these capabilities organized?</h3>' +
      '<p class="lede">This is operating structure, not a reporting hierarchy &mdash; functions, teams, roles, and shared services.</p><div id="structure-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#structure-mount'),
      project: project, dataKey: 'structure', addLabel: 'Add Structural Unit',
      itemLabel: function (item, i) { return item.name || 'Unit ' + (i + 1); },
      defaults: function () { return { name: '', kind: '', ownershipModel: '', notes: '' }; },
      onChange: ctrl.persist,
      fields: [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'kind', label: 'Kind', type: 'select', options: ['Function', 'Team', 'Role', 'Shared Service'] },
        { key: 'ownershipModel', label: 'Ownership model', type: 'select', options: ['Centralized', 'Distributed'] },
        { key: 'notes', label: 'Notes', type: 'textarea', help: 'Why is it organized this way?' }
      ]
    });
  }

  function stepOwnership(container, project, ctrl) {
    container.innerHTML = '<h3>Who is accountable for each major capability and outcome?</h3><div id="ownership-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#ownership-mount'),
      project: project, dataKey: 'ownership', addLabel: 'Add Ownership Entry',
      itemLabel: function (item, i) { return item.itemName || 'Ownership ' + (i + 1); },
      defaults: function () { return { itemType: '', itemName: '', owner: '', hasAuthority: '' }; },
      onChange: ctrl.persist,
      fields: [
        { key: 'itemType', label: 'What is being owned?', type: 'select', options: ['Capability', 'Outcome'] },
        { key: 'itemName', label: 'Which one?', type: 'select', options: function () { return outcomeAndCapabilityNames(project); } },
        { key: 'owner', label: 'Owner', type: 'text' },
        { key: 'hasAuthority', label: 'Does the owner have real authority to change it?', type: 'select', options: ['Yes', 'No', 'Unclear'] }
      ]
    });
  }

  function stepInterfaces(container, project, ctrl) {
    container.innerHTML = '<h3>Where must capabilities work together?</h3><div id="interfaces-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#interfaces-mount'),
      project: project, dataKey: 'interfaces', addLabel: 'Add Interface',
      itemLabel: function (item, i) { return (item.capabilityA && item.capabilityB) ? item.capabilityA + ' ↔ ' + item.capabilityB : 'Interface ' + (i + 1); },
      defaults: function () { return { capabilityA: '', capabilityB: '', exchanged: '', decisionCoordinated: '', riskIfFails: '' }; },
      onChange: ctrl.persist,
      fields: [
        { key: 'capabilityA', label: 'Capability A', type: 'select', options: function () { return capabilityNames(project); } },
        { key: 'capabilityB', label: 'Capability B', type: 'select', options: function () { return capabilityNames(project); } },
        { key: 'exchanged', label: 'What must be exchanged?', type: 'text' },
        { key: 'decisionCoordinated', label: 'What decision must be coordinated?', type: 'text' },
        { key: 'riskIfFails', label: 'What risk exists if the interface fails?', type: 'textarea' }
      ]
    });
  }

  function stepWorkflows(container, project, ctrl) {
    container.innerHTML = '<h3>What major flows cross the operating model?</h3><div id="workflows-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#workflows-mount'),
      project: project, dataKey: 'workflows', addLabel: 'Add Workflow',
      itemLabel: function (item, i) { return item.name || 'Workflow ' + (i + 1); },
      defaults: function () { return { name: '', participatingCapabilities: [] }; },
      onChange: ctrl.persist,
      fields: [
        { key: 'name', label: 'Workflow', type: 'text', help: 'Examples: Lead → Customer, Issue → Resolution, Request → Decision, Hire → Productive Employee, Idea → Launch.' },
        { key: 'participatingCapabilities', label: 'Which capabilities participate?', type: 'multiselect', options: function () { return capabilityNames(project); } }
      ]
    });
  }

  function stepGovernance(container, project, ctrl) {
    container.innerHTML = '<h3>How will the operating model be managed?</h3><div id="governance-mount"></div>';
    B.objectForm({
      mount: container.querySelector('#governance-mount'),
      project: project, dataKey: 'governance', onChange: ctrl.persist,
      fields: [
        { key: 'performanceReviewCadence', label: 'Performance review cadence', type: 'text' },
        { key: 'strategicReviewCadence', label: 'Strategic review cadence', type: 'text' },
        { key: 'riskReview', label: 'Risk review', type: 'text' },
        { key: 'capacityReview', label: 'Resource / capacity review', type: 'text' },
        { key: 'changeGovernance', label: 'Change governance', type: 'text' },
        { key: 'decisionEscalation', label: 'Decision escalation', type: 'text' }
      ]
    });
  }

  function stepRisk(container, project, ctrl) {
    var flags = analyze(project.data);
    container.innerHTML = '<h3>Operating Model Risks</h3><p class="lede">Deterministic checks against what you’ve entered so far &mdash; not a prediction.</p><div id="risk-mount" style="margin-top:var(--space-5)"></div>';
    B.renderRiskFlags(container.querySelector('#risk-mount'), flags);
    project.data._lastFlags = flags;
    ctrl.persist();
  }

  function chainNode(label, items) {
    return '<div class="builder-flow__node"><div class="builder-flow__node-title">' + label + '</div>' + items + '</div>' +
      '<div class="builder-flow__connector">&#8595;</div>';
  }

  function stepOutput(container, project, ctrl) {
    var d = project.data;
    var flags = analyze(d);
    var critical = flags.filter(function (f) { return f.severity === 'critical' || f.severity === 'warning'; });
    var gaps = flags.filter(function (f) { return f.severity === 'info'; });

    var outcomesHtml = (d.outcomes || []).map(function (o) { return '<span class="pill">' + (o.outcome || 'Untitled') + (o.priority ? ' &middot; ' + o.priority : '') + '</span>'; }).join(' ') || '<span class="text-dim">None entered</span>';
    var recipientsHtml = (d.valueRecipients || []).map(function (r) { return '<span class="pill">' + (r.type || 'Untitled') + '</span>'; }).join(' ') || '<span class="text-dim">None entered</span>';
    var capsHtml = (d.capabilities || []).map(function (c) { return '<span class="pill">' + (c.name || 'Untitled') + (c.criticality ? ' &middot; ' + c.criticality : '') + '</span>'; }).join(' ') || '<span class="text-dim">None entered</span>';
    var ownershipHtml = (d.ownership || []).map(function (o) { return '<span class="pill">' + (o.itemName || '?') + ' &rarr; ' + (o.owner || '?') + '</span>'; }).join(' ') || '<span class="text-dim">None entered</span>';
    var interfacesHtml = (d.interfaces || []).map(function (i) { return '<span class="pill">' + (i.capabilityA || '?') + ' ↔ ' + (i.capabilityB || '?') + '</span>'; }).join(' ') || '<span class="text-dim">None entered</span>';
    var workflowsHtml = (d.workflows || []).map(function (w) { return '<span class="pill">' + (w.name || 'Untitled') + '</span>'; }).join(' ') || '<span class="text-dim">None entered</span>';
    var govHtml = d.governance ? Object.keys(d.governance).filter(function (k) { return d.governance[k]; }).map(function (k) {
      return '<li>' + k.replace(/([A-Z])/g, ' $1').replace(/^./, function (s) { return s.toUpperCase(); }) + ': ' + d.governance[k] + '</li>';
    }).join('') : '';

    container.innerHTML =
      '<h3>Operating Model Summary</h3>' +
      (project.isSample ? '<span class="badge badge--accent">Sample Project</span>' : '') +
      '<p class="lede">' + (d.scopeName || 'Untitled operating system') + ' &mdash; ' + (SCOPE_OPTIONS.filter(function (s) { return s.value === d.scope; })[0] || {}).label + '</p>' +
      '<div class="builder-flow" style="margin:var(--space-6) 0">' +
        chainNode('Outcomes', outcomesHtml) +
        chainNode('Value Recipients', recipientsHtml) +
        chainNode('Capabilities', capsHtml) +
        chainNode('Ownership', ownershipHtml) +
        chainNode('Interfaces', interfacesHtml) +
        chainNode('Workflows', workflowsHtml) +
        '<div class="builder-flow__node"><div class="builder-flow__node-title">Governance</div>' + (govHtml ? '<ul>' + govHtml + '</ul>' : '<span class="text-dim">Not yet defined</span>') + '</div>' +
      '</div>' +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Primary Risks (' + critical.length + ')</span></div>' +
      '<div id="output-risk-mount"></div>' +
      (gaps.length ? '<div class="section-head" style="margin-top:var(--space-6)"><span class="eyebrow">Gaps (' + gaps.length + ')</span></div><div id="output-gap-mount"></div>' : '') +
      '<div class="section-head" style="margin-top:var(--space-6)"><span class="eyebrow">Questions To Investigate</span></div>' +
      '<ul>' +
        '<li class="operator-question">Which capability would most disrupt outcomes if it disappeared tomorrow?</li>' +
        '<li class="operator-question">Where is ownership assumed rather than confirmed?</li>' +
        '<li class="operator-question">Which interface is most likely to fail silently?</li>' +
      '</ul>' +
      '<div class="section-head" style="margin-top:var(--space-6)"><span class="eyebrow">Next Systems To Design</span></div>' +
      '<div class="related-links" id="next-systems-mount"></div>' +
      '<div id="output-actions-mount" style="margin-top:var(--space-7)"></div>';

    B.renderRiskFlags(container.querySelector('#output-risk-mount'), critical);
    if (gaps.length) B.renderRiskFlags(container.querySelector('#output-gap-mount'), gaps);

    container.querySelector('#next-systems-mount').innerHTML = global.OMSLinks.renderList([
      { label: 'Decision Rights Architect', type: 'page', id: 'decision-rights' },
      { label: 'Process Architect', type: 'page', id: 'process-architect' },
      { label: 'Operating Rhythms', type: 'resource', id: 'operating-rhythms' }
    ]);

    B.renderOutputActions(container.querySelector('#output-actions-mount'), project, {
      learnLinks: [
        { label: 'Operating Model', type: 'resource', id: 'operating-models' },
        { label: 'Capability Architecture', type: 'resource', id: 'capability-mapping' },
        { label: 'Role Clarity', type: 'resource', id: 'role-clarity' },
        { label: 'Strategic Alignment', type: 'resource', id: 'strategic-alignment' }
      ],
      nextBuilder: { label: 'Open Decision Rights Architect', href: global.OMSData.href('pages/decision-rights.html') }
    });
  }

  var STEPS = [
    { id: 'setup', label: 'Setup', render: stepSetup },
    { id: 'outcomes', label: 'Outcomes', render: stepOutcomes },
    { id: 'recipients', label: 'Recipients', render: stepRecipients },
    { id: 'capabilities', label: 'Capabilities', render: stepCapabilities },
    { id: 'structure', label: 'Structure', render: stepStructure },
    { id: 'ownership', label: 'Ownership', render: stepOwnership },
    { id: 'interfaces', label: 'Interfaces', render: stepInterfaces },
    { id: 'workflows', label: 'Workflows', render: stepWorkflows },
    { id: 'governance', label: 'Governance', render: stepGovernance },
    { id: 'risk', label: 'Risks', render: stepRisk },
    { id: 'output', label: 'Output', render: stepOutput }
  ];

  /* ----------------------------------------------------------
     Sample project
     ---------------------------------------------------------- */

  function sampleData() {
    return {
      scope: 'organization', scopeName: 'Northbeam — B2B SaaS Go-To-Market',
      outcomes: [
        { outcome: 'Revenue growth', whyItMatters: 'The board has set an aggressive net-new ARR target for the year.', howRecognized: 'Net-new ARR tracked monthly against target', priority: 'High' },
        { outcome: 'Customer retention', whyItMatters: 'Expansion revenue depends on renewing the existing base.', howRecognized: 'Gross revenue retention above 92%', priority: 'High' },
        { outcome: 'Fast delivery', whyItMatters: 'Sales cycles stall when onboarding takes too long.', howRecognized: 'Time from signed contract to first value under 21 days', priority: 'Medium' }
      ],
      valueRecipients: [
        { type: 'External customer', expectation: 'A working product, delivered on the timeline promised during sales.' },
        { type: 'Sales team', expectation: 'Qualified pipeline and fast, accurate pricing answers.' },
        { type: 'Leadership', expectation: 'Predictable, forecastable revenue.' }
      ],
      capabilities: [
        { name: 'Sales', purpose: 'Convert qualified pipeline into signed contracts.', owner: 'VP Sales', criticality: 'High', maturity: 'Defined' },
        { name: 'Marketing', purpose: 'Generate qualified pipeline.', owner: 'VP Marketing', criticality: 'High', maturity: 'Repeatable' },
        { name: 'Customer Success', purpose: 'Onboard and retain customers.', owner: 'VP Sales', criticality: 'High', maturity: 'Reactive' },
        { name: 'Product', purpose: 'Build and maintain the product customers are buying.', owner: 'VP Product', criticality: 'High', maturity: 'Managed' },
        { name: 'Finance', purpose: 'Price, bill, and forecast revenue.', owner: 'CFO', criticality: 'Medium', maturity: 'Defined' }
      ],
      structure: [
        { name: 'Revenue Org', kind: 'Function', ownershipModel: 'Centralized', notes: 'Sales, Marketing, and Customer Success report through one revenue leader to keep the funnel accountable end to end.' }
      ],
      ownership: [
        { itemType: 'Outcome', itemName: 'Revenue growth', owner: 'VP Sales', hasAuthority: 'Yes' },
        { itemType: 'Outcome', itemName: 'Customer retention', owner: '', hasAuthority: 'Unclear' },
        { itemType: 'Capability', itemName: 'Customer Success', owner: 'VP Sales', hasAuthority: 'Unclear' }
      ],
      interfaces: [
        { capabilityA: 'Sales', capabilityB: 'Marketing', exchanged: 'Lead quality feedback', decisionCoordinated: 'What counts as a qualified lead', riskIfFails: 'Marketing keeps generating leads Sales won’t work.' },
        { capabilityA: 'Sales', capabilityB: 'Customer Success', exchanged: 'Deal context and commitments made during sales', decisionCoordinated: 'When a deal hands off to onboarding', riskIfFails: 'Customers experience a reset the moment they sign.' }
      ],
      workflows: [
        { name: 'Lead → Customer', participatingCapabilities: ['Marketing', 'Sales', 'Customer Success'] },
        { name: 'Issue → Resolution', participatingCapabilities: ['Customer Success', 'Product'] }
      ],
      governance: {
        performanceReviewCadence: 'Monthly revenue review',
        strategicReviewCadence: 'Quarterly board review',
        riskReview: 'Ad hoc, no fixed cadence',
        capacityReview: 'Not currently reviewed',
        changeGovernance: 'VP-level sign-off for GTM process changes',
        decisionEscalation: 'Escalates to CEO when Sales and Customer Success disagree'
      }
    };
  }

  /* ----------------------------------------------------------
     Init
     ---------------------------------------------------------- */

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

  global.OMSBuilderOperatingModel = { init: init, sampleData: sampleData, analyze: analyze, builderType: 'operating-model', label: 'Operating Model Designer' };
})(window);
