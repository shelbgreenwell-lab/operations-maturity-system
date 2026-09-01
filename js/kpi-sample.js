/*
 * Operations Maturity System
 * Sample KPI Model — Northstar Software, "Customer Onboarding Measures."
 *
 * Builds the exact metric chain used to teach leading vs. lagging:
 * Handoff Defect Rate -> Implementation Rework -> Onboarding Lead Time ->
 * Time to Value -> Customer Retention. Also includes one deliberately
 * weak KPI ("Tickets Closed") with no owner or decision, so the quality
 * rules and the Activity vs. Outcome distinction have something real to
 * flag.
 */
(function (global) {
  'use strict';

  function build() {
    var K = global.OMSKpi;
    var id = function (p) { return K.newId(p); };

    var kHandoff = {
      id: id('kpi'), name: 'Handoff Defect Rate',
      decision: 'Whether to pause new Sales closes until Implementation handoff quality improves', decisionOwner: 'VP Implementation', decisionFrequency: 'Weekly',
      consequenceLateWrong: 'Rework keeps consuming implementation capacity while leadership assumes the team just needs more headcount.',
      purpose: 'Tracks how often a Sales-to-Implementation handoff is missing required information.',
      kpiType: 'Quality', leadingLagging: 'Leading', owner: 'Implementation Manager', dataOwner: 'Sales Operations',
      decisionEnabled: 'Whether to require complete handoff checklists before a deal is marked closed-won',
      formula: 'Handoffs with missing required fields ÷ total handoffs, per week', dataSource: 'CRM handoff checklist',
      unit: '%', frequency: 'Weekly', direction: 'Lower Is Better', target: '5%', warningThreshold: '10%', criticalThreshold: '20%',
      thresholdSource: 'Operational Standard', reportingLocation: 'Implementation weekly sync', reviewRhythm: 'Weekly',
      actionOffTarget: 'Sales ops reviews the last 10 defective handoffs with the rep and reissues the checklist.',
      dataConfidence: 'High', knownQualityIssue: '', gamingRisk: 'Marking a handoff "complete" without actually verifying the fields.',
      activityOrValue: 'Value', hasOutcomeConnection: true, reviewedButNoDecision: 'No'
    };

    var kRework = {
      id: id('kpi'), name: 'Implementation Rework Rate',
      decision: 'Whether configuration issues are a training problem or a handoff problem', decisionOwner: 'Implementation Manager', decisionFrequency: 'Weekly',
      consequenceLateWrong: 'The team keeps training specialists on a problem that actually originates upstream.',
      purpose: 'Share of implementation work that has to be redone due to incomplete or incorrect handoff information.',
      kpiType: 'Process', leadingLagging: 'Leading', owner: 'Implementation Manager', dataOwner: 'Implementation Manager',
      decisionEnabled: 'Whether to escalate to Sales leadership about handoff quality',
      formula: 'Implementation tickets reopened for missing info ÷ total implementation tickets', dataSource: 'Ticketing platform',
      unit: '%', frequency: 'Weekly', direction: 'Lower Is Better', target: '8%', warningThreshold: '15%', criticalThreshold: '25%',
      thresholdSource: 'Historical Baseline', reportingLocation: 'Implementation weekly sync', reviewRhythm: 'Weekly',
      actionOffTarget: 'Manager pulls the related handoffs and raises them with Sales ops.',
      dataConfidence: 'High', knownQualityIssue: '', gamingRisk: 'Logging rework as "new scope" instead of reopening the original ticket.',
      activityOrValue: 'Value', hasOutcomeConnection: true, reviewedButNoDecision: 'No'
    };

    var kOnboarding = {
      id: id('kpi'), name: 'Onboarding Lead Time',
      decision: 'Whether implementation capacity or process design is the constraint on onboarding speed', decisionOwner: 'VP Implementation', decisionFrequency: 'Monthly',
      consequenceLateWrong: 'Customers experience a slow start and the cause is misattributed to headcount.',
      purpose: 'Total elapsed time from contract signed to customer live.',
      kpiType: 'Flow', leadingLagging: 'Leading', owner: 'VP Implementation', dataOwner: 'Implementation Manager',
      decisionEnabled: 'Whether to invest in capacity, process redesign, or handoff quality',
      formula: 'Launch date minus contract signed date, averaged per month', dataSource: 'Value Stream: Lead to Live Customer',
      unit: 'days', frequency: 'Monthly', direction: 'Lower Is Better', target: '21 days', warningThreshold: '28 days', criticalThreshold: '35 days',
      thresholdSource: 'Customer Requirement', reportingLocation: 'Monthly operating review', reviewRhythm: 'Monthly',
      actionOffTarget: 'Review the Value Stream trace for the largest wait location before adding headcount.',
      dataConfidence: 'High', knownQualityIssue: '', gamingRisk: 'Marking a customer "live" before configuration is actually complete.',
      activityOrValue: 'Value', hasOutcomeConnection: true, reviewedButNoDecision: 'No'
    };

    var kTimeToValue = {
      id: id('kpi'), name: 'Time to Value',
      decision: 'Whether the customer experience during onboarding needs executive attention', decisionOwner: 'VP Customer Success', decisionFrequency: 'Monthly',
      consequenceLateWrong: 'A customer churns before anyone notices the onboarding experience degraded.',
      purpose: 'Time from contract signed until the customer reports realizing meaningful value from the product.',
      kpiType: 'Outcome', leadingLagging: 'Lagging', owner: 'VP Customer Success', dataOwner: 'Customer Success Ops',
      decisionEnabled: 'Whether onboarding investment is paying off',
      formula: 'Customer-reported "first value" date minus contract signed date', dataSource: 'Customer success survey + product usage',
      unit: 'days', frequency: 'Monthly', direction: 'Lower Is Better', target: '30 days', warningThreshold: '40 days', criticalThreshold: '55 days',
      thresholdSource: 'Leadership Target', reportingLocation: 'Monthly operating review', reviewRhythm: 'Monthly',
      actionOffTarget: 'Customer Success reviews the affected accounts and checks Onboarding Lead Time for the same period.',
      dataConfidence: 'Moderate', knownQualityIssue: 'Relies partly on a customer survey with an incomplete response rate.', gamingRisk: '',
      activityOrValue: 'Value', hasOutcomeConnection: true, reviewedButNoDecision: 'No'
    };

    var kRetention = {
      id: id('kpi'), name: 'Customer Retention',
      decision: 'Whether to change the onboarding or account management model', decisionOwner: 'CEO', decisionFrequency: 'Quarterly',
      consequenceLateWrong: 'Revenue erodes before leadership connects it to an operational cause.',
      purpose: 'Share of customers still active twelve months after signing.',
      kpiType: 'Outcome', leadingLagging: 'Lagging', owner: 'VP Customer Success', dataOwner: 'Finance',
      decisionEnabled: 'Whether onboarding and account management investment is working',
      formula: 'Customers active at month 12 ÷ customers who signed 12 months prior', dataSource: 'Billing system',
      unit: '%', frequency: 'Quarterly', direction: 'Higher Is Better', target: '92%', warningThreshold: '88%', criticalThreshold: '82%',
      thresholdSource: 'Leadership Target', reportingLocation: 'Quarterly business review', reviewRhythm: 'Quarterly',
      actionOffTarget: 'Executive review of the onboarding and account management chain before any pricing or product response.',
      dataConfidence: 'High', knownQualityIssue: '', gamingRisk: 'Delaying contract cancellation paperwork to keep an account "active" past the measurement date.',
      activityOrValue: 'Value', hasOutcomeConnection: true, reviewedButNoDecision: 'No'
    };

    var kTicketsClosed = {
      id: id('kpi'), name: 'Tickets Closed',
      decision: '', decisionOwner: '', decisionFrequency: '',
      consequenceLateWrong: '',
      purpose: 'Total support tickets closed per week.',
      kpiType: 'Custom', leadingLagging: 'Lagging', owner: '', dataOwner: '',
      decisionEnabled: '', formula: 'Count of tickets marked closed', dataSource: 'Ticketing platform',
      unit: 'count', frequency: 'Weekly', direction: 'Higher Is Better', target: '', warningThreshold: '', criticalThreshold: '',
      thresholdSource: 'Unknown', reportingLocation: 'Support team dashboard', reviewRhythm: 'Weekly',
      actionOffTarget: '', dataConfidence: 'High', knownQualityIssue: '', gamingRisk: 'Closing simple tickets first while complex issues age in the queue.',
      activityOrValue: 'Activity', hasOutcomeConnection: false, reviewedButNoDecision: 'Yes'
    };

    var data = K.blankData();
    data.scopeType = 'Value Stream';
    data.kpis = [kHandoff, kRework, kOnboarding, kTimeToValue, kRetention, kTicketsClosed];
    data.chainLinks = [
      { id: id('chain'), from: 'Handoff Defect Rate', to: 'Implementation Rework Rate', relation: 'Leads To' },
      { id: id('chain'), from: 'Implementation Rework Rate', to: 'Onboarding Lead Time', relation: 'Influences' },
      { id: id('chain'), from: 'Onboarding Lead Time', to: 'Time to Value', relation: 'Influences' },
      { id: id('chain'), from: 'Time to Value', to: 'Customer Retention', relation: 'Warns About' }
    ];
    data.outcomeDriverChains = [
      { id: id('odc'), outcome: 'Customer Retention', driver: 'Fast, Successful Onboarding', operatingSignal: 'Onboarding Cycle Time', earlyWarning: 'Implementation Queue Age' }
    ];

    return { data: data, scopeType: 'Value Stream', owner: '' };
  }

  global.OMSKpiSample = { build: build };
})(window);
