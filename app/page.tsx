'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Script from 'next/script';

// ================================================================
// CONFIGURATION
// ================================================================
const TEALIUM_ACCOUNT = 'sbx-launchdarkly';
const TEALIUM_PROFILE = 'main';
const TEALIUM_ENV = 'prod';
const LD_CLIENT_SIDE_ID = '63b72c57f3f26c136b237f93';

// ================================================================
// CONSTANTS
// ================================================================
const FIRST_NAMES = ['Emma','Liam','Olivia','Noah','Ava','Ethan','Sophia','Mason','Isabella','James',
  'Mia','Alexander','Charlotte','Benjamin','Amelia','Daniel','Harper','Matthew','Evelyn','Lucas',
  'Abigail','Jackson','Emily','Sebastian','Elizabeth','Jack','Sofia','Owen','Victoria','Henry'];
const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez',
  'Martinez','Hernandez','Lopez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee'];
const PAGES = ['Homepage','Product List','Product Detail','Cart','Checkout','Order Confirmation','About','Blog','FAQ','Contact'];
const PRODUCTS = [
  {id:'SKU-001',name:'Premium Headphones',price:149.99,category:'Electronics'},
  {id:'SKU-002',name:'Running Shoes',price:89.99,category:'Footwear'},
  {id:'SKU-003',name:'Coffee Maker',price:59.99,category:'Kitchen'},
  {id:'SKU-004',name:'Yoga Mat',price:29.99,category:'Fitness'},
  {id:'SKU-005',name:'Backpack',price:74.99,category:'Accessories'},
  {id:'SKU-006',name:'Wireless Mouse',price:34.99,category:'Electronics'},
  {id:'SKU-007',name:'Water Bottle',price:19.99,category:'Fitness'},
  {id:'SKU-008',name:'Desk Lamp',price:44.99,category:'Home Office'},
];
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
  cart: typeof PRODUCTS[number][];
  pageHistory: string[];
  totalSpent: number;
  sessionEvents: number;
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

// Globals for external SDKs
declare global {
  interface Window {
    utag?: { view: (data: Record<string, unknown>) => void; link: (data: Record<string, unknown>) => void };
    LDClient?: { initialize: (id: string, ctx: Record<string, unknown>) => LDClientInstance };
    utag_data?: Record<string, string>;
  }
}

