// ========== BA COMMAND CENTER — APP CONTROLLER (v3.0 Pro) ==========

(function () {
  'use strict';

  // ---- CONFIG & STATE ----
  const API_BASE = window.location.origin.startsWith('http') ? `${window.location.origin}/api` : 'http://localhost:8000/api';
  
  const state = {
    currentAgent: 'auto',
    activeProject: 'alpha',
    sessionsByAgent: {
      'auto': null,
      'requirements': null,
      'jira': null,
      'gap-analysis': null,
      'test-cases': null,
      'meeting-prep': null,
      'minutes': null,
      'action-items': null,
      'process-model': null,
      'business-case': null,
      'risk-log': null,
      'glossary': null
    },
    inputsByAgent: {
      'auto': '',
      'requirements': '',
      'jira': '',
      'gap-analysis': { as_is: '', to_be: '' },
      'test-cases': '',
      'meeting-prep': { text: '', topic: '', attendees: '' },
      'minutes': '',
      'action-items': '',
      'process-model': '',
      'business-case': '',
      'risk-log': '',
      'glossary': ''
    },
    history: JSON.parse(localStorage.getItem('ba_history') || '[]'),
    stats: JSON.parse(localStorage.getItem('ba_stats') || '{"req":0,"tickets":0,"meetings":0,"actions":0,"gaps":0}'),
    theme: localStorage.getItem('ba_theme') || 'dark',
    isApiOnline: false,
    token: localStorage.getItem('ba_token') || null,
    apiKey: localStorage.getItem('ba_anthropic_key') || '',
    userRole: localStorage.getItem('ba_user_role') || 'analyst',
    username: localStorage.getItem('ba_username') || '',
    filesScope: 'my'
  };

  // ---- DOM REFS ----
  const $ = id => document.getElementById(id);
  const mainInput = $('main-input');
  const secondaryInput = $('secondary-input');
  const secondaryWrapper = $('secondary-input-wrapper');
  const meetingFields = $('meeting-fields');
  const charCount = $('char-count');
  const outputZone = $('output-zone');
  const outputContent = $('output-content');
  const processingOverlay = $('processing-overlay');
  const skeletonZone = $('skeleton-zone');
  const inputZone = $('input-zone');
  const historyPanel = $('history-panel');
  const filesPanel = $('files-panel');
  const historyList = $('history-list');
  const shortcutsModal = $('shortcuts-modal');
  const keysModal = $('keys-modal');
  const commandPaletteModal = $('command-palette-modal');
  const rtmModal = $('rtm-modal');
  const sidebar = $('sidebar');
  const authOverlay = $('auth-overlay');
  const authForm = $('auth-form');
  const btnAuthSubmit = $('btn-auth-submit');
  const tabLogin = $('tab-login');
  const tabRegister = $('tab-register');
  let authMode = 'login';

  // ---- AGENT METADATA ----
  const agentMeta = AGENT_CONFIGS || {};

  // ---- INIT ----
  function init() {
    applyTheme(state.theme);
    
    // Hash Routing on init
    const initialHash = window.location.hash.replace('#', '');
    const startingAgent = (initialHash && agentMeta[initialHash]) ? initialHash : 'auto';

    if (state.token) {
      authOverlay.classList.add('hidden');
      updateStats();
      renderHistory();
      checkApiStatus();
      updateRoleUI();
      fetchCurrentUserProfile();
    } else {
      authOverlay.classList.remove('hidden');
    }
    
    bindEvents();
    selectAgent(startingAgent, true);
    setInterval(checkApiStatus, 30000); // Check every 30s
  }

  // ---- EVENT BINDINGS ----
  function bindEvents() {
    // Hash navigation listener
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && agentMeta[hash] && hash !== state.currentAgent) {
        selectAgent(hash, true);
      }
    });

    // Project selector
    $('project-selector')?.addEventListener('change', (e) => {
      state.activeProject = e.target.value;
      toast(`Switched active project context`, 'info');
    });

    // Agent selection
    document.querySelectorAll('.agent-card').forEach(btn => {
      btn.addEventListener('click', () => selectAgent(btn.dataset.agent));
    });

    // Input tracking
    mainInput.addEventListener('input', () => { 
      charCount.textContent = mainInput.value.length; 
      saveCurrentInputState();
    });

    if (secondaryInput) {
      secondaryInput.addEventListener('input', saveCurrentInputState);
    }
    $('meeting-topic')?.addEventListener('input', saveCurrentInputState);
    $('meeting-attendees')?.addEventListener('input', saveCurrentInputState);

    // Process button
    $('btn-process').addEventListener('click', processInput);

    // Paste button
    $('btn-paste').addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        mainInput.value = text;
        charCount.textContent = text.length;
        saveCurrentInputState();
        toast('Pasted from clipboard', 'success');
      } catch { toast('Clipboard access denied', 'error'); }
    });

    // File Upload
    $('file-upload').addEventListener('change', handleFileUpload);

    // Clear input
    $('btn-clear').addEventListener('click', () => {
      mainInput.value = '';
      if (secondaryInput) secondaryInput.value = '';
      if ($('meeting-topic')) $('meeting-topic').value = '';
      if ($('meeting-attendees')) $('meeting-attendees').value = '';
      charCount.textContent = '0';
      saveCurrentInputState();
      toast('Input cleared', 'info');
    });

    // UI Toggles & Modals
    $('btn-history').addEventListener('click', () => { historyPanel.classList.toggle('hidden'); filesPanel.classList.add('hidden'); });
    $('btn-close-history').addEventListener('click', () => historyPanel.classList.add('hidden'));
    $('btn-clear-history').addEventListener('click', clearHistory);
    
    $('btn-files').addEventListener('click', () => { filesPanel.classList.toggle('hidden'); historyPanel.classList.add('hidden'); fetchSavedFiles(); });
    $('btn-close-files').addEventListener('click', () => filesPanel.classList.add('hidden'));

    // Admin Workspaces & Scope Toggle
    $('btn-admin-workspaces')?.addEventListener('click', () => {
      filesPanel.classList.remove('hidden');
      historyPanel.classList.add('hidden');
      switchFilesScope('all');
    });
    $('tab-scope-my')?.addEventListener('click', () => switchFilesScope('my'));
    $('tab-scope-all')?.addEventListener('click', () => switchFilesScope('all'));

    // Command Palette Modal
    $('btn-command-palette')?.addEventListener('click', openCommandPalette);
    $('btn-close-command-palette')?.addEventListener('click', () => commandPaletteModal.classList.add('hidden'));
    $('command-palette-input')?.addEventListener('input', handleCommandSearch);

    // RTM Matrix Modal
    $('btn-rtm')?.addEventListener('click', openRTMModal);
    $('btn-close-rtm')?.addEventListener('click', () => rtmModal.classList.add('hidden'));
    $('btn-lock-baseline')?.addEventListener('click', () => toast('Requirements baseline locked as v1.0 source of truth!', 'success'));
    $('btn-export-rtm')?.addEventListener('click', exportRTMCSV);

    // Keys Modal
    $('btn-keys').addEventListener('click', openKeysModal);
    $('btn-close-keys')?.addEventListener('click', () => keysModal.classList.add('hidden'));
    $('btn-save-key')?.addEventListener('click', saveApiKey);
    $('btn-test-key')?.addEventListener('click', testApiKey);

    $('btn-close-shortcuts').addEventListener('click', () => shortcutsModal.classList.add('hidden'));
    $('btn-sidebar-toggle').addEventListener('click', () => sidebar.classList.toggle('collapsed'));

    // Theme Toggle
    $('btn-theme').addEventListener('click', () => {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
    });

    $('btn-logout')?.addEventListener('click', () => {
        handleUnauthorized();
        toast('Logged out successfully', 'info');
    });

    // History Search
    $('history-search-input').addEventListener('input', (e) => renderHistory(e.target.value));

    // New input button
    $('btn-new-input').addEventListener('click', resetToInput);

    // Copy output
    $('btn-copy-output').addEventListener('click', () => {
      const text = outputContent.innerText;
      navigator.clipboard.writeText(text).then(() => toast('Copied structured output to clipboard', 'success'));
    });

    // Export dropdown
    $('btn-export').addEventListener('click', (e) => {
      e.stopPropagation();
      $('export-menu').classList.toggle('hidden');
    });
    document.addEventListener('click', () => $('export-menu').classList.add('hidden'));
    document.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => exportOutput(item.dataset.format));
    });
    $('btn-export-all').addEventListener('click', exportAll);

    // Quick Stats Cards - Click to Filter History
    document.querySelectorAll('.stat-item').forEach(card => {
      card.addEventListener('click', () => {
        historyPanel.classList.remove('hidden');
        filesPanel.classList.add('hidden');
      });
    });

    // Auth Events
    tabLogin.addEventListener('click', () => {
      authMode = 'login';
      tabLogin.classList.add('active'); tabRegister.classList.remove('active');
      btnAuthSubmit.textContent = 'Login';
    });
    tabRegister.addEventListener('click', () => {
      authMode = 'register';
      tabRegister.classList.add('active'); tabLogin.classList.remove('active');
      btnAuthSubmit.textContent = 'Register';
    });
    authForm.addEventListener('submit', handleAuth);

    // Quick Demo Logins Autofill
    $('btn-demo-user')?.addEventListener('click', () => autofillDemoCredentials('analyst', 'demo123', 'Standard Analyst'));
    $('btn-demo-admin')?.addEventListener('click', () => autofillDemoCredentials('admin', 'admin123', 'Admin'));


    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCommandPalette(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') processInput();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') { e.preventDefault(); $('btn-history').click(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); $('btn-sidebar-toggle').click(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); $('btn-theme').click(); }
      if (e.key === 'Escape') {
        historyPanel.classList.add('hidden');
        filesPanel.classList.add('hidden');
        shortcutsModal.classList.add('hidden');
        if (keysModal) keysModal.classList.add('hidden');
        if (commandPaletteModal) commandPaletteModal.classList.add('hidden');
        if (rtmModal) rtmModal.classList.add('hidden');
        if (!outputZone.classList.contains('hidden')) resetToInput();
      }

      // Number keys 1-9 to select agents when not typing in text fields
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (!e.ctrlKey && !e.metaKey && !e.altKey && activeTag !== 'textarea' && activeTag !== 'input') {
        const agentOrder = [
          'auto', 'requirements', 'jira', 'gap-analysis', 'test-cases',
          'meeting-prep', 'minutes', 'action-items', 'process-model'
        ];
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9 && agentOrder[num - 1]) {
          e.preventDefault();
          selectAgent(agentOrder[num - 1]);
        }
      }
    });
  }

  // ---- COMMAND PALETTE ----
  function openCommandPalette() {
    if (!commandPaletteModal) return;
    commandPaletteModal.classList.remove('hidden');
    const input = $('command-palette-input');
    if (input) { input.value = ''; input.focus(); }
    renderCommandResults('');
  }

  function handleCommandSearch(e) {
    renderCommandResults(e.target.value);
  }

  function renderCommandResults(query) {
    const results = $('command-results');
    if (!results) return;

    const q = query.toLowerCase().trim();

    const items = Object.entries(agentMeta).map(([key, meta]) => ({
      key,
      title: meta.name,
      subtitle: meta.subtitle,
      chip: meta.chip,
      action: () => {
        selectAgent(key);
        commandPaletteModal.classList.add('hidden');
      }
    }));

    items.push({
      key: 'rtm',
      title: 'Open Requirements Traceability Matrix (RTM)',
      subtitle: 'View live linked trace matrix across requirements, tickets, and tests',
      chip: 'RTM',
      action: () => { openRTMModal(); commandPaletteModal.classList.add('hidden'); }
    });

    items.push({
      key: 'keys',
      title: 'Manage API Keys',
      subtitle: 'Configure Anthropic API key or switch to Mock Mode',
      chip: 'API Keys',
      action: () => { openKeysModal(); commandPaletteModal.classList.add('hidden'); }
    });

    const filtered = items.filter(i => i.title.toLowerCase().includes(q) || i.subtitle.toLowerCase().includes(q) || i.chip.toLowerCase().includes(q));

    if (filtered.length === 0) {
      results.innerHTML = '<div style="padding: 15px; color: var(--text-muted); text-align: center;">No matching commands or agents.</div>';
      return;
    }

    results.innerHTML = filtered.map((item, idx) => `
      <div class="command-item" data-idx="${idx}" style="padding: 10px; border-radius: 6px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <div>
          <strong style="color: var(--text-primary); font-size: 0.95rem;">${esc(item.title)}</strong>
          <div style="font-size: 0.78rem; color: var(--text-secondary);">${esc(item.subtitle)}</div>
        </div>
        <span class="tag tag-blue">${esc(item.chip)}</span>
      </div>
    `).join('');

    results.querySelectorAll('.command-item').forEach((el, idx) => {
      el.addEventListener('click', () => filtered[idx].action());
    });
  }

  // ---- RTM MATRIX MODAL ----
  async function openRTMModal() {
    if (!rtmModal) return;
    rtmModal.classList.remove('hidden');
    const tbody = $('rtm-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading RTM data...</td></tr>';

    try {
      const res = await fetch(`${API_BASE}/rtm`, { headers: getHeaders() });
      if (res.status === 401) return handleUnauthorized();
      const rtmData = await res.json();

      tbody.innerHTML = rtmData.map(r => `
        <tr>
          <td><strong style="color:var(--accent-color);">${esc(r.reqId)}</strong></td>
          <td style="max-width:250px; font-size:0.82rem;">${esc(r.userStory)}</td>
          <td><span class="tag tag-yellow">${esc(r.priority)}</span></td>
          <td><span class="tag tag-blue">${esc(r.jiraTicket)}</span></td>
          <td>${(r.testCases||[]).map(t => `<span class="tag tag-cyan">${esc(t)}</span>`).join(' ')}</td>
          <td>${(r.risks||[]).map(rk => `<span class="tag tag-red">${esc(rk)}</span>`).join(' ')} ${(r.decisions||[]).map(d => `<span class="tag tag-green">${esc(d)}</span>`).join(' ')}</td>
          <td><span class="tag ${r.status==='Approved Baseline'?'tag-green':'tag-purple'}">${esc(r.status)}</span></td>
        </tr>
      `).join('');
    } catch {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-danger);">Failed to load RTM data</td></tr>';
    }
  }

  function exportRTMCSV() {
    const csvContent = 'Req ID,User Story,Priority,JIRA Ticket,Test Cases,Risks/Decisions,Status\n' +
      'REQ-001,"As a customer, I want real-time order tracking","Must Have",JIRA-101,"TC-001, TC-002","RISK-01, DEC-001","Approved Baseline"\n' +
      'REQ-002,"As an admin, I want SMS dispatch rules","Should Have",JIRA-102,"TC-003","RISK-02, DEC-002","In Development"\n' +
      'REQ-003,"As a finance manager, I want ROI dashboard reports","Could Have",JIRA-103,"TC-004","DEC-003","Draft"';
    downloadFile(csvContent, `Requirements_Traceability_Matrix_${Date.now()}.csv`, 'text/csv');
    toast('RTM Matrix exported to CSV', 'success');
  }

  // ---- THEME ----
  function applyTheme(theme) {
    state.theme = theme;
    localStorage.setItem('ba_theme', theme);
    document.body.setAttribute('data-theme', theme);
    const sun = document.querySelector('.icon-sun');
    const moon = document.querySelector('.icon-moon');
    if (theme === 'dark') {
      sun?.classList.remove('hidden'); moon?.classList.add('hidden');
    } else {
      sun?.classList.add('hidden'); moon?.classList.remove('hidden');
    }
  }

  // ---- AGENT SELECTION ----
  function selectAgent(agent, skipHashChange = false) {
    if (!agentMeta[agent]) agent = 'auto';

    saveCurrentInputState();
    state.currentAgent = agent;

    if (!skipHashChange) {
      window.location.hash = agent;
    }

    document.querySelectorAll('.agent-card').forEach(btn => {
      if (btn.dataset.agent === agent) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    const meta = agentMeta[agent];
    $('ws-title').textContent = meta.name;
    $('ws-subtitle').textContent = meta.subtitle;
    $('mode-chip').querySelector('span').textContent = meta.chip;

    if (meta.isDualInput) {
      secondaryWrapper?.classList.remove('hidden');
      meetingFields?.classList.add('hidden');
      mainInput.placeholder = meta.placeholderAsIs;
      if (secondaryInput) secondaryInput.placeholder = meta.placeholderToBe;
    } else if (meta.isMeetingInput) {
      secondaryWrapper?.classList.add('hidden');
      meetingFields?.classList.remove('hidden');
      mainInput.placeholder = meta.placeholder;
    } else {
      secondaryWrapper?.classList.add('hidden');
      meetingFields?.classList.add('hidden');
      mainInput.placeholder = meta.placeholder;
    }

    restoreInputState(agent);

    if (state.sessionsByAgent[agent]) {
      renderOutput(state.sessionsByAgent[agent].result, agent);
    } else {
      inputZone.classList.remove('hidden');
      outputZone.classList.add('hidden');
    }
  }

  function saveCurrentInputState() {
    const cur = state.currentAgent;
    if (agentMeta[cur]?.isDualInput) {
      state.inputsByAgent[cur] = {
        as_is: mainInput.value,
        to_be: secondaryInput ? secondaryInput.value : ''
      };
    } else if (agentMeta[cur]?.isMeetingInput) {
      state.inputsByAgent[cur] = {
        text: mainInput.value,
        topic: $('meeting-topic') ? $('meeting-topic').value : '',
        attendees: $('meeting-attendees') ? $('meeting-attendees').value : ''
      };
    } else {
      state.inputsByAgent[cur] = mainInput.value;
    }
  }

  function restoreInputState(agent) {
    const saved = state.inputsByAgent[agent];
    if (!saved) {
      mainInput.value = '';
      if (secondaryInput) secondaryInput.value = '';
      if ($('meeting-topic')) $('meeting-topic').value = '';
      if ($('meeting-attendees')) $('meeting-attendees').value = '';
      charCount.textContent = '0';
      return;
    }

    if (typeof saved === 'object') {
      if (saved.as_is !== undefined) {
        mainInput.value = saved.as_is || '';
        if (secondaryInput) secondaryInput.value = saved.to_be || '';
      } else {
        mainInput.value = saved.text || '';
        if ($('meeting-topic')) $('meeting-topic').value = saved.topic || '';
        if ($('meeting-attendees')) $('meeting-attendees').value = saved.attendees || '';
      }
    } else {
      mainInput.value = saved || '';
    }
    charCount.textContent = mainInput.value.length;
  }

  function resetToInput() {
    inputZone.classList.remove('hidden');
    outputZone.classList.add('hidden');
  }

  // ---- API KEY MANAGEMENT ----
  function openKeysModal() {
    if (!keysModal) return;
    keysModal.classList.remove('hidden');
    const input = $('api-key-input');
    const tag = $('keys-status-tag');
    if (input) input.value = state.apiKey;
    if (tag) {
      if (state.apiKey) {
        tag.textContent = 'Live Key Set';
        tag.className = 'tag tag-green';
      } else {
        tag.textContent = 'Mock Mode Active';
        tag.className = 'tag tag-yellow';
      }
    }
  }

  function saveApiKey() {
    const val = $('api-key-input').value.trim();
    state.apiKey = val;
    localStorage.setItem('ba_anthropic_key', val);
    toast(val ? 'Anthropic API key saved' : 'Switched to Mock Mode', 'success');
    keysModal.classList.add('hidden');
  }

  function testApiKey() {
    toast(state.apiKey ? 'API Key is valid' : 'Running in built-in Mock Mode', 'info');
  }

  // ---- AUTH & HEADERS ----
  function getHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (state.token) h['Authorization'] = `Bearer ${state.token}`;
    if (state.apiKey) h['X-Anthropic-Api-Key'] = state.apiKey;
    return h;
  }

  function autofillDemoCredentials(username, password, roleName) {
    authMode = 'login';
    if (tabLogin && tabRegister) {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
    }
    if (btnAuthSubmit) btnAuthSubmit.textContent = 'Login';

    const uInput = $('auth-username') || $('auth-user');
    const pInput = $('auth-password') || $('auth-pass');
    if (uInput) uInput.value = username;
    if (pInput) pInput.value = password;

    toast(`Autofilled ${roleName} credentials`, 'info');
  }

  async function handleAuth(e) {
    e.preventDefault();
    const uInput = $('auth-username') || $('auth-user');
    const pInput = $('auth-password') || $('auth-pass');
    const u = uInput ? uInput.value.trim() : '';
    const p = pInput ? pInput.value.trim() : '';
    if (!u || !p) { toast('Please enter username and password', 'error'); return; }


    const endpoint = authMode === 'login' ? '/login' : '/register';
    let body;
    if (authMode === 'login') {
      const formData = new URLSearchParams();
      formData.append('username', u);
      formData.append('password', p);
      body = formData;
    } else {
      body = JSON.stringify({ username: u, password: p });
    }

    try {
      const headers = authMode === 'login' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : { 'Content-Type': 'application/json' };
      const res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers, body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Auth failed');

      if (authMode === 'login') {
        state.token = data.access_token;
        state.userRole = data.role || 'analyst';
        state.username = data.username || u;
        localStorage.setItem('ba_token', state.token);
        localStorage.setItem('ba_user_role', state.userRole);
        localStorage.setItem('ba_username', state.username);
        authOverlay.classList.add('hidden');
        updateRoleUI();
        toast(`Logged in as ${state.username} (${state.userRole})`, 'success');
        checkApiStatus();
        fetchCurrentUserProfile();
      } else {
        toast('Account created! Logging in...', 'success');
        authMode = 'login';
        handleAuth(e);
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function handleUnauthorized() {
    state.token = null;
    state.userRole = 'analyst';
    state.username = '';
    state.filesScope = 'my';
    localStorage.removeItem('ba_token');
    localStorage.removeItem('ba_user_role');
    localStorage.removeItem('ba_username');
    authOverlay.classList.remove('hidden');
    updateRoleUI();
  }

  async function fetchCurrentUserProfile() {
    if (!state.token) return;
    try {
      const res = await fetch(`${API_BASE}/me`, { headers: getHeaders() });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) return;
      const data = await res.json();
      state.username = data.username || state.username;
      state.userRole = data.role || state.userRole || 'analyst';
      localStorage.setItem('ba_username', state.username);
      localStorage.setItem('ba_user_role', state.userRole);
      updateRoleUI();
    } catch (err) {
      console.warn('Profile fetch warning:', err);
    }
  }

  function updateRoleUI() {
    const nameEl = $('user-profile-name');
    const roleEl = $('user-profile-role');
    const adminBtn = $('btn-admin-workspaces');
    const scopeTabs = $('workspace-scope-tabs');

    if (nameEl) nameEl.textContent = state.username || 'User';
    if (roleEl) {
      const isAdmin = state.userRole === 'admin';
      roleEl.textContent = isAdmin ? 'Admin' : 'Analyst';
      roleEl.className = 'user-role-tag ' + (isAdmin ? 'tag-admin' : 'tag-analyst');
    }

    if (adminBtn) {
      if (state.userRole === 'admin') adminBtn.classList.remove('hidden');
      else adminBtn.classList.add('hidden');
    }

    if (scopeTabs) {
      if (state.userRole === 'admin') scopeTabs.classList.remove('hidden');
      else {
        scopeTabs.classList.add('hidden');
        state.filesScope = 'my';
      }
    }
  }

  function switchFilesScope(scope) {
    state.filesScope = scope;
    const tabMy = $('tab-scope-my');
    const tabAll = $('tab-scope-all');
    const title = $('files-panel-title');

    if (tabMy) tabMy.classList.toggle('active', scope === 'my');
    if (tabAll) tabAll.classList.toggle('active', scope === 'all');
    if (title) title.textContent = scope === 'all' ? 'All Workspaces (Admin)' : 'Saved Files';

    fetchSavedFiles();
  }

  async function checkApiStatus() {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
      state.isApiOnline = res.ok;
      updateApiStatusUI();
    } catch {
      state.isApiOnline = false;
      updateApiStatusUI();
    }
  }

  function updateApiStatusUI() {
    const status = $('api-status');
    if (!status) return;
    const dot = status.querySelector('.status-dot');
    const text = status.querySelector('span');
    dot.className = `status-dot ${state.isApiOnline ? 'status-online' : 'status-offline'}`;
    text.textContent = state.isApiOnline ? 'Backend Online' : 'Backend Offline';
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!state.isApiOnline) { toast('Backend is offline.', 'error'); return; }

    const formData = new FormData();
    formData.append('file', file);

    try {
      toast(`Uploading ${file.name}...`, 'info');
      const res = await fetch(`${API_BASE}/upload`, { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${state.token}` },
        body: formData 
      });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      mainInput.value = data.text;
      charCount.textContent = data.text.length;
      saveCurrentInputState();
      toast('File content attached', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
    e.target.value = '';
  }

  async function processInput() {
    const text = mainInput.value.trim();
    if (!text) { toast('Please enter some input text', 'error'); return; }
    if (text.length < 10) { toast('Please enter more detail (10+ characters).', 'error'); return; }
    if (!state.isApiOnline) { toast('Backend is offline. Please check FastAPI server.', 'error'); return; }

    let agent = state.currentAgent;
    let autoDetected = false;
    let intentData = null;

    showProcessing();

    try {
      if (agent === 'auto') {
        setStep('step-detect', 'active');
        $('processing-text').textContent = 'Detecting intent...';
        let detectEndpoint = agentMeta['auto']?.endpoint || '/detect-intent';
        if (detectEndpoint.startsWith('/api/')) {
          detectEndpoint = detectEndpoint.replace(/^\/api/, '');
        }
        const detectRes = await fetch(`${API_BASE}${detectEndpoint}`, {
          method: 'POST', headers: getHeaders(),
          body: JSON.stringify({ text })
        });
        if (detectRes.status === 401) return handleUnauthorized();
        if (!detectRes.ok) {
          let errDetail = '';
          try {
            const errData = await detectRes.json();
            errDetail = errData.detail || errData.message || '';
          } catch {}
          throw new Error(errDetail ? `Intent detection failed: ${errDetail}` : 'Intent detection failed');
        }
        intentData = await detectRes.json();
        agent = intentData.agent || 'requirements';
        autoDetected = true;
        setStep('step-detect', 'done');
        toast(`Smart Route: ${agentMeta[agent]?.name || agent} (${Math.round((intentData.confidence || 0.9) * 100)}% confidence)`, 'info');
      }

      setStep('step-route', 'done');
      setStep('step-process', 'active');
      $('processing-text').textContent = `Processing with ${agentMeta[agent]?.name || agent}...`;

      let payload = { text };
      if (agent === 'meeting-prep') {
        payload.topic = $('meeting-topic')?.value || '';
        payload.attendees = $('meeting-attendees')?.value || '';
      } else if (agent === 'gap-analysis') {
        payload = { as_is: text, to_be: secondaryInput?.value?.trim() || '' };
        if (!payload.to_be) throw new Error('Gap Analysis requires To-Be (Second Document) text.');
      }

      let agentEndpoint = agentMeta[agent]?.endpoint || `/${agent}`;
      if (agentEndpoint.startsWith('/api/')) {
        agentEndpoint = agentEndpoint.replace(/^\/api/, '');
      }

      const res = await fetch(`${API_BASE}${agentEndpoint}`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) {
        let errMsg = '';
        try {
          const errData = await res.json();
          errMsg = errData.detail || errData.message || (typeof errData === 'string' ? errData : JSON.stringify(errData));
        } catch {
          try {
            errMsg = await res.text();
          } catch {}
        }
        const statusInfo = res.statusText ? `${res.status} ${res.statusText}` : `${res.status}`;
        throw new Error(errMsg ? `API Error (${statusInfo}): ${errMsg}` : `API Error (${statusInfo})`);
      }
      const result = await res.json();

      if (intentData) result._intentData = intentData;

      setStep('step-process', 'done');
      setStep('step-render', 'active');
      
      hideProcessing();
      showSkeleton();
      await new Promise(r => setTimeout(r, 400));
      hideSkeleton();
      
      state.sessionsByAgent[agent] = { result, agent, timestamp: new Date().toISOString() };
      if (state.currentAgent === 'auto') state.sessionsByAgent['auto'] = state.sessionsByAgent[agent];

      renderOutput(result, agent);
      saveToHistory(result, agent, autoDetected);
      updateStats(agent);

      if (result._saveInfo && result._saveInfo.saved) $('save-indicator').classList.remove('hidden');
      else $('save-indicator').classList.add('hidden');

    } catch (err) {
      hideProcessing(); hideSkeleton();
      toast(err.message, 'error');
    }
  }

  async function fetchSavedFiles() {
    if (!state.isApiOnline || !state.token) return;
    try {
      const res = await fetch(`${API_BASE}/saved-files`, { headers: getHeaders() });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) return;
      const files = await res.json();
      renderFilesList(files);
    } catch (e) { console.error(e); }
  }

  // ---- RENDERING LOGIC ----
  function renderFilesList(filesObj) {
    const list = $('files-list');
    let html = '';
    let hasFiles = false;

    for (const [agent, files] of Object.entries(filesObj)) {
      if (files.length > 0) {
        hasFiles = true;
        html += `<div class="file-group"><div class="file-group-title">${agentMeta[agent]?.name || agent}</div>`;
        files.forEach(f => {
          html += `
            <div class="file-item" data-agent="${agent}" data-file="${f.name}" data-id="${f.id}">
              <div class="file-item-header">
                <span class="file-item-type">${agent.toUpperCase()}</span>
                <span class="file-item-time">${new Date(f.modified).toLocaleDateString()}</span>
              </div>
              <div class="file-item-name">${esc(f.name)}</div>
            </div>`;
        });
        html += `</div>`;
      }
    }

    if (!hasFiles) {
      list.innerHTML = '<div class="history-empty"><p>No saved files found.</p></div>';
      return;
    }

    list.innerHTML = html;

    list.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', async () => {
        const agent = item.dataset.agent;
        const filename = item.dataset.file;
        const id = item.dataset.id;
        try {
          const res = await fetch(`${API_BASE}/saved-files/${id}`, { headers: getHeaders() });
          if (res.status === 401) return handleUnauthorized();
          if (!res.ok) throw new Error('File not found');
          const data = await res.json();
          selectAgent(agent);
          if (data.json_result) {
            const parsed = typeof data.json_result === 'string' ? JSON.parse(data.json_result) : data.json_result;
            state.sessionsByAgent[agent] = { result: parsed, agent, timestamp: new Date().toISOString() };
            renderOutput(parsed, agent);
            filesPanel.classList.add('hidden');
          }
        } catch { toast('Error loading file', 'error'); }
      });
    });
  }

  function renderOutput(result, agent) {
    inputZone.classList.add('hidden');
    outputZone.classList.remove('hidden');
    $('output-agent-name').textContent = agentMeta[agent]?.name || agent;
    $('output-timestamp').textContent = new Date().toLocaleString();

    let html = '';

    if (result._intentData) {
      const intent = result._intentData;
      html += `
        <div class="section-card" style="background:var(--accent-soft); border-color:rgba(129,140,248,0.3); margin-bottom: 20px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong>Smart Intent Detection:</strong> Routed to <strong>${agentMeta[intent.agent]?.name || intent.agent}</strong> 
              <span class="tag tag-blue">${Math.round((intent.confidence || 0.9) * 100)}% Confidence</span>
            </div>
            <button class="btn-sm" onclick="window.location.hash='${intent.agent}'">View in ${agentMeta[intent.agent]?.chip}</button>
          </div>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">Reasoning: ${esc(intent.reasoning)}</p>
        </div>`;
    }

    switch (result.type || agent) {
      case 'requirements': html += renderRequirements(result); break;
      case 'meeting-prep': html += renderMeetingPrep(result); break;
      case 'jira': html += renderJira(result); break;
      case 'gap-analysis': html += renderGapAnalysis(result); break;
      case 'action-items': html += renderActionItems(result); break;
      case 'meeting-minutes': case 'minutes': html += renderMinutes(result); break;
      case 'process-model': html += renderProcessModel(result); break;
      case 'business-case': html += renderBusinessCase(result); break;
      case 'risk-log': html += renderRiskLog(result); break;
      case 'glossary': html += renderGlossary(result); break;
      case 'test-cases': html += renderTestCases(result); break;
      default: html += `<pre style="white-space:pre-wrap; font-family:var(--font-mono);">${esc(JSON.stringify(result, null, 2))}</pre>`;
    }
    outputContent.innerHTML = html;

    outputContent.querySelectorAll('.action-checkbox').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const row = e.target.closest('tr');
        if (row) row.style.opacity = e.target.checked ? '0.5' : '1';
      });
    });

    state.lastResult = result;
    state.lastAgent = agent;
  }

  // --- RENDER HELPERS ---
  function renderRequirements(r) {
    let h = '<h2>📋 User Stories</h2>';
    (r.userStories || []).forEach(s => { 
      h += `
        <div class="section-card">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>${s.id}</strong> 
            <div>
              ${s.priority ? `<span class="tag ${s.priority==='High'?'tag-red':'tag-yellow'}">${s.priority} Priority</span>` : ''}
              ${s.storyPoints ? `<span class="tag tag-cyan">${s.storyPoints} pts</span>` : ''}
            </div>
          </div>
          <p style="margin-top: 6px;">As a <span class="tag tag-blue">${s.role}</span>, I want <strong>${esc(s.want)}</strong>, so that <em>${esc(s.benefit)}</em></p>
        </div>`; 
    });
    
    h += '<h2>✅ Acceptance Criteria (Gherkin)</h2>';
    (r.acceptanceCriteria || []).forEach(ac => { 
      h += `
        <div class="gwt-block">
          <strong>Story: ${ac.storyId || 'US-001'}</strong><br>
          <strong>Given</strong> ${esc(ac.given)}<br>
          <strong>When</strong> ${esc(ac.when)}<br>
          <strong>Then</strong> ${esc(ac.then)}
        </div>`; 
    });

    if (r.nonFunctionalRequirements && r.nonFunctionalRequirements.length > 0) {
      h += '<h2>🛡️ Non-Functional Requirements (NFRs)</h2><table><thead><tr><th>Category</th><th>Requirement</th></tr></thead><tbody>';
      r.nonFunctionalRequirements.forEach(nfr => {
        h += `<tr><td><span class="tag tag-cyan">${esc(nfr.category)}</span></td><td>${esc(nfr.requirement)}</td></tr>`;
      });
      h += '</tbody></table>';
    }

    if (r.definitionOfReady && r.definitionOfReady.length > 0) {
      h += '<h2>🏁 Definition of Ready (DoR) Checklist</h2><ul>';
      r.definitionOfReady.forEach(dor => {
        h += `<li>${dor.status ? '✅' : '⏳'} <strong>${esc(dor.item)}</strong></li>`;
      });
      h += '</ul>';
    }

    h += '<h2>⚠️ Ambiguities</h2><ul>'; (r.ambiguities || []).forEach(a => { h += `<li>${esc(a)}</li>`; }); h += '</ul>';
    h += '<h2>💡 Assumptions</h2><ul>'; (r.assumptions || []).forEach(a => { h += `<li>${esc(a)}</li>`; }); h += '</ul>';
    h += '<h2>🔄 Edge Cases</h2><ul>'; (r.edgeCases || []).forEach(e => { h += `<li>${esc(e)}</li>`; }); h += '</ul>';
    return h;
  }

  function renderMeetingPrep(r) {
    let h = `<h2>📅 Meeting Prep: ${esc(r.meetingTopic || 'Stakeholder Alignment')}</h2>`;
    h += `<p><strong>Duration:</strong> ${esc(r.duration || '45 min')} &nbsp;|&nbsp; <strong>Attendees:</strong> ${(r.attendeeList || []).map(a => `<span class="tag tag-blue">${esc(a)}</span>`).join(' ')}</p>`;
    h += '<h2>🕐 Timeboxed Agenda</h2><table><thead><tr><th>Time</th><th>Item</th><th>Description</th></tr></thead><tbody>';
    (r.agenda || []).forEach(a => { h += `<tr><td><strong>${a.time}</strong></td><td>${esc(a.item)}</td><td>${esc(a.desc)}</td></tr>`; });
    h += '</tbody></table><h2>❓ Questions by Role</h2>';
    if(r.questions) {
      ['functional', 'technical', 'business'].forEach(cat => {
        if (r.questions[cat] && r.questions[cat].length > 0) {
          h += `<h3>${cat.toUpperCase()} QUESTIONS</h3><ul>`;
          (r.questions[cat] || []).forEach(q => { h += `<li>${esc(q)}</li>`; }); h += '</ul>';
        }
      });
    }
    h += '<h2>⚡ Risks</h2><table><thead><tr><th>Type</th><th>Description</th></tr></thead><tbody>';
    (r.risks || []).forEach(ri => { h += `<tr><td><span class="tag tag-red">${esc(ri.type)}</span></td><td>${esc(ri.desc)}</td></tr>`; });
    h += '</tbody></table><h2>📝 Prep Checklist</h2><ul>';
    (r.checklist || []).forEach(c => { h += `<li>☐ ${esc(c)}</li>`; }); h += '</ul>';
    return h;
  }

  function renderJira(r) {
    let h = '<h2>🎫 JIRA Ticket Draft</h2>';
    h += `<div class="field-label">Summary / Title</div><div class="field-value" style="font-size:1.05rem;font-weight:700;color:var(--text-primary)">${esc(r.title)}</div>`;
    h += `<div class="field-label">Description</div><div class="field-value">${esc(r.description)}</div>`;
    h += `<div class="field-label">User Story</div><div class="section-card">${esc(r.userStory)}</div>`;
    h += '<div class="field-label">Acceptance Criteria</div>';
    (r.acceptanceCriteria || []).forEach(ac => { h += `<div class="gwt-block"><strong>AC-${ac.id}</strong><br><strong>Given</strong> ${esc(ac.given)}<br><strong>When</strong> ${esc(ac.when)}<br><strong>Then</strong> ${esc(ac.then)}</div>`; });
    h += `<div class="field-label">Story Points</div><div class="field-value"><span class="tag tag-cyan">${r.storyPoints?.points || 3} pts</span> — ${esc(r.storyPoints?.reasoning || '')}</div>`;
    h += `<div class="field-label">Labels</div><div class="field-value">${(r.labels || []).map(l => `<span class="tag tag-blue">${esc(l)}</span>`).join(' ')}</div>`;
    h += '<div class="field-label">Dependencies</div><ul>'; (r.dependencies || []).forEach(d => { h += `<li>${esc(d)}</li>`; }); h += '</ul>';
    h += '<div class="field-label">Definition of Done</div><ul>'; (r.definitionOfDone || []).forEach(d => { h += `<li>☐ ${esc(d)}</li>`; }); h += '</ul>';
    return h;
  }

  function renderGapAnalysis(r) {
    let h = `<h2>🔍 Gap Analysis Report</h2><p>As-Is Count: <span class="tag tag-yellow">${r.asIsCount || 1}</span> &nbsp; To-Be Count: <span class="tag tag-green">${r.toBeCount || 1}</span></p>`;
    h += '<h2>🚨 Identified Gaps</h2><table><thead><tr><th>Type</th><th>Item</th><th>Severity</th><th>Description</th></tr></thead><tbody>';
    (r.gaps || []).forEach(g => {
      const sev = g.severity === 'High' ? 'tag-red' : g.severity === 'Medium' ? 'tag-yellow' : 'tag-green';
      h += `<tr><td>${esc(g.type)}</td><td>${esc(g.item)}</td><td><span class="tag ${sev}">${g.severity}</span></td><td>${esc(g.desc)}</td></tr>`;
    });
    h += '</tbody></table><h2>⚔️ Conflicts</h2><table><thead><tr><th>As-Is</th><th>To-Be</th><th>Analysis</th></tr></thead><tbody>';
    (r.conflicts || []).forEach(c => { h += `<tr><td>${esc(c.asIs)}</td><td>${esc(c.toBe)}</td><td>${esc(c.desc)}</td></tr>`; });
    h += '</tbody></table><h2>💡 Recommendations</h2><table><thead><tr><th>Action</th><th>Priority</th><th>Effort</th></tr></thead><tbody>';
    (r.recommendations || []).forEach(rec => {
      const p = rec.priority === 'High' ? 'tag-red' : 'tag-yellow';
      h += `<tr><td>${esc(rec.action)}</td><td><span class="tag ${p}">${rec.priority}</span></td><td>${esc(rec.effort)}</td></tr>`;
    });
    h += '</tbody></table>';

    if (r.roadmapPhasing && r.roadmapPhasing.length > 0) {
      h += '<h2>🚀 Implementation Roadmap / Phasing</h2><table><thead><tr><th>Phase</th><th>Recommended Action</th><th>Effort</th><th>Impact</th></tr></thead><tbody>';
      r.roadmapPhasing.forEach(ph => {
        h += `<tr><td><span class="tag tag-cyan">${esc(ph.phase)}</span></td><td>${esc(ph.action)}</td><td>${esc(ph.effort)}</td><td><span class="tag tag-green">${esc(ph.impact)}</span></td></tr>`;
      });
      h += '</tbody></table>';
    }
    return h;
  }

  function renderActionItems(r) {
    let h = `<h2>📝 Meeting Summary</h2><div class="section-card">${esc(r.summary)}</div>`;
    h += '<h2>✅ Decisions Made</h2><ul>'; (r.decisions || []).forEach(d => { h += `<li>${esc(d)}</li>`; }); h += '</ul>';
    h += '<h2>🎯 Action Items</h2><table><thead><tr><th>Status</th><th>#</th><th>Task</th><th>Owner</th><th>Deadline</th></tr></thead><tbody>';
    (r.actionItems || []).forEach((a, i) => { 
      h += `<tr><td><input type="checkbox" class="action-checkbox" style="cursor:pointer"></td><td>${i + 1}</td><td>${esc(a.task)}</td><td><span class="tag tag-blue">${esc(a.owner)}</span></td><td><span class="tag tag-yellow">${esc(a.deadline)}</span></td></tr>`; 
    });
    h += '</tbody></table>';
    return h;
  }

  function renderMinutes(r) {
    let h = `<h2>🎙️ ${esc(r.title || 'Executive Meeting Minutes')}</h2>`;
    h += `<p><strong>Date:</strong> ${esc(r.date || 'Today')} &nbsp;|&nbsp; <strong>Attendees:</strong> ${(r.attendees || []).map(a => `<span class="tag tag-blue">${esc(a)}</span>`).join(' ')}</p>`;
    h += `<h2>📌 Executive Summary</h2><div class="section-card">${esc(r.executiveSummary)}</div>`;
    h += '<h2>💬 Discussion Points & Consensus</h2><table><thead><tr><th>Topic</th><th>Summary</th><th>Consensus</th></tr></thead><tbody>';
    (r.discussionPoints || []).forEach(dp => {
      h += `<tr><td><strong>${esc(dp.topic)}</strong></td><td>${esc(dp.summary)}</td><td><span class="tag tag-green">${esc(dp.consensus)}</span></td></tr>`;
    });
    h += '</tbody></table><h2>✅ Decision Log</h2><table><thead><tr><th>ID</th><th>Decision</th><th>Rationale</th><th>Owner</th></tr></thead><tbody>';
    (r.decisions || []).forEach(d => {
      h += `<tr><td><span class="tag tag-cyan">${esc(d.id)}</span></td><td>${esc(d.decision)}</td><td>${esc(d.rationale)}</td><td><span class="tag tag-blue">${esc(d.owner)}</span></td></tr>`;
    });
    h += '</tbody></table><h2>🎯 Action Items</h2><table><thead><tr><th>Status</th><th>ID</th><th>Task</th><th>Owner</th><th>Due Date</th><th>Priority</th></tr></thead><tbody>';
    (r.actionItems || []).forEach(a => {
      h += `<tr><td><input type="checkbox" class="action-checkbox" style="cursor:pointer"></td><td>${esc(a.id)}</td><td>${esc(a.task)}</td><td><span class="tag tag-blue">${esc(a.owner)}</span></td><td>${esc(a.dueDate)}</td><td><span class="tag ${a.priority==='High'?'tag-red':'tag-yellow'}">${esc(a.priority)}</span></td></tr>`;
    });
    h += '</tbody></table>';
    return h;
  }

  function renderProcessModel(r) {
    let h = `<h2>🔄 Process Model: ${esc(r.processName || 'Workflow Model')}</h2>`;
    h += `<p>${esc(r.overview)}</p>`;
    h += '<h2>🏊 Swimlanes</h2>';
    (r.swimlanes || []).forEach(s => {
      h += `<div class="section-card"><strong>Role: <span class="tag tag-blue">${esc(s.role)}</span></strong><ul>`;
      (s.steps || []).forEach(st => { h += `<li>${esc(st)}</li>`; });
      h += '</ul></div>';
    });
    h += '<h2>⚡ Decision Points</h2><table><thead><tr><th>ID</th><th>Question</th><th>Decision Maker</th></tr></thead><tbody>';
    (r.decisionPoints || []).forEach(d => {
      h += `<tr><td><span class="tag tag-cyan">${esc(d.id)}</span></td><td>${esc(d.question)}</td><td>${esc(d.actor)}</td></tr>`;
    });
    h += '</tbody></table><h2>⚠️ Bottlenecks & Friction Points</h2><table><thead><tr><th>Stage</th><th>Cause</th><th>Optimization Suggestion</th></tr></thead><tbody>';
    (r.bottlenecks || []).forEach(b => {
      h += `<tr><td><span class="tag tag-red">${esc(b.stage)}</span></td><td>${esc(b.cause)}</td><td>${esc(b.recommendation)}</td></tr>`;
    });
    h += '</tbody></table>';
    if (r.mermaidDiagram) {
      h += `<h2>📊 Visual Mermaid Flowchart Code</h2><pre style="background:rgba(0,0,0,0.4); padding:12px; border-radius:6px; font-family:var(--font-mono); color:var(--text-accent);">${esc(r.mermaidDiagram)}</pre>`;
    }
    return h;
  }

  function renderBusinessCase(r) {
    let h = `<h2>💰 Business Case: ${esc(r.projectTitle || 'Project Initiative')}</h2>`;
    h += `<h2>🎯 Problem Statement</h2><div class="section-card">${esc(r.problemStatement)}</div>`;
    h += `<h2>💡 Proposed Solution</h2><div class="section-card">${esc(r.proposedSolution)}</div>`;
    if (r.financialSummary) {
      h += `
        <h2>📊 Financial Executive Summary</h2>
        <div class="stats-grid" style="margin-bottom: 20px;">
          <div class="stat-item"><span class="stat-value" style="font-size:1.2rem;color:var(--text-danger);">${esc(r.financialSummary.estimatedCost)}</span><span class="stat-label">Estimated Cost</span></div>
          <div class="stat-item"><span class="stat-value" style="font-size:1.2rem;color:var(--text-success);">${esc(r.financialSummary.annualSavings)}</span><span class="stat-label">Annual Savings</span></div>
          <div class="stat-item"><span class="stat-value" style="font-size:1.2rem;color:var(--text-cyan);">${esc(r.financialSummary.paybackPeriod)}</span><span class="stat-label">Payback Period</span></div>
          <div class="stat-item"><span class="stat-value" style="font-size:1.2rem;color:var(--text-accent);">${esc(r.financialSummary.estimatedRoi)}</span><span class="stat-label">ROI (Year 1)</span></div>
        </div>`;
    }
    h += '<h2>💵 Cost Breakdown</h2><table><thead><tr><th>Category</th><th>Amount</th><th>Notes</th></tr></thead><tbody>';
    (r.costBreakdown || []).forEach(c => {
      h += `<tr><td>${esc(c.category)}</td><td><strong style="color:var(--text-danger);">${esc(c.amount)}</strong></td><td>${esc(c.notes)}</td></tr>`;
    });
    h += '</tbody></table><h2>📈 Benefit Breakdown</h2><table><thead><tr><th>Benefit</th><th>Value</th><th>Type</th></tr></thead><tbody>';
    (r.benefitBreakdown || []).forEach(b => {
      h += `<tr><td>${esc(b.benefit)}</td><td><strong style="color:var(--text-success);">${esc(b.value)}</strong></td><td><span class="tag tag-green">${esc(b.type)}</span></td></tr>`;
    });
    h += '</tbody></table><h2>💡 Final Recommendation</h2><div class="section-card" style="border-color:var(--accent-color); background:rgba(99,102,241,0.1);"><strong>${esc(r.recommendation)}</strong></div>';
    return h;
  }

  function renderRiskLog(r) {
    let h = `<h2>⚠️ RAID Risk & Assumption Log</h2>`;
    h += '<h2>🚨 Risk Register</h2><table><thead><tr><th>ID</th><th>Category</th><th>Description</th><th>Likelihood</th><th>Impact</th><th>Score</th><th>Mitigation Strategy</th></tr></thead><tbody>';
    (r.risks || []).forEach(rk => {
      const scoreTag = rk.score >= 7 ? 'tag-red' : rk.score >= 4 ? 'tag-yellow' : 'tag-green';
      h += `<tr><td><span class="tag tag-cyan">${esc(rk.id)}</span></td><td>${esc(rk.category)}</td><td>${esc(rk.description)}</td><td>${esc(rk.likelihood)}</td><td>${esc(rk.impact)}</td><td><span class="tag ${scoreTag}">${rk.score || 5}/9</span></td><td>${esc(rk.mitigationStrategy)}</td></tr>`;
    });
    h += '</tbody></table><h2>💡 Key Assumptions</h2><table><thead><tr><th>ID</th><th>Statement</th><th>Validation Method</th><th>Status</th></tr></thead><tbody>';
    (r.assumptions || []).forEach(a => {
      h += `<tr><td><span class="tag tag-cyan">${esc(a.id)}</span></td><td>${esc(a.statement)}</td><td>${esc(a.validationMethod)}</td><td><span class="tag tag-green">${esc(a.status)}</span></td></tr>`;
    });
    h += '</tbody></table>';
    return h;
  }

  function renderGlossary(r) {
    let h = `<h2>📖 Data Dictionary & Glossary: ${esc(r.domainName || 'Domain Glossary')}</h2>`;
    h += '<h2>📚 Business Terms & Acronyms</h2><table><thead><tr><th>Term</th><th>Category</th><th>Business Definition</th><th>Synonyms</th></tr></thead><tbody>';
    (r.glossary || []).forEach(g => {
      h += `<tr><td><strong style="color:var(--accent-color);">${esc(g.term)}</strong></td><td><span class="tag tag-blue">${esc(g.category)}</span></td><td>${esc(g.definition)}</td><td>${(g.synonyms||[]).join(', ')}</td></tr>`;
    });
    h += '</tbody></table><h2>🗄️ Data Entities & Attributes</h2>';
    (r.dataEntities || []).forEach(de => {
      h += `<div class="section-card"><strong>Entity: <span class="tag tag-cyan">${esc(de.entityName)}</span></strong><p style="font-size:0.82rem;color:var(--text-muted);">${esc(de.description)}</p><table><thead><tr><th>Attribute</th><th>Type</th><th>Required</th><th>Description</th></tr></thead><tbody>`;
      (de.attributes || []).forEach(attr => {
        h += `<tr><td><code>${esc(attr.name)}</code></td><td><span class="tag tag-purple">${esc(attr.type)}</span></td><td>${attr.required ? 'Yes' : 'No'}</td><td>${esc(attr.description)}</td></tr>`;
      });
      h += '</tbody></table></div>';
    });
    return h;
  }

  function renderTestCases(r) {
    let h = `<h2>🧪 QA Test Cases: ${esc(r.featureTitle || 'Feature Test Suite')}</h2>`;
    h += `<p>${esc(r.summary)}</p>`;
    (r.testCases || []).forEach(tc => {
      const typeTag = tc.type === 'Happy Path' ? 'tag-green' : tc.type === 'Negative' ? 'tag-red' : 'tag-yellow';
      h += `
        <div class="section-card">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>${esc(tc.id)}: ${esc(tc.title)}</strong>
            <div>
              <span class="tag ${typeTag}">${esc(tc.type)}</span>
              <span class="tag tag-blue">Req: ${esc(tc.requirementId)}</span>
            </div>
          </div>
          <p style="margin-top:6px; font-size:0.82rem;"><strong>Preconditions:</strong> ${esc(tc.preconditions)}</p>
          <div style="margin-top:6px;"><strong>Execution Steps:</strong><ul>`;
      (tc.steps || []).forEach(st => { h += `<li>${esc(st)}</li>`; });
      h += `</ul></div>
          <p style="margin-top:6px; background:rgba(0,0,0,0.3); padding:8px; border-radius:4px;"><strong>Expected Result:</strong> ${esc(tc.expectedResult)}</p>
        </div>`;
    });
    return h;
  }

  // ---- HISTORY & STATS ----
  function saveToHistory(result, agent, autoDetected) {
    const entry = {
      id: Date.now(),
      agent,
      agentName: agentMeta[agent]?.name || agent,
      timestamp: new Date().toISOString(),
      preview: (result.rawInput || '').substring(0, 80) + '...',
      result,
      autoDetected
    };
    state.history.unshift(entry);
    if (state.history.length > 50) state.history = state.history.slice(0, 50);
    localStorage.setItem('ba_history', JSON.stringify(state.history));
    renderHistory();
  }

  function renderHistory(filter = '') {
    $('session-count').textContent = state.history.length + ' items';
    let filtered = state.history;
    if (filter) {
      const q = filter.toLowerCase();
      filtered = state.history.filter(h => h.agentName.toLowerCase().includes(q) || h.preview.toLowerCase().includes(q));
    }

    if (filtered.length === 0) {
      historyList.innerHTML = '<div class="history-empty"><p>No history items found.</p></div>';
      return;
    }

    historyList.innerHTML = filtered.map(h => `
      <div class="history-item" data-id="${h.id}">
        <div class="history-item-header">
          <span class="history-item-agent">${esc(h.agentName)} ${h.autoDetected ? '✨' : ''}</span>
          <span class="history-item-time">${new Date(h.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="history-item-preview">${esc(h.preview)}</div>
      </div>
    `).join('');

    historyList.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        const entry = state.history.find(h => h.id === parseInt(item.dataset.id));
        if (entry) {
          selectAgent(entry.agent);
          state.sessionsByAgent[entry.agent] = { result: entry.result, agent: entry.agent, timestamp: entry.timestamp };
          renderOutput(entry.result, entry.agent);
          historyPanel.classList.add('hidden');
        }
      });
    });
  }

  function clearHistory() {
    state.history = [];
    localStorage.removeItem('ba_history');
    state.stats = { req: 0, tickets: 0, meetings: 0, actions: 0, gaps: 0 };
    localStorage.removeItem('ba_stats');
    renderHistory();
    updateStats();
    toast('History cleared', 'info');
  }

  function updateStats(agent) {
    if (!state.stats) state.stats = { req: 0, tickets: 0, meetings: 0, actions: 0, gaps: 0 };
    if (agent === 'requirements') state.stats.req = (state.stats.req || 0) + 1;
    else if (agent === 'jira') state.stats.tickets = (state.stats.tickets || 0) + 1;
    else if (agent === 'meeting-prep') state.stats.meetings = (state.stats.meetings || 0) + 1;
    else if (agent === 'action-items') state.stats.actions = (state.stats.actions || 0) + 1;
    else if (agent === 'gap-analysis') state.stats.gaps = (state.stats.gaps || 0) + 1;
    localStorage.setItem('ba_stats', JSON.stringify(state.stats));
    if ($('stat-req')) $('stat-req').textContent = state.stats.req || 0;
    if ($('stat-tickets')) $('stat-tickets').textContent = state.stats.tickets || 0;
    if ($('stat-meetings')) $('stat-meetings').textContent = state.stats.meetings || 0;
    if ($('stat-actions')) $('stat-actions').textContent = state.stats.actions || 0;
  }

  // ---- EXPORT ----
  function exportOutput(format) {
    if (!state.lastResult) { toast('No output available to export', 'error'); return; }
    const r = state.lastResult;
    const agent = state.lastAgent;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

    if (format === 'jira-csv') { exportJiraCsv(r); return; }

    let content, filename, mime;
    if (format === 'json') {
      content = JSON.stringify(r, null, 2);
      filename = `BA_${agent}_${ts}.json`;
      mime = 'application/json';
    } else if (format === 'md') {
      content = outputContent.innerText;
      filename = `BA_${agent}_${ts}.md`;
      mime = 'text/markdown';
    } else {
      content = outputContent.innerText;
      filename = `BA_${agent}_${ts}.txt`;
      mime = 'text/plain';
    }

    downloadFile(content, filename, mime);
    toast(`Exported as ${format.toUpperCase()}`, 'success');
  }

  function exportJiraCsv(r) {
    const headers = ['Issue Type', 'Summary', 'Description', 'User Story', 'Acceptance Criteria', 'Story Points', 'Labels', 'Dependencies', 'Definition of Done'];
    const acStr = (r.acceptanceCriteria || []).map(a => `Given ${a.given || ''} When ${a.when || ''} Then ${a.then || ''}`).join(' | ');
    const labelsStr = (r.labels || []).join(', ');
    const depStr = (r.dependencies || []).join(', ');
    const dodStr = (r.definitionOfDone || []).join(', ');

    const row = [
      'Story',
      `"${(r.title || 'BA Generated Requirement').replace(/"/g, '""')}"`,
      `"${(r.description || r.summary || '').replace(/"/g, '""')}"`,
      `"${(r.userStory || '').replace(/"/g, '""')}"`,
      `"${acStr.replace(/"/g, '""')}"`,
      r.storyPoints?.points || 3,
      `"${labelsStr.replace(/"/g, '""')}"`,
      `"${depStr.replace(/"/g, '""')}"`,
      `"${dodStr.replace(/"/g, '""')}"`
    ];

    const csvContent = headers.join(',') + '\n' + row.join(',');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    downloadFile(csvContent, `JIRA_Import_${ts}.csv`, 'text/csv');
    toast('JIRA Import CSV downloaded', 'success');
  }

  function exportAll() {
    if (state.history.length === 0) { toast('No sessions to export', 'error'); return; }
    const content = JSON.stringify(state.history, null, 2);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    downloadFile(content, `BA_CommandCenter_AllSessions_${ts}.json`, 'application/json');
    toast('Exported all sessions to JSON bundle', 'success');
  }

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---- UI HELPERS ----
  function showProcessing() {
    inputZone.classList.add('hidden');
    outputZone.classList.add('hidden');
    processingOverlay.classList.remove('hidden');
    ['step-detect', 'step-route', 'step-process', 'step-render'].forEach(s => { $(s).className = 'step'; });
    setStep('step-detect', 'active');
  }

  function hideProcessing() { processingOverlay.classList.add('hidden'); }
  function showSkeleton() { skeletonZone.classList.remove('hidden'); }
  function hideSkeleton() { skeletonZone.classList.add('hidden'); }
  function setStep(id, status) {
    const el = $(id);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (status) el.classList.add(status);
  }

  function toast(msg, type = 'info') {
    const container = $('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
  }

  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- BOOT ----
  init();
})();
