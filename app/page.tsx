'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ================================================================
// CONSTANTS
// ================================================================
const FIRST_NAMES = ['Emma','Liam','Olivia','Noah','Ava','Ethan','Sophia','Mason','Isabella','James',
  'Mia','Alexander','Charlotte','Benjamin','Amelia','Daniel','Harper','Matthew','Evelyn','Lucas',
  'Abigail','Jackson','Emily','Sebastian','Elizabeth','Jack','Sofia','Owen','Victoria','Henry'];
const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez',
  'Martinez','Hernandez','Lopez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee'];
const COUNTRIES = ['US','US','US','US','UK','UK','CA','CA','DE','AU'];
const CUSTOMER_TYPES = ['new','returning','returning','returning','premium','premium'];
const COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9'];

// ================================================================
// TYPES
// ================================================================
interface SimUser {
  key: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  customerType: string;
  color: string;
}

interface LogEntry {
  id: number;
  time: string;
  source: 'tealium' | 'ld' | 'system';
  msg: string;
  detail: string;
}

interface SegmentData {
  tealium: Set<string>;
}

// ================================================================
// COMPONENT
// ================================================================
export default function Home() {
  // State
  const [simRunning, setSimRunning] = useState(false);
  const [stats, setStats] = useState({ tealiumEvents: 0, ldEvents: 0, segmentSyncs: 0 });
  const [users, setUsers] = useState<SimUser[]>([]);
  const [segments, setSegments] = useState<SegmentData>({ tealium: new Set() });
  const [eventLog, setEventLog] = useState<LogEntry[]>([]);
  const [simMode, setSimMode] = useState('realistic');
  const [userCount, setUserCount] = useState(25);
  const [eventFreq, setEventFreq] = useState(1500);
  const [simDurationSetting, setSimDurationSetting] = useState(300);
  const [progress, setProgress] = useState(0);
  const [simStatusText, setSimStatusText] = useState('Idle');
  const [simStatusColor, setSimStatusColor] = useState('var(--text-dim)');
  const [tealiumStatus, setTealiumStatus] = useState('pending');
  const [ldStatus, setLdStatus] = useState('pending');
  const [flagPricing, setFlagPricing] = useState<string>('control');
  const [flagSegmentOffer, setFlagSegmentOffer] = useState<string>('no-offer');
  const [activeArrows, setActiveArrows] = useState<Record<string, boolean>>({ 'arrow-1': false, 'arrow-2': false, 'arrow-3': false });

  // Refs for mutable state used in timers
  const simRunningRef = useRef(false);
  const simTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simStartRef = useRef(0);
  const simDurationRef = useRef(0);
  const usersRef = useRef<SimUser[]>([]);
  const statsRef = useRef({ tealiumEvents: 0, ldEvents: 0, segmentSyncs: 0 });
  const segmentsRef = useRef<SegmentData>({ tealium: new Set() });
  const logIdRef = useRef(0);
  const eventLogRef = useRef<HTMLDivElement>(null);
  const simModeRef = useRef('realistic');
  const eventFreqRef = useRef(1500);
  // Track per-user session event counts for ecommerce mode
  const userSessionEventsRef = useRef<Record<string, number>>({});

  // Keep refs in sync
  useEffect(() => { simModeRef.current = simMode; }, [simMode]);
  useEffect(() => { eventFreqRef.current = eventFreq; }, [eventFreq]);

  // ================================================================
  // LOGGING
  // ================================================================
  const logEvent = useCallback((source: 'tealium' | 'ld' | 'system', msg: string, detail = '') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
    const id = ++logIdRef.current;
    setEventLog(prev => {
      const next = [...prev, { id, time, source, msg, detail }];
      if (next.length > 200) return next.slice(next.length - 200);
      return next;
    });
  }, []);

  // Auto-scroll event log
  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [eventLog]);

  // ================================================================
  // ARROW FLASH
  // ================================================================
  const flashArrow = useCallback((id: string) => {
    setActiveArrows(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setActiveArrows(prev => ({ ...prev, [id]: false }));
    }, 600);
  }, []);

  // ================================================================
  // STATS SYNC
  // ================================================================
  const syncStats = useCallback(() => {
    setStats({ ...statsRef.current });
    setSegments({
      tealium: new Set(segmentsRef.current.tealium),
    });
  }, []);

  // ================================================================
  // API HEALTH CHECK ON MOUNT
  // ================================================================
  useEffect(() => {
    // Check Tealium Collect API reachability
    setTealiumStatus('pending');
    fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        users: [{ key: 'health-check', firstName: 'Health', lastName: 'Check', email: 'health@check.com', customerType: 'new', country: 'US' }],
        eventType: 'page_view',
      }),
    })
      .then(r => {
        if (r.ok) {
          setTealiumStatus('connected');
          logEvent('system', 'Tealium Collect API reachable (server-side)');
        } else {
          setTealiumStatus('disconnected');
          logEvent('system', 'Tealium Collect API returned error');
        }
      })
      .catch(() => {
        setTealiumStatus('disconnected');
        logEvent('system', 'Tealium Collect API unreachable');
      });

    // Check LD server SDK via evaluate endpoint
    setLdStatus('pending');
    fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        users: [{ key: 'health-check', firstName: 'Health', lastName: 'Check', email: 'health@check.com', customerType: 'new', country: 'US' }],
      }),
    })
      .then(r => {
        if (r.ok) {
          setLdStatus('connected');
          logEvent('system', 'LaunchDarkly Server SDK connected');
        } else {
          setLdStatus('disconnected');
          logEvent('system', 'LaunchDarkly Server SDK error');
        }
      })
      .catch(() => {
        setLdStatus('disconnected');
        logEvent('system', 'LaunchDarkly Server SDK unreachable');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (simTimerRef.current) clearTimeout(simTimerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  // ================================================================
  // SERVER-SIDE EVENT FIRING
  // ================================================================
  const fireTealiumEvent = useCallback(async (eventType: string, targetUsers: SimUser[]) => {
    try {
      const resp = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: targetUsers, eventType }),
      });
      const data = await resp.json();

      if (data.results) {
        for (const result of data.results) {
          statsRef.current.tealiumEvents++;
          const statusNote = result.status === 'sent' ? '' : ' [ERROR]';
          logEvent('tealium', `Collect API${statusNote} -- ${result.detail}`, `user: ${result.user}`);

          // For product_view, add_to_cart, purchase: also log EventStream flow
          if (eventType === 'product_view' || eventType === 'add_to_cart') {
            const eventName = eventType === 'product_view' ? 'product-viewed' : 'add-to-cart';
            logEvent('tealium', `-> EventStream -> LD Metric Import: ${eventName}`, result.user);
            flashArrow('arrow-2');
          } else if (eventType === 'purchase') {
            logEvent('tealium', `-> EventStream -> LD Metric Import: purchase-complete`, result.user);
            flashArrow('arrow-2');

            // Auto-add purchasers to segment
            const userKey = targetUsers.find(u => `${u.firstName} ${u.lastName[0]}.` === result.user)?.key;
            if (userKey && !segmentsRef.current.tealium.has(userKey)) {
              segmentsRef.current.tealium.add(userKey);
              statsRef.current.segmentSyncs++;
              logEvent('tealium', `Audience joined: LaunchDarkly Test Audience`, `${result.user} (purchase triggered)`);
              logEvent('ld', `Segment sync: +1 member -> tealium-segment`, userKey);
              flashArrow('arrow-3');
            }
          }

          flashArrow('arrow-1');
        }
        syncStats();
      }
    } catch (err) {
      logEvent('system', `Tealium event failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [logEvent, flashArrow, syncStats]);

  const fireLDFlagEval = useCallback(async (targetUsers: SimUser[]) => {
    try {
      const resp = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: targetUsers }),
      });
      const data = await resp.json();

      if (data.results) {
        for (const res of data.results) {
          logEvent('ld', `variation('pricing-page-layout') -> ${res.pricingLayout}`, `${res.name}`);
          logEvent('ld', `variation('tealium-segment-offer') -> ${res.segmentOffer}`, `${res.name}`);
          setFlagPricing(res.pricingLayout);
          setFlagSegmentOffer(res.segmentOffer);
          statsRef.current.ldEvents++;
        }
        syncStats();
      }
    } catch (err) {
      logEvent('system', `LD flag eval failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [logEvent, syncStats]);

  const fireSegmentSync = useCallback((user: SimUser) => {
    const adding = !segmentsRef.current.tealium.has(user.key) || Math.random() > 0.3;

    if (adding) {
      segmentsRef.current.tealium.add(user.key);
      logEvent('tealium', `Audience join: LaunchDarkly Test Audience`, `${user.firstName} ${user.lastName[0]}.`);
      logEvent('ld', `Segment sync: Add member -> tealium-segment`, user.key);
    } else {
      segmentsRef.current.tealium.delete(user.key);
      logEvent('tealium', `Audience leave: LaunchDarkly Test Audience`, `${user.firstName} ${user.lastName[0]}.`);
      logEvent('ld', `Segment sync: Remove member -> tealium-segment`, user.key);
    }

    statsRef.current.segmentSyncs++;
    syncStats();
    flashArrow('arrow-3');
  }, [logEvent, flashArrow, syncStats]);

  // ================================================================
  // SIMULATION DISPATCH
  // ================================================================
  const simulateEvent = useCallback(() => {
    if (!simRunningRef.current) return;
    const currentUsers = usersRef.current;
    if (currentUsers.length === 0) return;
    const mode = simModeRef.current;
    const user = currentUsers[Math.floor(Math.random() * currentUsers.length)];

    switch (mode) {
      case 'realistic': {
        const rand = Math.random();
        if (rand < 0.25) fireTealiumEvent('page_view', [user]);
        else if (rand < 0.45) fireTealiumEvent('product_view', [user]);
        else if (rand < 0.60) fireTealiumEvent('add_to_cart', [user]);
        else if (rand < 0.75) fireTealiumEvent('purchase', [user]);
        else if (rand < 0.90) fireLDFlagEval([user]);
        else fireSegmentSync(user);
        break;
      }
      case 'ecommerce': {
        const sessionEvents = userSessionEventsRef.current;
        const step = (sessionEvents[user.key] || 0) % 5;
        switch (step) {
          case 0: fireTealiumEvent('page_view', [user]); break;
          case 1: fireTealiumEvent('product_view', [user]); break;
          case 2: fireTealiumEvent('add_to_cart', [user]); break;
          case 3: fireLDFlagEval([user]); break;
          case 4: fireTealiumEvent('purchase', [user]); break;
        }
        sessionEvents[user.key] = (sessionEvents[user.key] || 0) + 1;
        break;
      }
      case 'segment-sync': {
        const rand = Math.random();
        if (rand < 0.4) fireSegmentSync(user);
        else if (rand < 0.7) fireTealiumEvent('page_view', [user]);
        else fireLDFlagEval([user]);
        break;
      }
      case 'burst': {
        const burstUsers = Array.from({ length: 5 }, () =>
          currentUsers[Math.floor(Math.random() * currentUsers.length)]
        );
        for (const u of burstUsers) {
          const rand = Math.random();
          if (rand < 0.25) fireTealiumEvent('page_view', [u]);
          else if (rand < 0.45) fireTealiumEvent('product_view', [u]);
          else if (rand < 0.60) fireTealiumEvent('add_to_cart', [u]);
          else if (rand < 0.75) fireTealiumEvent('purchase', [u]);
          else if (rand < 0.90) fireLDFlagEval([u]);
          else fireSegmentSync(u);
        }
        break;
      }
    }
  }, [fireTealiumEvent, fireLDFlagEval, fireSegmentSync]);

  // ================================================================
  // SCHEDULE NEXT EVENT
  // ================================================================
  const scheduleNextEvent = useCallback(() => {
    if (!simRunningRef.current) return;
    const freq = eventFreqRef.current;
    const jitter = freq * (0.5 + Math.random());
    simTimerRef.current = setTimeout(() => {
      simulateEvent();
      scheduleNextEvent();
    }, jitter);
  }, [simulateEvent]);

  // ================================================================
  // USER GENERATION
  // ================================================================
  const generateUsers = useCallback((count: number) => {
    const newUsers: SimUser[] = [];
    for (let i = 0; i < count; i++) {
      const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      newUsers.push({
        key: `user-${Date.now()}-${i}`,
        firstName: first,
        lastName: last,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
        country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)],
        customerType: CUSTOMER_TYPES[Math.floor(Math.random() * CUSTOMER_TYPES.length)],
        color: COLORS[i % COLORS.length],
      });
    }
    usersRef.current = newUsers;
    userSessionEventsRef.current = {};
    setUsers([...newUsers]);
  }, []);

  // ================================================================
  // SIMULATION CONTROL
  // ================================================================
  const stopSimulation = useCallback(() => {
    simRunningRef.current = false;
    setSimRunning(false);
    if (simTimerRef.current) clearTimeout(simTimerRef.current);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setSimStatusText('Stopped');
    setSimStatusColor('var(--orange)');
    setProgress(100);

    const elapsed = ((Date.now() - simStartRef.current) / 1000).toFixed(0);
    const s = statsRef.current;
    logEvent('system', `Simulation stopped after ${elapsed}s -- ${s.tealiumEvents} Tealium events, ${s.ldEvents} LD events, ${s.segmentSyncs} segment syncs`);
  }, [logEvent]);

  const startSimulation = useCallback(() => {
    // Reset stats
    statsRef.current = { tealiumEvents: 0, ldEvents: 0, segmentSyncs: 0 };
    segmentsRef.current = { tealium: new Set() };
    syncStats();

    generateUsers(userCount);

    simRunningRef.current = true;
    setSimRunning(true);
    simStartRef.current = Date.now();
    simDurationRef.current = simDurationSetting * 1000;

    setSimStatusText('Running');
    setSimStatusColor('var(--green)');
    setProgress(0);

    logEvent('system', `Simulation started -- ${userCount} users, mode: ${simMode}`);

    // Bulk-evaluate flags for all users via server SDK to register them in LD
    const allUsers = usersRef.current;
    logEvent('system', `Evaluating flags for ${allUsers.length} users via server SDK...`);
    fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: allUsers }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.results) {
          logEvent('system', `Registered ${data.results.length} users with LaunchDarkly`);
          statsRef.current.ldEvents += data.results.length;
          syncStats();
        }
      })
      .catch(() => {
        logEvent('system', 'Bulk flag evaluation failed -- falling back to simulation mode');
      });

    scheduleNextEvent();

    if (simDurationSetting > 0) {
      progressTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - simStartRef.current;
        const pct = Math.min(100, (elapsed / simDurationRef.current) * 100);
        setProgress(pct);
        if (elapsed >= simDurationRef.current) stopSimulation();
      }, 200);
    }
  }, [userCount, simDurationSetting, simMode, generateUsers, logEvent, scheduleNextEvent, stopSimulation, syncStats]);

  // ================================================================
  // MANUAL EVENTS
  // ================================================================
  const fireManualEvent = useCallback((type: string) => {
    if (usersRef.current.length === 0) {
      generateUsers(5);
    }
    const currentUsers = usersRef.current;
    const user = currentUsers[Math.floor(Math.random() * currentUsers.length)];

    switch (type) {
      case 'page_view': fireTealiumEvent('page_view', [user]); break;
      case 'product_view': fireTealiumEvent('product_view', [user]); break;
      case 'add_to_cart': fireTealiumEvent('add_to_cart', [user]); break;
      case 'purchase': fireTealiumEvent('purchase', [user]); break;
      case 'flag_eval': fireLDFlagEval([user]); break;
      case 'segment_add': case 'segment_remove': fireSegmentSync(user); break;
    }
  }, [generateUsers, fireTealiumEvent, fireLDFlagEval, fireSegmentSync]);

  // ================================================================
  // HELPERS
  // ================================================================
  const clearLog = () => {
    setEventLog([]);
    logEvent('system', 'Log cleared');
  };

  // ================================================================
  // RENDER
  // ================================================================
  return (
    <>
      <div className="header">
        <h1><span className="teal">Tealium</span> + <span className="ld">LaunchDarkly</span> Integration Demo</h1>
        <div className="status">
          <span><span className={`status-dot ${tealiumStatus}`}></span>Tealium</span>
          <span><span className={`status-dot ${ldStatus}`}></span>LaunchDarkly</span>
          <span style={{ fontWeight: 600, color: simStatusColor }}>{simStatusText}</span>
        </div>
      </div>

      <div className="container">
        {/* Sidebar: Controls */}
        <div className="sidebar">
          <h2>Simulation Controls</h2>

          <div className="config-group">
            <label>Simulation Mode</label>
            <select value={simMode} onChange={e => setSimMode(e.target.value)}>
              <option value="realistic">Realistic Traffic (Mixed Events)</option>
              <option value="ecommerce">E-Commerce Journey</option>
              <option value="segment-sync">Audience/Segment Sync Focus</option>
              <option value="burst">Burst Traffic</option>
            </select>
          </div>

          <div className="config-group">
            <label>Number of Simulated Users</label>
            <div className="slider-group">
              <input
                type="range"
                min="5"
                max="100"
                value={userCount}
                onChange={e => setUserCount(parseInt(e.target.value))}
              />
              <div className="slider-label">
                <span>5</span>
                <span>{userCount} users</span>
                <span>100</span>
              </div>
            </div>
          </div>

          <div className="config-group">
            <label>Event Frequency</label>
            <div className="slider-group">
              <input
                type="range"
                min="500"
                max="5000"
                value={eventFreq}
                step="100"
                onChange={e => setEventFreq(parseInt(e.target.value))}
              />
              <div className="slider-label">
                <span>Fast</span>
                <span>{(eventFreq / 1000).toFixed(1)}s interval</span>
                <span>Slow</span>
              </div>
            </div>
          </div>

          <div className="config-group">
            <label>Duration</label>
            <select value={simDurationSetting} onChange={e => setSimDurationSetting(parseInt(e.target.value))}>
              <option value="60">1 minute</option>
              <option value="300">5 minutes</option>
              <option value="600">10 minutes</option>
              <option value="1800">30 minutes</option>
              <option value="0">Until stopped</option>
            </select>
          </div>

          <div className="progress-bar">
            <div className="fill" style={{ width: `${progress}%` }}></div>
          </div>

          <button
            className="btn btn-green"
            onClick={startSimulation}
            disabled={simRunning}
          >
            &#9654; Start Simulation
          </button>
          <button
            className="btn btn-red"
            onClick={stopSimulation}
            disabled={!simRunning}
          >
            &#9632; Stop Simulation
          </button>

          <hr style={{ borderColor: '#2a2d3a', margin: '20px 0' }} />

          <h2>Manual Events</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '12px' }}>
            Fire individual events for targeted testing
          </p>

          <div className="sim-controls">
            <button className="btn btn-teal" onClick={() => fireManualEvent('page_view')}>Page View</button>
            <button className="btn btn-teal" onClick={() => fireManualEvent('product_view')}>Product View</button>
            <button className="btn btn-teal" onClick={() => fireManualEvent('add_to_cart')}>Add to Cart</button>
            <button className="btn btn-teal" onClick={() => fireManualEvent('purchase')}>Purchase</button>
            <button className="btn btn-ld" onClick={() => fireManualEvent('flag_eval')}>Flag Eval</button>
            <button className="btn btn-outline" onClick={() => fireManualEvent('segment_add')}>+ Segment</button>
            <button className="btn btn-outline" onClick={() => fireManualEvent('segment_remove')}>- Segment</button>
          </div>

          <hr style={{ borderColor: '#2a2d3a', margin: '20px 0' }} />

          <h2>Active Simulated Users</h2>
          <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '12px' }}>
            {users.slice(0, 20).map(u => (
              <div key={u.key} style={{ display: 'flex', alignItems: 'center', padding: '3px 0' }}>
                <span className="user-avatar" style={{ background: u.color }}>{u.firstName[0]}</span>
                <span>{u.firstName} {u.lastName[0]}.</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: '11px' }}>{u.customerType}</span>
              </div>
            ))}
            {users.length > 20 && (
              <div style={{ color: 'var(--text-dim)', padding: '4px 0' }}>+{users.length - 20} more</div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="main">
          {/* Data Flow Visualization */}
          <div className="card">
            <h3>Live Data Flow</h3>
            <div className="flow-viz">
              <div className="flow-node browser">Server<br /><small style={{ color: 'var(--text-dim)' }}>API Routes</small></div>
              <div className={`flow-arrow ${activeArrows['arrow-1'] ? 'active' : ''}`}>&rarr;</div>
              <div className="flow-node tealium-node">Tealium<br /><small>Collect API</small></div>
              <div className={`flow-arrow ${activeArrows['arrow-2'] ? 'active' : ''}`}>&rarr;</div>
              <div className="flow-node ld-node">LaunchDarkly<br /><small>Metrics API</small></div>
            </div>
            <div className="flow-viz" style={{ paddingTop: 0 }}>
              <div className="flow-node tealium-node">Tealium<br /><small>AudienceStream</small></div>
              <div className={`flow-arrow ${activeArrows['arrow-3'] ? 'active' : ''}`}>&#8644;</div>
              <div className="flow-node ld-node">LaunchDarkly<br /><small>Synced Segments</small></div>
            </div>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card teal">
              <div className="value">{stats.tealiumEvents}</div>
              <div className="label">Tealium Events</div>
            </div>
            <div className="stat-card ld">
              <div className="value">{stats.ldEvents}</div>
              <div className="label">LD Events</div>
            </div>
            <div className="stat-card green">
              <div className="value">{stats.segmentSyncs}</div>
              <div className="label">Segment Syncs</div>
            </div>
            <div className="stat-card">
              <div className="value">{users.length}</div>
              <div className="label">Active Users</div>
            </div>
          </div>

          <div className="two-col">
            {/* Flag Evaluations */}
            <div className="card">
              <h3>Feature Flags <span className="badge badge-ld">LaunchDarkly</span></h3>
              <div>
                <div className="flag-row">
                  <span className="flag-name">pricing-page-layout</span>
                  <span className="flag-value string">{flagPricing}</span>
                </div>
                <div className="flag-row">
                  <span className="flag-name">tealium-segment-offer</span>
                  <span className="flag-value string">{flagSegmentOffer}</span>
                </div>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '12px' }}>
                Flag values evaluated server-side via LD Node SDK
              </p>
            </div>

            {/* Segment Membership */}
            <div className="card">
              <h3>Audience/Segment Sync <span className="badge badge-both">Bidirectional</span></h3>
              <table className="segment-table">
                <thead>
                  <tr>
                    <th>Tealium Audience</th>
                    <th>LD Segment</th>
                    <th>Members</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { audience: 'LaunchDarkly Test Audience', segment: 'tealium-segment', set: segments.tealium },
                  ].map(row => (
                    <tr key={row.segment}>
                      <td>{row.audience}</td>
                      <td>{row.segment}</td>
                      <td>{row.set.size}</td>
                      <td><span className={`status-dot ${row.set.size > 0 ? 'connected' : 'pending'}`}></span>{row.set.size > 0 ? 'Active' : 'Idle'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Event Log */}
          <div className="card">
            <h3>
              Event Stream
              <span className="badge badge-teal">Tealium</span>
              <span className="badge badge-ld">LaunchDarkly</span>
              <button
                className="btn btn-outline"
                style={{ width: 'auto', margin: 0, padding: '4px 12px', fontSize: '11px', marginLeft: 'auto' }}
                onClick={clearLog}
              >
                Clear
              </button>
            </h3>
            <div className="event-log" ref={eventLogRef}>
              {eventLog.map(entry => (
                <div key={entry.id} className="event">
                  <span className="time">{entry.time}</span>
                  <span className={`source ${entry.source}`}>
                    {entry.source === 'tealium' ? 'TEALIUM' : entry.source === 'ld' ? 'LD' : 'SYSTEM'}
                  </span>
                  <span className="msg">{entry.msg}</span>
                  <span className="detail">{entry.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
