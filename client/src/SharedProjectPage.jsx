import { useEffect, useState } from 'react';
import { ArrowRight, Check, Image as ImageIcon, Layers3, LoaderCircle, Ruler, ScanLine, Sparkles } from 'lucide-react';
import { api, assetUrl } from './lib/api.js';

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);
const number = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value) || 0);

export default function SharedProjectPage({ token }) {
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`/public/projects/${token}`)
      .then((result) => setProject(result.data))
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false));
  }, [token]);

  const imageUrl = (id) => id ? assetUrl(`/api/public/projects/${token}/assets/${id}`) : '';
  const latest = project?.imageIds;
  const report = project?.estimateReport;
  const measurements = project?.measurements;

  return <div className="shared-page">
    <header className="shared-header"><a href="/" className="shared-brand"><span className="ds-brand-mark"><Layers3 size={18} /></span><span>dreamspace<span>ai</span></span></a><a href="/" className="shared-cta-small">Create your own <ArrowRight size={14} /></a></header>
    <main className="shared-main">
      {loading && <div className="shared-state"><LoaderCircle className="project-spin" size={22} /><p>Opening this shared design…</p></div>}
      {!loading && error && <div className="shared-state"><Layers3 size={24} /><h1>This link is not available</h1><p>{error}</p><a className="ds-button ds-button-dark" href="/">Explore DreamSpace <ArrowRight size={15} /></a></div>}
      {project && <>
        <section className="shared-hero">
          <div>
            <span className="shared-kicker"><Sparkles size={13} /> SHARED HOME PROJECT</span>
            <h1>{project.title}</h1>
            <p>{[project.roomType || project.room, project.style].filter(Boolean).join(' · ') || 'A DreamSpace concept'}</p>
            <span className="shared-by">Shared by {project.ownerName} · {project.sharedAt ? new Date(project.sharedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'DreamSpace user'}</span>
          </div>
          <a className="ds-button ds-button-dark" href="/">Start your own design <ArrowRight size={15} /></a>
        </section>
        <div className={`shared-images${latest?.reference ? ' has-reference' : ''}`}>
          <figure><figcaption><ImageIcon size={13} /> ORIGINAL SPACE</figcaption>{latest?.original ? <img src={imageUrl(latest.original)} alt="Original room" /> : <div className="project-detail-image-empty">No original photo</div>}</figure>
          <figure className="shared-design-figure"><figcaption><Sparkles size={13} /> AI DESIGN</figcaption>{latest?.generated ? <img src={imageUrl(latest.generated)} alt="AI redesign" /> : <div className="project-detail-image-empty">No AI design</div>}</figure>
          {latest?.reference && <figure><figcaption><ScanLine size={13} /> REFERENCE</figcaption><img src={imageUrl(latest.reference)} alt="Reference" /></figure>}
        </div>
        <div className="shared-columns">
          <section className="shared-card">
            <h2>Design direction</h2>
            <div className="shared-facts">
              <div><small>Room</small><b>{project.roomType || project.room || 'Not set'}</b></div>
              <div><small>Style</small><b>{project.style || 'Not set'}</b></div>
              <div><small>Palette</small><b>{project.palette || 'Not set'}</b></div>
              <div><small>Layout</small><b>{project.layout || 'Not set'}</b></div>
              <div><small>Door openings</small><b>{project.doors ?? 'Not recorded'}</b></div>
              <div><small>Window openings</small><b>{project.windows ?? 'Not recorded'}</b></div>
            </div>
            {measurements && <div className="shared-measurement"><Ruler size={15} /><span><b>{number(measurements.length)} × {number(measurements.width)} × {number(measurements.height)} {measurements.unit || 'ft'}</b><small>{measurements.city} · {report?.renovationType || 'Room size'}{measurements.openingsArea ? ` · Openings ${number(measurements.openingsArea)} sq. ft.` : ''}</small></span></div>}
            {project.rooms?.length ? <><h3>Rooms in this plan</h3><ul className="shared-room-list">{project.rooms.map((room, index) => <li key={index}><b>{room.name}</b><span>{[room.length && room.width ? `${number(room.length)} × ${number(room.width)} ft` : '', room.height ? `${number(room.height)} ft high` : '', room.notes].filter(Boolean).join(' · ') || 'Dimensions not added'}</span></li>)}</ul></> : null}
          </section>
          <section className="shared-card">
            <h2>Renovation estimate</h2>
            {report ? <>
              <div className="shared-cost-range"><div><small>Low</small><b>{money(report.low)}</b></div><div className="shared-cost-main"><small>Expected</small><b>{money(report.expected)}</b></div><div><small>High</small><b>{money(report.high)}</b></div></div>
              <table className="project-report-table"><thead><tr><th>Item</th><th>Expected</th></tr></thead><tbody>{(report.items || []).slice(0, 8).map((item, index) => <tr key={`${item.name}-${index}`}><td>{item.name}</td><td>{money(item.expected)}</td></tr>)}</tbody></table>
              <p className="shared-disclaimer"><Check size={13} /> Indicative only. Confirm quantities and rates with a local contractor.</p>
            </> : <p className="project-detail-empty">No renovation estimate was attached to this project.</p>}
          </section>
        </div>
        <section className="shared-closing"><div><span className="shared-kicker">A PLACE FOR YOUR IDEAS</span><h2>Your home could feel like this.</h2><p>Try styles, compare layouts and plan a renovation estimate in your own free workspace.</p></div><a className="ds-button ds-button-dark" href="/">Open DreamSpace <ArrowRight size={15} /></a></section>
      </>}
    </main>
    <footer className="shared-footer"><span>Shared from DreamSpace AI · Made for the place you call home</span><a href="/privacy.html">Privacy</a></footer>
  </div>;
}
