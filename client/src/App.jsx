import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import {
  ArrowDown, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Box,
  Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ClipboardCheck, Compass,
  Grid2X2, House, IndianRupee, Layers3, LogOut, Menu, Plus, Trash2,
  Ruler, Search, Share2, ShieldCheck, Sparkles, Sofa, Upload,
  UserRound, Wallet, WandSparkles, X,
} from 'lucide-react';
import { api, assetUrl } from './lib/api.js';
import RedesignWorkflow from './RedesignWorkflow.jsx';
import RenovationCostCalculator from './RenovationCostCalculator.jsx';
import ProjectsWorkspace from './ProjectsWorkspace.jsx';
import NotificationsPanel from './NotificationsPanel.jsx';
import Planner from './Planner.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import SharedProjectPage from './SharedProjectPage.jsx';
import PasswordReset from './PasswordReset.jsx';
import ForgotPassword from './ForgotPassword.jsx';
import FeedbackPanel from './FeedbackPanel.jsx';
import './profile.css';
import './native-safe-area.css';

const image = (id, width = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;
const examples = [
  { title: 'Slow Sunday living', type: 'Living room · Japandi', image: 'photo-1600210492486-724fe5c67fb0', label: 'INTERIOR' },
  { title: 'A softer kind of homecoming', type: 'Facade · Contemporary', image: 'photo-1600607687939-ce8a6c25118c', label: 'EXTERIOR' },
  { title: 'A kitchen with a point of view', type: 'Kitchen · Modern Indian', image: 'photo-1600566753086-00f18fb6b3ea', label: 'RENOVATION' },
  { title: 'Light, texture, and quiet', type: 'Bedroom · Warm minimal', image: 'photo-1616486338812-3dadae4b4ace', label: 'INTERIOR' },
];
const navigation = [
  { id: 'Interior Design', icon: Sofa, detail: 'Reimagine a room' },
  { id: 'Exterior Design', icon: House, detail: 'Shape your facade' },
  { id: '3D Studio', icon: Box, detail: 'Walk through your idea' },
  { id: 'My Projects', icon: Layers3, detail: 'Your saved concepts' },
  { id: 'Cost Estimator', icon: IndianRupee, detail: 'Plan your budget' },
  { id: 'Renovation Planner', icon: ClipboardCheck, detail: 'Track every step' },
];
const styles = ['Warm minimal', 'Modern Indian', 'Contemporary', 'Japandi', 'Traditional', 'Coastal'];
const readStore = (key, fallback) => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
};