interface LDClientInstance {
  on: (event: string, cb: () => void) => void;
  variation: (flag: string, defaultValue: unknown) => unknown;
  identify: (ctx: Record<string, unknown>) => void;
  track: (event: string, data?: Record<string, unknown>, metricValue?: number) => void;
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
  const tealiumReadyRef = useRef(false);
  const ldReadyRef = useRef(false);
  const ldClientRef = useRef<LDClientInstance | null>(null);
  const eventLogRef = useRef<HTMLDivElement>(null);
  const simModeRef = useRef('realistic');
  const eventFreqRef = useRef(1500);

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
  // FLAG UPDATE
  // ================================================================
  const updateFlags = useCallback(() => {
    const client = ldClientRef.current;
    if (!client) return;
    try {
      const pricing = client.variation('pricing-page-layout', 'control');
      const segOffer = client.variation('tealium-segment-offer', 'no-offer');
      setFlagPricing(pricing as string);
      setFlagSegmentOffer(segOffer as string);
    } catch (_e) { /* ignore */ }
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
  // EVENT FIRING FUNCTIONS
  // ================================================================
  const fireTealiumPageView = useCallback((user: SimUser) => {
    const page = PAGES[Math.floor(Math.random() * PAGES.length)];
    user.pageHistory.push(page);
    const data: Record<string, unknown> = {
      tealium_event: 'page_view',
      page_name: page,
      page_type: page.toLowerCase().replace(/\s/g, '_'),
      customer_id: user.key,
      customer_type: user.customerType,
      country_code: user.country,
      currency_code: user.country === 'UK' ? 'GBP' : user.country === 'DE' ? 'EUR' : 'USD',
    };
    if (tealiumReadyRef.current && window.utag) {
      try { window.utag.view(data); } catch (_e) { /* ignore */ }
    }
    statsRef.current.tealiumEvents++;
    syncStats();
    logEvent('tealium', `utag.view() \u2014 ${page}`, `user: ${user.firstName} ${user.lastName[0]}.`);
    flashArrow('arrow-1');
  }, [logEvent, flashArrow, syncStats]);

  const fireTealiumProductView = useCallback((user: SimUser) => {
    const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
    const data: Record<string, unknown> = {
      tealium_event: 'product_view',
      event_name: 'product-viewed',
      page_name: 'Product Detail',
      product_id: [product.id],
      product_name: [product.name],
      product_price: [String(product.price)],
      product_category: [product.category],
      customer_id: user.key,
      customer_type: user.customerType,
    };
    if (tealiumReadyRef.current && window.utag) {
      try { window.utag.link(data); } catch (_e) { /* ignore */ }
    }
    statsRef.current.tealiumEvents++;
    syncStats();
    logEvent('tealium', `utag.link() \u2014 product_view: ${product.name}`, `$${product.price}`);
    logEvent('tealium', `\u2192 EventStream \u2192 LD Metric Import: product-viewed`, product.id);
    flashArrow('arrow-1');
    flashArrow('arrow-2');
  }, [logEvent, flashArrow, syncStats]);

  const fireTealiumAddToCart = useCallback((user: SimUser) => {
    const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
    user.cart.push(product);
    const data: Record<string, unknown> = {
      tealium_event: 'cart_add',
      event_name: 'add-to-cart',
      product_id: [product.id],
      product_name: [product.name],
      product_price: [String(product.price)],
      product_quantity: ['1'],
      customer_id: user.key,
    };
    if (tealiumReadyRef.current && window.utag) {
      try { window.utag.link(data); } catch (_e) { /* ignore */ }
    }
    statsRef.current.tealiumEvents++;
    syncStats();
    logEvent('tealium', `utag.link() \u2014 add_to_cart: ${product.name}`, `${user.firstName} ${user.lastName[0]}.`);
    logEvent('tealium', `\u2192 EventStream \u2192 LD Metric Import: add-to-cart`, product.id);
    flashArrow('arrow-1');
    flashArrow('arrow-2');
  }, [logEvent, flashArrow, syncStats]);

  const fireSegmentSync = useCallback((user: SimUser) => {
    const adding = !segmentsRef.current.tealium.has(user.key) || Math.random() > 0.3;

    if (adding) {
      segmentsRef.current.tealium.add(user.key);
      logEvent('tealium', `Audience join: LaunchDarkly Test Audience`, `${user.firstName} ${user.lastName[0]}.`);
      logEvent('ld', `Segment sync: Add member \u2192 tealium-segment`, user.key);
    } else {
      segmentsRef.current.tealium.delete(user.key);
      logEvent('tealium', `Audience leave: LaunchDarkly Test Audience`, `${user.firstName} ${user.lastName[0]}.`);
      logEvent('ld', `Segment sync: Remove member \u2192 tealium-segment`, user.key);
    }

    statsRef.current.segmentSyncs++;
    syncStats();
    flashArrow('arrow-3');
  }, [logEvent, flashArrow, syncStats]);

  const fireTealiumPurchase = useCallback((user: SimUser) => {
    if (user.cart.length === 0) {
      user.cart.push(PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)]);
    }
    const total = user.cart.reduce((sum, p) => sum + p.price, 0);
    user.totalSpent += total;
    const orderId = 'ORD-' + Math.random().toString(36).substr(2,8).toUpperCase();
    const subtotal = total;
    const tax = Math.round(total * 0.08 * 100) / 100;
    const shipping = total > 100 ? 0 : 5.99;
    const orderTotal = subtotal + tax + shipping;
    const STATES = ['CA','NY','TX','FL','IL','PA','OH','GA','NC','MI'];
    const state = STATES[Math.floor(Math.random() * STATES.length)];
    const zip = String(10000 + Math.floor(Math.random() * 89999));
    const data: Record<string, unknown> = {
      tealium_event: 'purchase',
      event_name: 'purchase-complete',
      order_id: orderId,
      order_total: String(orderTotal.toFixed(2)),
      order_subtotal: String(subtotal.toFixed(2)),
      order_tax: String(tax.toFixed(2)),
      order_shipping: String(shipping.toFixed(2)),
      order_currency: 'USD',
      product_id: user.cart.map(p => p.id),
      product_name: user.cart.map(p => p.name),
      product_price: user.cart.map(p => String(p.price)),
      product_unit_price: user.cart.map(p => p.price),
      product_quantity: user.cart.map(() => 1),
      product_on_page: user.cart.map(p => p.name),
      customer_id: user.key,
      customer_type: user.customerType,
      customer_email: user.email,
      customer_country: user.country,
      customer_state: state,
      customer_zip: zip,
    };
    if (tealiumReadyRef.current && window.utag) {
      try { window.utag.link(data); } catch (_e) { /* ignore */ }
    }
    statsRef.current.tealiumEvents++;
    syncStats();
    logEvent('tealium', `utag.link() \u2014 purchase: ${orderId}`, `$${total.toFixed(2)}`);
    logEvent('tealium', `\u2192 EventStream \u2192 LD Metric Import: purchase-complete ($${total.toFixed(2)})`, orderId);
    flashArrow('arrow-1');
    flashArrow('arrow-2');

    if (!segmentsRef.current.tealium.has(user.key)) {
      segmentsRef.current.tealium.add(user.key);
      statsRef.current.segmentSyncs++;
      logEvent('tealium', `Audience joined: LaunchDarkly Test Audience`, `${user.firstName} (purchase triggered)`);
      logEvent('ld', `Segment sync: +1 member \u2192 tealium-segment`, user.key);
      flashArrow('arrow-3');
      syncStats();
    }

    user.cart = [];
  }, [logEvent, flashArrow, syncStats]);

