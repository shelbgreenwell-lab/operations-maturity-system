/*
 * Operations Maturity System
 * Learn — searchable knowledge library engine.
 *
 * Responsible for:
 * - unifying every operational domain (flagship and foundational)
 *   and every anti-pattern into one searchable, filterable library
 * - search, layer filter, topic/category filter, maturity filter,
 *   and resource-type filter
 * - curated browse sections (Start Here, Foundational Systems,
 *   Running the Business, Measuring the Business, Improving the
 *   Business, Scaling the Business)
 * - the Operating Principles reference list
 * - the "If You're Experiencing..." symptom finder into Diagnose
 * - progressive disclosure of full resource detail, shared with
 *   Explore via js/resource-detail.js
 *
 * Content lives in /data/operating-layers.json, /data/resources.json,
 * /data/anti-patterns.json, /data/diagnostics.json, and /data/principles.json.
 */

(function (global) {
  'use strict';

  var LAYER_NAMES = {
    direction: 'Direction', design: 'Design', execution: 'Execution',
    management: 'Management', intelligence: 'Intelligence', evolution: 'Evolution'
  };
  var LAYER_ORDER = ['direction', 'design', 'execution', 'management', 'intelligence', 'evolution'];
  var CATEGORY_ORDER = ['Foundational Systems', 'Running the Business', 'Measuring the Business', 'Improving the Business', 'Scaling the Business'];
  var START_HERE_IDS = ['decision-rights', 'process-ownership', 'operating-rhythms', 'kpi-architecture', 'root-cause-analysis', 'operating-models'];

  var els = {};
  var knowledge = null;
  var items = []; // unified: domains (flagship + foundational) + anti-patterns
  var diagnostics = null;
  var filters = { type: 'all', layer: 'all', category: 'all', maturity: 'all', query: '' };

  function byId(id) { return document.getElementById(id); }

  function buildItems(k, antiPatternsData) {
    var domainItems = k.domains.map(function (domain) {
      var resource = domain.isFlagship ? k.resourcesById[domain.resourceId] : null;
      var whatItIs = resource ? resource.whatItIs : domain.whatItIs;
      var whyItMatters = resource ? resource.whyItMatters : domain.whyItMatters;
      var category = resource ? resource.systemCategory : domain.systemCategory;
      return {
        itemType: 'domain',
        id: domain.id,
        layerId: domain.layerId,
        title: domain.name,
        systemCategory: category,
        isFlagship: !!domain.isFlagship,
        question: resource ? resource.question : domain.question,
        summary: whatItIs,
        why: whyItMatters,
        resourceId: domain.resourceId,
        searchText: [domain.name, whatItIs, whyItMatters, domain.question].join(' ').toLowerCase()
      };
    });

    var antiPatternItems = antiPatternsData.antiPatterns.map(function (p) {
      return {
        itemType: 'antipattern',
        id: p.id,
        title: p.name,
        summary: p.looksLike,
        why: p.whatItBreaks,
        searchText: [p.name, p.looksLike, p.whatItBreaks, p.whyItHappens].join(' ').toLowerCase()
      };
    });

    return domainItems.concat(antiPatternItems);
  }

  /* ----------------------------------------------------------
     Filters
     ---------------------------------------------------------- */

  function renderFilterGroup(mount, options, activeValue, onSelect) {
    mount.innerHTML = options.map(function (opt) {
      return '<button type="button" class="resource-filter' + (opt.value === activeValue ? ' is-active' : '') +
        '" data-value="' + opt.value + '">' + opt.label + '</button>';
    }).join('');
    mount.querySelectorAll('.resource-filter').forEach(function (btn) {
      btn.addEventListener('click', function () {
        onSelect(btn.getAttribute('data-value'));
        renderAll();
      });
    });
  }

  function renderFilters() {
    renderFilterGroup(els.typeFilter, [
      { value: 'all', label: 'All Types' },
      { value: 'domain', label: 'Systems' },
      { value: 'antipattern', label: 'Anti-Patterns' }
    ], filters.type, function (v) { filters.type = v; });

    renderFilterGroup(els.layerFilter, [{ value: 'all', label: 'All Layers' }].concat(
      LAYER_ORDER.map(function (id) { return { value: id, label: LAYER_NAMES[id] }; })
    ), filters.layer, function (v) { filters.layer = v; });

    renderFilterGroup(els.categoryFilter, [{ value: 'all', label: 'All Categories' }].concat(
      CATEGORY_ORDER.map(function (c) { return { value: c, label: c }; })
    ), filters.category, function (v) { filters.category = v; });

    renderFilterGroup(els.maturityFilter, [
      { value: 'all', label: 'All Depth' },
      { value: 'flagship', label: 'Fully Developed' },
      { value: 'foundational', label: 'Foundational' }
    ], filters.maturity, function (v) { filters.maturity = v; });
  }

  function matchesFilters(item) {
    if (filters.type !== 'all' && item.itemType !== filters.type) return false;
    if (filters.layer !== 'all') {
      if (item.itemType !== 'domain' || item.layerId !== filters.layer) return false;
    }
    if (filters.category !== 'all') {
      if (item.itemType !== 'domain' || item.systemCategory !== filters.category) return false;
    }
    if (filters.maturity !== 'all') {
      if (item.itemType !== 'domain') return false;
      if (filters.maturity === 'flagship' && !item.isFlagship) return false;
      if (filters.maturity === 'foundational' && item.isFlagship) return false;
    }
    if (filters.query) {
      if (item.searchText.indexOf(filters.query) === -1) return false;
    }
    return true;
  }

  function isFilterActive() {
    return filters.type !== 'all' || filters.layer !== 'all' || filters.category !== 'all' ||
      filters.maturity !== 'all' || !!filters.query;
  }

  /* ----------------------------------------------------------
     Card rendering
     ---------------------------------------------------------- */

  function cardHtml(item) {
    var badge = item.itemType === 'antipattern'
      ? '<span class="badge badge--outline">Anti-Pattern</span>'
      : (item.isFlagship ? '<span class="badge badge--accent">Flagship</span>' : '<span class="badge badge--outline">Foundational</span>');
    return '' +
      '<button type="button" class="card card--interactive resource-card" data-type="' + item.itemType + '" data-id="' + item.id + '" style="text-align:left">' +
        badge +
        '<h3>' + item.title + '</h3>' +
        '<p class="text-muted" style="font-size:var(--step--1)">' + (item.summary || '') + '</p>' +
      '</button>';
  }

  function bindCards(container) {
    container.querySelectorAll('.resource-card').forEach(function (card) {
      card.addEventListener('click', function () {
        openItem(card.getAttribute('data-type'), card.getAttribute('data-id'));
      });
    });
  }

  function renderResultsCount(count) {
    if (!els.resultsCount) return;
    els.resultsCount.textContent = count === 0 ? 'No matches. Try a different search or filter.' :
      count + (count === 1 ? ' result' : ' results');
  }

  function renderFlatGrid() {
    var visible = items.filter(matchesFilters);
    renderResultsCount(visible.length);
    els.sections.hidden = true;
    els.flatGrid.hidden = false;
    els.flatGrid.innerHTML = visible.map(cardHtml).join('');
    bindCards(els.flatGrid);
  }

  function renderSectionedBrowse() {
    els.flatGrid.hidden = true;
    els.sections.hidden = false;
    renderResultsCount(items.length);

    var domainItems = items.filter(function (i) { return i.itemType === 'domain'; });
    var byId2 = {};
    domainItems.forEach(function (i) { byId2[i.id] = i; });

    var startHere = START_HERE_IDS.map(function (id) { return byId2[id]; }).filter(Boolean);

    var sectionsHtml = '<div class="card-grid" style="margin-bottom:var(--space-4)">' + startHere.map(cardHtml).join('') + '</div>';

    var byCategory = {};
    CATEGORY_ORDER.forEach(function (c) { byCategory[c] = []; });
    domainItems.forEach(function (i) {
      if (byCategory[i.systemCategory]) byCategory[i.systemCategory].push(i);
    });

    var categoryBlocks = CATEGORY_ORDER.map(function (category) {
      var list = byCategory[category];
      if (!list.length) return '';
      return '' +
        '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">' + category + '</span></div>' +
        '<div class="card-grid">' + list.map(cardHtml).join('') + '</div>';
    }).join('');

    els.startHereMount.innerHTML = sectionsHtml;
    els.categorySections.innerHTML = categoryBlocks;

    bindCards(els.startHereMount);
    bindCards(els.categorySections);
  }

  function renderAll() {
    if (isFilterActive()) {
      renderFlatGrid();
    } else {
      renderSectionedBrowse();
    }
  }

  /* ----------------------------------------------------------
     Item detail (domain/resource or anti-pattern)
     ---------------------------------------------------------- */

  function openItem(type, id) {
    if (type === 'antipattern') {
      global.location.href = global.OMSData.href('pages/anti-patterns.html?pattern=' + id);
      return;
    }
    var domain = knowledge.domains.filter(function (d) { return d.id === id; })[0];
    if (!domain) return;

    els.detailPanel.classList.add('is-open');

    global.OMSResourceDetail.renderBreadcrumb(els.breadcrumb, [
      { label: 'Learn', href: global.OMSData.href('pages/learn.html') },
      { label: domain.name }
    ]);

    if (domain.isFlagship) {
      global.OMSResourceDetail.renderFlagship(knowledge.resourcesById[domain.resourceId], els.detailMount);
    } else {
      global.OMSResourceDetail.renderLight(domain, els.detailMount);
    }

    els.detailPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeItem() {
    els.detailPanel.classList.remove('is-open');
  }

  /* ----------------------------------------------------------
     Operating Principles
     ---------------------------------------------------------- */

  function renderPrinciples(principlesData) {
    if (!els.principlesMount) return;
    els.principlesMount.innerHTML = principlesData.principles.map(function (p) {
      return '<p class="operator-question">' + p.text + '</p>';
    }).join('');
  }

  /* ----------------------------------------------------------
     If You're Experiencing...
     ---------------------------------------------------------- */

  function renderSymptomFinder(diagnosticsData) {
    if (!els.symptomFinder) return;
    diagnostics = diagnosticsData;
    els.symptomFinder.innerHTML = diagnosticsData.diagnostics.map(function (d) {
      return '<a class="symptom-card card--interactive" href="' + global.OMSData.href('pages/diagnose.html?symptom=' + d.id) + '">' +
        '<div class="card__eyebrow">Symptom</div>' +
        '<h4 style="margin:var(--space-2) 0 0">' + d.symptom + '</h4>' +
        '</a>';
    }).join('');
  }

  /* ----------------------------------------------------------
     Init
     ---------------------------------------------------------- */

  function init() {
    els.searchInput = byId('learn-search');
    els.typeFilter = byId('filter-type');
    els.layerFilter = byId('filter-layer');
    els.categoryFilter = byId('filter-category');
    els.maturityFilter = byId('filter-maturity');
    els.resultsCount = byId('learn-results-count');
    els.sections = byId('learn-sections');
    els.startHereMount = byId('start-here-mount');
    els.categorySections = byId('category-sections-mount');
    els.flatGrid = byId('learn-flat-grid');
    els.detailPanel = byId('resource-detail-panel');
    els.breadcrumb = byId('learn-breadcrumb');
    els.detailMount = byId('resource-detail-mount');
    els.principlesMount = byId('principles-mount');
    els.symptomFinder = byId('symptom-finder-mount');

    if (!els.flatGrid) return;

    if (els.searchInput) {
      els.searchInput.addEventListener('input', function () {
        filters.query = els.searchInput.value.trim().toLowerCase();
        renderAll();
      });
    }

    var closeBtn = byId('close-resource-detail');
    if (closeBtn) closeBtn.addEventListener('click', closeItem);

    Promise.all([
      global.OMSData.loadKnowledge(),
      global.OMSData.load('anti-patterns.json'),
      global.OMSData.load('principles.json'),
      global.OMSData.load('diagnostics.json')
    ]).then(function (results) {
      knowledge = results[0];
      items = buildItems(knowledge, results[1]);
      renderFilters();
      renderPrinciples(results[2]);
      renderSymptomFinder(results[3]);

      var params = new URLSearchParams(global.location.search);
      var requestedResource = params.get('resource');
      if (requestedResource) {
        filters.type = 'domain';
      }
      renderAll();

      if (requestedResource) {
        openItem('domain', requestedResource);
      }
    });
  }

  global.OMSLearn = { init: init };
})(window);