function App() {
  const [page, setPage] = useState('Landing');
  const [pageHistory, setPageHistory] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [auth, setAuth] = useState('');
  const [toast, setToast] = useState('');
  const [user, setUser] = useState(null);
  const [guestMode, setGuestMode] = useState(() => sessionStorage.getItem('dreamspace-guest') === 'true');
  const [projects, setProjects] = useState(() => sessionStorage.getItem('dreamspace-guest') === 'true' ? readStore('dreamspace-guest-projects', []) : []);
  const [shareToken] = useState(() => new URLSearchParams(window.location.search).get('share') || '');
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('reset') || '');
  const backActionRef = useRef(() => {});

  backActionRef.current = () => {
    if (auth) { setAuth(''); return; }
    if (menuOpen) { setMenuOpen(false); return; }
    if (pageHistory.length) {
      const previous = pageHistory[pageHistory.length - 1];
      setPageHistory((current) => current.slice(0, -1)); setPage(previous); return;
    }
    if (page !== 'Landing') { setPage('Landing'); return; }
    NativeApp.exitApp();
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    StatusBar.setStyle({ style: StatusBarStyle.Dark }).catch(() => {});
    StatusBar.show().catch(() => {});
    SplashScreen.hide({ fadeOutDuration: 180 }).catch(() => {});
    return undefined;
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    let listener;
    NativeApp.addListener('backButton', () => backActionRef.current()).then((handle) => { listener = handle; }).catch(() => {});
    return () => { listener?.remove(); };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    let listener;
    NativeApp.addListener('appRestoredResult', (result) => {
      if (result.pluginId === 'Camera' && result.methodName === 'getPhoto' && result.success && result.data?.webPath) {
        sessionStorage.setItem('dreamspace-restored-camera-photo', JSON.stringify(result.data));
      }
    }).then((handle) => { listener = handle; }).catch(() => {});
    return () => { listener?.remove(); };
  }, []);

  useEffect(() => {
    let mounted = true;
    let noticeTimer;
    api('/auth/me').then(async ({ user: sessionUser }) => {
      if (!mounted) return;
      setUser(sessionUser);
      if (sessionUser) {
        setGuestMode(false);
        sessionStorage.removeItem('dreamspace-guest');
        try {
          const result = await api('/projects');
          if (mounted) setProjects(result.data.map(toUiProject));
        } catch { if (mounted) setProjects([]); }
      } else if (sessionStorage.getItem('dreamspace-guest') === 'true') {
        setProjects(readStore('dreamspace-guest-projects', []));
      } else {
        setProjects([]);
      }
    }).catch((error) => {
      if (mounted && sessionStorage.getItem('dreamspace-guest') !== 'true') setProjects([]);
      if (mounted && Capacitor.isNativePlatform() && /API address|offline|reach the server/i.test(error.message || '')) {
        setToast(error.message); noticeTimer = window.setTimeout(() => { if (mounted) setToast(''); }, 6500);
      }
    });
    return () => { mounted = false; window.clearTimeout(noticeTimer); };
  }, []);

  useEffect(() => {
    if (guestMode && !user) localStorage.setItem('dreamspace-guest-projects', JSON.stringify(projects));
  }, [projects, guestMode, user]);
  const notify = (message) => { setToast(message); window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => setToast(''), 3000); };
  const navigate = (next) => {
    if (next !== 'Landing' && !user && !guestMode) {
      setGuestMode(true);
      sessionStorage.setItem('dreamspace-guest', 'true');
      setProjects(readStore('dreamspace-guest-projects', []));
    }
    setPageHistory((current) => page === next ? current : [...current, page].slice(-20));
    setPage(next); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const addProject = async (project) => {
    const type = String(project.kind || 'Interior').toLowerCase();
    const payload = {
      title: project.title, type: ['interior', 'exterior', 'renovation'].includes(type) ? type : 'interior',
      room: project.room, style: project.style, prompt: project.prompt, estimate: project.estimate,
      measurements: project.measurements, estimateReport: project.estimateReport, rooms: project.rooms,
      imageKey: typeof project.image === 'string' && /^photo-[a-zA-Z0-9-]{4,80}$/.test(project.image) ? project.image : undefined,
    };
    if (user) {
      const result = await api('/projects', { method: 'POST', body: payload });
      const saved = { ...toUiProject(result.data), image: project.image || toUiProject(result.data).image, created: 'Just now' };
      setProjects((current) => [saved, ...current]);
      return saved;
    }
    const saved = { ...project, id: crypto.randomUUID(), created: 'Just now' };
    setProjects((current) => [saved, ...current]);
    return saved;
  };
  const submitAuth = async (form, kind) => {
    const result = await api(`/auth/${kind}`, { method: 'POST', body: form });
    await completeSignIn(result);
  };
  const submitGoogle = async (credential) => {
    const result = await api('/auth/google', { method: 'POST', body: { credential } });
    await completeSignIn(result);
  };
  const completeSignIn = async (result) => {
    setUser(result.user); setGuestMode(false); sessionStorage.removeItem('dreamspace-guest');
    try { const savedProjects = await api('/projects'); setProjects(savedProjects.data.map(toUiProject)); }
    catch { setProjects([]); }
    setAuth(''); setPageHistory([]); setPage('Dashboard'); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' });
    notify(`Welcome, ${result.user.name.split(' ')[0]}!`);
  };
  const enterGuest = () => {
    setGuestMode(true); sessionStorage.setItem('dreamspace-guest', 'true');
    setProjects(readStore('dreamspace-guest-projects', [])); setAuth(''); navigate('Dashboard');
  };
  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST' }); }
    catch { notify('Could not contact the server. You have been signed out on this device.'); }
    setUser(null); setGuestMode(false); sessionStorage.removeItem('dreamspace-guest'); setProjects([]);
    setPageHistory([]); setPage('Landing'); window.scrollTo({ top: 0, behavior: 'smooth' });
    notify('You’ve been signed out.');
  };
  const finishPasswordReset = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('reset');
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    setResetToken('');
    setAuth('login');
  };
  const deleteAccount = async (payload) => {
    await api('/auth/account', { method: 'DELETE', body: payload });
    localStorage.removeItem(`dreamspace-profile:${user?.id}`);
    localStorage.removeItem(`dreamspace-avatar:${user?.id}`);
    localStorage.removeItem('dreamspace-guest-projects');
    sessionStorage.removeItem('dreamspace-guest');
    setUser(null); setGuestMode(false); setProjects([]); setPageHistory([]); setPage('Landing');
    notify('Your account and saved project data have been deleted.');
  };

  if (shareToken) return <SharedProjectPage token={shareToken} />;

  return <div className="ds-app">
    {page === 'Landing' ? <Landing navigate={navigate} setAuth={setAuth} notify={notify} user={user} /> : <Workspace
      page={page} navigate={navigate} menuOpen={menuOpen} setMenuOpen={setMenuOpen} user={user} setAuth={setAuth} onUserChange={setUser} onDeleteAccount={deleteAccount} onProjectsChange={(raw) => setProjects(raw.map(toUiProject))}
      projects={projects} addProject={addProject} notify={notify} logout={logout}
    />}
    {auth && auth !== 'forgot' && <AuthModal kind={auth} onClose={() => setAuth('')} onSwitch={setAuth} onSubmit={(form) => submitAuth(form, auth)} onGoogle={submitGoogle} onGuest={enterGuest} />}
    {auth === 'forgot' && <ForgotPassword onClose={() => setAuth('')} onSwitch={setAuth} />}
    {resetToken && <PasswordReset token={resetToken} onDone={finishPasswordReset} notify={notify} />}
    {toast && <div className="ds-toast"><span><Check size={15} /></span>{toast}</div>}
  </div>;
}

function toUiProject(project) {
  const type = project.type || 'interior';
  const latest = project.generations?.at(-1);
  const imageKey = latest?.generatedAssetId ? assetUrl(`/api/design-assets/${latest.generatedAssetId}`)
    : project.referenceAssetId ? assetUrl(`/api/design-assets/${project.referenceAssetId}`)
      : project.imageKey || (type === 'exterior' ? examples[1].image : type === 'renovation' ? examples[2].image : examples[0].image);
  return { ...project, id: project._id || project.id, kind: type[0].toUpperCase() + type.slice(1), image: imageKey, created: 'Saved project' };
}

function projectImage(value, width = 850) {
  return value?.startsWith('/api/') || value?.startsWith('http') || value?.startsWith('data:') || value?.startsWith('blob:') ? value : image(value || examples[0].image, width);
}

function Brand({ light = false, onClick }) {
  return <button className={`ds-brand ${light ? 'brand-light' : ''}`} onClick={onClick} aria-label="DreamSpace AI home"><span className="ds-brand-mark"><House size={18} strokeWidth={2.1} /></span><span>dreamspace<span>ai</span></span></button>;
}

