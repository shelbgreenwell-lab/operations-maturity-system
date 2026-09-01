/*
 * Operations Maturity System
 * Sample Health Model — Northstar Software, "Customer Onboarding Health."
 *
 * The teaching scenario from the spec: Time to Value is still on target,
 * but Implementation Queue Age, Sales Handoff Defect Rate, and
 * Configuration Rework Rate are all rising while capacity remains
 * adequate. The lesson: the outcome has not failed yet, but the operating
 * system underneath it is already deteriorating.
 */
(function (global) {
  'use strict';

  function build() {
    var H = global.OMSHealth;
    var id = function (p) { return H.newId(p); };
    var ts = function (vals) { return vals.map(function (v, i) { return { id: id('pt'), label: 'Week ' + (i + 1), value: String(v) }; }); };

    var dOutcome = {
      id: id('dim'), name: 'Customer Outcome', category: 'Outcome',
      whatHealthyLooksLike: 'New customers report meaningful value from the product within about a month of signing.',
      signal: 'Time to Value', deteriorationLooksLike: 'Time to Value creeping upward month over month.',
      earlyWarning: 'Watch Onboarding Flow, Implementation Queue Age, and Sales Handoff Quality — they move first.',
      whenToAct: 'When Time to Value crosses 40 days.', whoActs: 'VP Customer Success',
      statusMode: 'Threshold', direction: 'Lower Is Better',
      currentValue: '29', targetValue: '30', watchThreshold: '40', criticalThreshold: '55',
      thresholdSource: 'Leadership Target', reviewRhythm: 'Monthly', reportingLocation: 'Monthly operating review',
      decisionOnOffTrack: 'Executive review of the full onboarding chain before any pricing or product response.',
      timeSeries: ts([31, 30, 30, 29])
    };

    var dCustomer = {
      id: id('dim'), name: 'Customer Satisfaction', category: 'Customer',
      whatHealthyLooksLike: 'Customers rate the onboarding experience highly right after go-live.',
      signal: 'Post-onboarding CSAT', deteriorationLooksLike: 'CSAT scores drifting down after a strong start.',
      earlyWarning: 'A drop here often follows onboarding delays by a few weeks.',
      whenToAct: 'When CSAT falls below 80.', whoActs: 'VP Customer Success',
      statusMode: 'Threshold', direction: 'Higher Is Better',
      currentValue: '91', targetValue: '90', watchThreshold: '80', criticalThreshold: '70',
      thresholdSource: 'Leadership Target', reviewRhythm: 'Monthly', reportingLocation: 'Monthly operating review',
      decisionOnOffTrack: 'Customer Success reviews the affected accounts directly.',
      timeSeries: ts([90, 90, 91, 91])
    };

    var dFlow = {
      id: id('dim'), name: 'Onboarding Flow', category: 'Flow',
      whatHealthyLooksLike: 'Customers move from contract signed to live without long waits between steps.',
      signal: 'Onboarding Lead Time', deteriorationLooksLike: 'Lead time creeping upward as queue age and rework absorb capacity.',
      earlyWarning: 'Implementation Queue Age typically rises before Onboarding Lead Time does.',
      whenToAct: 'When lead time crosses 28 days.', whoActs: 'VP Implementation',
      statusMode: 'Threshold', direction: 'Lower Is Better',
      currentValue: '24', targetValue: '21', watchThreshold: '28', criticalThreshold: '35',
      thresholdSource: 'Customer Requirement', reviewRhythm: 'Weekly', reportingLocation: 'Implementation weekly sync',
      decisionOnOffTrack: 'Review the Value Stream trace for the largest wait location before adding headcount.',
      timeSeries: ts([19, 21, 23, 24])
    };

    var dQueue = {
      id: id('dim'), name: 'Implementation Queue Age', category: 'Capacity',
      whatHealthyLooksLike: 'New implementations start within a few days of handoff.',
      signal: 'Average queue age before implementation starts', deteriorationLooksLike: 'Work sits longer before anyone picks it up.',
      earlyWarning: 'Queue age rising is usually the first visible sign implementation capacity is falling behind demand — before Onboarding Lead Time or Time to Value move at all.',
      whenToAct: 'When average queue age crosses 5 days.', whoActs: 'Implementation Manager',
      statusMode: 'Threshold', direction: 'Lower Is Better',
      currentValue: '6', targetValue: '3', watchThreshold: '5', criticalThreshold: '8',
      thresholdSource: 'Operational Standard', reviewRhythm: 'Weekly', reportingLocation: 'Implementation weekly sync',
      decisionOnOffTrack: 'Check demand against effective capacity before assuming the team needs more headcount.',
      timeSeries: ts([3, 4, 5, 6])
    };

    var dHandoff = {
      id: id('dim'), name: 'Sales Handoff Quality', category: 'Quality',
      whatHealthyLooksLike: 'Handoffs from Sales arrive with all required information.',
      signal: 'Sales Handoff Defect Rate', deteriorationLooksLike: 'A rising share of handoffs are missing required fields.',
      earlyWarning: 'This is usually the earliest signal in the chain — it moves before rework, queue age, or lead time do.',
      whenToAct: 'When the defect rate crosses 10%.', whoActs: 'Implementation Manager',
      statusMode: 'Threshold', direction: 'Lower Is Better',
      currentValue: '13', targetValue: '5', watchThreshold: '10', criticalThreshold: '20',
      thresholdSource: 'Operational Standard', reviewRhythm: 'Weekly', reportingLocation: 'Implementation weekly sync',
      decisionOnOffTrack: 'Sales ops reviews the last 10 defective handoffs with the rep and reissues the checklist.',
      timeSeries: ts([6, 8, 11, 13])
    };

    var dRework = {
      id: id('dim'), name: 'Configuration Rework', category: 'Quality',
      whatHealthyLooksLike: 'Implementation work is done right the first time.',
      signal: 'Configuration Rework Rate', deteriorationLooksLike: 'A rising share of implementation work has to be redone.',
      earlyWarning: 'Rework tends to rise a few weeks after Sales Handoff Quality starts slipping.',
      whenToAct: 'When rework crosses 15%.', whoActs: 'Implementation Manager',
      statusMode: 'Threshold', direction: 'Lower Is Better',
      currentValue: '17', targetValue: '8', watchThreshold: '15', criticalThreshold: '25',
      thresholdSource: 'Historical Baseline', reviewRhythm: 'Weekly', reportingLocation: 'Implementation weekly sync',
      decisionOnOffTrack: 'Pull the related handoffs and raise them with Sales ops rather than retraining specialists.',
      timeSeries: ts([9, 12, 15, 17])
    };

    var dCapacity = {
      id: id('dim'), name: 'Implementation Capacity', category: 'Capacity',
      whatHealthyLooksLike: 'The team has enough slack to absorb normal demand variability.',
      signal: 'Implementation Capacity Buffer', deteriorationLooksLike: 'Buffer shrinks toward zero as demand or rework consumes more hours.',
      earlyWarning: 'A shrinking buffer alongside rising rework is a sign capacity is quietly being consumed by fixable defects, not real demand growth.',
      whenToAct: 'When buffer falls below 10%.', whoActs: 'VP Implementation',
      statusMode: 'Threshold', direction: 'Higher Is Better',
      currentValue: '18', targetValue: '15', watchThreshold: '10', criticalThreshold: '0',
      thresholdSource: 'Capacity Limit', reviewRhythm: 'Monthly', reportingLocation: 'Monthly operating review',
      decisionOnOffTrack: 'Decide whether to add capacity or fix the upstream quality issues consuming it first.',
      timeSeries: ts([19, 18.5, 19, 18.6])
    };

    var dRisk = {
      id: id('dim'), name: 'Executive Exception Approvals', category: 'Risk',
      whatHealthyLooksLike: 'Exceptions to the standard onboarding process are rare and clearly justified.',
      signal: 'Executive Exception Approval Rate', deteriorationLooksLike: 'A rising share of deals require an executive exception to move forward.',
      earlyWarning: 'A rising exception rate often means the standard process is quietly being bypassed to hit deal dates.',
      whenToAct: 'When the exception rate crosses 10%.', whoActs: 'VP Implementation',
      statusMode: 'Threshold', direction: 'Lower Is Better',
      currentValue: '7', targetValue: '5', watchThreshold: '10', criticalThreshold: '15',
      thresholdSource: 'Risk Tolerance', reviewRhythm: 'Monthly', reportingLocation: 'Monthly operating review',
      decisionOnOffTrack: 'Review the last quarter of exceptions for a common root cause before granting more.',
      timeSeries: ts([5, 6, 6, 7])
    };

    var data = H.blankData();
    data.scopeType = 'Value Stream';
    data.businessOutcome = 'Time to Value';
    data.performanceStatus = 'On Target';
    data.dimensions = [dOutcome, dCustomer, dFlow, dQueue, dHandoff, dRework, dCapacity, dRisk];
    data.signalCascades = [
      { id: id('cas'), earlySignal: 'Sales Handoff Defect Rate rising', operatingCondition: 'Implementation Queue Age and Configuration Rework Rate rising', performanceImpact: 'Onboarding Lead Time creeping upward', businessOutcome: 'Time to Value and Customer Retention at risk' }
    ];

    return { data: data, scopeType: 'Value Stream', owner: 'VP Implementation' };
  }

  global.OMSHealthSample = { build: build };
})(window);
