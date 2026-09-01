/*
 * Operations Maturity System
 * Navigation controller.
 *
 * Responsible for:
 * - global navigation behavior
 * - active navigation states
 * - mobile navigation
 * - page transitions
 * - shared navigation interactions
 * - the "What Should I Do?" routing modal, since deciding where to
 *   go next is itself a navigation problem, not a feature page
 *
 * Keep feature-specific application logic out of this file.
 *
 * Every page provides an empty <div id="site-nav"></div> and
 * <div id="site-footer"></div>. This file renders the shared
 * header/footer markup into them so navigation only has to be
 * maintained in one place, and marks the current page active
 * using <body data-page="...">.
 */

(function (global) {
  'use strict';

  var PRIMARY_LINKS = [
    { id: 'home', label: 'Home', path: 'index.html' },
    { id: 'explore', label: 'Explore', path: 'pages/explore.html' },
    { id: 'assess', label: 'Assess', path: 'pages/assess.html' },
    { id: 'diagnose', label: 'Diagnose', path: 'pages/diagnose.html' },
    { id: 'build', label: 'Build', path: 'pages/build.html' },
    { id: 'blueprint', label: 'Blueprint', path: 'pages/blueprint.html' },
    { id: 'workbench', label: 'Workbench', path: 'pages/workbench.html' },
    { id: 'command-center', label: 'Command Center', path: 'pages/command-center.html' }
  ];

  var MORE_LINKS = [
    { id: 'learn', label: 'Learn', path: 'pages/learn.html' },
    { id: 'improve', label: 'Improve', path: 'pages/improve.html' },
    { id: 'scenario-lab', label: 'Scenario Lab', path: 'pages/scenario-lab.html' },
    { id: 'anti-patterns', label: 'Anti-Patterns', path: 'pages/anti-patterns.html' },
    { id: 'dependency-map', label: 'Dependency Map', path: 'pages/dependency-map.html' },
    { id: 'glossary', label: 'Glossary', path: 'pages/glossary.html' },
    { id: 'governance', label: 'Governance', path: 'pages/governance.html' },
    { id: 'risk', label: 'Risk', path: 'pages/risk.html' },
    { id: 'capacity', label: 'Capacity', path: 'pages/capacity.html' },
    { id: 'scale-readiness', label: 'Scale Readiness', path: 'pages/scale-readiness.html' },
    { id: 'operating-debt', label: 'Operating Debt', path: 'pages/operating-debt.html' },
    { id: 'transformation', label: 'Transformation', path: 'pages/transformation.html' }
  ];

  var PROFILE_LINK = { id: 'profile', label: 'Profile', path: 'pages/profile.html' };

  var FOOTER_LINKS = [
    { id: 'explore', label: 'Explore', path: 'pages/explore.html' },
    { id: 'assess', label: 'Assess', path: 'pages/assess.html' },
    { id: 'diagnose', label: 'Diagnose', path: 'pages/diagnose.html' },
    { id: 'build', label: 'Build', path: 'pages/build.html' },
    { id: 'blueprint', label: 'Blueprint', path: 'pages/blueprint.html' },
    { id: 'workbench', label: 'Workbench', path: 'pages/workbench.html' },
    { id: 'command-center', label: 'Command Center', path: 'pages/command-center.html' },
    { id: 'glossary', label: 'Glossary', path: 'pages/glossary.html' }
  ];

  function href(path) {
    return global.OMSData ? global.OMSData.href(path) : path;
  }

  function escBc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function findNavLink(id) {
    return PRIMARY_LINKS.concat(MORE_LINKS, [PROFILE_LINK]).filter(function (l) { return l.id === id; })[0] || null;
  }

  /*
   * A consistent breadcrumb trail reinforcing where a page sits in
   * the system, e.g. Home / Build / Operating Model Designer.
   * trailIds are ids from PRIMARY_LINKS/MORE_LINKS; currentLabel is
   * the current page's own label (can be dynamic, e.g. a Blueprint
   * or project name — it is escaped here).
   */
  function renderBreadcrumb(mountId, trailIds, currentLabel) {
    var mount = document.getElementById(mountId);
    if (!mount) return;
    var parts = [{ label: 'Home', href: href('index.html') }];
    (trailIds || []).forEach(function (id) {
      var link = findNavLink(id);
      if (link) parts.push({ label: link.label, href: href(link.path) });
    });
    mount.innerHTML = parts.map(function (p) {
      return '<a href="' + p.href + '">' + escBc(p.label) + '</a><span class="breadcrumb__sep" aria-hidden="true">/</span>';
    }).join('') + '<span class="breadcrumb__current">' + escBc(currentLabel) + '</span>';
  }

  function currentAttr(id, page) {
    return id === page ? ' aria-current="page"' : '';
  }

  function renderPrimary(page) {
    var links = PRIMARY_LINKS.map(function (link) {
      return '<a href="' + href(link.path) + '" data-nav="' + link.id + '"' +
        currentAttr(link.id, page) + '>' + link.label + '</a>';
    }).join('');

    var moreActive = MORE_LINKS.some(function (l) { return l.id === page; });
    var morePanel = MORE_LINKS.map(function (link) {
      return '<a href="' + href(link.path) + '" data-nav="' + link.id + '"' +
        currentAttr(link.id, page) + '>' + link.label + '</a>';
    }).join('');

    return links +
      '<div class="nav-more">' +
        '<button type="button" class="nav-more__trigger' + (moreActive ? ' is-active' : '') + '" id="nav-more-trigger" aria-haspopup="true" aria-expanded="false" aria-controls="nav-more-panel">More <span class="nav-more__caret" aria-hidden="true">&#9662;</span></button>' +
        '<div class="nav-more__panel" id="nav-more-panel" hidden>' + morePanel + '</div>' +
      '</div>';
  }

  function renderSecondary(page) {
    return '' +
      '<button type="button" class="secondary-nav__icon" id="nav-search-trigger" aria-label="Search OMS" title="Search">&#128269;</button>' +
      '<button type="button" class="secondary-nav__icon" id="nav-router-trigger" aria-label="What should I do?" title="What should I do?">?</button>' +
      '<a class="secondary-nav__icon" href="' + href(PROFILE_LINK.path) + '" data-nav="profile"' +
        currentAttr('profile', page) + ' aria-label="Profile">P</a>';
  }

  function renderMobile(page) {
    var groupA = PRIMARY_LINKS.map(function (link) {
      return '<a href="' + href(link.path) + '" data-nav="' + link.id + '"' +
        currentAttr(link.id, page) + '>' + link.label + '</a>';
    }).join('');
    var groupB = MORE_LINKS.map(function (link) {
      return '<a href="' + href(link.path) + '" data-nav="' + link.id + '"' +
        currentAttr(link.id, page) + '>' + link.label + '</a>';
    }).join('');
    var profileLink = '<a href="' + href(PROFILE_LINK.path) + '" data-nav="profile"' + currentAttr('profile', page) + '>' + PROFILE_LINK.label + '</a>';

    return '' +
      '<div class="mobile-nav__utility">' +
        '<button type="button" id="nav-search-trigger-mobile">Search OMS</button>' +
        '<button type="button" id="nav-router-trigger-mobile">What should I do?</button>' +
      '</div>' +
      groupA +
      '<span class="mobile-nav__group-label">More</span>' +
      groupB +
      profileLink;
  }

  function renderHeader(page) {
    return '' +
      '<header class="site-header">' +
        '<div class="site-header__inner">' +
          '<a class="brand" href="' + href('index.html') + '">' +
            '<span class="brand__mark">OMS</span>' +
            '<span class="brand__name">Operations Maturity System</span>' +
          '</a>' +
          '<nav class="primary-nav" aria-label="Primary">' + renderPrimary(page) + '</nav>' +
          '<div class="secondary-nav">' + renderSecondary(page) + '</div>' +
          '<button class="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false">' +
            '<span class="nav-toggle__bar"></span>' +
          '</button>' +
        '</div>' +
        '<nav class="mobile-nav" aria-label="Mobile">' + renderMobile(page) + '</nav>' +
      '</header>';
  }

  function renderFooter() {
    var links = FOOTER_LINKS.map(function (link) {
      return '<a href="' + href(link.path) + '">' + link.label + '</a>';
    }).join('');

    return '' +
      '<footer class="site-footer">' +
        '<div class="site-footer__inner">' +
          '<div>' +
            '<div class="site-footer__brand">OMS &mdash; Operations Maturity System</div>' +
            '<p class="site-footer__philosophy">Every business has an operating system. Most just haven&rsquo;t designed it intentionally.</p>' +
          '</div>' +
          '<nav class="site-footer__links" aria-label="Footer">' + links + '</nav>' +
        '</div>' +
      '</footer>';
  }

  function bindMobileToggle(header) {
    var toggle = header.querySelector('.nav-toggle');
    var mobileNav = header.querySelector('.mobile-nav');
    if (!toggle || !mobileNav) return;

    toggle.addEventListener('click', function () {
      var isOpen = mobileNav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    mobileNav.addEventListener('click', function (event) {
      if (event.target.tagName === 'A') {
        mobileNav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function bindMoreDropdown(header) {
    var trigger = header.querySelector('#nav-more-trigger');
    var panel = header.querySelector('#nav-more-panel');
    if (!trigger || !panel) return;

    function close() {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }
    function open() {
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    }

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      if (panel.hidden) open(); else close();
    });
    document.addEventListener('click', function (e) {
      if (!panel.hidden && !panel.contains(e.target) && e.target !== trigger) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { close(); trigger.focus(); }
    });
  }

  /* ----------------------------------------------------------
     "What Should I Do?" — a lightweight routing modal. Deciding
     between Assess, Diagnose, Build, Blueprint, and Workbench is
     one of the most common places a new user gets stuck, so this
     is reachable from every page, not just Home.
     ---------------------------------------------------------- */

  var ROUTE_OPTIONS = [
    { prompt: 'I want to understand how mature our operations are.', action: 'Assess', path: 'pages/assess.html' },
    { prompt: 'Something isn’t working and I don’t know why.', action: 'Diagnose', path: 'pages/diagnose.html' },
    { prompt: 'I know what system needs to be designed or redesigned.', action: 'Build', path: 'pages/build.html' },
    { prompt: 'I need to understand how everything connects.', action: 'View Blueprint', path: 'pages/blueprint.html' },
    { prompt: 'I already know what needs attention and want to manage the improvement.', action: 'Open Workbench', path: 'pages/workbench.html' },
    { prompt: 'I want to learn an operations concept.', action: 'Learn', path: 'pages/learn.html' },
    { prompt: 'I want to practice operational judgment.', action: 'Scenario Lab', path: 'pages/scenario-lab.html' }
  ];

  var lastModalTrigger = null;
  var currentModalKeyHandler = null;
  var FOCUSABLE_SELECTOR = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function closeAnyModal() {
    var overlay = document.getElementById('nav-modal-overlay');
    if (overlay) overlay.remove();
    if (currentModalKeyHandler) { document.removeEventListener('keydown', currentModalKeyHandler); currentModalKeyHandler = null; }
    if (lastModalTrigger && document.body.contains(lastModalTrigger)) lastModalTrigger.focus();
    lastModalTrigger = null;
  }

  function openModal(innerHtml, onMount) {
    closeAnyModal();
    lastModalTrigger = document.activeElement;

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'nav-modal-overlay';
    var panel = document.createElement('div');
    panel.className = 'modal-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.innerHTML = innerHtml;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    var heading = panel.querySelector('h1, h2, h3');
    if (heading) {
      if (!heading.id) heading.id = 'modal-title-' + Date.now();
      panel.setAttribute('aria-labelledby', heading.id);
    }

    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeAnyModal(); });
    currentModalKeyHandler = function (e) {
      if (e.key === 'Escape') { closeAnyModal(); return; }
      if (e.key === 'Tab') {
        var focusable = Array.prototype.slice.call(panel.querySelectorAll(FOCUSABLE_SELECTOR));
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', currentModalKeyHandler);
    var closeBtn = panel.querySelector('[data-modal-close]');
    if (closeBtn) closeBtn.addEventListener('click', closeAnyModal);
    var firstFocusable = panel.querySelector('button, a, input');
    if (firstFocusable) firstFocusable.focus();
    if (onMount) onMount(panel);
  }

  function openRouter() {
    var html =
      '<button type="button" class="modal-panel__close" data-modal-close aria-label="Close">&times;</button>' +
      '<h3 style="margin-top:0">What should I do?</h3>' +
      '<p class="text-muted">What are you trying to do?</p>' +
      '<div style="display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-4)">' +
      ROUTE_OPTIONS.map(function (opt, i) {
        return '<a class="trace-node" href="' + href(opt.path) + '" style="text-decoration:none">' +
          '<span>' + opt.prompt + '</span>' +
          '<span class="trace-node__relation">' + opt.action + ' &rarr;</span>' +
        '</a>';
      }).join('') +
      '</div>';
    openModal(html);
  }

  function bindUtilityTriggers(header) {
    var routerBtn = header.querySelector('#nav-router-trigger');
    var routerBtnMobile = header.querySelector('#nav-router-trigger-mobile');
    if (routerBtn) routerBtn.addEventListener('click', openRouter);
    if (routerBtnMobile) routerBtnMobile.addEventListener('click', openRouter);

    var searchBtn = header.querySelector('#nav-search-trigger');
    var searchBtnMobile = header.querySelector('#nav-search-trigger-mobile');
    function triggerSearch() { if (global.OMSSearch) global.OMSSearch.open(); }
    if (searchBtn) searchBtn.addEventListener('click', triggerSearch);
    if (searchBtnMobile) searchBtnMobile.addEventListener('click', triggerSearch);
  }

  function init() {
    var page = document.body.getAttribute('data-page') || '';
    var navMount = document.getElementById('site-nav');
    var footerMount = document.getElementById('site-footer');

    if (navMount) {
      navMount.outerHTML = renderHeader(page);
      var header = document.querySelector('.site-header');
      if (header) {
        bindMobileToggle(header);
        bindMoreDropdown(header);
        bindUtilityTriggers(header);
      }
    }

    if (footerMount) {
      footerMount.outerHTML = renderFooter();
    }
  }

  global.OMSNav = { init: init, openRouter: openRouter, openModal: openModal, closeModal: closeAnyModal, renderBreadcrumb: renderBreadcrumb };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