function Landing({ navigate, setAuth, notify, user }) {
  const [mobileNav, setMobileNav] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const stories = [
    { quote: 'Imagine seeing a familiar room with a fresh palette, while keeping the pieces that matter to you.', names: 'Illustrative example', meta: 'Not a customer testimonial', initials: 'EX' },
    { quote: 'Explore a few styles, compare the feeling, then take a clearer direction to your designer or contractor.', names: 'Illustrative example', meta: 'Not a customer testimonial', initials: 'EX' },
    { quote: 'An early estimate can help organize questions before you request a local contractor quote.', names: 'Illustrative example', meta: 'Not a customer testimonial', initials: 'EX' },
  ];
  const share = () => {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(window.location.href).then(() => notify('DreamSpace link copied to your clipboard.')).catch(() => notify('You can share DreamSpace from your browser menu.'));
    else notify('You can share DreamSpace from your browser menu.');
  };
  return <div className="landing-page">
    <header className="landing-header"><div className="landing-header-inner"><Brand onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} /><nav className={`landing-nav ${mobileNav ? 'landing-nav-open' : ''}`} aria-label="Main navigation"><a href="#designs" onClick={() => setMobileNav(false)}>Discover</a><a href="#how-it-works" onClick={() => setMobileNav(false)}>How it works</a><a href="#pricing" onClick={() => setMobileNav(false)}>Pricing</a><a href="#stories" onClick={() => setMobileNav(false)}>Stories</a></nav><div className="landing-actions">{user ? <button className="signup-button" onClick={() => navigate('Dashboard')}>My workspace <ArrowRight size={15} /></button> : <><button className="login-button" onClick={() => setAuth('login')}>Log in</button><button className="signup-button" onClick={() => setAuth('signup')}>Get started <ArrowRight size={15} /></button></>}</div><button className="landing-menu-button" aria-label="Toggle navigation" onClick={() => setMobileNav(!mobileNav)}>{mobileNav ? <X size={21} /> : <Menu size={21} />}</button></div></header>

    <main>
      <section className="landing-hero"><div className="landing-hero-inner"><div className="landing-hero-copy"><div className="hero-label"><span /> A NEW WAY TO IMAGINE HOME</div><h1>Your home,<br /><em>more you.</em></h1><p>Big ideas for the place you call home. DreamSpace AI helps you see what’s possible, plan what it takes, and make every corner feel like yours.</p><div className="landing-hero-actions"><button className="ds-button ds-button-dark" onClick={() => navigate('Dashboard')}>Design your space <ArrowRight size={16} /></button><button className="quiet-button" onClick={() => document.getElementById('designs')?.scrollIntoView({ behavior: 'smooth' })}>Explore the possibilities <ArrowDown size={15} /></button></div><div className="landing-proof"><div className="proof-avatars"><span>R</span><span>M</span><span>A</span><span>+</span></div><span><b>Thoughtful homes,</b> imagined across India</span></div></div><div className="landing-hero-art"><div className="hero-art-main" /><div className="hero-art-caption"><span className="caption-icon"><Sparkles size={14} /></span><span><b>Made for the way you live</b><small>Inspired by home, grounded in you</small></span></div><div className="hero-art-label"><span /> A little more room to breathe</div><div className="art-outline art-outline-a" /><div className="art-outline art-outline-b" /></div><div className="hero-side-note">IDEAS TO INSPIRATION <ArrowDownRight size={14} /></div></div><div className="hero-bottom-strip"><span>DESIGN WITH INTENTION</span><span className="strip-line" /><span>MADE FOR INDIAN HOMES</span><span className="strip-line" /><span>YOUR VISION, REIMAGINED</span></div></section>

      <section className="landing-section examples-section" id="designs"><div className="section-topline"><span>01 — A LITTLE INSPIRATION</span><span>Spaces with a story to tell</span></div><div className="landing-section-heading"><div><div className="eyebrow-light">FIND YOUR FEELING</div><h2>Every home starts<br />with <em>a feeling.</em></h2></div><p>From a sunlit reading nook to a front door that makes you smile — explore ideas made for real homes and real life.</p></div><div className="example-grid">{examples.map((item, i) => <article key={item.title} className={`example-card example-card-${i + 1}`}><button className="example-image" style={{ backgroundImage: `url(${image(item.image, 1000)})` }} onClick={() => navigate('Interior Design')} aria-label={`Explore ${item.title}`}><span className="example-chip">{item.label}</span><span className="example-hover"><ArrowUpRight size={19} /></span></button><div className="example-meta"><div><h3>{item.title}</h3><p>{item.type}</p></div><button aria-label={`Design a ${item.type}`} onClick={() => navigate(item.label === 'EXTERIOR' ? 'Exterior Design' : 'Interior Design')}><ArrowUpRight size={17} /></button></div></article>)}</div><div className="examples-bottom"><span>YOUR HOME IS THE STARTING POINT.</span><button className="text-button" onClick={() => navigate('Interior Design')}>Find your own direction <ArrowRight size={15} /></button></div></section>

      <section className="feature-section"><div className="feature-grid"><div className="feature-heading"><div className="eyebrow-light">A BETTER WAY TO BEGIN</div><h2>Good design<br />starts with <em>you.</em></h2><p>Less second guessing. More “this feels right.” Your ideas, your pace, with a little help along the way.</p><button className="text-button" onClick={() => navigate('Dashboard')}>See what you can create <ArrowRight size={15} /></button></div><div className="feature-list"><Feature icon={WandSparkles} number="01" title="See the possibility" text="Turn a room photo or a passing thought into design directions that make sense for your space." /><Feature icon={Ruler} number="02" title="Make it yours" text="Explore styles, finishes, layouts and details until the idea feels unmistakably like home." /><Feature icon={Wallet} number="03" title="Plan with confidence" text="Get a practical starting point for costs, so the dream feels a little closer to real." /></div><div className="feature-image-wrap"><div className="feature-image" /><div className="feature-note"><span><Check size={14} /></span> A home that feels like yours</div><div className="feature-stamp"><House size={19} /><small>MADE FOR<br />LIVING WELL</small></div></div></div></section>

      <section className="process-section" id="how-it-works"><div className="section-topline"><span>02 — SIMPLE BY DESIGN</span><span>From “what if” to “welcome home”</span></div><div className="process-intro"><div><div className="eyebrow-light">A FEW GOOD STEPS</div><h2>Start with an idea.<br /><em>Go where it takes you.</em></h2></div><p>You don’t need a perfect plan. Just a place, a feeling, and the curiosity to see what could be.</p></div><div className="steps-grid"><Step n="01" icon={Upload} title="Bring your space" text="Upload a photo, choose a room or describe what you have in mind." /><div className="step-connector"><ArrowRight size={17} /></div><Step n="02" icon={Sparkles} title="Explore your ideas" text="Try thoughtful styles and visual directions made around your home." /><div className="step-connector"><ArrowRight size={17} /></div><Step n="03" icon={House} title="Make it happen" text="Save your favourites, explore in 3D and plan your next steps." /></div><div className="process-cta"><span><span className="process-dot" /> YOUR NEXT CHAPTER IS AROUND THE CORNER</span><button className="ds-button ds-button-light" onClick={() => navigate('Dashboard')}>Let’s get started <ArrowRight size={16} /></button></div></section>

      <section className="pricing-section" id="pricing"><div className="section-topline"><span>03 — ROOM TO GROW</span><span>Start simple. Stay inspired.</span></div><div className="pricing-head"><div><div className="eyebrow-light">A PLAN FOR YOUR PLANS</div><h2>Make room for <em>more.</em></h2></div><p>Use the planning tools at no cost. Paid plans are not active in this build.</p></div><div className="pricing-grid"><PricingCard name="A little inspiration" price="Free" descriptor="A lovely place to begin." items={['Guest planning tools on this device', 'Indicative renovation cost estimates', 'Save designs with a free account', 'AI designs when generation is configured']} action="Start for free" onClick={() => navigate('Dashboard')} /><PricingCard featured name="Room to imagine" price="Coming soon" period="" descriptor="Paid memberships are not active in this build." items={['No payment is collected', 'Features and pricing may change', 'Availability will be announced before launch']} action="Not available" onClick={() => notify('Paid memberships are not available in this build. No payment will be collected.')} /><PricingCard name="A whole new chapter" price="Coming soon" period="" descriptor="Annual billing is not active in this build." items={['No payment is collected', 'No subscription is created', 'Terms will be published before launch']} action="Not available" onClick={() => notify('Paid memberships are not available in this build. No payment will be collected.')} /></div><div className="pricing-note"><ShieldCheck size={15} /> Paid plans are not available. This build does not collect payments.</div></section>

      <section className="stories-section" id="stories"><div className="stories-image"><div className="story-image" /><div className="story-image-label"><span>ILLUSTRATIVE DESIGN STORIES</span><b>Illustrative concepts<br />not customer testimonials</b></div></div><div className="story-copy"><div className="eyebrow-light">EXAMPLE EXPERIENCES</div><div className="quote-mark">“</div><blockquote>{stories[storyIndex].quote}</blockquote><div className="story-person"><span className="story-avatar">{stories[storyIndex].initials}</span><span><b>{stories[storyIndex].names}</b><small>{stories[storyIndex].meta}</small></span></div><div className="story-controls"><button aria-label="Previous story" onClick={() => setStoryIndex((storyIndex + stories.length - 1) % stories.length)}><ArrowLeft size={15} /></button><button aria-label="Next story" onClick={() => setStoryIndex((storyIndex + 1) % stories.length)}><ArrowRight size={15} /></button><span>{String(storyIndex + 1).padStart(2, '0')} <i /> 03</span></div></div></section>

      <section className="closing-cta"><div className="closing-orb" /><div className="eyebrow-light">THE PLACE YOU CALL HOME</div><h2>It could feel like <em>this.</em></h2><p>Bring us a room, an idea, or just a feeling. We’ll help you take it from there.</p><button className="ds-button ds-button-dark" onClick={() => navigate('Dashboard')}>Imagine your space <ArrowRight size={16} /></button><span className="closing-scribble">Made for living well <span>✳</span></span></section>
    </main>
    <footer className="landing-footer"><div className="footer-main"><div className="footer-brand-block"><Brand light onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} /><p>A little more possibility<br />for the place you call home.</p><div className="social-row"><button aria-label="Copy DreamSpace link" onClick={share}><Share2 size={13} /></button><button aria-label="Copy DreamSpace link" onClick={share}><Share2 size={13} /></button><button aria-label="Copy DreamSpace link" onClick={share}><Share2 size={13} /></button></div></div><div className="footer-links"><div><b>EXPLORE</b><a href="#designs">Design ideas</a><a href="#how-it-works">How it works</a><a href="#pricing">Plans & pricing</a><button onClick={() => navigate('3D Studio')}>3D Studio</button></div><div><b>YOUR SPACE</b><button onClick={() => navigate('My Projects')}>My projects</button><button onClick={() => navigate('Cost Estimator')}>Cost estimator</button><button onClick={() => setAuth('login')}>Sign in</button><button onClick={() => setAuth('signup')}>Create an account</button></div><div><b>HERE TO HELP</b><button onClick={() => navigate('Dashboard')}>Getting started</button><span>Support contact to be configured before launch</span><a href="/privacy.html">Privacy policy draft</a><a href="/terms.html">Terms draft</a><a href="/delete-account">Delete account</a></div></div></div><div className="footer-bottom"><span>© 2026 DreamSpace AI. Made with care in India.</span><span>Thoughtful design for the way we live. <span>♥</span></span></div></footer>
  </div>;
}

