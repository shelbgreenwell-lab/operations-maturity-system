/*
 * Operations Maturity System
 * Sample Risk Model — Northstar Software, "Customer Onboarding."
 *
 * Current operations appear healthy. This sample exists to show why that
 * doesn't mean the value stream is safe: one specialist owns all complex
 * integrations, implementation runs on one platform with an untested
 * manual fallback, customer configuration data lives in a manually
 * reconciled spreadsheet, and executive exception approval has no
 * delegated backup. The value stream is performing. It is also fragile.
 */
(function (global) {
  'use strict';

  function build() {
    var K = global.OMSRisk;
    var id = function (p) { return K.newId(p); };

    var data = K.blankData();
    data.systemType = 'Value Stream';
    data.systemOwner = 'VP Implementation';
    data.valueOutcomeSupported = 'Customers move from contract signed to live without long waits, and onboarding value stream performance currently looks healthy.';
    data.stakeholdersAffected = 'New customers, Implementation team, Sales, Customer Success, Finance';
    data.criticality = 'Critical';
    data.criticalityExplanation = 'Onboarding is the first experience a paying customer has with the product. A stall here delays time to value and puts renewal and expansion at risk.';
    data.impacts = [
      { id: id('imp'), category: 'Customer', whatWouldHappen: 'New customers experience a slow, inconsistent start.', severity: 'High' },
      { id: id('imp'), category: 'Delivery', whatWouldHappen: 'Implementation queue grows and launch cycle time rises.', severity: 'Critical' },
      { id: id('imp'), category: 'Revenue', whatWouldHappen: 'Delayed time to value increases churn and expansion risk.', severity: 'High' }
    ];

    data.dependencies = [
      { id: id('dep'), category: 'People', whatDependedOn: 'Senior Integration Specialist', why: 'The only person who can configure complex multi-system integrations.', strength: 'Critical', alternativeAvailable: 'No', timeToSubstitute: 'Weeks', owner: 'VP Implementation', evidence: 'All complex integration tickets are assigned to one name.' },
      { id: id('dep'), category: 'Technology', whatDependedOn: 'Implementation Platform', why: 'Runs all customer configuration and integration setup.', strength: 'High', alternativeAvailable: 'No', timeToSubstitute: 'Weeks', owner: 'VP Implementation', evidence: '' },
      { id: id('dep'), category: 'Data', whatDependedOn: 'Customer Configuration Spreadsheet', why: 'Holds the configuration state implementation actually works from.', strength: 'High', alternativeAvailable: 'No', timeToSubstitute: 'Days', owner: '', evidence: '', concentrationDescription: 'All customer configuration data is manually reconciled through one shared spreadsheet.' },
      { id: id('dep'), category: 'Decisions', whatDependedOn: 'Executive Exception Approval', why: 'Required for any non-standard onboarding term.', strength: 'Critical', alternativeAvailable: 'No', timeToSubstitute: 'Days', owner: 'VP Implementation', evidence: '' },
      { id: id('dep'), category: 'Capacity', whatDependedOn: 'Implementation Capacity Buffer', why: 'Absorbs normal demand variability.', strength: 'High', alternativeAvailable: 'Unsure', timeToSubstitute: 'Weeks', owner: 'VP Implementation', evidence: '', concentrationDescription: 'Buffer drops well below normal every quarter-end close.' }
    ];

    data.technologyDependencies = [
      { id: id('tech'), system: 'Implementation Platform', purpose: 'Customer configuration and integration setup', owner: 'VP Implementation', criticalProcessesSupported: 'Customer Onboarding — Configuration', fallback: 'Manual configuration via spreadsheet and email', outageTolerance: '4 hours', manualWorkaround: 'Manual configuration process', manualWorkaroundTested: 'No', integrationDependencies: 'Salesforce CRM', knownReliabilityIssue: '', dataDependency: 'Customer Configuration Spreadsheet' }
    ];

    data.dataDependencies = [
      { id: id('data'), dataSource: 'Customer Configuration Spreadsheet', systemOfRecord: 'Shared spreadsheet — not a system of record', owner: '', consumers: 'Implementation team, Data Migration', validation: '', backup: 'None', recoveryMethod: '', freshnessRequirement: 'Real-time during active implementations', impactIfUnavailable: 'Implementation stalls or proceeds on stale data', usedInCriticalDecision: 'Yes', dataConfidence: 'Low', manuallyMaintained: 'Yes' }
    ];

    data.vendorDependencies = [
      { id: id('ven'), vendor: 'Implementation Platform Co.', service: 'Configuration and integration platform', criticality: 'Critical', alternativeSupplier: 'No', switchingTime: 'Months', contractDependency: 'Annual contract, auto-renews', dataDependency: 'Hosts all active configuration state', knowledgeDependency: 'Platform-specific setup expertise', operationalWorkaround: 'Manual configuration (untested)' }
    ];

    data.knowledgeRisks = [
      { id: id('kn'), whatKnowledge: 'Complex multi-system integration setup', documented: 'No', current: 'Unsure', canOthersExecute: 'No', backupTested: 'No', recoveryTime: 'Weeks' }
    ];

    data.failureScenarios = [
      { id: id('fs'), failure: 'Integration specialist unavailable for two weeks', startTime: '', expectedDuration: '2 weeks', affectedSystem: 'Customer Onboarding — Configuration' },
      { id: id('fs'), failure: 'Implementation Platform outage', startTime: '', expectedDuration: '4+ hours', affectedSystem: 'Customer Onboarding' }
    ];

    data.risks = [
      {
        id: id('r'), risk: 'Sole integration specialist becomes unavailable', system: 'Customer Onboarding', cause: 'No cross-trained backup for complex integrations',
        potentialImpact: 'Complex implementations stall, the queue grows, and launch cycle time rises.', likelihood: 'Moderate', impact: 'Critical',
        owner: 'VP Implementation', control: '', earlyWarning: '', response: 'Reassign to available generalists (untested)', recovery: 'Wait for the specialist to return, or hire and train a replacement',
        status: 'Open', reviewRhythm: '', evidence: 'All complex integration tickets are assigned to one name.',
        detectionMechanism: 'Noticed when complex tickets stop moving', automatedOrManual: 'Manual', timeToImpact: 'Days',
        fallbackExists: 'Unsure', backupExists: 'No', knowledgeExists: 'No', authorityExists: 'Yes', recoveryStepsExist: 'No', recoveryTested: 'No',
        relatedBlueprintType: '', relatedBlueprintId: ''
      },
      {
        id: id('r'), risk: 'Customer configuration data is lost or incorrect', system: 'Customer Onboarding', cause: 'Manually maintained spreadsheet with no validation and no backup',
        potentialImpact: 'Configuration errors surface during customer validation, late in the process.', likelihood: 'High', impact: 'High',
        owner: '', control: '', earlyWarning: '', response: '', recovery: '',
        status: 'Open', reviewRhythm: '', evidence: '',
        detectionMechanism: 'Customer validation call flags a mismatch', automatedOrManual: 'Manual', timeToImpact: 'Weeks'
      },
      {
        id: id('r'), risk: 'Executive approver unavailable for exception decisions', system: 'Customer Onboarding', cause: 'No delegated backup approver',
        potentialImpact: 'Exception-dependent deals stall until the approver returns.', likelihood: 'Moderate', impact: 'Moderate',
        owner: 'VP Implementation', control: '', earlyWarning: '', response: 'Wait for the approver to return', recovery: '',
        status: 'Open', reviewRhythm: '', evidence: '', detectionMechanism: '', timeToImpact: 'Days'
      }
    ];

    data.controls = [
      { id: id('ctl'), control: 'Manual configuration fallback procedure', riskAddressed: 'Implementation Platform outage', owner: 'VP Implementation', type: 'Corrective', frequency: 'As needed', evidence: '', monitoring: 'No' }
    ];

    return { data: data, owner: 'VP Implementation' };
  }

  global.OMSRiskSample = { build: build };
})(window);
