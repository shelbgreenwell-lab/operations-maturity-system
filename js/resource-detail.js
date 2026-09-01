/*
 * Operations Maturity System
 * Shared rich resource-detail renderer.
 *
 * Responsible for:
 * - rendering the full flagship resource template (question, why
 *   it exists, good/bad execution, system connections, maturity
 *   progression, failure signals, operator mode, related systems)
 * - rendering the lighter panel used for non-flagship domains
 * - rendering shared breadcrumb and prev/next domain navigation
 *
 * Used by both js/explore.js and js/learn.js so the "open a
 * system" experience is identical everywhere it happens. Content
 * itself lives in /data/resources.json and /data/operating-layers.json.
 */

(function (global) {
  'use strict';

  var LEVEL_COLOR_VAR = { 1: '--level-1', 2: '--level-2', 3: '--level-3', 4: '--level-4', 5: '--level-5' };

  function links() {
    return global.OMSLinks || { resolve: function () { return '#'; }, renderList: function () { return ''; } };
  }

  function escapeAttr(str) {
    return String(str || '');
  }

  function section(eyebrow, title, bodyHtml, opts) {
    if (!bodyHtml) return '';
    opts = opts || {};
    return '' +
      '<div class="section-head" style="margin-top:' + (opts.tight ? 'var(--space-6)' : 'var(--space-8)') + '">' +
        (eyebrow ? '<span class="eyebrow">' + eyebrow + '</span>' : '') +
        (title ? '<h3 style="margin-top:var(--space-2)">' + title + '</h3>' : '') +
      '</div>' +
      bodyHtml;
  }

  function bulletList(items, className) {
    if (!items || !items.length) return '';
    return '<ul' + (className ? ' class="' + className + '"' : '') + '>' +
      items.map(function (i) { return '<li>' + i + '</li>'; }).join('') +
      '</ul>';
  }

  function operatorQuestionList(items) {
    if (!items || !items.length) return '';
    return '<ul style="display:flex;flex-direction:column;gap:var(--space-3)">' +
      items.map(function (q) { return '<li class="operator-question">' + q + '</li>'; }).join('') +
      '</ul>';
  }

  function pillList(items, resolvable) {
    if (!items || !items.length) return '';
    return '<div class="tag-list">' + items.map(function (i) {
      if (resolvable && i.type) {
        return '<a class="pill" href="' + links().resolve(i) + '">' + i.label + '</a>';
      }
      return '<span class="pill">' + i + '</span>';
    }).join('') + '</div>';
  }

  function relationshipGrid(dependencies) {
    if (!dependencies) return '';
    var order = [
      { key: 'dependsOn', label: 'Depends On' },
      { key: 'enables', label: 'Enables' },
      { key: 'influences', label: 'Influences' },
      { key: 'governs', label: 'Governs' },
      { key: 'measures', label: 'Measures' },
      { key: 'executes', label: 'Executes' },
      { key: 'informs', label: 'Informs' }
    ];
    var groups = order.map(function (o) {
      var items = dependencies[o.key];
      if (!items || !items.length) return '';
      return '<div class="relationship-group"><h4>' + o.label + '</h4>' + pillList(items, true) + '</div>';
    }).filter(Boolean).join('');
    if (!groups) return '';
    return '<div class="relationship-grid">' + groups + '</div>';
  }

  function maturityLadder(progression) {
    if (!progression || !progression.length) return '';
    return '<div class="level-track">' + progression.map(function (level) {
      return '' +
        '<div class="level-card" style="--level-color:var(' + LEVEL_COLOR_VAR[level.level] + ')">' +
          '<span class="level-card__number">Level ' + level.level + '</span>' +
          '<span class="level-card__name">' + level.name + '</span>' +
          '<p class="level-card__statement">' + level.description + '</p>' +
        '</div>';
    }).join('') + '</div>';
  }

  function signalGrid(signals) {
    if (!signals) return '';
    var blocks = [
      { key: 'healthy', label: 'Healthy', cls: 'signal-block--healthy' },
      { key: 'warning', label: 'Early Warning', cls: 'signal-block--warning' },
      { key: 'failure', label: 'Failure', cls: 'signal-block--failure' }
    ].map(function (b) {
      var items = signals[b.key];
      if (!items || !items.length) return '';
      return '<div class="signal-block ' + b.cls + '"><h4>' + b.label + '</h4>' + bulletList(items) + '</div>';
    }).filter(Boolean).join('');
    if (!blocks) return '';
    return '<div class="signal-grid">' + blocks + '</div>';
  }

  function operatorMode(mode) {
    if (!mode) return '';
    var blocks = [
      { key: 'investigate', label: 'Investigate' },
      { key: 'evidence', label: 'Evidence' },
      { key: 'observe', label: 'Observe' },
      { key: 'measure', label: 'Measure' },
      { key: 'doNotYet', label: 'Do Not Do Yet' }
    ].map(function (b) {
      var items = mode[b.key];
      if (!items || !items.length) return '';
      return '<div><h4>' + b.label + '</h4>' + bulletList(items) + '</div>';
    }).filter(Boolean).join('');
    if (!blocks) return '';
    return '<details class="operator-mode"><summary>Operator Mode</summary><div class="operator-mode__body">' + blocks + '</div></details>';
  }

  function twoColumn(leftTitle, left, rightTitle, right) {
    if (!left && !right) return '';
    return '<div class="resource-detail__grid">' +
      (left ? '<div class="outcome-block"><h4>' + leftTitle + '</h4><p class="text-muted">' + left + '</p></div>' : '') +
      (right ? '<div class="outcome-block"><h4>' + rightTitle + '</h4><p class="text-muted">' + right + '</p></div>' : '') +
      '</div>';
  }

  function threeLists(a, b, c) {
    var cols = [a, b, c].filter(function (x) { return x.items && x.items.length; });
    if (!cols.length) return '';
    return '<div class="outcome-grid">' + cols.map(function (x) {
      return '<div class="outcome-block"><h4>' + x.title + '</h4>' + bulletList(x.items) + '</div>';
    }).join('') + '</div>';
  }

  /**
   * Renders the full flagship resource template into `mountEl`.
   */
  function renderFlagship(resource, mountEl) {
    if (!mountEl || !resource) return;

    var html = '';

    html += '<span class="badge badge--accent">' + (resource.systemCategory || resource.layer) + '</span>';
    html += '<h1 style="margin:var(--space-3) 0">' + resource.title + '</h1>';
    html += '<p class="resource-hero__question">' + resource.question + '</p>';
    html += '<p class="lede" style="max-width:70ch">' + resource.whatItIs + '</p>';

    if (resource.whyThisExists) {
      html += '<div class="callout" style="margin-top:var(--space-6)"><strong style="display:block;margin-bottom:var(--space-2);font-family:var(--font-mono);font-size:var(--step--1);letter-spacing:.06em;text-transform:uppercase;color:var(--color-accent)">Why This Exists</strong>' + resource.whyThisExists + '</div>';
    }

    html += section('', 'What Good Looks Like &amp; What Bad Looks Like',
      twoColumn('What Good Looks Like', resource.goodLooksLike, 'What Bad Looks Like', resource.badLooksLike));

    html += section('Failure Patterns', 'What Failure Looks Like',
      bulletList(resource.failureSymptoms, 'layer-detail__weak'));

    html += section('System Connections', 'How this connects to everything else',
      relationshipGrid(resource.dependencies));

    html += section('Consequence', 'What Breaks When This Is Weak',
      bulletList(resource.whatBreaksWhenWeak, 'layer-detail__weak'));

    if (resource.commonMisdiagnoses && resource.commonMisdiagnoses.length) {
      html += section('Systems Thinking', 'Don&rsquo;t Confuse This With&hellip;',
        '<p class="text-muted">This symptom is often misdiagnosed as:</p>' + pillList(resource.commonMisdiagnoses, false).replace('tag-list', 'misdiagnosis-list'));
    }

    html += section('Maturity Progression', 'How this changes from Reactive to Adaptive',
      maturityLadder(resource.maturityProgression));

    html += section('Operational Signals', 'What to watch for',
      signalGrid(resource.signals));

    html += section('', 'When To Use It &amp; When Not To',
      twoColumn('When To Use It', resource.whenToUse, 'When Not To Use It', resource.whenNotToUse));

    html += section('Building The System', 'How to build, govern, and measure it',
      threeLists(
        { title: 'How To Build It', items: resource.howToBuild },
        { title: 'How To Govern It', items: resource.howToGovern },
        { title: 'How To Measure It', items: resource.howToMeasure }
      ));

    html += section('Operator Questions', 'Questions a great operator would ask',
      operatorQuestionList(resource.operatorQuestions));

    html += operatorMode(resource.operatorMode);

    var relatedHtml = '';
    if (resource.relatedResources && resource.relatedResources.length) {
      relatedHtml += '<div class="outcome-block"><h4>Related Systems</h4><div class="related-links">' + links().renderList(resource.relatedResources) + '</div></div>';
    }
    if (resource.relatedAntiPatterns && resource.relatedAntiPatterns.length) {
      relatedHtml += '<div class="outcome-block"><h4>Related Anti-Patterns</h4><div class="related-links">' + links().renderList(resource.relatedAntiPatterns) + '</div></div>';
    }
    if (resource.relatedDiagnostics && resource.relatedDiagnostics.length) {
      relatedHtml += '<div class="outcome-block"><h4>Related Diagnostics</h4><div class="related-links">' + links().renderList(resource.relatedDiagnostics) + '</div></div>';
    }
    if (relatedHtml) {
      html += section('Related Systems', 'Everything connects', '<div class="outcome-grid">' + relatedHtml + '</div>');
    }

    if (resource.nextBestAction) {
      html += '<div class="next-action"><span>Next best action</span>' +
        '<a class="btn btn--primary" href="' + links().resolve(resource.nextBestAction) + '">' + resource.nextBestAction.label + ' &rarr;</a>' +
        '</div>';
    }

    if (global.OMSWorkbenchCore) {
      html += '<div class="next-action" style="margin-top:var(--space-4)"><span>Keep this while you work</span>' +
        '<button type="button" class="btn btn--secondary" id="resource-save-to-workbench">Save To Workbench</button></div>';
    }

    mountEl.innerHTML = html;

    var saveBtn = mountEl.querySelector('#resource-save-to-workbench');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var WB = global.OMSWorkbenchCore;
      var wsData = WB.load();
      var already = wsData.savedSystems.some(function (s) { return s.resourceRef && s.resourceRef.id === resource.id; });
      if (already) { saveBtn.textContent = 'Already Saved'; saveBtn.disabled = true; return; }
      WB.addItem(wsData, 'savedSystems', {
        resourceRef: { type: 'resource', id: resource.id, label: resource.title },
        layer: resource.layer || '', whySaved: '', relatedPriorityId: null, relatedInvestigationId: null, notes: ''
      });
      saveBtn.textContent = 'Saved To Workbench ✓';
      saveBtn.disabled = true;
    });
  }

  /**
   * Renders the lightweight, non-flagship domain panel: a single
   * screen with the domain's question, definition, and why it
   * matters, clearly marked as not yet fully developed.
   */
  function renderLight(domain, mountEl) {
    if (!mountEl || !domain) return;

    mountEl.innerHTML = '' +
      '<span class="badge badge--outline">' + (domain.systemCategory || domain.layerName || '') + '</span>' +
      '<div class="foundational-notice" style="margin-top:var(--space-3)"><span class="badge">Foundational &mdash; Full Resource Coming Soon</span></div>' +
      '<h1 style="margin:var(--space-3) 0">' + domain.name + '</h1>' +
      (domain.question ? '<p class="resource-hero__question">' + domain.question + '</p>' : '') +
      (domain.whatItIs ? '<p class="lede" style="max-width:70ch">' + domain.whatItIs + '</p>' : '') +
      (domain.whyItMatters ? '<div class="callout" style="margin-top:var(--space-6)">' + domain.whyItMatters + '</div>' : '');
  }

  /**
   * Renders a breadcrumb trail. `items` is an array of
   * { label, href? } — the last item should omit href.
   */
  function renderBreadcrumb(mountEl, items) {
    if (!mountEl || !items || !items.length) return;
    mountEl.innerHTML = items.map(function (item, i) {
      var sep = i > 0 ? '<span class="breadcrumb__sep">&rarr;</span>' : '';
      var content = item.href
        ? '<a href="' + item.href + '">' + item.label + '</a>'
        : '<span class="breadcrumb__current">' + item.label + '</span>';
      return sep + content;
    }).join('');
  }

  /**
   * Renders previous/next lateral navigation between sibling
   * domains. `prevItem`/`nextItem` are { name, onClick } or null.
   */
  function renderDomainNav(mountEl, prevItem, nextItem) {
    if (!mountEl) return;
    if (!prevItem && !nextItem) {
      mountEl.innerHTML = '';
      return;
    }
    mountEl.innerHTML = '' +
      (prevItem ? '<button type="button" class="domain-nav__link" data-nav-prev><span class="domain-nav__label">&larr; Previous System</span><span class="domain-nav__name">' + prevItem.name + '</span></button>' : '<span></span>') +
      (nextItem ? '<button type="button" class="domain-nav__link domain-nav__link--next" data-nav-next><span class="domain-nav__label">Next System &rarr;</span><span class="domain-nav__name">' + nextItem.name + '</span></button>' : '<span></span>');

    if (prevItem) mountEl.querySelector('[data-nav-prev]').addEventListener('click', prevItem.onClick);
    if (nextItem) mountEl.querySelector('[data-nav-next]').addEventListener('click', nextItem.onClick);
  }

  global.OMSResourceDetail = {
    renderFlagship: renderFlagship,
    renderLight: renderLight,
    renderBreadcrumb: renderBreadcrumb,
    renderDomainNav: renderDomainNav
  };
})(window);