function Feature({ icon: Icon, number, title, text }) { return <article className="feature-row"><div className="feature-row-icon"><Icon size={19} strokeWidth={1.7} /></div><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>; }
function Step({ n, icon: Icon, title, text }) { return <article className="step-card"><div className="step-card-top"><span>{n}</span><Icon size={20} /></div><h3>{title}</h3><p>{text}</p></article>; }
function PricingCard({ name, price, period, descriptor, items, action, featured, onClick }) { return <article className={`pricing-card ${featured ? 'pricing-featured' : ''}`}>{featured && <div className="popular-tag"><Sparkles size={12} /> MOST LOVED</div>}<div className="plan-name">{name}</div><p>{descriptor}</p><div className="plan-price">{price}<small>{period}</small></div><button className={featured ? 'plan-button plan-button-dark' : 'plan-button'} onClick={onClick}>{action}<ArrowRight size={15} /></button><div className="plan-rule" /><span className="plan-includes">A little more room for</span><ul>{items.map((item) => <li key={item}><Check size={14} />{item}</li>)}</ul></article>; }

function Workspace({ page, navigate, menuOpen, setMenuOpen, user, setAuth, onUserChange, onDeleteAccount, onProjectsChange, projects, addProject, notify, logout }) {
  const [profile, setProfile] = useState(() => ({ ...readStore(`dreamspace-profile:${user?.id || 'guest'}`, {}), name: user?.name || 'Guest', email: user?.email || '', city: user?.city || 'Pune', style: user?.preferredStyle || 'Warm minimal' }));
  const saveProfile = async (value) => {
    if (user) {
      const result = await api('/auth/profile', { method: 'PATCH', body: { name: value.name, city: value.city, preferredStyle: value.style } });
      onUserChange(result.user);
      setProfile({ ...value, ...result.user, style: result.user.preferredStyle });
    } else {
      localStorage.setItem(`dreamspace-profile:${user?.id || 'guest'}`, JSON.stringify(value));
      setProfile(value);
    }
  };
  const displayPage = page === 'Dashboard' ? 'Home' : page;
  const select = (next) => navigate(next);
  const attachEstimate = async (projectId, report) => {
    const result = await api(`/projects/${projectId}`, { method: 'PATCH', body: report });
    const refreshed = await api('/projects'); onProjectsChange(refreshed.data);
    return result.data;
  };
  const refreshProjects = async () => {
    if (!user) return;
    const refreshed = await api('/projects'); onProjectsChange(refreshed.data);
  };
  return <div className="workspace-shell">
    <aside className={`workspace-sidebar ${menuOpen ? 'workspace-sidebar-open' : ''}`}><Brand onClick={() => select('Landing')} /><button className="workspace-account"><span className="workspace-avatar">{(user?.name || 'A').slice(0, 1).toUpperCase()}</span><span><b>{user?.name || 'Guest workspace'}</b><small>Personal workspace</small></span><ChevronDown size={15} /></button><div className="workspace-nav-label">YOUR WORKSPACE</div><nav className="workspace-nav"><button className={`workspace-nav-item ${displayPage === 'Home' ? 'workspace-nav-active' : ''}`} onClick={() => select('Dashboard')}><Grid2X2 size={17} />Overview</button>{navigation.map(({ id, icon: Icon }) => <button key={id} className={`workspace-nav-item ${displayPage === id ? 'workspace-nav-active' : ''}`} onClick={() => select(id)}><Icon size={17} />{id}</button>)}{user?.isAdmin && <button className={`workspace-nav-item ${displayPage === 'Admin' ? 'workspace-nav-active' : ''}`} onClick={() => select('Admin')}><ShieldCheck size={17} />Admin dashboard</button>}</nav><div className="workspace-side-bottom"><div className="workspace-help"><span><CircleHelp size={16} /></span><b>Need a hand?</b><p>Our team is here to help your ideas take shape.</p><span className="workspace-help-contact">Support contact to be configured before launch</span></div><button className={`workspace-nav-item ${displayPage === 'Profile' ? 'workspace-nav-active' : ''}`} onClick={() => select('Profile')}><UserRound size={17} />Profile & settings</button><button className="workspace-logout" onClick={logout}><LogOut size={16} />Sign out</button></div></aside>
    {menuOpen && <button className="workspace-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <main className="workspace-main"><header className="workspace-topbar"><button className="workspace-mobile-toggle" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={21} /></button><div className="workspace-crumb"><span>Workspace</span><ChevronRight size={14} /><b>{displayPage}</b></div><div className="workspace-top-actions"><button aria-label="Search projects" onClick={() => select('My Projects')}><Search size={18} /></button><NotificationsPanel user={user} onAuth={() => setAuth('login')} onNavigate={select} /><span className="top-divider" /><button className="workspace-top-avatar" onClick={() => select('Profile')}>{(user?.name || 'AS').split(' ').map((word) => word[0]).slice(0, 2).join('')}</button></div></header><div className="workspace-content"><div className="workspace-page-head"><div><div className="workspace-eyebrow"><span /> DREAMSPACE WORKSPACE</div><h1>{displayPage === 'Home' ? `Good morning${user?.name ? `, ${user.name.split(' ')[0]}` : ', Ananya'}` : displayPage}</h1><p>{pageDescription(displayPage)}</p></div>{['Home', 'My Projects'].includes(displayPage) && <button className="ds-button ds-button-dark" onClick={() => select('Interior Design')}><Plus size={16} /> New design</button>}</div>
      {displayPage === 'Home' && <Overview projects={projects} navigate={navigate} notify={notify} />}
      {['Interior Design', 'Exterior Design', '3D Studio'].includes(displayPage) && <RedesignWorkflow mode={displayPage === 'Exterior Design' ? 'exterior' : displayPage === '3D Studio' ? '3d' : 'interior'} projects={projects} notify={notify} user={user} onNavigate={select} onAuth={() => setAuth('login')} onProjectsChange={onProjectsChange} />}
      {displayPage === 'My Projects' && <ProjectsWorkspace projects={projects} navigate={navigate} notify={notify} user={user} onProjectsChange={onProjectsChange} />}
      {displayPage === 'Cost Estimator' && <RenovationCostCalculator notify={notify} addProject={addProject} projects={projects} user={user} attachEstimate={attachEstimate} refreshProjects={refreshProjects} />}
      {displayPage === 'Renovation Planner' && <Planner user={user} setAuth={setAuth} projects={projects.filter((project) => !project.archived)} notify={notify} />}
      {displayPage === 'Admin' && (user?.isAdmin ? <AdminDashboard notify={notify} /> : <div className="planner-guest"><span><ShieldCheck size={24} /></span><h3>Administrator access only</h3><p>This area is available to DreamSpace administrators.</p></div>)}
      {displayPage === 'Profile' && <Profile profile={profile} onSave={saveProfile} user={user} notify={notify} navigate={navigate} onDeleteAccount={onDeleteAccount} />}
      <footer className="workspace-footer"><span>Made for the place you call home <b>♥</b></span><span>DreamSpace AI <i>·</i> Built for better living</span></footer>
    </div></main>
  </div>;
}

function pageDescription(page) {
  return ({ Home: 'A little inspiration can make a house feel like yours.', 'Interior Design': 'Try a new point of view for any room in your home.', 'Exterior Design': 'Imagine a homecoming that looks and feels like you.', '3D Studio': 'Take a closer look at the spaces you are shaping.', 'My Projects': 'Your ideas, saved for whenever inspiration strikes.', 'Cost Estimator': 'A thoughtful starting point for your home budget.', 'Renovation Planner': 'A clear checklist from first measurement to final handover.', Admin: 'Platform activity, enquiries and feedback in one place.', Profile: 'Your details, your preferences, your DreamSpace.' })[page] || '';
}

function Overview({ projects, navigate, notify }) {
  const activeProjects = projects.filter((project) => !project.archived);
  return <><section className="workspace-hero"><div className="workspace-hero-copy"><span className="workspace-kicker"><Sparkles size={13} /> A FRESH START FOR YOUR SPACE</span><h2>Let’s make room<br />for <em>possibility.</em></h2><p>Bring your ideas to life with thoughtful design tools for the way you live.</p><button className="ds-button ds-button-dark" onClick={() => navigate('Interior Design')}>Create a design <ArrowRight size={16} /></button><div className="hero-comfort"><CheckCircle2 size={13} /> Made for your home <span /> Free to begin</div></div><div className="workspace-hero-photo"><div className="workspace-hero-badge"><Sparkles size={13} /> A softer kind of home</div><div className="workspace-photo-credit">WARM MINIMALISM <ArrowUpRight size={12} /></div></div></section><section className="workspace-quick"><div className="workspace-section-head"><div><h2>Choose your starting point</h2><p>A few ways to bring an idea into focus.</p></div><span className="section-count">01 / 03</span></div><div className="quick-grid">{[{ name: 'Interior Design', icon: Sofa, text: 'Reimagine a room, your way', tint: 'sage' }, { name: 'Exterior Design', icon: House, text: 'Explore a fresh facade', tint: 'sand' }, { name: 'Cost Estimator', icon: IndianRupee, text: 'Get a feel for the numbers', tint: 'blue' }].map(({ name, icon: Icon, text, tint }) => <button className="quick-card" key={name} onClick={() => navigate(name)}><span className={`quick-icon ${tint}`}><Icon size={20} /></span><span><b>{name}</b><small>{text}</small></span><ArrowRight size={16} /></button>)}</div></section><section className="workspace-project-section"><div className="workspace-section-head"><div><h2>Recently imagined</h2><p>Your latest ideas, all in one place.</p></div><button className="text-button" onClick={() => navigate('My Projects')}>All projects <ArrowRight size={15} /></button></div>{activeProjects.length ? <ProjectGrid projects={activeProjects.slice(0, 3)} navigate={navigate} /> : <EmptyState icon={Layers3} title="Your next idea belongs here" text="Start a design and it will be waiting for you here." action="Start a design" onClick={() => navigate('Interior Design')} />}</section><section className="workspace-inspiration"><span><BookOpenIcon /></span><div><b>Ideas for a home that feels like yours</b><p>Explore styles, materials and practical tips for Indian homes.</p></div><button onClick={() => navigate('Interior Design')}>Find inspiration <ArrowRight size={14} /></button></section></>;
}

function BookOpenIcon() { return <Compass size={18} />; }

function ProjectGrid({ projects, navigate }) { return <div className="saved-project-grid">{projects.map((project) => <article key={project.id || project.title} className="saved-project-card"><button className="saved-project-image" onClick={() => navigate('My Projects')} aria-label={`Open ${project.title}`}><img src={projectImage(project.image)} alt="" crossOrigin="use-credentials" /><span>{project.kind || 'Interior'}</span><span className="saved-image-arrow"><ArrowUpRight size={15} /></span></button><div className="saved-project-info"><div><h3>{project.title}</h3><p>{project.room || 'Living room'} · {project.style || 'Warm minimal'}</p></div><span>{project.created}</span></div></article>)}</div>; }

function EmptyState({ icon: Icon, title, text, action, onClick }) { return <div className="empty-state"><span><Icon size={22} /></span><h3>{title}</h3><p>{text}</p><button className="ds-button ds-button-dark" onClick={onClick}>{action} <ArrowRight size={15} /></button></div>; }

function Profile({ profile, onSave, user, notify, navigate, onDeleteAccount }) {
  const [avatar, setAvatar] = useState(() => readStore(`dreamspace-avatar:${user?.id || 'guest'}`, ''));
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState(profile);
  const needsPassword = user?.hasPassword !== false;
  const change = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const onAvatar = (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) return notify('Choose a JPG, PNG or WebP image under 1 MB.');
    const reader = new FileReader(); reader.onload = () => { const value = String(reader.result); setAvatar(value); localStorage.setItem(`dreamspace-avatar:${user?.id || 'guest'}`, JSON.stringify(value)); notify('Profile photo updated on this device.'); }; reader.readAsDataURL(file);
  };
  const save = async () => {
    setSaving(true); setError('');
    try { await onSave(values); notify('Your profile has been saved.'); }
    catch (cause) { setError(cause.message || 'Your profile could not be saved.'); }
    finally { setSaving(false); }
  };
  const deleteAccount = async () => {
    if (needsPassword && !password) return setError('Enter your password to delete your account.');
    if (!needsPassword && !confirmEmail.trim()) return setError('Type your account email to confirm deletion.');
    if (!window.confirm('Delete your account and all saved designs and project data? This cannot be undone.')) return;
    setDeleting(true); setError('');
    try { await onDeleteAccount(needsPassword ? { password } : { confirmEmail: confirmEmail.trim() }); }
    catch (cause) { setError(cause.message || 'Your account could not be deleted.'); }
    finally { setDeleting(false); }
  };
  return <div className="profile-layout"><section className="profile-card"><div className="profile-card-head"><span className="profile-big-avatar">{avatar ? <img src={avatar} alt="Profile" /> : (values.name || 'G').split(' ').map((word) => word[0]).slice(0, 2).join('')}</span><div><h2>{values.name}</h2><p>{values.email || 'Guest workspace'}</p></div><input id="profile-avatar-upload" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => onAvatar(event.target.files?.[0])} /><button type="button" onClick={() => document.getElementById('profile-avatar-upload')?.click()}><Upload size={14} /> Change photo</button></div><div className="profile-section-title"><b>Personal details</b><span>{user ? 'Account identity is tied to your sign-in.' : 'Guest preferences stay on this device.'}</span></div><div className="profile-fields"><label>Full name<input value={values.name} onChange={(event) => change('name', event.target.value)} maxLength={80} required /></label><label>Email address<input type="email" value={values.email} disabled /></label><label>City<input value={values.city} onChange={(event) => change('city', event.target.value)} maxLength={80} required /></label></div><div className="profile-section-title profile-style-title"><b>Your design instinct</b><span>Used to personalize your design workspace.</span></div><label className="form-label">The style you gravitate towards</label><div className="style-chips">{styles.map((item) => <button type="button" className={values.style === item ? 'style-chip-selected' : ''} onClick={() => change('style', item)} key={item}>{item}</button>)}</div>{error && <p className="auth-error" role="alert">{error}</p>}<button type="button" className="ds-button ds-button-dark profile-save" onClick={save} disabled={saving}>{saving ? 'Saving…' : <><Check size={15} /> Save your details</>}</button>{user && <section className="account-delete"><div className="profile-section-title"><b>Delete account</b><span>This permanently removes your account, saved projects and uploaded design images.</span></div>{needsPassword ? <><label className="form-label" htmlFor="delete-account-password">Confirm your password</label><input id="delete-account-password" type="password" autoComplete="current-password" maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></> : <><p className="delete-google-note">This account signs in with Google. Type your account email to confirm deletion.</p><label className="form-label" htmlFor="delete-account-email">Account email</label><input id="delete-account-email" type="email" autoComplete="email" maxLength={254} value={confirmEmail} onChange={(event) => setConfirmEmail(event.target.value)} /></>}<button type="button" className="account-delete-button" onClick={deleteAccount} disabled={deleting}>{deleting ? 'Deleting…' : <><Trash2 size={15} /> Delete my account</>}</button></section>}</section><aside className="profile-aside"><div className="profile-plan-card"><span className="profile-plan-icon"><Sparkles size={17} /></span><span className="plan-label">YOUR CURRENT PLAN</span><h3>{user ? 'Dreamer' : 'Free plan'}</h3><p>Paid plans and billing are not available in this build.</p><button onClick={() => { navigate('Landing'); window.setTimeout(() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }), 80); }}>Explore plans <ArrowRight size={13} /></button></div><div className="privacy-note"><ShieldCheck size={17} /><div><b>Your details are yours</b><p>Account details and saved designs are stored for your workspace. See the privacy policy for data handling and deletion.</p></div></div><button className="settings-row" onClick={() => notify('Open the bell in the top bar to see design, enquiry and account updates.')}><Bell size={16} /><span><b>Notifications</b><small>Design and enquiry updates</small></span><ChevronRight size={15} /></button><button className="settings-row" onClick={() => notify('Sign-in uses a secure server session. Your browser receives only an HttpOnly session cookie.')}><ShieldCheck size={16} /><span><b>Account security</b><small>Secure sign-in session</small></span><ChevronRight size={15} /></button>{user && <FeedbackPanel notify={notify} />}</aside></div>;
}