  const fireLDFlagEval = useCallback((user: SimUser) => {
    let value: unknown;

    if (ldClientRef.current && ldReadyRef.current) {
      try {
        ldClientRef.current.identify({ kind:'user', key: user.key, name: `${user.firstName} ${user.lastName}`,
          custom: { customer_type: user.customerType, country: user.country }});
        value = ldClientRef.current.variation('pricing-page-layout', 'control');
        const segValue = ldClientRef.current.variation('tealium-segment-offer', 'no-offer');
        logEvent('ld', `variation('tealium-segment-offer') \u2192 ${segValue}`, `${user.firstName} ${user.lastName[0]}.`);
      } catch (_e) {
        value = simulateFlagValue('pricing-page-layout');
      }
    } else {
      value = simulateFlagValue('pricing-page-layout');
    }

    statsRef.current.ldEvents++;
    syncStats();
    logEvent('ld', `variation('pricing-page-layout') \u2192 ${value}`, `${user.firstName} ${user.lastName[0]}.`);
  }, [logEvent, syncStats]);

  // ================================================================
  // SIMULATION DISPATCH
  // ================================================================
  const fireRealisticEvent = useCallback((user: SimUser) => {
    const rand = Math.random();
    if (rand < 0.25) fireTealiumPageView(user);
    else if (rand < 0.45) fireTealiumProductView(user);
    else if (rand < 0.60) fireTealiumAddToCart(user);
    else if (rand < 0.75) fireTealiumPurchase(user);
    else if (rand < 0.90) fireLDFlagEval(user);
    else fireSegmentSync(user);
  }, [fireTealiumPageView, fireTealiumProductView, fireTealiumAddToCart, fireTealiumPurchase, fireLDFlagEval, fireSegmentSync]);

  const fireEcommerceEvent = useCallback((user: SimUser) => {
    const step = user.sessionEvents % 5;
    switch(step) {
      case 0: fireTealiumPageView(user); break;
      case 1: fireTealiumProductView(user); break;
      case 2: fireTealiumAddToCart(user); break;
      case 3: fireLDFlagEval(user); break;
      case 4: fireTealiumPurchase(user); break;
    }
    user.sessionEvents++;
  }, [fireTealiumPageView, fireTealiumProductView, fireTealiumAddToCart, fireLDFlagEval, fireTealiumPurchase]);

  const fireSegmentEvent = useCallback((user: SimUser) => {
    const rand = Math.random();
    if (rand < 0.4) fireSegmentSync(user);
    else if (rand < 0.7) fireTealiumPageView(user);
    else fireLDFlagEval(user);
  }, [fireSegmentSync, fireTealiumPageView, fireLDFlagEval]);

