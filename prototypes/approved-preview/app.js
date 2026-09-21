(() => {
  'use strict';

  const courses = {
    CIV100: { code: 'CIV100', name: 'Statics', cls: 'course-civ', color: 'var(--course-green)' },
    MAT186: { code: 'MAT186', name: 'Calculus', cls: 'course-mat', color: 'var(--course-blue)' },
    APS110: { code: 'APS110', name: 'Engineering Chemistry', cls: 'course-aps110', color: 'var(--course-rose)' },
    APS111: { code: 'APS111', name: 'Engineering Strategies & Practice', cls: 'course-aps111', color: 'var(--course-violet)' },
  };

  const fixtures = {
    assessments: [
      { id:'a2', course:'CIV100', title:'Assignment 2', type:'Assignment', due:'Sun, Sep 21', dueTime:'11:59 PM', remaining:'1h 25m', remainingMinutes:85, planned:3, risk:'On track', riskType:'success', group:'Next 7 days', estimate:'2h 30m', completed:'1h 05m', description:'Assignment 2 covers equilibrium of rigid bodies, free body diagrams, and force systems. Show all working and submit as a single PDF.' },
      { id:'q2', course:'MAT186', title:'Quiz 2', type:'Quiz', due:'Wed, Sep 24', dueTime:'11:59 PM', remaining:'2h 00m', remainingMinutes:120, planned:2, risk:'Low flexibility', riskType:'warning', group:'Next 7 days', estimate:'2h 00m', completed:'0m' },
      { id:'e1', course:'APS110', title:'Essay 1', type:'Assignment', due:'Fri, Sep 26', dueTime:'11:59 PM', remaining:'3h 00m', remainingMinutes:180, planned:3, risk:'On track', riskType:'success', group:'Next 7 days', estimate:'3h 00m', completed:'0m' },
      { id:'m1', course:'APS111', title:'Midterm', type:'Test', due:'Thu, Oct 2', dueTime:'9:00 AM', remaining:'9h 00m', remainingMinutes:540, planned:6, risk:'Plenty of time', riskType:'success', group:'Next 7 days', estimate:'9h 00m', completed:'0m' },
      { id:'a3', course:'CIV100', title:'Assignment 3', type:'Assignment', due:'Sun, Oct 5', dueTime:'11:59 PM', remaining:'2h 30m', remainingMinutes:150, planned:0, risk:'On track', riskType:'success', group:'Next 2 weeks', estimate:'2h 30m', completed:'0m' },
      { id:'ps1', course:'MAT186', title:'Problem Set 1', type:'Assignment', due:'Tue, Oct 7', dueTime:'11:59 PM', remaining:'2h 00m', remainingMinutes:120, planned:0, risk:'On track', riskType:'success', group:'Next 2 weeks', estimate:'2h 00m', completed:'0m' },
      { id:'q1', course:'APS110', title:'Quiz 1', type:'Quiz', due:'Fri, Oct 10', dueTime:'11:59 PM', remaining:'1h 30m', remainingMinutes:90, planned:0, risk:'On track', riskType:'success', group:'Next 2 weeks', estimate:'1h 30m', completed:'0m' },
      { id:'ma1', course:'MAT186', title:'Assignment 1', type:'Assignment', due:'Sun, Oct 12', dueTime:'11:59 PM', remaining:'2h 00m', remainingMinutes:120, planned:0, risk:'Plenty of time', riskType:'success', group:'Next 2 weeks', estimate:'2h 00m', completed:'0m' },
      { id:'fe1', course:'APS111', title:'Final Exam', type:'Exam', due:'Wed, Nov 26', dueTime:'9:00 AM', remaining:'TBD', remainingMinutes:null, planned:0, risk:'Far away', riskType:'info', group:'Later', estimate:'TBD', completed:'0m' },
      { id:'fe2', course:'CIV100', title:'Final Exam', type:'Exam', due:'Thu, Dec 4', dueTime:'9:00 AM', remaining:'TBD', remainingMinutes:null, planned:0, risk:'Far away', riskType:'info', group:'Later', estimate:'TBD', completed:'0m' },
    ],
    stillToDo: [
      { id:'t-mat', course:'MAT186', title:'Practice problems (Set 3)', duration:'45 min', context:'Before Wednesday' },
      { id:'t-aps', course:'APS110', title:'Read Chapter 4', duration:'30 min', context:'Before Friday' },
      { id:'t-civ', course:'CIV100', title:'Review tutorial notes', duration:'20 min', context:'Flexible' },
    ],
    todayTimeline: [
      { id:'sleep', time:'8:00 AM', end:'9:00', title:'Sleep / morning buffer', kind:'neutral' },
      { id:'mat-lecture', time:'9:00 AM', end:'10:00', course:'MAT186', title:'Lecture', location:'BA 1170', kind:'fixed mat' },
      { id:'civ-tut', time:'10:00 AM', end:'11:00', course:'CIV100', title:'Tutorial', location:'GB 248', kind:'fixed civ' },
      { id:'lunch', time:'11:00 AM', end:'12:00', title:'Lunch', kind:'neutral' },
      { id:'aps-lecture', time:'12:00 PM', end:'1:00', course:'APS110', title:'Lecture', location:'SF 1101', kind:'fixed aps' },
      { id:'commute', time:'1:00 PM', end:'2:00', title:'Commute', location:'Union → St. George', kind:'neutral' },
      { id:'civ-work', time:'2:00 PM', end:'2:50', course:'CIV100', title:'Continue Assignment 2', kind:'planner', selected:true },
      { id:'gym', time:'3:00 PM', end:'4:30', title:'Gym / personal time', kind:'protected' },
      { id:'mat-practice', time:'5:00 PM', end:'6:00', course:'MAT186', title:'Practice problems', kind:'planner' },
      { id:'dinner', time:'6:30 PM', end:'7:30', title:'Dinner', kind:'neutral' },
      { id:'aps-reading', time:'7:30 PM', end:'8:30', course:'APS110', title:'Reading & notes', kind:'planner' },
      { id:'free', time:'8:30 PM', end:'→', title:'Free time', kind:'free' },
    ],
    inbox: [
      { id:'i1', text:'Read Chapter 4 for APS110', hint:'Tomorrow or Friday would be good', course:'APS110', type:'Task', duration:'~ 30 min', age:'2 min ago' },
      { id:'i2', text:'MAT186 quiz next Wednesday', hint:'Check Quercus for details', course:'MAT186', type:'Assessment', duration:'', age:'2 hr ago' },
      { id:'i3', text:'Finish lab report', hint:'Roughly 3–4 hours', course:'APS111', type:'Task', duration:'~ 3–4 hr', age:'4 hr ago' },
      { id:'i4', text:'Book haircut', hint:'Some time this week', course:'Personal', type:'Task', duration:'', age:'4 hr ago' },
      { id:'i5', text:'Look into PEY application deadline', hint:'Need to confirm exact date', course:'Career', type:'Task', duration:'', age:'6 hr ago' },
    ],
    weekDays: [
      { name:'Mon', date:'15', work:'2h 30m', load:.45 },
      { name:'Tue', date:'16', work:'2h 40m', load:.48, today:true },
      { name:'Wed', date:'17', work:'3h 20m', load:.64 },
      { name:'Thu', date:'18', work:'4h 10m', load:.78, warning:true },
      { name:'Fri', date:'19', work:'2h 00m', load:.38 },
      { name:'Sat', date:'20', work:'1h 30m', load:.28 },
      { name:'Sun', date:'21', work:'1h 20m', load:.24 },
    ],
    weekEvents: [
      {id:'w1',day:0,start:60,duration:60,course:'MAT186',title:'Lecture',sub:'BA 1170',type:'fixed'},
      {id:'w2',day:0,start:180,duration:60,course:'CIV100',title:'Tutorial',sub:'GB 248',type:'fixed'},
      {id:'w3',day:0,start:360,duration:60,course:'APS110',title:'Lecture',sub:'SF 1101',type:'fixed'},
      {id:'w4',day:0,start:480,duration:60,course:'MAT186',title:'Study / practice',sub:'Practice problems',type:'planner'},
      {id:'w5',day:0,start:540,duration:60,title:'Free time',type:'free'},
      {id:'w6',day:1,start:60,duration:60,course:'MAT186',title:'Lecture',sub:'BA 1170',type:'fixed'},
      {id:'w7',day:1,start:180,duration:60,title:'Lunch',type:'protected'},
      {id:'civ-work',day:1,start:360,duration:50,course:'CIV100',title:'Assignment 2',sub:'2:00–2:50 PM',type:'planner',selected:true},
      {id:'w9',day:1,start:540,duration:60,course:'MAT186',title:'Practice problems',sub:'5:00–6:00 PM',type:'planner'},
      {id:'w10',day:1,start:690,duration:60,course:'APS110',title:'Reading & notes',sub:'7:30–8:30 PM',type:'planner'},
      {id:'w11',day:1,start:780,duration:60,title:'Free time',type:'free'},
      {id:'w12',day:2,start:60,duration:60,course:'APS111',title:'Lecture',sub:'SF 1007',type:'fixed'},
      {id:'w13',day:2,start:300,duration:90,course:'CIV100',title:'Work on Assignment 3',sub:'1:00–2:30 PM',type:'planner'},
      {id:'w14',day:2,start:420,duration:60,course:'MAT186',title:'Office Hours',sub:'3:00–4:00 PM',type:'fixed'},
      {id:'w15',day:2,start:510,duration:60,title:'Commute',type:'protected'},
      {id:'w16',day:2,start:630,duration:60,course:'APS110',title:'Review',sub:'6:30–7:30 PM',type:'planner'},
      {id:'w17',day:3,start:60,duration:60,course:'MAT186',title:'Tutorial',sub:'GB 306',type:'fixed'},
      {id:'w18',day:3,start:300,duration:120,course:'CIV100',title:'Assignment 2 (final)',sub:'1:00–3:00 PM',type:'planner'},
      {id:'w19',day:3,start:450,duration:60,title:'Commute',type:'protected'},
      {id:'w20',day:3,start:510,duration:90,course:'APS111',title:'Midterm prep',sub:'4:30–6:00 PM',type:'planner'},
      {id:'w21',day:3,start:690,duration:60,title:'Dinner',type:'protected'},
      {id:'w22',day:3,start:780,duration:60,title:'Personal time',type:'free'},
      {id:'w23',day:4,start:60,duration:60,course:'MAT186',title:'Lecture',sub:'BA 1170',type:'fixed'},
      {id:'w24',day:4,start:300,duration:60,course:'APS110',title:'Tutorial',sub:'SF 1101',type:'fixed'},
      {id:'w25',day:4,start:420,duration:60,title:'Work on notes',type:'planner'},
      {id:'w26',day:4,start:510,duration:60,title:'Commute',type:'protected'},
      {id:'w27',day:4,start:600,duration:150,title:'Free time',type:'free'},
      {id:'w28',day:5,start:0,duration:60,title:'Sleep in',type:'protected'},
      {id:'sat-civ',day:5,start:180,duration:90,course:'CIV100',title:'Catch up / Review',sub:'11:00–12:30 PM',type:'planner'},
      {id:'sat-aps',day:5,start:360,duration:90,course:'APS111',title:'Midterm prep',sub:'2:00–3:30 PM',type:'planner'},
      {id:'w31',day:5,start:480,duration:60,title:'Gym',sub:'4:00–5:00 PM',type:'protected'},
      {id:'w32',day:6,start:120,duration:60,course:'MAT186',title:'Reading',sub:'10:00–11:00 AM',type:'planner'},
      {id:'w33',day:6,start:300,duration:60,title:'Plan next week',sub:'1:00–2:00 PM',type:'planner'},
      {id:'w34',day:6,start:450,duration:180,title:'Free time',type:'free'},
    ]
  };

  const state = {
    route: routeFromHash(),
    selectedSession: 'civ-work',
    selectedAssessment: 'a2',
    panel: stateFromHash('panel'),
    scenario: stateFromHash('scenario') === 'saturday',
    conflict: stateFromHash('conflict') === '1',
    commandOpen: false,
    commandQuery: '',
    completed: new Set(),
    locked: new Set(),
    inbox: fixtures.inbox.map(item => ({...item})),
    inboxTab: 'Inbox',
    theme: localStorage.getItem('planner-theme') || 'light',
    selectedMobileDay: 1,
    gPending: false,
  };

  document.documentElement.dataset.theme = state.theme;

  function routeFromHash() {
    const raw = (location.hash || '#today').slice(1).split('?')[0];
    const allowed = ['today','week','upcoming','inbox','courses','availability','integrations','settings','onboarding'];
    return allowed.includes(raw) ? raw : 'today';
  }
  function stateFromHash(name) {
    const qs = (location.hash.split('?')[1] || '');
    return new URLSearchParams(qs).get(name);
  }
  function setHash(route, params = {}) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k,v]) => { if (v !== undefined && v !== null && v !== false) search.set(k, String(v)); });
    location.hash = route + (search.toString() ? `?${search}` : '');
  }
  function go(route) { setHash(route); }

  function escapeHtml(value='') {
    return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function icon(name, size=18) {
    const common = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
    const shapes = {
      home:`<path d="M4 10.5 12 4l8 6.5v8.5a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/>`,
      calendar:`<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>`,
      list:`<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="5" cy="18" r="1" fill="currentColor" stroke="none"/>`,
      inbox:`<path d="M4 6h16l2 11H15l-2 3h-2l-2-3H2z"/><path d="M3 14h6l2 3h2l2-3h6"/>`,
      book:`<path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v18H7.5A3.5 3.5 0 0 0 4 23zM20 5.5A3.5 3.5 0 0 0 16.5 2H13v18h3.5A3.5 3.5 0 0 1 20 23z"/>`,
      plug:`<path d="M8 3v5M16 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"/>`,
      gear:`<circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.6-1.4.9-1.9-2.1-2.1-1.9.9-1.4-.6L11.5 3h-3l-.7 2-1.4.6-1.9-.9-2.1 2.1.9 1.9-.6 1.4-2 .7v3l2 .7.6 1.4-.9 1.9 2.1 2.1 1.9-.9 1.4.6.7 2h3l.7-2 1.4-.6 1.9.9 2.1-2.1-.9-1.9.6-1.4z" transform="translate(1.5)"/>`,
      search:`<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>`,
      plus:`<path d="M12 5v14M5 12h14"/>`,
      check:`<path d="m5 12 4 4 10-10"/>`,
      sliders:`<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6"/>`,
      dots:`<circle cx="6" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1" fill="currentColor" stroke="none"/>`,
      lock:`<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>`,
      unlock:`<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M9 10V7a4 4 0 0 1 7-2.6"/>`,
      x:`<path d="M6 6l12 12M18 6 6 18"/>`,
      chevron:`<path d="m9 6 6 6-6 6"/>`,
      left:`<path d="m15 6-6 6 6 6"/>`,
      right:`<path d="m9 6 6 6-6 6"/>`,
      external:`<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>`,
      clock:`<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>`,
      pin:`<path d="M12 21s6-5 6-11a6 6 0 0 0-12 0c0 6 6 11 6 11z"/><circle cx="12" cy="10" r="2"/>`,
      alert:`<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>`,
      sun:`<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`,
      moon:`<path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5z"/>`,
      spark:`<path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>`,
    };
    return `<svg ${common}>${shapes[name] || shapes.dots}</svg>`;
  }

  function navItem(route, label, ico) {
    return `<button class="nav-item ${state.route===route?'active':''}" data-route="${route}" aria-current="${state.route===route?'page':'false'}"><span class="nav-icon">${icon(ico)}</span><span class="nav-label">${label}</span></button>`;
  }

  function shell(content, options={}) {
    const panel = renderPanel();
    return `
      <div class="app-shell">
        <aside class="sidebar" aria-label="Primary navigation">
          <div class="brand"><span class="brand-mark" aria-hidden="true"></span><span>University Planner</span></div>
          <nav class="nav-group">
            ${navItem('today','Today','home')}
            ${navItem('week','Week','calendar')}
            ${navItem('upcoming','Upcoming','list')}
            ${navItem('inbox','Inbox','inbox')}
          </nav>
          <nav class="nav-group">
            ${navItem('courses','Courses','book')}
            ${navItem('availability','Calendar & Availability','calendar')}
            ${navItem('integrations','Integrations','plug')}
          </nav>
          <div class="nav-group">${navItem('settings','Settings','gear')}</div>
          <div class="sidebar-spacer"></div>
          <div class="version">v0.1.0 · local prototype</div>
        </aside>
        <header class="topbar">
          <button class="command-trigger" data-action="open-command" aria-label="Search or ask planner">
            ${icon('search',16)} <span class="search-label">Search or ask planner…</span><span class="shortcut">⌘ K</span>
          </button>
          <div class="topbar-actions">
            <button class="primary-btn" data-action="quick-add">${icon('plus',17)} <span>Add</span></button>
            <div class="sync"><span class="sync-dot"></span><span>Synced</span></div>
            <div class="profile" aria-hidden="true">T</div><span class="profile-label">Taheem</span>
          </div>
        </header>
        <main class="main"><div class="page ${panel?'with-panel':''}">${content}</div></main>
        ${panel}
        ${mobileNav()}
      </div>
      <div class="toast-region" id="toast-region" aria-live="polite"></div>
      ${state.commandOpen ? renderCommandPalette() : ''}
    `;
  }

  function mobileNav() {
    const item=(route,label,ico)=>`<button class="${state.route===route?'active':''}" data-route="${route}"><span>${icon(ico,18)}</span><span>${label}</span></button>`;
    return `<nav class="mobile-nav" aria-label="Mobile navigation">
      ${item('today','Today','home')}${item('week','Week','calendar')}
      <button class="add" data-action="quick-add" aria-label="Quick add">+</button>
      ${item('upcoming','Upcoming','calendar')}${item('inbox','Inbox','inbox')}
    </nav>`;
  }

  function courseBadge(code) {
    if (!courses[code]) return `<span class="course-badge">${escapeHtml(code)}</span>`;
    return `<span class="course-badge ${courses[code].cls}">${code}</span>`;
  }
  function status(label,type='success') { return `<span class="status ${type}">${escapeHtml(label)}</span>`; }
  function courseVar(code) { return courses[code]?.color || 'var(--course-slate)'; }

  function renderToday() {
    const nextDone = state.completed.has('civ-work');
    const timeline = fixtures.todayTimeline.filter(item => !state.completed.has(item.id));
    return shell(`<div class="page-inner today-width">
      <div class="page-title-row">
        <div><h1 class="page-title">Today</h1><p class="page-subtitle">Tuesday, September 16, 2025</p><div class="summary-line">2h 40m planned work&nbsp;&nbsp;·&nbsp;&nbsp;Free after 8:30 PM</div></div>
        <div class="callout success" style="min-width:250px"><strong>✓ You’re on track</strong><span class="tiny">All deadlines remain within schedule.</span></div>
      </div>
      <div class="today-layout"><div>
        <section class="card now-card" aria-labelledby="next-heading">
          <div>
            <div class="eyebrow">${nextDone?'NEXT':'NEXT'}</div>
            <div class="now-main">${courseBadge(nextDone?'MAT186':'CIV100')}<div><h2 id="next-heading" class="now-title">${nextDone?'Practice problems':'Continue Assignment 2'}</h2><div class="muted" style="font-size:13px;margin-bottom:8px">${nextDone?'Set 3 · Calculus practice':'Work on problem set (Part B)'}</div><div class="meta"><span>${icon('clock',14)} ${nextDone?'5:00–6:00 PM · 60 min':'2:00–2:50 PM · 50 min'}</span><span>${icon('pin',14)} ${nextDone?'BA 1170':'Robarts Library'}</span><span>${nextDone?'45 min remaining':'1h 25m remaining'}</span></div></div></div>
          </div>
          <div class="now-actions"><button class="primary-btn" data-action="complete-now">${icon('check',16)} Mark complete</button><button class="secondary-btn" data-action="adjust-now">${icon('sliders',16)} Adjust</button><button class="icon-btn" aria-label="More actions">${icon('dots')}</button></div>
        </section>
        <div class="section-head"><h2>Today’s schedule</h2><button class="secondary-btn" data-route="week">Open in calendar</button></div>
        <section class="timeline" aria-label="Today's schedule">
          ${timeline.map(item=>`<div class="timeline-row"><div class="time-label">${item.time}</div><button class="timeline-block ${item.kind}" ${item.id==='civ-work'?'data-action="select-session" data-session="civ-work"':''} style="border-top:0;border-right:0;border-bottom:0;text-align:left"><span>${item.course?courseBadge(item.course):''}</span><strong>${escapeHtml(item.title)}</strong>${item.location?`<span class="muted">${escapeHtml(item.location)}</span>`:''}<span class="block-time">${escapeHtml(item.end)}</span></button></div>`).join('')}
        </section>
        <div class="section-head"><h2>Still to do today <span class="status info">${fixtures.stillToDo.length}</span></h2><button class="ghost-btn" data-route="upcoming">View all</button></div>
        <div class="row-list">${fixtures.stillToDo.map(task=>`<div class="task-row"><button class="check" aria-label="Complete ${escapeHtml(task.title)}" data-action="complete-task" data-task="${task.id}"></button><div style="display:flex;align-items:center;gap:12px;min-width:0">${courseBadge(task.course)}<span class="task-title">${escapeHtml(task.title)}</span></div><span class="muted tiny">${task.duration}</span><span class="muted tiny">${task.context}</span></div>`).join('')}</div>
      </div>
      <aside class="side-stack">
        <section class="card side-card"><h3>Upcoming</h3><div class="side-upcoming">${fixtures.assessments.slice(0,4).map(a=>`<button class="side-upcoming-item ghost-btn" style="padding:0;text-align:left" data-action="open-assessment" data-assessment="${a.id}"><span class="course-line" style="--course:${courseVar(a.course)}"></span><span><strong style="display:block;font-size:13px">${a.course} · ${a.title}</strong><span class="tiny">${a.due} · ${a.remaining} left</span></span>${status(a.risk,a.riskType)}</button>`).join('')}</div></section>
        <section class="card side-card"><h3>Quick actions</h3><div style="display:grid;gap:8px"><button class="quick-action" data-action="protect-tonight">${icon('moon',18)}<span><strong style="display:block">Protect tonight</strong><span class="tiny">Keep your evening free</span></span></button><button class="quick-action" data-action="something-changed">${icon('calendar',18)}<span><strong style="display:block">Something changed</strong><span class="tiny">Class cancelled, running late, etc.</span></span></button><button class="quick-action" data-action="quick-add">${icon('plus',18)}<span><strong style="display:block">Add something</strong><span class="tiny">Quick capture (N)</span></span></button><button class="quick-action" data-action="open-command">${icon('spark',18)}<span><strong style="display:block">Ask planner</strong><span class="tiny">Get advice or run a scenario</span></span></button></div></section>
      </aside></div>
    </div>`);
  }

  function renderWeek() {
    const scenario = state.scenario;
    const events = fixtures.weekEvents.filter(event => !(scenario && event.day===5 && ['sat-civ','sat-aps'].includes(event.id)));
    const mobileDay = state.selectedMobileDay;
    return shell(`<div class="page-inner week-width">
      <div class="page-title-row"><div><h1 class="page-title">Week</h1><p class="page-subtitle">September 15 – 21, 2025</p></div></div>
      <div class="week-toolbar"><div class="week-toolbar-left"><button class="icon-btn" aria-label="Previous week">${icon('left')}</button><button class="secondary-btn">Today</button><button class="icon-btn" aria-label="Next week">${icon('right')}</button></div><div class="week-toolbar-right"><div class="segmented"><button class="active">Week</button><button>Month</button></div><button class="secondary-btn">Filters</button>${!scenario?`<button class="secondary-btn" data-action="scenario-saturday">Take Saturday off</button>`:''}</div></div>
      <div class="week-wrap desktop-week"><div class="week-grid"><div class="week-corner"></div>${fixtures.weekDays.map((day,i)=>`<div class="day-head ${day.today?'today':''} ${scenario&&i===5?'today':''}"><span class="day-name">${day.name}</span><span class="day-date">${day.date}</span><span class="day-work">${scenario&&i===5?'0h 00m':day.work}</span><span class="loadbar"><span style="width:${scenario&&i===5?5:Math.round(day.load*100)}%;${day.warning?'background:#e5a33d':''}"></span></span></div>`).join('')}<div class="time-gutter">${[8,9,10,11,12,13,14,15,16,17,18,19,20].map((h,idx)=>`<span class="time-tick" style="top:${idx*50}px">${h>12?h-12:h} ${h<12?'AM':'PM'}</span>`).join('')}</div>${fixtures.weekDays.map((day,dayIndex)=>`<div class="day-column ${day.today?'today':''}">${events.filter(e=>e.day===dayIndex).map(event=>weekEvent(event)).join('')}${scenario&&dayIndex===5?`<div class="week-event ghost" style="--start:0;--duration:60;--course:var(--success)"><strong>Take the day off</strong><span>Suggested</span></div>`:''}</div>`).join('')}</div></div>
      <div class="mobile-week" style="display:none"><div class="mobile-day-strip">${fixtures.weekDays.map((d,i)=>`<button class="mobile-day ${mobileDay===i?'active':''}" data-action="mobile-day" data-day="${i}">${d.name}<br><strong>${d.date}</strong></button>`).join('')}</div><div class="mobile-agenda">${events.filter(e=>e.day===mobileDay).sort((a,b)=>a.start-b.start).map(e=>`<div class="mobile-agenda-row"><div class="time-label">${minutesToTime(e.start)}</div><button class="timeline-block ${e.type==='planner'?'planner':e.type==='free'?'free':e.type==='protected'?'protected':`fixed ${courseClass(e.course)}`}" data-action="select-session" data-session="${e.id}" style="border-top:0;border-right:0;border-bottom:0;text-align:left"><span>${e.course?courseBadge(e.course):''}</span><strong>${e.title}</strong><span class="block-time">${Math.round(e.duration)} min</span></button></div>`).join('')}</div></div>
      <div class="week-footer"><section class="card summary-card"><h3>Workload overview${scenario?' (after changes)':''}</h3><div class="workload-bars">${fixtures.weekDays.map((d,i)=>{const load=scenario&&i===5?0:scenario&&i===3?0.92:scenario&&i===4?0.58:d.load;return `<div class="workload-bar"><span>${d.name}</span><span>${scenario&&i===5?'0h':d.work}</span><span class="workload-rect ${load>.75?'warn':''}" style="height:${Math.max(5,Math.round(load*42))}px"></span></div>`}).join('')}</div></section><section class="card summary-card"><h3>${scenario?'Sessions moved':'Deadlines this week'}</h3>${scenario?`<div class="deadline-list"><div class="deadline-item"><span class="dot" style="--course:var(--course-green)"></span><span>CIV100 assignment work</span><span>Sat → Thu · 50 min</span></div><div class="deadline-item"><span class="dot" style="--course:var(--course-blue)"></span><span>MAT186 practice</span><span>Sat → Fri · 40 min</span></div><div class="deadline-item"><span class="dot" style="--course:var(--course-rose)"></span><span>APS110 reading</span><span>Sat → Fri · 30 min</span></div></div>`:`<div class="deadline-list"><div class="deadline-item"><span class="dot" style="--course:var(--course-green)"></span><span>CIV100 Assignment 2</span><span>Sun, Sep 21 · 11:59 PM</span></div><div class="deadline-item"><span class="dot" style="--course:var(--course-blue)"></span><span>MAT186 Quiz 2</span><span>Wed, Sep 24 · 11:59 PM</span></div><div class="deadline-item"><span class="dot" style="--course:var(--course-rose)"></span><span>APS111 Midterm</span><span>Thu, Oct 2 · 9:00 AM</span></div></div>`}</section></div>
    </div>`);
  }

  function weekEvent(event) {
    const c=event.course; const course= c ? courseVar(c) : (event.type==='free'?'var(--success)':'var(--course-slate)');
    const selected=state.selectedSession===event.id?'selected':'';
    return `<button class="week-event ${event.type} ${selected}" style="--start:${event.start};--duration:${event.duration};--course:${course}" data-action="select-session" data-session="${event.id}" aria-label="${escapeHtml(`${c||''} ${event.title}`)}"><strong>${c?`${c} `:''}${escapeHtml(event.title)}</strong>${event.sub?`<span>${escapeHtml(event.sub)}</span>`:''}</button>`;
  }
  function minutesToTime(start) { const h=8+Math.floor(start/60); const m=start%60; return `${h>12?h-12:h}:${String(m).padStart(2,'0')}`; }
  function courseClass(code) { if(code==='CIV100') return 'civ'; if(code==='MAT186') return 'mat'; return 'aps'; }

  function renderUpcoming() {
    return shell(`<div class="page-inner"><div class="page-title-row"><div><h1 class="page-title">Upcoming</h1><p class="page-subtitle">Your assessments, deadlines, and important commitments.</p></div></div><div class="upcoming-controls"><div class="tabbar"><button class="active">Next 7 days</button><button>Next 2 weeks</button><button>Later</button><button>All</button></div><button class="secondary-btn">Sort by · Planner pressure</button></div>${['Next 7 days','Next 2 weeks','Later'].map(group=>`<section class="assessment-group"><h2>${group}</h2><div class="row-list">${fixtures.assessments.filter(a=>a.group===group).map(assessmentRow).join('')}</div></section>`).join('')}</div>`);
  }
  function assessmentRow(a) {
    return `<button class="assessment-row" data-action="open-assessment" data-assessment="${a.id}" style="width:100%;border-left:0;border-right:0;border-top:0;background:transparent;text-align:left"><span class="assessment-course-line" style="--course:${courseVar(a.course)}"></span><span>${courseBadge(a.course)}</span><span><strong>${escapeHtml(a.title)}</strong><span class="assessment-type">${escapeHtml(a.type)}</span></span><span class="muted">${a.due}<br><span class="tiny">${a.dueTime}</span></span><span><strong>${a.remaining}</strong><br><span class="tiny">remaining</span></span><span>${status(a.risk,a.riskType)}</span><span>${icon('chevron',16)}</span></button>`;
  }

  function renderInbox() {
    return shell(`<div class="page-inner"><div class="page-title-row"><div><h1 class="page-title">Inbox</h1><p class="page-subtitle">Capture anything. The planner will organize it.</p></div></div><div class="inbox-layout"><div><form class="capture" id="capture-form"><input id="capture-input" autocomplete="off" aria-label="Quick capture" placeholder="Add a task, deadline, or note…"><button class="primary-btn" type="submit">Add</button></form><div class="chips"><button class="chip" data-action="fill-capture" data-text="CIV100 assignment due next Sunday">“CIV100 assignment due next Sunday”</button><button class="chip" data-action="fill-capture" data-text="Study for MAT186 2h">“Study for MAT186 2h”</button><button class="chip" data-action="fill-capture" data-text="Gym every Mon Wed Fri 5pm">“Gym every Mon Wed Fri 5pm”</button></div><div class="inbox-tabs"><button class="${state.inboxTab==='Inbox'?'active':''}" data-action="inbox-tab" data-tab="Inbox">Inbox <span class="status info">${state.inbox.length}</span></button><button class="${state.inboxTab==='Processed'?'active':''}" data-action="inbox-tab" data-tab="Processed">Processed <span class="status">12</span></button><button class="${state.inboxTab==='Dismissed'?'active':''}" data-action="inbox-tab" data-tab="Dismissed">Dismissed <span class="status">3</span></button></div><div class="row-list">${renderInboxRows()}</div><div class="two-col-cards"><div class="callout"><strong>✓ Processed today</strong><div class="tiny" style="display:grid;gap:8px"><span>Gym at 5pm · recurring rule created</span><span>CIV100 tutorial next Thursday · calendar event added</span></div></div><div class="callout"><strong>Let the planner do the work</strong><p class="muted" style="font-size:13px;margin:0">Add messy details. The system captures first and only asks you to resolve what actually matters.</p></div></div></div><aside class="side-stack"><section class="card side-card"><h3>Quick add from sources</h3><div style="display:grid;gap:12px"><div><strong>Quercus</strong><div class="tiny">3 new items found</div></div><div><strong>UofT Calendar</strong><div class="tiny">No new items</div></div><div><strong>Gmail</strong><div class="tiny">1 potential item</div></div></div></section><section class="card side-card"><h3>Needs your input</h3><div style="display:grid;gap:12px"><div><strong>“Lab report”</strong><div class="tiny">When is this due?</div></div><div><strong>“Book haircut”</strong><div class="tiny">Any preferred day?</div></div></div></section></aside></div></div>`);
  }
  function renderInboxRows() {
    if (state.inboxTab!=='Inbox') return `<div style="padding:28px;text-align:center;color:var(--text-secondary)">${state.inboxTab} items are available here in the full application history.</div>`;
    return state.inbox.map(item=>`<div class="inbox-row"><span class="square-check"></span><span><strong>${escapeHtml(item.text)}</strong><span class="tiny" style="display:block;margin-top:3px">${escapeHtml(item.hint||'Captured')}</span></span><span>${item.course==='Personal'||item.course==='Career'?`<span class="status info">${item.course}</span>`:courseBadge(item.course)}</span><span class="muted tiny">${item.type}${item.duration?` · ${item.duration}`:''}</span><span class="tiny">${item.age}</span><button class="ghost-btn" aria-label="More actions">${icon('dots')}</button></div>`).join('');
  }

  function renderCourses() {
    const selected='CIV100';
    return shell(`<div class="page-inner"><div class="page-title-row"><div><h1 class="page-title">Courses</h1><p class="page-subtitle">Fall 2026</p></div></div><div class="course-page"><aside class="course-nav">${Object.values(courses).map(c=>`<button class="${c.code===selected?'active':''}">${c.code}</button>`).join('')}</aside><section><div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">${courseBadge(selected)}<div><h2 style="margin:0;font-size:24px">CIV100</h2><div class="muted">Statics</div></div></div><p class="muted">Course overview and current planning context.</p><div class="two-col-cards"><div class="callout"><strong>Lectures</strong><span class="tiny">Tue 9:00–10:00 · BA 1170</span></div><div class="callout"><strong>Tutorials</strong><span class="tiny">Thu 11:00–12:00 · GB 248</span></div></div><div class="section-head"><h2>Assessments</h2><button class="primary-btn">Add assessment</button></div><table class="data-table"><thead><tr><th>Name</th><th>Due date</th><th>Weight</th><th>Status</th></tr></thead><tbody><tr><td>Assignment 1</td><td>Sep 7</td><td>10%</td><td>${status('Completed','success')}</td></tr><tr><td>Assignment 2</td><td>Sep 21</td><td>15%</td><td>${status('On track','success')}</td></tr><tr><td>Quiz 1</td><td>Oct 10</td><td>15%</td><td>${status('Not started','info')}</td></tr><tr><td>Final Exam</td><td>Dec 4</td><td>60%</td><td>${status('Not started','info')}</td></tr></tbody></table><div class="section-head"><h2>Recurring work</h2></div><div class="row-list"><div class="task-row"><span>${icon('calendar')}</span><span>Tutorial preparation</span><span class="tiny">Before each tutorial</span><span>${status('Auto','info')}</span></div><div class="task-row"><span>${icon('book')}</span><span>Lecture review</span><span class="tiny">After lecture</span><span>${status('Auto','info')}</span></div></div></section></div></div>`);
  }

  function renderAvailability() {
    const labels=['Classes','Study bounds','Gym','Prayer','Sleep','Commute','Personal time'];
    return shell(`<div class="page-inner"><div class="page-title-row"><div><h1 class="page-title">Calendar & Availability</h1><p class="page-subtitle">Set your time. Your rules.</p></div><button class="primary-btn">Add block</button></div><div class="tabbar" style="width:max-content;margin-bottom:20px"><button class="active">Availability</button><button>Calendar Sync</button><button>Time Blocks</button><button>Exceptions</button></div><div class="availability-grid"><div class="av-cell av-label"></div>${fixtures.weekDays.map(d=>`<div class="av-cell av-label">${d.name}</div>`).join('')}${labels.map((label,row)=>`<div class="av-cell av-label">${label}</div>${fixtures.weekDays.map((d,i)=>`<div class="av-cell selected-day">${availabilityBlock(label,row,i)}</div>`).join('')}`).join('')}</div></div>`);
  }
  function availabilityBlock(label,row,i){
    const map={
      'Classes': i<5?['9:00–1:00','var(--course-blue)']:['','var(--course-blue)'],
      'Study bounds':['8:00–10:00','var(--primary)'],
      'Gym':(i===0||i===2||i===5)?['4:00–5:00','var(--course-green)']:['','var(--course-green)'],
      'Prayer':['Daily','var(--course-amber)'],
      'Sleep':['10:00–6:00','var(--course-violet)'],
      'Commute':i<5?['AM / PM','var(--course-slate)']:['','var(--course-slate)'],
      'Personal time':['Flexible','var(--success)']
    };
    const [text,color]=map[label]||['','var(--course-slate)'];
    return text?`<div class="av-block" style="--course:${color}">${text}</div>`:'';
  }

  function renderIntegrations() {
    return shell(`<div class="page-inner"><div class="page-title-row"><div><h1 class="page-title">Integrations</h1><p class="page-subtitle">External sources can supply facts. The planner remains in control of the schedule.</p></div></div><div class="settings-section"><div class="setting-row"><div><label>Google Calendar</label><p>Read occupied time and optionally publish generated Study Plan sessions.</p></div><div>${status('Connected','success')} <button class="secondary-btn">Manage</button></div></div><div class="setting-row"><div><label>Quercus / LMS</label><p>Course and assessment import boundary. Deep automation remains a later release.</p></div><div>${status('Review required','warning')} <button class="secondary-btn">Review</button></div></div><div class="setting-row"><div><label>Google Drive</label><p>Associate course and assessment resources without using Drive as the task database.</p></div><div>${status('Available','info')} <button class="secondary-btn">Manage</button></div></div><div class="setting-row"><div><label>Email ingestion</label><p>Not part of the MVP.</p></div><div>${status('Later','info')}</div></div></div></div>`);
  }

  function renderSettings() {
    return shell(`<div class="page-inner"><div class="page-title-row"><div><h1 class="page-title">Settings</h1><p class="page-subtitle">Make the planner fit your boundaries without turning it into a control panel.</p></div></div><div class="settings-layout"><nav class="settings-nav"><button class="active">General</button><button>Planning</button><button>Integrations</button><button>Appearance</button><button>Accessibility</button><button>Data & Privacy</button></nav><section class="settings-section"><h2 style="margin-top:0">General</h2><div class="setting-row"><div><label>Term</label><p>Active academic term.</p></div><select><option>Fall 2026</option></select></div><div class="setting-row"><div><label>Planner aggressiveness</label><p>High-level scheduling density preference.</p></div><select><option>Balanced (recommended)</option><option>Relaxed</option><option>Compact</option></select></div><div class="setting-row"><div><label>Default study session length</label><p>Preferred session size before task-specific rules.</p></div><select><option>50 minutes</option></select></div><div class="setting-row"><div><label>Deadline buffer</label><p>Preferred completion target before a hard deadline.</p></div><select><option>1 day</option></select></div><div class="setting-row"><div><label>Include commute time</label><p>Only tasks tagged TRANSIT_OK may use commute capacity.</p></div><button class="switch" aria-label="Include commute time"></button></div><div class="setting-row"><div><label>Protect prayer times</label><p>Hard protection where configured.</p></div><button class="switch" aria-label="Protect prayer times"></button></div><div class="setting-row"><div><label>Smart rescheduling</label><p>Automatically suggest alternatives when reality changes.</p></div><button class="switch" aria-label="Smart rescheduling"></button></div><div class="setting-row"><div><label>Appearance</label><p>Light and dark themes are first-class.</p></div><button class="secondary-btn" data-action="toggle-theme">Switch to ${state.theme==='light'?'dark':'light'}</button></div></section></div></div>`);
  }

  function renderOnboarding() {
    return shell(`<div class="page-inner onboarding"><section class="onboard-card"><aside class="onboard-steps">${['Welcome','Term & Courses','Timetable','Availability','Preferences','Generate Plan'].map((s,i)=>`<div class="step ${i===0?'active':''}"><span class="step-index">${i+1}</span>${s}</div>`).join('')}</aside><div class="onboard-main"><h1>Welcome to University Planner</h1><p class="muted">A smarter way to plan your university life.</p><div class="onboard-choice"><span>${icon('book',22)}</span><div><strong>Add your courses</strong><div class="tiny">Import where available or add them manually.</div></div></div><div class="onboard-choice"><span>${icon('clock',22)}</span><div><strong>Set your availability</strong><div class="tiny">Classes, sleep, gym, prayer, commute, and protected time.</div></div></div><div class="onboard-choice"><span>${icon('spark',22)}</span><div><strong>Let the planner do the rest</strong><div class="tiny">It will create a personalized plan without filling every empty minute.</div></div></div><button class="primary-btn" style="width:100%;margin-top:16px" data-route="today">Get started</button></div></section></div>`);
  }

  function renderPanel() {
    if (state.scenario) return scenarioPanel();
    if (state.conflict) return conflictPanel();
    if (state.panel==='assessment') return assessmentPanel();
    if (state.panel==='planner') return plannerPanel();
    if (state.route==='week' && state.panel==='session' && state.selectedSession) return sessionPanel();
    return '';
  }

  function sessionPanel() {
    const event=fixtures.weekEvents.find(e=>e.id===state.selectedSession) || fixtures.weekEvents.find(e=>e.id==='civ-work');
    if (!event || !event.course) return '';
    const locked=state.locked.has(event.id);
    return `<aside class="right-panel" aria-label="Session detail"><div class="panel-head"><div>${courseBadge(event.course)}<h2 class="panel-title">${escapeHtml(event.title)}</h2><div class="muted">Tue, Sep 16, 2025 · ${event.sub||'Scheduled work'}</div></div><button class="ghost-btn" data-action="close-panel" aria-label="Close">${icon('x')}</button></div><button class="primary-btn" style="width:100%" data-action="complete-session" data-session="${event.id}">${icon('check')} Mark complete</button><div style="display:flex;gap:8px;margin-top:8px"><button class="secondary-btn" style="flex:1" data-action="move-session">${icon('sliders')} Adjust</button><button class="icon-btn" aria-label="More">${icon('dots')}</button></div><div class="panel-tabs"><button class="panel-tab active">Details</button><button class="panel-tab">Task</button><button class="panel-tab">Why here?</button></div><div class="panel-section"><h4>1h 25m remaining</h4><div class="progress"><span style="width:36%"></span></div><p class="muted tiny">Due Sun, Sep 21 · 5 days left</p></div><div class="panel-section"><h4>Subtasks</h4><div class="subtask"><span class="subtask-dot done">✓</span>Understand problem set</div><div class="subtask"><span class="subtask-dot"></span>Solve remaining problems</div><div class="subtask"><span class="subtask-dot"></span>Write up solutions</div><div class="subtask"><span class="subtask-dot"></span>Final review</div></div><div class="panel-section"><h4>Why here?</h4><p class="muted" style="font-size:13px">Only two suitable desk periods remain before the preferred completion buffer. This placement keeps Wednesday lighter and preserves the Sunday deadline buffer.</p></div><div style="margin-top:28px;border-top:1px solid var(--border);padding-top:16px;display:grid;gap:6px"><button class="danger-quiet" data-action="skip-session" data-session="${event.id}">Skip session</button><button class="ghost-btn" data-action="toggle-lock" data-session="${event.id}">${icon(locked?'unlock':'lock')} ${locked?'Unlock time':'Lock time'}</button></div></aside>`;
  }

  function assessmentPanel() {
    const a=fixtures.assessments.find(x=>x.id===state.selectedAssessment) || fixtures.assessments[0];
    return `<aside class="right-panel" aria-label="Assessment detail"><div class="panel-head"><div>${courseBadge(a.course)}<h2 class="panel-title">${escapeHtml(a.title)}</h2><div class="muted">${courses[a.course]?.name||''}</div></div><button class="ghost-btn" data-action="close-panel" aria-label="Close">${icon('x')}</button></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;padding:12px 0;border-bottom:1px solid var(--border)"><div><span class="tiny">Due</span><strong style="display:block;font-size:13px">${a.due}<br>${a.dueTime}</strong></div><div><span class="tiny">Time remaining</span><strong style="display:block;font-size:13px">${a.remaining}</strong></div><div><span class="tiny">Type</span><strong style="display:block;font-size:13px">${a.type}</strong></div></div><div style="display:flex;gap:8px;margin:14px 0"><button class="primary-btn" style="flex:1">${icon('external')} Open in Quercus</button><button class="secondary-btn">View source</button></div><div class="panel-tabs"><button class="panel-tab active">Overview</button><button class="panel-tab">Tasks</button><button class="panel-tab">Planned Sessions</button><button class="panel-tab">Resources</button></div><div class="callout"><strong>Planner status</strong><span class="muted" style="font-size:13px">${a.risk}. All required work is represented in the current plan.</span></div><div class="two-col-cards"><div class="callout"><strong>Workload</strong><div class="tiny">Total estimate <b>${a.estimate}</b><br>Completed <b>${a.completed}</b><br>Remaining <b>${a.remaining}</b></div></div><div class="callout"><strong>Flexibility</strong><p class="tiny">${a.risk==='Low flexibility'?'Very little suitable capacity remains.':'You have enough suitable capacity to keep the current plan stable.'}</p></div></div>${a.description?`<div class="panel-section"><h4>Description</h4><p class="muted" style="font-size:13px">${escapeHtml(a.description)}</p></div>`:''}<div class="panel-section"><h4>Important dates</h4><div class="tiny" style="display:grid;gap:8px"><span>Release date · Mon, Sep 8, 2025</span><span>Due date · ${a.due} · ${a.dueTime}</span></div></div></aside>`;
  }

  function scenarioPanel() {
    return `<aside class="right-panel" aria-label="Scenario preview"><div class="panel-head"><div><div class="tiny">Scenario</div><h2 class="panel-title">Take Saturday off</h2><div class="muted">Move Saturday’s planned work to other days while keeping deadlines protected.</div></div><button class="ghost-btn" data-action="cancel-scenario" aria-label="Close">${icon('x')}</button></div><div class="scenario-banner"><span>✓</span><div><strong>This looks good</strong><div class="tiny">All deadlines remain protected. A few sessions will be moved.</div></div></div><div class="panel-section"><h4>What will change</h4><div class="change-list"><div class="change-item"><span class="dot" style="--course:var(--course-green)"></span><div><strong>CIV100</strong><div class="tiny">Move 50 min to Thursday</div></div></div><div class="change-item"><span class="dot" style="--course:var(--course-blue)"></span><div><strong>MAT186</strong><div class="tiny">Move 40 min to Friday</div></div></div><div class="change-item"><span class="dot" style="--course:var(--course-rose)"></span><div><strong>APS110</strong><div class="tiny">Move 30 min to Friday</div></div></div></div></div><div class="panel-section"><div class="subtask">${icon('check',18)} Deadlines · <span class="tiny">remain on track</span></div><div class="subtask">${icon('list',18)} Workload · <span class="tiny">slightly higher Thu/Fri</span></div><div class="subtask">${icon('clock',18)} Free time · <span class="tiny">full day Saturday</span></div></div><div class="callout" style="background:var(--primary-subtle)"><strong>Preview only</strong><span class="tiny">Your current schedule will not be changed until you apply this scenario.</span></div><button class="primary-btn" style="width:100%;margin-top:16px" data-action="apply-scenario">${icon('check')} Apply changes</button><button class="secondary-btn" style="width:100%;margin-top:8px" data-action="cancel-scenario">Cancel</button></aside>`;
  }

  function conflictPanel() {
    return `<aside class="right-panel" aria-label="Conflict resolution"><div class="panel-head"><div><div class="tiny">Schedule conflict</div><h2 class="panel-title">2h 30m short</h2><div class="muted">Required work does not fit under the current constraints.</div></div><button class="ghost-btn" data-action="close-conflict">${icon('x')}</button></div><div class="callout danger"><strong>Schedule conflict detected</strong><span class="tiny">The planner will not fake a valid schedule. Choose a tradeoff or explicitly accept risk.</span></div><div class="conflict-metrics"><div class="metric"><span class="tiny">Required work</span><strong>6h 30m</strong></div><div class="metric"><span class="tiny">Suitable capacity</span><strong>4h 00m</strong></div></div><div class="panel-section"><h4>What’s causing this?</h4><div class="row-list"><div class="task-row"><span>${icon('alert')}</span><span>APS111 Midterm prep</span><span>2h</span><span></span></div><div class="task-row"><span>${icon('alert')}</span><span>MAT186 Problem Set 1</span><span>1h 30m</span><span></span></div><div class="task-row"><span>${icon('lock')}</span><span>Limited availability Thu–Fri</span><span></span><span></span></div></div></div><div class="panel-section"><h4>Options</h4><div class="option-list"><label class="option"><input type="radio" name="conflict" checked><span><strong>Move gym to Saturday</strong><span class="tiny" style="display:block">Frees 2h</span></span></label><label class="option"><input type="radio" name="conflict"><span><strong>Shift lower-priority tasks</strong><span class="tiny" style="display:block">Move review sessions to next week</span></span></label><label class="option"><input type="radio" name="conflict"><span><strong>Reduce preferred buffer</strong><span class="tiny" style="display:block">Use minimum estimates; not recommended</span></span></label></div></div><button class="primary-btn" style="width:100%" data-action="resolve-conflict">Apply this change</button><button class="secondary-btn" style="width:100%;margin-top:8px" data-action="close-conflict">Try another option</button></aside>`;
  }

  function plannerPanel() {
    return `<aside class="right-panel" aria-label="Planner"><div class="panel-head"><div><div class="tiny">Planner</div><h2 class="panel-title">What’s left today?</h2></div><button class="ghost-btn" data-action="close-panel">${icon('x')}</button></div><div class="callout success"><strong>You’re in good shape.</strong><span class="tiny">About 2h 15m of useful work remains. After 8:30 PM, the rest of the evening is free.</span></div><div class="panel-section"><h4>Recommended order</h4><div class="row-list"><div class="task-row"><span>1</span><span>CIV100 · Continue Assignment 2</span><span>50 min</span><span></span></div><div class="task-row"><span>2</span><span>MAT186 · Practice problems</span><span>45 min</span><span></span></div><div class="task-row"><span>3</span><span>APS110 · Reading & notes</span><span>30 min</span><span></span></div></div></div><button class="secondary-btn" style="width:100%" data-action="scenario-saturday">Preview Saturday off</button></aside>`;
  }

  function renderCommandPalette() {
    const items=[
      ['What’s left today?','today-left'],['Can I take tonight off?','tonight-off'],['I finished CIV100 early.','finish-civ'],['Why is Thursday so busy?','why-thu'],['Schedule 2 hours for APS110 this weekend','aps-weekend'],['Move my gym to tomorrow','move-gym'],['Show my upcoming deadlines','show-upcoming'],['Review schedule conflict','conflict']
    ];
    const q=state.commandQuery.toLowerCase().trim();
    const filtered=items.filter(([label])=>!q||label.toLowerCase().includes(q));
    return `<div class="command-overlay" data-action="close-command-bg"><div class="command-box" role="dialog" aria-modal="true" aria-label="Planner command"><div class="command-input">${icon('search',17)}<input id="command-input" value="${escapeHtml(state.commandQuery)}" placeholder="Ask the planner anything…" autocomplete="off"></div><div class="command-results"><div class="command-list">${filtered.map(([label,cmd],i)=>`<button class="command-item ${i===0?'active':''}" data-command="${cmd}">${icon(i<4?'search':'calendar',15)} ${escapeHtml(label)}</button>`).join('')||`<div class="tiny" style="padding:12px">No matching local command.</div>`}</div><div class="command-list"><div class="tiny" style="padding:8px 10px">Suggested</div><button class="command-item" data-command="today-left">Review today’s plan</button><button class="command-item" data-command="scenario-saturday">Take Saturday off (preview)</button><button class="command-item" data-action="quick-add">Add a task or deadline</button><button class="command-item" data-route="settings">Open settings</button></div></div></div></div>`;
  }

  function render() {
    state.route=routeFromHash();
    state.panel=stateFromHash('panel');
    state.scenario=stateFromHash('scenario')==='saturday';
    state.conflict=stateFromHash('conflict')==='1';
    const renderers={today:renderToday,week:renderWeek,upcoming:renderUpcoming,inbox:renderInbox,courses:renderCourses,availability:renderAvailability,integrations:renderIntegrations,settings:renderSettings,onboarding:renderOnboarding};
    document.getElementById('app').innerHTML=(renderers[state.route]||renderToday)();
    if(state.commandOpen) setTimeout(()=>document.getElementById('command-input')?.focus(),0);
    if(state.route==='inbox' && sessionStorage.getItem('focus-capture')==='1') { sessionStorage.removeItem('focus-capture'); setTimeout(()=>document.getElementById('capture-input')?.focus(),0); }
  }

  function updateRouteParams(patch) {
    const current = new URLSearchParams(location.hash.split('?')[1]||'');
    Object.entries(patch).forEach(([k,v])=>{ if(v===null||v===false||v===undefined) current.delete(k); else current.set(k,String(v)); });
    setHash(state.route,Object.fromEntries(current));
  }

  function toast(message, actionLabel, actionFn) {
    const region=document.getElementById('toast-region'); if(!region) return;
    const el=document.createElement('div'); el.className='toast'; el.innerHTML=`<span>${escapeHtml(message)}</span>${actionLabel?`<button class="ghost-btn">${escapeHtml(actionLabel)}</button>`:''}`;
    if(actionLabel) el.querySelector('button').addEventListener('click',()=>{ actionFn?.(); el.remove(); });
    region.appendChild(el); setTimeout(()=>el.remove(),4500);
  }

  function completeSession(id) {
    state.completed.add(id); state.selectedSession=id==='civ-work'?'w9':state.selectedSession; toast('Session completed. Future work has been recalculated.','Undo',()=>{state.completed.delete(id);render();}); render();
  }

  document.addEventListener('click', e => {
    const routeBtn=e.target.closest('[data-route]');
    if(routeBtn){ e.preventDefault(); state.commandOpen=false; go(routeBtn.dataset.route); return; }
    const action=e.target.closest('[data-action]')?.dataset.action;
    if(!action) return;
    if(action==='open-command'){state.commandOpen=true;render();return;}
    if(action==='close-command-bg' && e.target.classList.contains('command-overlay')){state.commandOpen=false;render();return;}
    if(action==='quick-add'){state.commandOpen=false;sessionStorage.setItem('focus-capture','1');go('inbox');return;}
    if(action==='fill-capture'){const input=document.getElementById('capture-input');if(input){input.value=e.target.closest('[data-text]').dataset.text;input.focus();}return;}
    if(action==='select-session'){state.selectedSession=e.target.closest('[data-session]').dataset.session; if(state.route==='week') updateRouteParams({panel:'session'}); else {go('week'); setTimeout(()=>updateRouteParams({panel:'session'}),0);} return;}
    if(action==='close-panel'){updateRouteParams({panel:null});return;}
    if(action==='complete-session'){completeSession(e.target.closest('[data-session]').dataset.session);updateRouteParams({panel:null});return;}
    if(action==='complete-now'){completeSession(state.completed.has('civ-work')?'w9':'civ-work');return;}
    if(action==='complete-task'){const id=e.target.closest('[data-task]').dataset.task; toast('Task marked complete.','Undo'); e.target.closest('.task-row')?.remove(); return;}
    if(action==='skip-session'){const id=e.target.closest('[data-session]').dataset.session;toast('Session skipped. The planner moved the unfinished work.','Undo');state.selectedSession=null;updateRouteParams({panel:null});return;}
    if(action==='toggle-lock'){const id=e.target.closest('[data-session]').dataset.session; if(state.locked.has(id)){state.locked.delete(id);toast('Session unlocked.');}else{state.locked.add(id);toast('Session locked. The planner will leave this time alone.');}render();return;}
    if(action==='move-session'){toast('Move mode: choose a recommended time in the production planner.');return;}
    if(action==='adjust-now'){state.selectedSession='civ-work';go('week');setTimeout(()=>updateRouteParams({panel:'session'}),0);return;}
    if(action==='scenario-saturday'){state.commandOpen=false;if(state.route!=='week'){go('week');setTimeout(()=>updateRouteParams({scenario:'saturday'}),0);}else updateRouteParams({scenario:'saturday',panel:null});return;}
    if(action==='cancel-scenario'){updateRouteParams({scenario:null});return;}
    if(action==='apply-scenario'){updateRouteParams({scenario:null});toast('Saturday protected. 3 sessions moved; deadlines remain safe.','Undo',()=>toast('Previous plan restored.'));return;}
    if(action==='open-assessment'){state.selectedAssessment=e.target.closest('[data-assessment]').dataset.assessment; if(state.route!=='upcoming'){go('upcoming');setTimeout(()=>updateRouteParams({panel:'assessment'}),0);}else updateRouteParams({panel:'assessment'});return;}
    if(action==='protect-tonight'){updateRouteParams({panel:'planner'});toast('Planner opened a non-mutating preview first.');return;}
    if(action==='something-changed'){state.conflict=true;if(state.route!=='week'){go('week');setTimeout(()=>updateRouteParams({conflict:'1'}),0);}else updateRouteParams({conflict:'1'});return;}
    if(action==='close-conflict'){updateRouteParams({conflict:null});return;}
    if(action==='resolve-conflict'){updateRouteParams({conflict:null});toast('Conflict resolved in preview: gym moved to Saturday.');return;}
    if(action==='inbox-tab'){state.inboxTab=e.target.closest('[data-tab]').dataset.tab;render();return;}
    if(action==='mobile-day'){state.selectedMobileDay=Number(e.target.closest('[data-day]').dataset.day);render();return;}
    if(action==='toggle-theme'){state.theme=state.theme==='light'?'dark':'light';localStorage.setItem('planner-theme',state.theme);document.documentElement.dataset.theme=state.theme;render();return;}
  });

  document.addEventListener('submit', e => {
    if(e.target.id!=='capture-form') return;
    e.preventDefault();
    const input=document.getElementById('capture-input'); const text=(input?.value||'').trim(); if(!text) return;
    const upper=text.toUpperCase(); const course=Object.keys(courses).find(code=>upper.includes(code))||'Personal';
    state.inbox.unshift({id:`captured-${Date.now()}`,text,hint:course==='Personal'?'Captured — details can be resolved later':'Captured — planner will classify remaining details',course,type:'Task',duration:'',age:'now'});
    input.value=''; toast('Captured. No large form required.'); render(); setTimeout(()=>document.getElementById('capture-input')?.focus(),0);
  });

  document.addEventListener('input', e => {
    if(e.target.id==='command-input'){state.commandQuery=e.target.value; const caret=e.target.selectionStart; render(); setTimeout(()=>{const i=document.getElementById('command-input');if(i){i.focus();i.setSelectionRange(caret,caret);}},0);}
  });

  document.addEventListener('click', e=>{
    const cmd=e.target.closest('[data-command]')?.dataset.command; if(!cmd) return;
    state.commandOpen=false; state.commandQuery='';
    if(cmd==='today-left'){ if(state.route!=='today') go('today'); setTimeout(()=>updateRouteParams({panel:'planner'}),0); }
    else if(cmd==='scenario-saturday'||cmd==='tonight-off'){ if(state.route!=='week') go('week'); setTimeout(()=>updateRouteParams({scenario:'saturday'}),0); }
    else if(cmd==='finish-civ'){ state.completed.add('civ-work'); toast('CIV100 work marked complete. Future sessions released where no longer needed.','Undo',()=>{state.completed.delete('civ-work');render();}); render(); }
    else if(cmd==='why-thu'){ if(state.route!=='week') go('week'); setTimeout(()=>{state.selectedSession='w18';updateRouteParams({panel:'session'});},0); }
    else if(cmd==='show-upcoming'){ go('upcoming'); }
    else if(cmd==='conflict'){ if(state.route!=='week') go('week'); setTimeout(()=>updateRouteParams({conflict:'1'}),0); }
    else toast('Command captured. The production assistant will route it through validated application services.');
  });

  document.addEventListener('keydown', e => {
    const editable=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();state.commandOpen=!state.commandOpen;render();return;}
    if(e.key==='Escape'){if(state.commandOpen){state.commandOpen=false;render();return;} if(state.scenario||state.conflict||state.panel){updateRouteParams({scenario:null,conflict:null,panel:null});return;}}
    if(editable) return;
    if(e.key.toLowerCase()==='n'){e.preventDefault();sessionStorage.setItem('focus-capture','1');go('inbox');return;}
    if(e.key.toLowerCase()==='g'){state.gPending=true;setTimeout(()=>state.gPending=false,900);return;}
    if(state.gPending){const k=e.key.toLowerCase();state.gPending=false;const map={t:'today',w:'week',u:'upcoming',i:'inbox'};if(map[k]){e.preventDefault();go(map[k]);}return;}
    if(e.key.toLowerCase()==='d'&&state.route==='week'&&state.selectedSession){completeSession(state.selectedSession);return;}
    if(e.key.toLowerCase()==='l'&&state.route==='week'&&state.selectedSession){if(state.locked.has(state.selectedSession))state.locked.delete(state.selectedSession);else state.locked.add(state.selectedSession);render();return;}
    if(e.key.toLowerCase()==='m'&&state.route==='week'&&state.selectedSession){toast('Move: select a recommended destination in the full app.');return;}
  });

  window.addEventListener('hashchange', render);
  if(!location.hash) location.hash='#today'; else render();
})();