function AuthModal({ kind, onClose, onSwitch, onSubmit, onGoogle, onGuest }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [runtimeGoogleClientId, setRuntimeGoogleClientId] = useState('');
  const googleButtonRef = useRef(null);
  const onGoogleRef = useRef(onGoogle);
  onGoogleRef.current = onGoogle;
  const googleClientId = (import.meta.env || {}).VITE_GOOGLE_CLIENT_ID || runtimeGoogleClientId;

  useEffect(() => { setAccepted(false); }, [kind]);
  useEffect(() => {
    if ((import.meta.env || {}).VITE_GOOGLE_CLIENT_ID) return undefined;
    let active = true;
    api('/config').then((result) => { if (active) setRuntimeGoogleClientId(result.googleClientId || ''); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!googleClientId || Capacitor.isNativePlatform()) return undefined;
    let cancelled = false;
    const initialize = () => {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            if (!response?.credential) return setError('Google sign-in did not return a credential. Please try again.');
            setWorking(true); setError('');
            try { await onGoogleRef.current(response.credential); }
            catch (cause) { setError(cause.message || 'Google sign-in failed. Please try again.'); }
            finally { setWorking(false); }
          },
        });
        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleButtonRef.current, { theme: 'outline', size: 'large', width: 300, text: 'continue_with', shape: 'pill' });
        if (!cancelled) setGoogleReady(true);
      } catch { if (!cancelled) setGoogleReady(false); }
    };
    const existing = document.querySelector('script[data-dreamspace-gis]');
    if (existing) {
      if (window.google?.accounts?.id) initialize();
      else {
        existing.addEventListener('load', initialize);
        return () => { cancelled = true; existing.removeEventListener('load', initialize); };
      }
      return () => { cancelled = true; };
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true; script.defer = true; script.setAttribute('data-dreamspace-gis', 'true');
    script.addEventListener('load', initialize);
    document.head.appendChild(script);
    return () => { cancelled = true; script.removeEventListener('load', initialize); };
  }, [googleClientId]);

  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (kind === 'signup' && !name.trim()) return setError('Enter your name to create an account.');
    if (!email.trim()) return setError('Enter your email address.');
    if (!password) return setError('Enter your password.');
    if (kind === 'signup' && password.length < 10) return setError('Use at least 10 characters for your password.');
    if (kind === 'signup' && !/[a-z]/i.test(password)) return setError('Include at least one letter in your password.');
    if (kind === 'signup' && !/[0-9]/.test(password)) return setError('Include at least one number in your password.');
    setWorking(true);
    try { await onSubmit(kind === 'signup' ? { name: name.trim(), email: email.trim(), password, termsAccepted: true, privacyAcknowledged: true } : { email: email.trim(), password }); }
    catch (requestError) { setError(requestError.message || 'We couldn’t complete that request. Please try again.'); }
    finally { setWorking(false); }
  };

  return <div className="auth-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !working) onClose(); }}><section className="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="auth-close" onClick={onClose} aria-label="Close" disabled={working}><X size={19} /></button><Brand onClick={onClose} /><div className="auth-kicker">A PLACE FOR YOUR IDEAS</div><h2 id="auth-title">{kind === 'signup' ? 'Make yourself at home.' : 'Welcome back.'}</h2><p>{kind === 'signup' ? 'Create an account to save your designs and projects.' : 'Log in to find your saved ideas and projects.'}</p>{googleClientId && !Capacitor.isNativePlatform() && <div className="auth-google" ref={googleButtonRef} />}{googleReady && <div className="auth-divider"><span>or continue with email</span></div>}<form onSubmit={submit}>{kind === 'signup' && <label>Your name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" maxLength={80} disabled={working} /></label>}<label>Email address<input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" maxLength={254} required disabled={working} /></label><div className="auth-password-field"><label>Password<input autoComplete={kind === 'signup' ? 'new-password' : 'current-password'} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={kind === 'signup' ? 'At least 10 characters, with a number' : 'Your password'} maxLength={128} required disabled={working} /></label>{kind === 'login' && <button type="button" className="auth-forgot" onClick={() => { setError(''); onSwitch('forgot'); }} disabled={working}>Forgot password?</button>}</div>{kind === 'signup' && <label className="auth-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required disabled={working} /><span>I agree to the <a href="/terms.html">Terms draft</a> and acknowledge the <a href="/privacy.html">Privacy Policy draft</a>.</span></label>}{error && <div className="auth-error" role="alert">{error}</div>}<button type="submit" className="ds-button ds-button-dark auth-submit" disabled={working}>{working ? <><span className="spinner" /> {kind === 'signup' ? 'Creating your account…' : 'Logging you in…'}</> : <>{kind === 'signup' ? 'Create your account' : 'Log in'} <ArrowRight size={15} /></>}</button></form><div className="auth-switch">{kind === 'signup' ? 'Already have an account?' : 'New to DreamSpace?'} <button onClick={() => { setError(''); onSwitch(kind === 'signup' ? 'login' : 'signup'); }} disabled={working}>{kind === 'signup' ? 'Log in' : 'Create an account'}</button></div><button className="guest-button" onClick={onGuest} disabled={working}>Continue as a guest</button><small className="auth-note"><ShieldCheck size={12} /> Passwords are protected with one-way hashing.</small></section></div>;
}

export default App;