  const simulateEvent = useCallback(() => {
    if (!simRunningRef.current) return;
    const currentUsers = usersRef.current;
    if (currentUsers.length === 0) return;
    const mode = simModeRef.current;
    const user = currentUsers[Math.floor(Math.random() * currentUsers.length)];

    switch(mode) {
      case 'realistic': fireRealisticEvent(user); break;
      case 'ecommerce': fireEcommerceEvent(user); break;
      case 'segment-sync': fireSegmentEvent(user); break;
      case 'burst':
        for(let i=0;i<5;i++) fireRealisticEvent(currentUsers[Math.floor(Math.random()*currentUsers.length)]);
        break;
    }
  }, [fireRealisticEvent, fireEcommerceEvent, fireSegmentEvent]);

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
        cart: [],
        pageHistory: [],
        totalSpent: 0,
        sessionEvents: 0,
      });
    }
    usersRef.current = newUsers;
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
    logEvent('system', `Simulation stopped after ${elapsed}s \u2014 ${s.tealiumEvents} Tealium events, ${s.ldEvents} LD events, ${s.segmentSyncs} segment syncs`);
  }, [logEvent]);

  const startSimulation = useCallback(() => {
    generateUsers(userCount);

    simRunningRef.current = true;
    setSimRunning(true);
    simStartRef.current = Date.now();
    simDurationRef.current = simDurationSetting * 1000;

    setSimStatusText('Running');
    setSimStatusColor('var(--green)');

    logEvent('system', `Simulation started \u2014 ${userCount} users, mode: ${simMode}`);

    scheduleNextEvent();

    if (simDurationSetting > 0) {
      progressTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - simStartRef.current;
        const pct = Math.min(100, (elapsed / simDurationRef.current) * 100);
        setProgress(pct);
        if (elapsed >= simDurationRef.current) stopSimulation();
      }, 200);
    }
  }, [userCount, simDurationSetting, simMode, generateUsers, logEvent, scheduleNextEvent, stopSimulation]);

  // ================================================================
  // MANUAL EVENTS
  // ================================================================
  const fireManualEvent = useCallback((type: string) => {
    if (usersRef.current.length === 0) {
      generateUsers(5);
    }
    const currentUsers = usersRef.current;
    const user = currentUsers[Math.floor(Math.random() * currentUsers.length)];

    switch(type) {
      case 'page_view': fireTealiumPageView(user); break;
      case 'product_view': fireTealiumProductView(user); break;
      case 'add_to_cart': fireTealiumAddToCart(user); break;
      case 'purchase': fireTealiumPurchase(user); break;
      case 'flag_eval': fireLDFlagEval(user); break;
      case 'segment_add': case 'segment_remove': fireSegmentSync(user); break;
    }
  }, [generateUsers, fireTealiumPageView, fireTealiumProductView, fireTealiumAddToCart, fireTealiumPurchase, fireLDFlagEval, fireSegmentSync]);

  // ================================================================
  // SDK INITIALIZATION
  // ================================================================
  useEffect(() => {
    const checkTealium = () => {
      if (window.utag) {
        setTealiumStatus('connected');
        logEvent('system', 'Tealium utag.js loaded and ready');
        tealiumReadyRef.current = true;
      } else {
        setTealiumStatus('pending');
        logEvent('system', 'Waiting for Tealium utag.js to load...');
        setTimeout(checkTealium, 2000);
        return;
      }
    };

    const checkLD = () => {
      if (window.LDClient) {
        try {
          const ctx = { kind: 'user', key: 'demo-bootstrap', name: 'Demo Bootstrap', anonymous: false };
          const client = window.LDClient.initialize(LD_CLIENT_SIDE_ID, ctx);
          ldClientRef.current = client;
          client.on('ready', () => {
            setLdStatus('connected');
            logEvent('system', 'LaunchDarkly SDK initialized and streaming');
            ldReadyRef.current = true;
            updateFlags();
          });
          client.on('change', () => { updateFlags(); });
        } catch (e: unknown) {
          setLdStatus('disconnected');
          logEvent('system', 'LaunchDarkly SDK error: ' + (e instanceof Error ? e.message : String(e)));
        }
      } else {
        setLdStatus('pending');
        logEvent('system', 'LaunchDarkly SDK not loaded \u2014 check script tag');
      }
    };

    // Load Tealium utag.js dynamically
    window.utag_data = {
      page_type: 'demo',
      page_name: 'Tealium LD Integration Demo',
      site_section: 'demo',
      country_code: 'US',
      currency_code: 'USD',
      tealium_event: 'page_view'
    };
    const script = document.createElement('script');
    script.src = `//tags.tiqcdn.com/utag/${TEALIUM_ACCOUNT}/${TEALIUM_PROFILE}/${TEALIUM_ENV}/utag.js`;
    script.type = 'text/javascript';
    script.async = true;
    document.head.appendChild(script);

    const timer = setTimeout(() => {
      checkTealium();
      checkLD();
    }, 1000);

    return () => clearTimeout(timer);
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
      <Script
        src="https://unpkg.com/launchdarkly-js-client-sdk@3"
        strategy="afterInteractive"
      />

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
              <div className="flow-node browser">Browser<br /><small style={{ color: 'var(--text-dim)' }}>utag.js + LD SDK</small></div>
              <div className={`flow-arrow ${activeArrows['arrow-1'] ? 'active' : ''}`}>&rarr;</div>
              <div className="flow-node tealium-node">Tealium<br /><small>EventStream</small></div>
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
                Flag values update in real-time via LD SDK streaming
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

// ================================================================
// HELPER (outside component)
// ================================================================
function simulateFlagValue(_flag: string): unknown {
  return ['control','simplified','comparison'][Math.floor(Math.random()*3)];
}
