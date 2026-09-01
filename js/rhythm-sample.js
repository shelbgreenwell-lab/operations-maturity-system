/*
 * Operations Maturity System
 * Sample Operating Rhythms — Northstar Software, "current state."
 *
 * Leadership believes the organization has strong governance: there are
 * plenty of meetings. What this sample is built to reveal: the same
 * onboarding metric is reviewed in three different forums, none of the
 * standing reviews produce a decision, routine exceptions escalate
 * straight to a VP, and risk is reviewed monthly with no thresholds at
 * all. Load Sample creates all five rhythms at once so the duplication
 * and gaps are visible across the set, not just within one rhythm.
 */
(function (global) {
  'use strict';

  function build() {
    var R = global.OMSRhythm;
    var id = function (p) { return R.newId(p); };

    var standup = {
      name: 'Weekly Onboarding Standup', owner: 'Implementation Manager',
      data: Object.assign(R.blankData(), {
        purposeCategory: 'Delivery', purpose: 'Track onboarding implementation work in flight.',
        systemScope: 'Customer Onboarding', cadence: 'Weekly', estimatedDurationMinutes: '30',
        signals: [
          { id: id('sig'), name: 'Onboarding Lead Time', whyReviewed: 'To see whether onboarding is on pace', decisionSupported: '', owner: 'Implementation Manager', threshold: '', status: 'Watch', trend: 'Deteriorating', dataConfidence: 'High', disposition: 'Monitor' },
          { id: id('sig'), name: 'Handoff Defect Rate', whyReviewed: 'To see if Sales handoffs are clean', decisionSupported: '', owner: 'Implementation Manager', threshold: '', status: 'Weak', trend: 'Deteriorating', dataConfidence: 'High', disposition: 'Monitor' }
        ],
        participants: [
          { id: id('p'), role: 'Implementation Manager', whyRequired: 'Runs the team', decisionAuthority: 'Provides Input', informationOnly: 'No' },
          { id: id('p'), role: 'Implementation Specialists (4)', whyRequired: 'Status updates', decisionAuthority: 'Informed Only', informationOnly: 'Yes' },
          { id: id('p'), role: 'Sales Ops', whyRequired: 'Historical attendee', decisionAuthority: 'Informed Only', informationOnly: 'Yes' }
        ],
        decisions: [],
        inputs: [{ id: id('in'), type: 'Work In Progress', description: 'Open implementation tickets' }]
      })
    };

    var csSync = {
      name: 'Weekly Customer Success Sync', owner: 'VP Customer Success',
      data: Object.assign(R.blankData(), {
        purposeCategory: 'Customer Health', purpose: 'Review how new customers are progressing through onboarding.',
        systemScope: 'Customer Onboarding', cadence: 'Weekly', estimatedDurationMinutes: '45',
        signals: [
          { id: id('sig'), name: 'Onboarding Lead Time', whyReviewed: 'Customer Success also tracks this independently', decisionSupported: '', owner: 'VP Customer Success', threshold: '', status: 'Watch', trend: 'Deteriorating', dataConfidence: 'Moderate', disposition: 'Monitor' },
          { id: id('sig'), name: 'Time to Value', whyReviewed: 'Core customer health signal', decisionSupported: '', owner: 'VP Customer Success', threshold: '', status: 'Healthy', trend: 'Stable', dataConfidence: 'Moderate', disposition: 'No Action' },
          { id: id('sig'), name: 'Customer Satisfaction', whyReviewed: 'General health check', decisionSupported: '', owner: 'VP Customer Success', threshold: '', status: 'Healthy', trend: 'Stable', dataConfidence: 'High', disposition: 'No Action' }
        ],
        participants: [
          { id: id('p'), role: 'VP Customer Success', whyRequired: 'Owns the relationship', decisionAuthority: 'Informed Only', informationOnly: 'Yes' },
          { id: id('p'), role: 'Customer Success Managers (6)', whyRequired: 'Account updates', decisionAuthority: 'Informed Only', informationOnly: 'Yes' }
        ],
        decisions: [],
        inputs: [{ id: id('in'), type: 'Customer Signals', description: 'Account health scores' }]
      })
    };

    var businessReview = {
      name: 'Monthly Business Review', owner: 'CEO',
      data: Object.assign(R.blankData(), {
        purposeCategory: 'Performance', purpose: 'Review overall business performance against plan.',
        systemScope: 'Company-wide', cadence: 'Monthly', estimatedDurationMinutes: '90',
        cadenceRationale: 'Matches the board and investor reporting cycle.',
        signals: [
          { id: id('sig'), name: 'Onboarding Lead Time', whyReviewed: 'Shows up on the exec dashboard', decisionSupported: 'Whether to invest in onboarding capacity', owner: 'CEO', threshold: '28 days', status: 'Weak', trend: 'Deteriorating', dataConfidence: 'High', disposition: 'Decision' },
          { id: id('sig'), name: 'Customer Retention', whyReviewed: 'Core company metric', decisionSupported: '', owner: 'CEO', threshold: '', status: 'Watch', trend: 'Stable', dataConfidence: 'High', disposition: 'Monitor' }
        ],
        decisions: [
          { id: id('dec'), name: 'Approve Onboarding Capacity Investment', owner: 'CEO', requiredInputs: 'Capacity model, budget', authorityLevel: 'Executive', frequency: 'Monthly', expectedSpeed: 'Same meeting', escalationThreshold: '', executionOwner: 'VP Implementation', reviewDate: '', action: 'Approve headcount budget', expectedResult: 'Lead time back under 28 days', relatedMetric: 'Onboarding Lead Time', escalationIf: '' }
        ],
        participants: [
          { id: id('p'), role: 'CEO', whyRequired: 'Final authority', decisionAuthority: 'Decides', informationOnly: 'No' },
          { id: id('p'), role: 'VP Implementation', whyRequired: 'Owns onboarding', decisionAuthority: 'Provides Input', informationOnly: 'No' },
          { id: id('p'), role: 'VP Customer Success', whyRequired: 'Owns retention', decisionAuthority: 'Provides Input', informationOnly: 'No' },
          { id: id('p'), role: 'CFO', whyRequired: 'Budget approval', decisionAuthority: 'Provides Input', informationOnly: 'No' }
        ],
        inputs: [{ id: id('in'), type: 'Metrics', description: 'Company scorecard' }]
      })
    };

    var riskReview = {
      name: 'Monthly Risk Review', owner: 'VP Implementation',
      data: Object.assign(R.blankData(), {
        purposeCategory: 'Risk', purpose: 'Review open operational risks.',
        systemScope: 'Company-wide', cadence: 'Monthly', estimatedDurationMinutes: '45',
        signals: [
          { id: id('sig'), name: 'Executive Exception Approval Rate', whyReviewed: 'Tracked as a risk indicator', decisionSupported: '', owner: 'VP Implementation', threshold: '', status: 'Watch', trend: 'Deteriorating', dataConfidence: 'High', disposition: 'Monitor' },
          { id: id('sig'), name: 'Data Migration Failure Risk', whyReviewed: 'Standing risk register item', decisionSupported: '', owner: 'VP Implementation', threshold: '', status: 'Critical', trend: 'Unknown', dataConfidence: 'Low', disposition: 'No Action' }
        ],
        decisions: [],
        participants: [
          { id: id('p'), role: 'VP Implementation', whyRequired: 'Owns the risk register', decisionAuthority: 'Provides Input', informationOnly: 'No' },
          { id: id('p'), role: 'Head of Security', whyRequired: 'Security risks', decisionAuthority: 'Informed Only', informationOnly: 'Yes' }
        ],
        inputs: [{ id: id('in'), type: 'Risks', description: 'Risk register' }]
      })
    };

    var exceptionEscalation = {
      name: 'Executive Exception Escalation', owner: 'VP Implementation',
      data: Object.assign(R.blankData(), {
        purposeCategory: 'Escalation', purpose: 'Approve onboarding exceptions that fall outside the standard process.',
        systemScope: 'Customer Onboarding', cadence: 'Threshold-Triggered',
        isTriggered: true, triggerCondition: 'A deal requires any non-standard onboarding term.',
        triggerThreshold: 'Any exception, regardless of size', triggerOwner: 'Implementation Manager',
        triggerParticipants: 'VP Implementation', triggerDecisionRequired: 'Approve or deny the exception', triggerResponseTime: 'Same day',
        decisions: [
          { id: id('dec'), name: 'Approve Onboarding Exception', owner: 'VP Implementation', requiredInputs: 'Deal terms', authorityLevel: 'Executive', frequency: 'Weekly', expectedSpeed: 'Same day', escalationThreshold: 'Any exception', executionOwner: 'VP Implementation', reviewDate: '', action: 'Approve or deny', expectedResult: '', relatedMetric: '', escalationIf: 'Always — no lower threshold exists' },
          { id: id('dec'), name: 'Approve Configuration Deviation', owner: 'VP Implementation', requiredInputs: 'Configuration request', authorityLevel: 'Executive', frequency: 'Weekly', expectedSpeed: 'Same day', escalationThreshold: 'Any deviation', executionOwner: 'VP Implementation', reviewDate: '', action: 'Approve or deny', expectedResult: '', relatedMetric: '', escalationIf: 'Always — no lower threshold exists' }
        ],
        participants: [
          { id: id('p'), role: 'VP Implementation', whyRequired: 'Only person authorized to approve exceptions', decisionAuthority: 'Decides', informationOnly: 'No' },
          { id: id('p'), role: 'Implementation Manager', whyRequired: 'Raises the exception', decisionAuthority: 'Provides Input', informationOnly: 'No' }
        ],
        inputs: [{ id: id('in'), type: 'Exceptions', description: 'Exception requests' }]
      })
    };

    return {
      rhythms: [standup, csSync, businessReview, riskReview, exceptionEscalation]
    };
  }

  global.OMSRhythmSample = { build: build };
})(window);
