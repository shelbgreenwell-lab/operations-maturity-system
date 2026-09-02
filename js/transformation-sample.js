/*
 * Operations Maturity System
 * Transformation — Northstar Software sample plan.
 *
 * A deliberately mid-flight plan: the foundational phase is done, the
 * next is genuinely in progress, and one later phase has been started
 * anyway — showing exactly what "skipping ahead" looks like in practice.
 */
(function (global) {
  'use strict';

  function build() {
    var data = {
      planScope: 'Customer Onboarding operations',
      targetStateDescription: 'Onboarding runs on documented, owned processes with no single-person dependencies, reviewed on a standing rhythm rather than escalated ad hoc.',
      targetLayerScores: { direction: '4', design: '4', execution: '4', management: '3.5', intelligence: '3.5', evolution: '3' },
      phases: [
        {
          name: 'Stabilize', objective: 'Stop the bleeding — get onboarding predictable day to day.',
          exitCriteria: [
            { text: 'Onboarding queue has a named owner', met: 'true' },
            { text: 'Critical escalations have a documented path', met: 'true' }
          ],
          status: 'Complete', startDate: '2025-01-06', targetCompletionDate: '2025-03-01', actualCompletionDate: '2025-02-24',
          blockedReason: '', risks: '', owner: 'VP Implementation'
        },
        {
          name: 'Standardize', objective: 'Document the complex-implementation process so it does not depend on one specialist.',
          exitCriteria: [
            { text: 'Complex implementation steps documented in Blueprint', met: '' },
            { text: 'At least one other specialist trained on the full process', met: '' }
          ],
          status: 'Not Started', startDate: '', targetCompletionDate: '2025-06-30', actualCompletionDate: '',
          blockedReason: '', risks: 'The one specialist who could document the process is also the one running the queue.', owner: 'Process Lead'
        },
        {
          name: 'Control', objective: 'Add review checkpoints so drift gets caught before it becomes a customer issue.',
          exitCriteria: [
            { text: 'A recurring onboarding review rhythm exists', met: '' }
          ],
          status: 'In Progress', startDate: '2025-04-01', targetCompletionDate: '', actualCompletionDate: '',
          blockedReason: '', risks: '', owner: ''
        },
        {
          name: 'Optimize', objective: 'Reduce cycle time once the process is standardized and controlled.',
          exitCriteria: [], status: 'Not Started', startDate: '', targetCompletionDate: '', actualCompletionDate: '',
          blockedReason: '', risks: '', owner: ''
        },
        {
          name: 'Adapt', objective: 'Build the capability to redesign onboarding as volume and product mix change.',
          exitCriteria: [], status: 'Not Started', startDate: '', targetCompletionDate: '', actualCompletionDate: '',
          blockedReason: '', risks: '', owner: ''
        }
      ],
      sequencingNotes: 'Control was started ahead of Standardize to satisfy a leadership request for visibility into onboarding health. In hindsight, review checkpoints on an undocumented process are reviewing something no one else can execute.',
      findings: [], activity: []
    };
    return { data: data, owner: 'VP Implementation' };
  }

  global.OMSTransformationSample = { build: build };
})(window);
