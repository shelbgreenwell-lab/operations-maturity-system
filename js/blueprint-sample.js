/*
 * Operations Maturity System
 * Sample Blueprint — Northstar Software, a fictional B2B SaaS company.
 *
 * Deliberately interconnected and deliberately imperfect. The problems
 * below are not decorative — they are the same shape of problem the
 * Blueprint's deterministic rules are built to surface, so opening this
 * sample and clicking around should make those rules visible in action:
 *   - an executive decision bottleneck (six decisions all escalate to the CEO)
 *   - a key-person dependency (one person owns three critical onboarding processes)
 *   - a manual reporting reconciliation (a "Low criticality" spreadsheet
 *     quietly feeds three of the company's most important metrics)
 *   - an undefined Sales -> Implementation handoff
 *   - customer onboarding process drift (designed vs. actual)
 *   - capacity pressure in Implementation (also designed vs. actual)
 */
(function (global) {
  'use strict';

  function build() {
    return {
      meta: {
        mapping: 'organization',
        mappingOther: '',
        purpose: 'Grow Northstar into the category-leading platform for mid-market and enterprise operations teams, without letting growth outrun the systems that deliver it.',
        customer: 'Mid-market and enterprise B2B customers'
      },

      outcomes: [
        { id: 'out-revenue', name: 'Revenue Growth', description: 'Predictable, compounding new and expansion revenue.', priority: 'High', successMeasure: 'ARR grows 25% YoY', owner: 'CRO' },
        { id: 'out-retention', name: 'Customer Retention', description: 'Customers renew and expand because the product keeps its promises.', priority: 'High', successMeasure: 'Net revenue retention above 110%', owner: 'VP Customer Success' },
        { id: 'out-efficiency', name: 'Operational Efficiency', description: 'The cost of serving each customer goes down as the company scales.', priority: 'Medium', successMeasure: 'Cost-to-serve per customer down 15%', owner: 'COO' },
        { id: 'out-innovation', name: 'Product Innovation', description: 'The product stays ahead of what customers and the market need next.', priority: 'Medium', successMeasure: 'Four major releases shipped per year', owner: 'VP Product' }
      ],

      valueRecipients: [
        { id: 'vr-midmarket', recipient: 'Mid-market B2B customers', expectation: 'Reliable software that solves a defined operational problem, with responsive support when something breaks.', confirmation: 'Renewal rate and CSAT survey results', outcomeIds: ['out-retention', 'out-revenue'] },
        { id: 'vr-enterprise', recipient: 'Enterprise B2B customers', expectation: 'A scalable, secure platform with dedicated support, SLAs, and a partner who understands their business.', confirmation: 'Quarterly business review sentiment and expansion revenue', outcomeIds: ['out-revenue', 'out-retention'] }
      ],

      capabilities: [
        { id: 'cap-sales', name: 'Sales', purpose: 'Convert qualified pipeline into signed contracts.', owner: 'VP Sales', criticality: 'High', maturity: 'Defined', outcomeIds: ['out-revenue'], valueStreamIds: ['vs-leadtocustomer'] },
        { id: 'cap-marketing', name: 'Marketing', purpose: 'Generate qualified pipeline and build market awareness.', owner: 'VP Marketing', criticality: 'Medium', maturity: 'Repeatable', outcomeIds: ['out-revenue'], valueStreamIds: ['vs-leadtocustomer'] },
        { id: 'cap-implementation', name: 'Implementation', purpose: 'Onboard new customers into a working, correctly configured product.', owner: 'Priya Nair, Director of Implementation', criticality: 'High', maturity: 'Reactive', outcomeIds: ['out-retention'], valueStreamIds: ['vs-leadtocustomer'] },
        { id: 'cap-customersuccess', name: 'Customer Success', purpose: 'Drive adoption, renewal, and expansion across the customer base.', owner: 'VP Customer Success', criticality: 'High', maturity: 'Defined', outcomeIds: ['out-retention'], valueStreamIds: ['vs-issuetoresolution'] },
        { id: 'cap-product', name: 'Product & Engineering', purpose: 'Build and operate the software the whole company sells and supports.', owner: 'VP Product', criticality: 'Critical', maturity: 'Managed', outcomeIds: ['out-innovation'], valueStreamIds: ['vs-idealaunch'] },
        { id: 'cap-financeops', name: 'Finance & Operations', purpose: 'Manage billing, financial reporting, and operational infrastructure.', owner: 'COO', criticality: 'Medium', maturity: 'Reactive', outcomeIds: ['out-efficiency'], valueStreamIds: [] }
      ],

      valueStreams: [
        { id: 'vs-leadtocustomer', name: 'Lead → Customer', start: 'Marketing qualified lead', end: 'Signed, onboarded, live customer', valueCreated: 'A paying customer actively using the product', capabilityIds: ['cap-marketing', 'cap-sales', 'cap-implementation'], owner: 'VP Sales', stages: 'MQL, SQL, Opportunity, Closed Won, Onboarding, Live' },
        { id: 'vs-issuetoresolution', name: 'Issue → Resolution', start: 'Customer reports an issue', end: 'Issue resolved and confirmed', valueCreated: 'Restored trust and continuity of service', capabilityIds: ['cap-customersuccess'], owner: 'VP Customer Success', stages: 'Report, Triage, Resolve, Confirm' },
        { id: 'vs-idealaunch', name: 'Idea → Launch', start: 'Idea captured from customer feedback or strategy', end: 'Feature launched to customers', valueCreated: 'New capability delivered to the market', capabilityIds: ['cap-product'], owner: 'VP Product', stages: 'Discovery, Design, Build, Ship' }
      ],

      teams: [
        { id: 'team-sales', name: 'Sales Team', purpose: 'Run the sales team and pipeline execution.', capabilityIds: ['cap-sales'], valueStreamIds: ['vs-leadtocustomer'], leader: 'VP Sales' },
        { id: 'team-marketing', name: 'Marketing Team', purpose: 'Generate demand and qualified pipeline.', capabilityIds: ['cap-marketing'], valueStreamIds: ['vs-leadtocustomer'], leader: 'VP Marketing' },
        { id: 'team-implementation', name: 'Implementation Team', purpose: 'Configure and launch new customer accounts.', capabilityIds: ['cap-implementation'], valueStreamIds: ['vs-leadtocustomer'], leader: 'Priya Nair, Director of Implementation' },
        { id: 'team-customersuccess', name: 'Customer Success Team', purpose: 'Drive adoption, renewal, and expansion.', capabilityIds: ['cap-customersuccess'], valueStreamIds: ['vs-issuetoresolution'], leader: 'VP Customer Success' },
        { id: 'team-product', name: 'Product & Engineering Team', purpose: 'Build and operate the platform.', capabilityIds: ['cap-product'], valueStreamIds: ['vs-idealaunch'], leader: 'VP Product' },
        { id: 'team-financeops', name: 'Finance & Ops Team', purpose: 'Run billing, reporting, and operational infrastructure.', capabilityIds: ['cap-financeops'], valueStreamIds: [], leader: 'COO' }
      ],

      roles: [
        { id: 'role-cro', name: 'CRO', purpose: 'Owns the revenue number and go-to-market strategy.', teamId: 'team-sales', capabilityIds: ['cap-sales'], processIds: [], decisionIds: ['dec-pricing'], metricIds: [], governanceIds: ['gov-elt'] },
        { id: 'role-vpsales', name: 'VP Sales', purpose: 'Runs the sales team and pipeline execution.', teamId: 'team-sales', capabilityIds: ['cap-sales'], processIds: ['proc-qualification', 'proc-closing'], decisionIds: ['dec-discount'], metricIds: ['met-pipelinecoverage', 'met-winrate'], governanceIds: ['gov-revops'] },
        { id: 'role-dirimpl', name: 'Director of Implementation', purpose: '', teamId: 'team-implementation', capabilityIds: ['cap-implementation'], processIds: ['proc-onboardingconfig', 'proc-onboardingmigration', 'proc-onboardingtraining'], decisionIds: ['dec-capacity'], metricIds: [], governanceIds: [] },
        { id: 'role-vpcs', name: 'VP Customer Success', purpose: 'Owns retention and expansion across the customer base.', teamId: 'team-customersuccess', capabilityIds: ['cap-customersuccess'], processIds: ['proc-renewal', 'proc-triage'], decisionIds: ['dec-escalation'], metricIds: ['met-nrr', 'met-csat'], governanceIds: [] },
        { id: 'role-vpproduct', name: 'VP Product', purpose: 'Owns the product roadmap and engineering execution.', teamId: 'team-product', capabilityIds: ['cap-product'], processIds: [], decisionIds: ['dec-roadmap'], metricIds: ['met-adoption'], governanceIds: ['gov-product'] },
        { id: 'role-coo', name: 'COO', purpose: 'Owns operating infrastructure, finance, and cross-functional execution.', teamId: 'team-financeops', capabilityIds: ['cap-financeops'], processIds: ['proc-reporting'], decisionIds: [], metricIds: ['met-arr', 'met-grossmargin'], governanceIds: ['gov-elt'] },
        { id: 'role-vpmarketing', name: 'VP Marketing', purpose: 'Owns pipeline generation and brand awareness.', teamId: 'team-marketing', capabilityIds: ['cap-marketing'], processIds: [], decisionIds: [], metricIds: [], governanceIds: [] }
      ],

      decisions: [
        { id: 'dec-pricing', name: 'Pricing Exception', owner: 'CRO', frequency: 'Weekly', impact: 'High', escalationOwner: 'CEO', roleId: 'role-cro', processId: '' },
        { id: 'dec-discount', name: 'Discount Approval', owner: 'VP Sales', frequency: 'Weekly', impact: 'Medium', escalationOwner: 'CEO', roleId: 'role-vpsales', processId: 'proc-closing' },
        { id: 'dec-redline', name: 'Contract Redline Approval', owner: 'General Counsel', frequency: 'Ad Hoc', impact: 'High', escalationOwner: 'CEO', roleId: '', processId: 'proc-closing' },
        { id: 'dec-capacity', name: 'Implementation Capacity Allocation', owner: 'Priya Nair, Director of Implementation', frequency: 'Weekly', impact: 'Critical', escalationOwner: 'CEO', roleId: 'role-dirimpl', processId: 'proc-onboardingconfig' },
        { id: 'dec-escalation', name: 'Customer Escalation Response', owner: 'VP Customer Success', frequency: 'Ad Hoc', impact: 'High', escalationOwner: 'CEO', roleId: 'role-vpcs', processId: 'proc-triage' },
        { id: 'dec-roadmap', name: 'Roadmap Prioritization', owner: 'VP Product', frequency: 'Monthly', impact: 'High', escalationOwner: 'CEO', roleId: 'role-vpproduct', processId: '' }
      ],

      processes: [
        { id: 'proc-qualification', name: 'Lead Qualification', purpose: 'Confirm a lead is a real, fundable opportunity before it enters the pipeline.', owner: 'VP Sales', capabilityId: 'cap-sales', valueStreamId: 'vs-leadtocustomer', criticality: 'Medium', outcomeId: 'out-revenue' },
        { id: 'proc-closing', name: 'Contract Closing', purpose: 'Negotiate and execute a signed contract.', owner: 'VP Sales', capabilityId: 'cap-sales', valueStreamId: 'vs-leadtocustomer', criticality: 'High', outcomeId: 'out-revenue' },
        { id: 'proc-onboardingconfig', name: 'Customer Onboarding — Configuration', purpose: 'Configure the product for a new customer’s environment and use case.', owner: 'Priya Nair, Director of Implementation', capabilityId: 'cap-implementation', valueStreamId: 'vs-leadtocustomer', criticality: 'Critical', outcomeId: 'out-retention' },
        { id: 'proc-onboardingmigration', name: 'Customer Onboarding — Data Migration', purpose: 'Migrate the customer’s existing data into the platform.', owner: 'Priya Nair, Director of Implementation', capabilityId: 'cap-implementation', valueStreamId: 'vs-leadtocustomer', criticality: 'Critical', outcomeId: 'out-retention' },
        { id: 'proc-onboardingtraining', name: 'Customer Onboarding — Training', purpose: 'Train the customer’s team to use the product independently.', owner: 'Priya Nair, Director of Implementation', capabilityId: 'cap-implementation', valueStreamId: 'vs-leadtocustomer', criticality: 'High', outcomeId: 'out-retention' },
        { id: 'proc-renewal', name: 'Renewal & Expansion Review', purpose: 'Assess account health ahead of renewal and identify expansion opportunity.', owner: 'VP Customer Success', capabilityId: 'cap-customersuccess', valueStreamId: 'vs-issuetoresolution', criticality: 'High', outcomeId: 'out-retention' },
        { id: 'proc-reporting', name: 'Monthly Revenue Reporting', purpose: 'Produce the revenue and margin figures used for board and investor reporting.', owner: '', capabilityId: 'cap-financeops', valueStreamId: '', criticality: 'High', outcomeId: 'out-efficiency' },
        { id: 'proc-triage', name: 'Support Ticket Triage', purpose: 'Assess and route incoming support issues.', owner: 'VP Customer Success', capabilityId: 'cap-customersuccess', valueStreamId: 'vs-issuetoresolution', criticality: 'Medium', outcomeId: 'out-retention' }
      ],

      handoffs: [
        { id: 'ho-salesimpl', fromCapabilityId: 'cap-sales', toCapabilityId: 'cap-implementation', from: 'Sales', to: 'Implementation', whatMoves: 'Signed contract, deal notes, customer requirements', status: 'Undefined', impact: 'Critical', valueStreamId: 'vs-leadtocustomer', auto: false },
        { id: 'ho-implcs', fromCapabilityId: 'cap-implementation', toCapabilityId: 'cap-customersuccess', from: 'Implementation', to: 'Customer Success', whatMoves: 'Configured account and onboarding notes', status: 'Partially Defined', impact: 'High', valueStreamId: 'vs-leadtocustomer', auto: false },
        { id: 'ho-mktgsales', fromCapabilityId: 'cap-marketing', toCapabilityId: 'cap-sales', from: 'Marketing', to: 'Sales', whatMoves: 'Marketing qualified lead', status: 'Defined', impact: 'Medium', valueStreamId: 'vs-leadtocustomer', auto: false },
        { id: 'ho-csproduct', fromCapabilityId: 'cap-customersuccess', toCapabilityId: 'cap-product', from: 'Customer Success', to: 'Product & Engineering', whatMoves: 'Customer feedback and feature requests', status: 'Undefined', impact: 'Medium', valueStreamId: 'vs-idealaunch', auto: false }
      ],

      technology: [
        { id: 'tech-crm', name: 'CRM', purpose: 'System of record for pipeline, accounts, and contracts.', processIds: ['proc-qualification', 'proc-closing', 'proc-onboardingconfig', 'proc-onboardingmigration', 'proc-renewal', 'proc-reporting', 'proc-triage'], capabilityIds: ['cap-sales', 'cap-implementation', 'cap-customersuccess'], dataProduced: 'Pipeline, account, and contract data', owner: 'VP Sales', criticality: 'Critical' },
        { id: 'tech-billing', name: 'Billing System', purpose: 'Invoicing and revenue recognition.', processIds: ['proc-reporting'], capabilityIds: ['cap-financeops'], dataProduced: 'Invoice and payment data', owner: 'COO', criticality: 'High' },
        { id: 'tech-analytics', name: 'Product Analytics Platform', purpose: 'Track product usage and adoption.', processIds: ['proc-renewal'], capabilityIds: ['cap-product', 'cap-customersuccess'], dataProduced: 'Usage and adoption data', owner: 'VP Product', criticality: 'Medium' },
        { id: 'tech-supportdesk', name: 'Support Desk', purpose: 'Ticketing and support case management.', processIds: ['proc-triage'], capabilityIds: ['cap-customersuccess'], dataProduced: 'Support ticket data', owner: 'VP Customer Success', criticality: 'Medium' },
        { id: 'tech-spreadsheets', name: 'Finance Reconciliation Spreadsheets', purpose: 'Manual workaround used to reconcile revenue figures across systems.', processIds: ['proc-reporting'], capabilityIds: ['cap-financeops'], dataProduced: 'Manually reconciled revenue figures', owner: '', criticality: 'Low' }
      ],

      data: [
        { id: 'data-pipeline', name: 'Pipeline & Account Data', source: 'CRM', owner: 'VP Sales', systemIds: ['tech-crm'], processIds: ['proc-qualification', 'proc-closing'], metricIds: ['met-pipelinecoverage', 'met-winrate'], criticality: 'High' },
        { id: 'data-manualrecon', name: 'Manually Reconciled Revenue Figures', source: 'Finance team manual export from CRM, billing, and spreadsheets', owner: '', systemIds: ['tech-spreadsheets', 'tech-billing'], processIds: ['proc-reporting'], metricIds: ['met-arr', 'met-nrr', 'met-grossmargin'], criticality: 'Low' },
        { id: 'data-usage', name: 'Product Usage Data', source: 'Product Analytics Platform', owner: 'VP Product', systemIds: ['tech-analytics'], processIds: ['proc-renewal'], metricIds: ['met-adoption'], criticality: 'High' },
        { id: 'data-support', name: 'Support Ticket Data', source: 'Support Desk', owner: 'VP Customer Success', systemIds: ['tech-supportdesk'], processIds: ['proc-triage'], metricIds: ['met-csat', 'met-ticketrestime'], criticality: 'Medium' }
      ],

      metrics: [
        { id: 'met-arr', name: 'Annual Recurring Revenue (ARR)', outcomeId: 'out-revenue', processId: 'proc-reporting', owner: 'COO', frequency: 'Monthly', type: 'Lagging', decisionEnabled: 'Budget allocation, board reporting' },
        { id: 'met-nrr', name: 'Net Revenue Retention (NRR)', outcomeId: 'out-retention', processId: 'proc-renewal', owner: 'VP Customer Success', frequency: 'Monthly', type: 'Lagging', decisionEnabled: 'Renewal strategy and resourcing' },
        { id: 'met-grossmargin', name: 'Gross Margin', outcomeId: 'out-efficiency', processId: 'proc-reporting', owner: '', frequency: 'Monthly', type: 'Lagging', decisionEnabled: '' },
        { id: 'met-pipelinecoverage', name: 'Pipeline Coverage', outcomeId: 'out-revenue', processId: 'proc-qualification', owner: 'VP Sales', frequency: 'Weekly', type: 'Leading', decisionEnabled: 'Pricing exception, discount approval' },
        { id: 'met-winrate', name: 'Win Rate', outcomeId: 'out-revenue', processId: 'proc-closing', owner: 'VP Sales', frequency: 'Monthly', type: 'Lagging', decisionEnabled: 'Roadmap prioritization' },
        { id: 'met-adoption', name: 'Adoption Score', outcomeId: 'out-retention', processId: 'proc-renewal', owner: 'VP Product', frequency: 'Weekly', type: 'Leading', decisionEnabled: 'Roadmap prioritization, customer escalation response' },
        { id: 'met-csat', name: 'CSAT', outcomeId: 'out-retention', processId: 'proc-triage', owner: 'VP Customer Success', frequency: 'Monthly', type: 'Lagging', decisionEnabled: 'Customer escalation response' },
        { id: 'met-ticketrestime', name: 'Ticket Resolution Time', outcomeId: 'out-efficiency', processId: 'proc-triage', owner: 'VP Customer Success', frequency: 'Weekly', type: 'Leading', decisionEnabled: 'Support staffing' }
      ],

      rhythms: [
        { id: 'rhy-pipeline', name: 'Weekly Pipeline Review', purpose: 'Review pipeline health and coach open deals.', cadence: 'Weekly', owner: 'VP Sales', metricIds: ['met-pipelinecoverage', 'met-winrate'], decisionIds: ['dec-discount'], processIds: ['proc-qualification', 'proc-closing'] },
        { id: 'rhy-mbr', name: 'Monthly Business Review', purpose: 'Review company performance against plan.', cadence: 'Monthly', owner: 'CEO', metricIds: ['met-arr', 'met-nrr', 'met-grossmargin'], decisionIds: ['dec-roadmap'], processIds: ['proc-reporting'] },
        { id: 'rhy-capacity', name: 'Weekly Implementation Capacity Standup', purpose: 'Allocate implementation specialists across active onboardings.', cadence: 'Weekly', owner: 'Priya Nair, Director of Implementation', metricIds: [], decisionIds: ['dec-capacity'], processIds: ['proc-onboardingconfig'] },
        { id: 'rhy-health', name: 'Quarterly Customer Health Review', purpose: 'Review at-risk accounts and renewal risk.', cadence: 'Quarterly', owner: 'VP Customer Success', metricIds: ['met-nrr', 'met-adoption', 'met-csat'], decisionIds: ['dec-escalation'], processIds: ['proc-renewal'] }
      ],

      governance: [
        { id: 'gov-elt', mechanism: 'Executive Leadership Team (ELT)', whatIsGoverned: 'Company strategy, budget, and cross-functional escalations', owner: 'CEO', cadence: 'Weekly', threshold: 'Decisions above $50K or unresolved cross-functional conflicts', decisionAuthority: 'CEO, with ELT input', escalationPath: 'Any ELT member can escalate directly to the CEO', rhythmIds: ['rhy-mbr'] },
        { id: 'gov-revops', mechanism: 'Revenue Operations Council', whatIsGoverned: 'Pricing, discounting, and CRM data quality', owner: 'CRO', cadence: 'Monthly', threshold: 'Discounts above 20%', decisionAuthority: 'CRO, escalates to CEO above threshold', escalationPath: 'CEO', rhythmIds: ['rhy-pipeline'] },
        { id: 'gov-product', mechanism: 'Product Governance Board', whatIsGoverned: 'Roadmap prioritization and major architecture decisions', owner: 'VP Product', cadence: 'Monthly', threshold: 'Features affecting more than two teams', decisionAuthority: 'VP Product, escalates to CEO for roadmap conflicts', escalationPath: 'CEO', rhythmIds: [] }
      ],

      improvementMechanisms: [
        { id: 'imp-healthreview', name: 'Operational Health Review', inputs: 'Health signals, systemic risk findings, churn data', owner: 'COO', cadence: 'Quarterly', howTested: 'Piloted with one team before company-wide rollout', howStandardized: 'Documented in the internal operations playbook and reviewed at the Monthly Business Review', governanceIds: ['gov-elt'] },
        { id: 'imp-onboardingbacklog', name: 'Onboarding Process Improvement Backlog', inputs: 'Implementation team retrospectives, customer feedback on time-to-value', owner: 'Priya Nair, Director of Implementation', cadence: 'Monthly', howTested: 'New checklist steps are trialed on three accounts before wider rollout', howStandardized: 'Updates are written into the onboarding playbook', governanceIds: [] },
        { id: 'imp-feedbackloop', name: 'Customer Feedback → Product Loop', inputs: 'Support tickets, CSAT verbatims, churn interviews', owner: 'VP Product', cadence: 'Monthly', howTested: 'Prototyped with design-partner customers before broader release', howStandardized: 'Added to the product requirements template', governanceIds: ['gov-product'] }
      ],

      findings: [],

      healthSignals: {
        'capabilities:cap-implementation': 'Weak',
        'processes:proc-reporting': 'Critical',
        'processes:proc-onboardingconfig': 'Watch',
        'technology:tech-crm': 'Watch',
        'decisions:dec-capacity': 'Weak'
      },

      designedActualDifferences: [
        {
          id: 'dva-onboardingconfig', type: 'processes', objectId: 'proc-onboardingconfig',
          designed: 'Every new customer completes a standardized 4-step configuration checklist within 5 business days of contract signature.',
          actual: 'Configuration steps are frequently skipped or reordered under time pressure, and completion time ranges from 3 days to 6 weeks depending on which specialist is assigned.',
          recordedAt: '2026-01-15T00:00:00.000Z'
        },
        {
          id: 'dva-reporting', type: 'processes', objectId: 'proc-reporting',
          designed: 'Revenue and margin dashboards refresh automatically overnight from the billing and CRM systems.',
          actual: 'Finance manually exports data from three systems into a spreadsheet each month-end and reconciles it by hand — a three-day process before the board meeting.',
          recordedAt: '2026-01-15T00:00:00.000Z'
        },
        {
          id: 'dva-salesimpl', type: 'handoffs', objectId: 'ho-salesimpl',
          designed: 'Sales hands off a completed account brief and signed scope to Implementation within 24 hours of close.',
          actual: 'There is no standard handoff document. Implementation specialists often start onboarding without full context on what was sold or promised.',
          recordedAt: '2026-01-15T00:00:00.000Z'
        },
        {
          id: 'dva-implteam', type: 'teams', objectId: 'team-implementation',
          designed: 'Implementation capacity is planned a quarter ahead based on the sales pipeline forecast.',
          actual: 'Implementation is chronically over capacity. New onboardings are queued reactively as deals close, and specialists are frequently reassigned mid-engagement.',
          recordedAt: '2026-01-15T00:00:00.000Z'
        }
      ],

      activity: []
    };
  }

  global.OMSBlueprintSample = { build: build };
})(window);
