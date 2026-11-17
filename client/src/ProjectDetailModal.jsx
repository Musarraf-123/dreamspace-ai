import { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, ArrowDownToLine, CalendarDays, Check, Copy, Heart, Image as ImageIcon, Layers3, Link2, Link2Off, LoaderCircle, Pencil, Ruler, ScanLine, Send, Share2, Sparkles, Trash2, X } from 'lucide-react';
import { api, assetUrl } from './lib/api.js';

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);
const number = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value) || 0);

export default function ProjectDetailModal({ project, onClose, onUpdate, onDelete, onDuplicate, onArchive, onShare, onStopShare, isGuest, navigate, notify }) {
  const [title, setTitle] = useState(project.title || 'Untitled project');
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareLink, setShareLink] = useState(() => project.shareToken && !isGuest ? `${window.location.origin}/?share=${project.shareToken}` : '');
  const [error, setError] = useState('');
  const [enquiry, setEnquiry] = useState({ name: '', phone: '', city: project.measurements?.city || '', message: '' });
  const [enquiryBusy, setEnquiryBusy] = useState(false);
  const [enquiryDone, setEnquiryDone] = useState('');
  const latest = project.generations?.at(-1);
  const originalId = latest?.originalAssetId || project.sourceAssetId;
  const designId = latest?.generatedAssetId;
  const originalUrl = originalId ? assetUrl(`/api/design-assets/${originalId}`) : '';
  const designUrl = designId ? assetUrl(`/api/design-assets/${designId}`) : '';
  const referenceUrl = project.referenceAssetId ? assetUrl(`/api/design-assets/${project.referenceAssetId}`) : '';
  const report = project.estimateReport;
  const measurements = project.measurements;
  const date = project.updatedAt ? new Date(project.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Saved project';

  useEffect(() => { setTitle(project.title || 'Untitled project'); }, [project.title]);

  const saveName = async () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed.length > 100) return setError('Project name must be between 1 and 100 characters.');
    setBusy(true); setError('');
    try { await onUpdate(project, { title: trimmed }); setRenaming(false); notify('Project renamed.'); }
    catch (cause) { setError(cause.message || 'Could not rename this project.'); }
    finally { setBusy(false); }
  };
  const generateReport = async () => {
    setBusy(true); setError('');
    try {
      const { createProjectReport } = await import('./lib/projectReportPdf.js');
      const { blob, filename } = await createProjectReport(project);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = filename; link.rel = 'noopener'; link.style.display = 'none';
      document.body.appendChild(link);
      try { link.click(); }
      catch { window.open(url, '_blank', 'noopener'); }
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      notify('Your project PDF is ready to download.');
    } catch (cause) { setError(cause.message || 'The project report could not be created. Please try again.'); }
    finally { setBusy(false); }
  };
  const addEstimate = () => {
    sessionStorage.setItem('dreamspace-attach-estimate-to', project._id || project.id);
    onClose(); navigate('Cost Estimator');
  };
  const shareReport = async () => {
    setBusy(true); setError('');
    try {
      const { createProjectReport } = await import('./lib/projectReportPdf.js');
      const { blob, filename } = await createProjectReport(project);
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        setSharing(true);
        await navigator.share({ files: [file], title: project.title, text: 'My DreamSpace AI project report' });
        notify('Project report shared.');
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = filename; link.rel = 'noopener'; link.style.display = 'none';
        document.body.appendChild(link); link.click(); link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        notify('Sharing is not supported here, so the PDF was downloaded instead.');
      }
    } catch (cause) {
      if (cause.name !== 'AbortError') setError(cause.message || 'The project report could not be shared.');
    } finally { setSharing(false); setBusy(false); }
  };
  const submitEnquiry = async (event) => {
    event.preventDefault(); setError(''); setEnquiryDone('');
    setEnquiryBusy(true);
    try {
      const { data } = await api('/enquiries', { method: 'POST', body: { ...enquiry, projectId: project._id || project.id } });
      setEnquiryDone(data.message || 'Your contractor enquiry has been recorded.');
      notify('Contractor enquiry recorded.');
    } catch (cause) { setError(cause.message || 'Your enquiry could not be recorded.'); }
    finally { setEnquiryBusy(false); }
  };
  const copyText = async (value) => {
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(value); return true; } catch { return false; }
    }
    return false;
  };
  const copyShareLink = async () => {
    const copied = await copyText(shareLink);
    notify(copied ? 'View-only project link copied.' : 'Select the link field and copy it manually.');
  };
  const createShareLink = async () => {
    setShareBusy(true); setError('');
    try {
      const result = await onShare(project);
      const url = `${window.location.origin}${result.path}`;
      setShareLink(url);
      const copied = await copyText(url);
      notify(copied ? 'View-only link copied. Anyone with it can see this project.' : 'Share link created below.');
    } catch (cause) { setError(cause.message || 'The share link could not be created.'); }
    finally { setShareBusy(false); }
  };
  const turnOffShare = async () => {
    if (!window.confirm('Turn off this share link? Anyone who has it will lose access.')) return;
    setShareBusy(true); setError('');
    try { await onStopShare(project); setShareLink(''); }
    catch (cause) { setError(cause.message || 'The share link could not be turned off.'); }
    finally { setShareBusy(false); }
  };
  const removeProject = async () => {
    setBusy(true); setError('');
    try { await onDelete(project); }
    catch (cause) { setError(cause.message || 'Could not delete this project.'); }
    finally { setBusy(false); }
  };

  return <div className="project-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="project-detail-modal" role="dialog" aria-modal="true" aria-labelledby="project-detail-title">
      <header className="project-detail-header"><div><span className="project-detail-kicker"><Sparkles size={13} /> SAVED HOME PROJECT</span><h2 id="project-detail-title">{project.title}</h2></div><button className="project-detail-close" aria-label="Close project details" onClick={onClose}><X size={19} /></button></header>
      <div className="project-detail-scroll">
        {error && <div className="project-detail-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={14} /></button></div>}
        <div className="project-detail-toolbar"><span><CalendarDays size={14} /> Updated {date}</span><div><button className={project.favorite ? 'detail-tool-button favorite' : 'detail-tool-button'} onClick={async () => { setBusy(true); setError(''); try { await onUpdate(project, { favorite: !project.favorite }); } catch (cause) { setError(cause.message); } finally { setBusy(false); } }}><Heart size={15} fill={project.favorite ? 'currentColor' : 'none'} /> {project.favorite ? 'Favourited' : 'Favourite'}</button><button className="detail-tool-button" onClick={() => setRenaming(!renaming)}><Pencil size={14} /> Rename</button><button className="detail-tool-button" disabled={busy || sharing} onClick={shareReport}><Share2 size={14} /> {sharing ? 'Sharing…' : 'Share PDF'}</button><button className="detail-tool-button" disabled={busy || shareBusy} onClick={() => onDuplicate(project)}><Copy size={14} /> Duplicate</button><button className="detail-tool-button" disabled={busy || shareBusy} onClick={() => onArchive(project, !project.archived)}>{project.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />} {project.archived ? 'Restore' : 'Archive'}</button><button className="detail-tool-button" disabled={busy || shareBusy} onClick={shareLink ? copyShareLink : createShareLink}><Link2 size={14} /> {shareLink ? 'Copy link' : 'Share link'}</button></div></div>
        {shareLink && <div className="project-share-link"><div><b>View-only project link</b><span>Anyone with this link can see the design, photos and estimate. It does not allow editing.</span><input readOnly value={shareLink} onFocus={(event) => event.target.select()} aria-label="Shared project link" /></div><button type="button" onClick={copyShareLink} aria-label="Copy shared link"><Copy size={15} /></button><button type="button" className="project-share-off" onClick={turnOffShare}><Link2Off size={14} /> Turn off</button></div>}
        {renaming && <div className="project-rename-form"><label htmlFor="project-new-title">Project name</label><input id="project-new-title" maxLength="100" value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveName(); }} /><button className="ds-button ds-button-dark" disabled={busy} onClick={saveName}><Check size={14} /> Save name</button></div>}

        <div className={`project-detail-images${referenceUrl ? ' has-reference' : ''}`}><figure><figcaption><ImageIcon size={13} /> ORIGINAL PHOTO</figcaption>{originalUrl ? <img src={originalUrl} alt="Original uploaded photo" crossOrigin="use-credentials" /> : <div className="project-detail-image-empty">No original photo attached</div>}</figure><figure><figcaption><Sparkles size={13} /> AI DESIGN</figcaption>{designUrl ? <img src={designUrl} alt="AI generated redesign" crossOrigin="use-credentials" /> : <div className="project-detail-image-empty">No AI design image attached</div>}</figure>{referenceUrl && <figure><figcaption><ScanLine size={13} /> REFERENCE PHOTO</figcaption><img src={referenceUrl} alt="Reference photo used for the renovation estimate" crossOrigin="use-credentials" /></figure>}</div>

        <div className="project-detail-section"><h3><Sparkles size={15} /> Design preferences</h3><div className="project-detail-facts"><Fact label="Mode" value={latest?.mode || project.type || 'Not set'} /><Fact label="Room" value={latest?.roomType || project.roomType || project.room || 'Not set'} /><Fact label="Style" value={latest?.style || project.style || 'Not set'} /><Fact label="Palette" value={latest?.palette || project.palette || 'Not set'} /><Fact label="Budget guide" value={latest?.budget || project.budget || 'Not set'} /><Fact label="Layout" value={latest?.layout || project.layout || 'Not recorded'} /><Fact label="Door openings" value={latest?.doors ?? project.doors ?? 'Not recorded'} /><Fact label="Window openings" value={latest?.windows ?? project.windows ?? 'Not recorded'} /><Fact label="Custom notes" value={latest?.instructions || project.prompt || 'No custom notes'} /></div></div>

        <div className="project-detail-section"><h3><Ruler size={15} /> Room measurements</h3>{measurements ? <div className="project-measurement-strip"><b>{number(measurements.length)} × {number(measurements.width)} × {number(measurements.height)} {measurements.unit || 'ft'}</b><span>{measurements.city || 'City not set'}</span><small>{report?.renovationType || 'Room size'}{report?.quality ? ` · ${report.quality} quality` : ''}</small>{measurements.openingsArea > 0 && <small>Door/window openings: {number(measurements.openingsArea)} sq. ft.</small>}</div> : <div className="project-detail-empty">No room measurements added yet. Add a renovation estimate to include measurements and material costs in the report.</div>}</div>

        {project.rooms?.length ? <div className="project-detail-section"><h3><Layers3 size={15} /> Rooms in this plan</h3><ul className="project-room-list">{project.rooms.map((room, index) => <li key={index}><b>{room.name}</b><span>{[room.length && room.width ? `${number(room.length)} × ${number(room.width)} ft` : '', room.height ? `${number(room.height)} ft high` : '', room.notes].filter(Boolean).join(' · ') || 'Dimensions not added'}</span></li>)}</ul></div> : null}

        <div className="project-detail-section"><h3><span className="detail-rupee">₹</span> Renovation estimate</h3>{report ? <><div className="project-cost-summary"><Fact label="Low" value={money(report.low)} /><Fact label="Expected" value={money(report.expected)} /><Fact label="High" value={money(report.high)} /></div><div className="project-report-table-wrap"><table className="project-report-table"><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Expected</th></tr></thead><tbody>{(report.items || []).map((item, index) => <tr key={`${item.key || item.name}-${index}`}><td>{item.name}</td><td>{number(item.quantity)} {item.unit}</td><td>{money(item.unitRate)}</td><td>{money(item.expected)}</td></tr>)}</tbody></table></div><h4 className="project-material-title">Material shopping list</h4>{report.shoppingList?.length ? <ul className="project-material-list">{report.shoppingList.map((item, index) => <li key={`${item.name}-${index}`}><span>{item.name}</span><b>{number(item.quantity)} {item.unit}</b></li>)}</ul> : <p className="project-detail-empty">No material quantities were attached.</p>}{report.assumptions?.length ? <><h4 className="project-material-title">Assumptions</h4><ul className="project-assumption-list">{report.assumptions.map((line, index) => <li key={index}>{line}</li>)}</ul></> : null}</> : <div className="project-detail-empty">No cost estimate is attached. Add one to build a complete design and renovation report.</div>}</div>
        <div className="project-detail-section"><h3><Send size={15} /> Contractor enquiry</h3><p className="project-enquiry-note">Share this project brief with a contractor. Requests are recorded for a DreamSpace follow-up; live contractor matching is not enabled in this build.</p>{enquiryDone ? <div className="project-enquiry-done"><Check size={15} /> {enquiryDone}</div> : <form className="project-enquiry-form" onSubmit={submitEnquiry}><div className="project-enquiry-grid"><label>Your name<input required minLength={2} maxLength={80} value={enquiry.name} onChange={(event) => setEnquiry({ ...enquiry, name: event.target.value })} /></label><label>Phone<input required type="tel" inputMode="tel" pattern="[0-9+()\s-]{7,20}" maxLength={20} placeholder="98765 43210" value={enquiry.phone} onChange={(event) => setEnquiry({ ...enquiry, phone: event.target.value })} /></label><label>City<input required minLength={2} maxLength={80} value={enquiry.city} onChange={(event) => setEnquiry({ ...enquiry, city: event.target.value })} /></label></div><label>What should the contractor know?<textarea required minLength={5} maxLength={1000} rows={3} placeholder="Scope, timeline, preferred visit time…" value={enquiry.message} onChange={(event) => setEnquiry({ ...enquiry, message: event.target.value })} /></label><button type="submit" className="ds-button ds-button-dark" disabled={enquiryBusy}>{enquiryBusy ? <><LoaderCircle className="project-spin" size={14} /> Recording…</> : <><Send size={14} /> Send enquiry</>}</button></form>}</div>
      </div>
      <footer className="project-detail-footer"><button className="project-delete-button" disabled={busy} onClick={removeProject}><Trash2 size={15} /> Delete</button><button className="project-add-estimate" disabled={busy} onClick={addEstimate}><Ruler size={15} /> {report ? 'Update estimate' : 'Add measurements & estimate'}</button><button className="ds-button ds-button-dark project-pdf-button" disabled={busy} onClick={generateReport}>{busy ? <LoaderCircle className="project-spin" size={15} /> : <ArrowDownToLine size={15} />}{busy ? 'Preparing PDF…' : 'Download PDF report'}</button></footer>
    </section>
  </div>;
}

function Fact({ label, value }) { return <div className="project-detail-fact"><small>{label}</small><b>{value}</b></div>; }
