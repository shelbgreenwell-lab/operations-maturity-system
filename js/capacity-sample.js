/*
 * Operations Maturity System
 * Sample Capacity Model — Northstar Software, Implementation Operations.
 *
 * The management narrative going in: "Utilization is high, demand has
 * grown, we need to hire." The numbers below are entered so the
 * deterministic rules can show a fuller picture: real capacity pressure
 * exists, but a material share of it comes from rework caused by
 * incomplete Sales handoffs, a heavy meeting load, one specialist
 * carrying all complex integration work, manual work allocation, and
 * executive approval delay on exceptions — not from headcount alone.
 */
(function (global) {
  'use strict';

  function build() {
    var C = global.OMSCapacity;
    var id = function (p) { return C.newId(p); };

    var data = C.blankData();
    data.subjectType = 'Team';
    data.timePeriod = 'Weekly';
    data.unitOfWork = 'Implementations';
    data.relatedValueStreamId = '';

    data.demand = { minimum: 3, typical: 5, peak: 8, pattern: 'Campaign Driven', patternNote: 'Peaks follow the end of each sales quarter as closed deals arrive in a batch.' };

    data.workTypes = [
      { id: id('wt'), name: 'Standard Implementation', pctVolume: 55, avgEffortValue: 16, avgEffortUnit: 'hours', skillRequired: 'Implementation Specialist', reworkLikelihood: 'Low', priority: 'Normal' },
      { id: id('wt'), name: 'Complex Integration', pctVolume: 30, avgEffortValue: 40, avgEffortUnit: 'hours', skillRequired: 'Senior Integration Specialist', reworkLikelihood: 'High', priority: 'High' },
      { id: id('wt'), name: 'Exception Handling', pctVolume: 15, avgEffortValue: 8, avgEffortUnit: 'hours', skillRequired: 'Implementation Specialist', reworkLikelihood: 'Medium', priority: 'Critical' }
    ];

    data.resources = { numberOfPeople: 8, scheduledHoursPerPerson: 40, workingDaysPerPeriod: 5, hoursPerDay: 8 };

    data.capacityLosses = [
      { id: id('loss'), category: 'Administration', mode: 'Percent', value: 4 },
      { id: id('loss'), category: 'Training', mode: 'Percent', value: 2 },
      { id: id('loss'), category: 'PTO / Absence', mode: 'Percent', value: 7 },
      { id: id('loss'), category: 'Required Documentation', mode: 'Percent', value: 4 },
      { id: id('loss'), category: 'Coordination', mode: 'Percent', value: 3 }
    ];

    data.productivity = { avgRateValue: 1, avgRateUnit: 'per week' };

    data.queue = { name: 'Implementation Backlog', arrivalRate: 6, processingRate: 5, waitTimeValue: 6, waitTimeUnit: 'days', queueSize: 14, importedFromValueStream: false, sourceQueueId: '' };

    data.diagnosisAnswers = {
      backlogRising: 'Yes', demandAboveOutput: 'Yes', waitDespiteAvailable: 'Yes', reworkConsuming: 'Yes',
      approvalsWait: 'Yes', skillImbalance: 'Yes', prioritiesChanging: 'No', workOutsideProcess: 'No',
      workloadVaries: 'Yes', waitingOnDecisions: 'Yes', waitingOnInfo: 'Yes', concentratedWorkType: 'No'
    };

    data.distribution = [
      { id: id('dist'), dimension: 'Process Stage', name: 'Complex Integration Configuration', demandLoadPct: 118 },
      { id: id('dist'), dimension: 'Process Stage', name: 'Customer Validation', demandLoadPct: 72 }
    ];

    data.skills = [
      { id: id('skill'), name: 'Complex Integrations', peopleCount: 1, isBottleneck: true, criticalWorkPct: 35, note: 'Only one specialist can configure complex or enterprise integrations.' }
    ];

    data.allocation = { method: 'Manager Assigned', matchesWorkNote: 'Complex work is not consistently routed to the specialist with the right skill; assignment depends on who the manager thinks is free.', agingIssue: true, cherryPicking: false, managerBottleneck: true };

    data.priorityLoad = [
      { priority: 'Critical', pctOfWork: 40 },
      { priority: 'High', pctOfWork: 35 },
      { priority: 'Normal', pctOfWork: 20 },
      { priority: 'Low', pctOfWork: 5 }
    ];

    data.rework = { pctOfCapacity: 18, note: 'Rework caused by incomplete Sales handoffs — missing technical requirements discovered during configuration.', importedFromValueStream: false };

    data.failureDemand = [
      { id: id('fd'), type: 'Reopened Implementation Tickets', volumePerPeriod: 1, avgEffortValue: 8, avgEffortUnit: 'hours' }
    ];

    data.meetings = [
      { id: id('mtg'), name: 'Daily Standup', participants: 8, durationHours: 1, frequency: 'Daily' },
      { id: id('mtg'), name: 'Cross-Functional Sync', participants: 8, durationHours: 1, frequency: 'Weekly' }
    ];

    data.contextSwitching = { queueCount: 4, isHigh: true, note: 'Specialists move between new implementations, exceptions, escalations, and rework without a defined order.' };

    data.concentrationRisks = [
      { id: id('risk'), type: 'Person', name: 'Complex Integrations Specialist', note: 'All complex integration work routes through one person with no documented backup.' }
    ];

    data.capacityOwner = '';
    data.operatingRhythm = { frequency: 'Ad hoc', inputs: '', participants: '', decisions: '', actions: '' };
    data.forecast = { lowCase: 5, expectedCase: 6, highCase: 8, period: 'Next quarter' };
    data.earlyWarningSignals = [
      { id: id('ews'), signal: 'Queue age', currentValue: '6 days average', note: '' },
      { id: id('ews'), signal: 'Rework rate', currentValue: '18%', note: '' },
      { id: id('ews'), signal: 'Escalation volume', currentValue: 'Rising', note: 'Not yet tracked precisely.' }
    ];
    data.bufferAssumptionPct = 15;

    return { data: data, subjectType: 'Team', systemTeam: 'Implementation Team', owner: '' };
  }

  global.OMSCapacitySample = { build: build };
})(window);
