import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ArrowDownToLine, ArrowRight, Check, CheckCircle2, ImagePlus, LoaderCircle, LockKeyhole, RefreshCw, Save, ScanLine, Share2, Sparkles, Upload, WandSparkles, X } from 'lucide-react';
import { api, apiForm, assetUrl, downloadAsset } from './lib/api.js';

const options = {
  interior: ['Living room', 'Bedroom', 'Kitchen', 'Dining room', 'Bathroom', 'Home office', 'Balcony'],
  exterior: ['Independent home', 'Apartment facade', 'Entryway', 'Terrace', 'Garden', 'Compound wall'],
  '3d': ['Living room', 'Bedroom', 'Kitchen', 'Dining room', 'Bathroom', 'Home office', 'Balcony'],
};
const styles = ['Warm minimal', 'Modern Indian', 'Contemporary', 'Japandi', 'Traditional', 'Coastal', 'Earthy contemporary'];
const palettes = ['Warm neutrals', 'Forest & cream', 'Terracotta & sand', 'Ivory & teak', 'Jewel tones', 'Monochrome'];
const budgets = ['Under ₹2 lakh', '₹2–5 lakh', '₹5–10 lakh', '₹10–20 lakh', '₹20 lakh+'];
const layouts = ['Open plan', 'Galley', 'L-shaped', 'U-shaped', 'Closed rooms', 'Not sure'];
const modeLabels = { interior: 'Interior', exterior: 'Exterior', '3d': '3D Studio' };

export default function RedesignWorkflow({ mode: initialMode, projects, notify, user, onNavigate, onAuth, onProjectsChange }) {
  const [mode, setMode] = useState(initialMode);
  const [roomType, setRoomType] = useState(initialMode === 'exterior' ? options.exterior[0] : 'Living room');
  const [style, setStyle] = useState('Warm minimal');
  const [palette, setPalette] = useState('Warm neutrals');
  const [budget, setBudget] = useState('₹2–5 lakh');
  const [layout, setLayout] = useState('Not sure');
  const [doors, setDoors] = useState('0');
  const [windows, setWindows] = useState('0');
  const [analysisNote, setAnalysisNote] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [file, setFile] = useState(null);
  const [sourcePreview, setSourcePreview] = useState('');
  const [design, setDesign] = useState(null);
  const [compare, setCompare] = useState(50);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('Preparing your photo…');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [takingPhoto, setTakingPhoto] = useState(false);
  const fileRef = useRef(null);
  const stageTimer = useRef(null);

  useEffect(() => {
    if (initialMode !== mode) setMode(initialMode);
  }, [initialMode]);
  useEffect(() => () => {
    if (sourcePreview.startsWith('blob:')) URL.revokeObjectURL(sourcePreview);
    window.clearInterval(stageTimer.current);
  }, [sourcePreview]);

  const chooseMode = (value) => {
    setMode(value);
    setRoomType(value === 'exterior' ? options.exterior[0] : options.interior[0]);
    onNavigate(value === 'exterior' ? 'Exterior Design' : value === '3d' ? '3D Studio' : 'Interior Design');
  };
  const onFile = (nextFile) => {
    setError('');
    if (!nextFile) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(nextFile.type)) return setError('Choose a JPG, PNG or WebP photo.');
    if (nextFile.size > 8 * 1024 * 1024) return setError('Choose a photo under 8 MB.');
    if (sourcePreview.startsWith('blob:')) URL.revokeObjectURL(sourcePreview);
    setFile(nextFile); setSourcePreview(URL.createObjectURL(nextFile)); setDesign(null); setSaved(false);
    setAnalysisNote(''); setLayout('Not sure'); setDoors('0'); setWindows('0');
  };
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const restored = sessionStorage.getItem('dreamspace-restored-camera-photo');
    if (!restored) return;
    sessionStorage.removeItem('dreamspace-restored-camera-photo');
    try {
      const photo = JSON.parse(restored);
      if (!photo.webPath) return;
      fetch(photo.webPath).then((response) => response.blob()).then((blob) => {
        const mime = blob.type.startsWith('image/') ? blob.type : photo.format === 'png' ? 'image/png' : 'image/jpeg';
        onFile(new File([blob], `dreamspace-photo.${photo.format || 'jpg'}`, { type: mime }));
      }).catch(() => setError('The photo was selected, but DreamSpace could not reopen it. Please choose the photo again.'));
    } catch { setError('The photo selection could not be restored. Please choose it again.'); }
  }, []);
  const takeOrChoosePhoto = async () => {
    setTakingPhoto(true); setError('');
    try {
      const photo = await Camera.getPhoto({ quality: 90, allowEditing: false, resultType: CameraResultType.Uri, source: CameraSource.Prompt });
      if (!photo.webPath) throw new Error('The selected photo could not be opened. Try choosing it from Files instead.');
      const response = await fetch(photo.webPath);
      if (!response.ok) throw new Error('Could not read the selected photo. Please try again.');
      const blob = await response.blob();
      const mime = blob.type.startsWith('image/') ? blob.type : photo.format === 'png' ? 'image/png' : 'image/jpeg';
      onFile(new File([blob], `dreamspace-photo.${photo.format || 'jpg'}`, { type: mime }));
    } catch (cause) {
      if (!/cancel|user cancelled/i.test(cause.message || '')) setError(cause.message || 'Camera and photo access failed. You can still choose an image file.');
    } finally { setTakingPhoto(false); }
  };
  const refreshProjects = async () => {
    if (!user || !onProjectsChange) return;
    try { const result = await api('/projects'); onProjectsChange(result.data); } catch { /* keep the current workspace list */ }
  };
  const generate = async () => {
    setError('');
    if (!file) return setError('Upload a photo of your room or house to begin.');
    if (!user) return setError('Sign in or create a free account to generate and securely save designs.');
    const form = new FormData();
    form.append('image', file); form.append('mode', mode); form.append('roomType', roomType);
    form.append('style', style); form.append('palette', palette); form.append('budget', budget); form.append('instructions', instructions);
    form.append('layout', layout); form.append('doors', doors || '0'); form.append('windows', windows || '0');
    if (design?.projectId) form.append('projectId', design.projectId);
    setBusy(true); setSaved(false); setStage('Preparing your photo…');
    const stages = ['Sending your photo securely…', 'Reimagining your space…', 'Finishing the details…'];
    let index = 0;
    stageTimer.current = window.setInterval(() => { index = (index + 1) % stages.length; setStage(stages[index]); }, 7000);
    try {
      const { data } = await apiForm('/designs', form);
      setDesign({ ...data, title: `${roomType} — ${style}`, roomType, style, mode }); setCompare(50);
      await refreshProjects();
    } catch (cause) { setError(cause.message || 'We could not create this design. Try again.'); }
    finally { window.clearInterval(stageTimer.current); setBusy(false); }
  };
  const saveDesign = async () => {
    if (!design?.projectId) return;
    try { await api(`/projects/${design.projectId}/save`, { method: 'POST', body: {} }); setSaved(true); await refreshProjects(); notify('Design saved to My Projects.'); }
    catch (cause) { setError(cause.message || 'Unable to save this design.'); }
  };
  const analyseSpace = async () => {
    setError(''); setAnalysisNote('');
    if (!file) return setError('Upload a photo before analysing the space.');
    if (!user) return setError('Sign in to analyse your space.');
    setAnalysing(true);
    try {
      const form = new FormData(); form.append('image', file);
      const { data } = await apiForm('/designs/analyze', form);
      const suggestion = String(data.roomType || '').toLowerCase();
      const match = options[mode].find((option) => option.toLowerCase() === suggestion);
      if (match) setRoomType(match);
      setLayout(layouts.includes(data.layout) ? data.layout : 'Not sure');
      setDoors(String(data.doors ?? 0)); setWindows(String(data.windows ?? 0));
      setAnalysisNote([data.notes, match ? '' : data.roomType ? `Suggested space: ${data.roomType}.` : '', 'Review these before generating.'].filter(Boolean).join(' '));
      notify('Space analysis added to your design brief.');
    } catch (cause) { setAnalysisNote(cause.message || 'Space analysis is unavailable. Choose the layout and openings manually.'); }
    finally { setAnalysing(false); }
  };
  const shareDesign = async () => {
    if (!design?.generatedAssetId) return;
    setError(''); setSharing(true);
    try {
      const response = await fetch(assetUrl(`/api/design-assets/${design.generatedAssetId}`), { credentials: 'include' });
      if (!response.ok) throw new Error('Unable to prepare this image for sharing.');
      const blob = await response.blob();
      const sharedFile = new File([blob], 'dreamspace-redesign.jpg', { type: blob.type || 'image/jpeg' });
      if (navigator.canShare?.({ files: [sharedFile] })) {
        await navigator.share({ files: [sharedFile], title: design.title, text: 'My DreamSpace AI redesign' });
        notify('Design shared.');
      } else {
        await downloadAsset(`/api/design-assets/${design.generatedAssetId}?download=1`, 'dreamspace-redesign.jpg');
        notify('Sharing is not supported here, so the image was downloaded instead.');
      }
    } catch (cause) {
      if (cause.name !== 'AbortError') setError(cause.message || 'Unable to share this image.');
    } finally { setSharing(false); }
  };
  const download = async () => {
    if (!design?.generatedAssetId) return;
    setDownloading(true);
    try { await downloadAsset(`/api/design-assets/${design.generatedAssetId}?download=1`, 'dreamspace-redesign.jpg'); }
    catch (cause) { setError(cause.message || 'Unable to download this image.'); }
    finally { setDownloading(false); }
  };

  const afterUrl = design ? assetUrl(design.generatedAssetUrl) : '';
  const beforeUrl = design ? assetUrl(design.originalAssetUrl) : '';
  return <div className="redesign-workflow">
    <section className="redesign-intro"><div><span className="redesign-eyebrow"><Sparkles size={14} /> AI HOME REDESIGN</span><h2>See your space <em>in a new light.</em></h2><p>Start with a real photo. Explore a thoughtful redesign shaped around your home and budget.</p></div><span className="redesign-secure"><LockKeyhole size={14} /> Private to your account</span></section>
    <div className="redesign-mode-tabs" role="tablist" aria-label="Design mode">{Object.entries(modeLabels).map(([value, label]) => <button type="button" role="tab" aria-selected={mode === value} className={mode === value ? 'active' : ''} key={value} onClick={() => chooseMode(value)}>{label}</button>)}</div>
    <div className="redesign-layout">
      <section className="redesign-form-card">
        <div className="redesign-card-heading"><span><WandSparkles size={18} /></span><div><b>Shape your redesign</b><small>Choose the details that feel right for your home.</small></div></div>
        <label className="redesign-label" htmlFor="redesign-image">1. Upload a photo <small>Required</small></label>
        <input ref={fileRef} id="redesign-image" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => onFile(event.target.files?.[0])} />
        <button type="button" className={`redesign-upload ${sourcePreview ? 'has-photo' : ''}`} onClick={() => fileRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onFile(event.dataTransfer.files?.[0]); }}>
          {sourcePreview ? <><img src={sourcePreview} alt="Your uploaded space" /><span><b>{file?.name}</b><small>Click to choose a different photo</small></span><CheckCircle2 size={19} /></> : <><span className="redesign-upload-icon"><ImagePlus size={20} /></span><span><b>Choose a room or house photo</b><small>JPG, PNG or WebP · up to 8 MB</small></span><span className="redesign-browse"><Upload size={14} /> Browse</span></>}
        </button>
        {Capacitor.isNativePlatform() && <button type="button" className="redesign-native-photo" onClick={takeOrChoosePhoto} disabled={takingPhoto}><ImagePlus size={14} /> {takingPhoto ? 'Opening photos…' : 'Take a photo or choose from gallery'}</button>}
        <label className="redesign-label" htmlFor="redesign-room">2. Choose your space</label>
        <select id="redesign-room" className="ds-select" value={roomType} onChange={(event) => setRoomType(event.target.value)}>{options[mode].map((option) => <option key={option}>{option}</option>)}</select>
        <div className="redesign-analysis">
          <div className="redesign-analysis-head"><span><ScanLine size={15} /> Space analysis</span><button type="button" className="redesign-analysis-button" onClick={() => (user ? analyseSpace() : onAuth())} disabled={!file || analysing || busy}>{analysing ? 'Analysing…' : user ? 'Analyse photo' : 'Sign in to analyse'}</button></div>
          <div className="redesign-analysis-grid">
            <div><label className="redesign-label" htmlFor="redesign-layout">Layout</label><select id="redesign-layout" className="ds-select" value={layout} onChange={(event) => setLayout(event.target.value)}>{layouts.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div><label className="redesign-label" htmlFor="redesign-doors">Doors</label><input id="redesign-doors" className="ds-select" type="number" min="0" max="20" inputMode="numeric" value={doors} onChange={(event) => setDoors(event.target.value)} /></div>
            <div><label className="redesign-label" htmlFor="redesign-windows">Windows</label><input id="redesign-windows" className="ds-select" type="number" min="0" max="20" inputMode="numeric" value={windows} onChange={(event) => setWindows(event.target.value)} /></div>
          </div>
          <p className="redesign-analysis-note">{analysisNote || (user ? 'Optional: let DreamSpace suggest the room type, layout and visible openings from your photo.' : 'Sign in to analyse your photo, or guide the layout and openings yourself.')}</p>
        </div>
        <label className="redesign-label">3. Design style</label><div className="redesign-chips">{styles.map((item) => <button type="button" className={style === item ? 'selected' : ''} key={item} onClick={() => setStyle(item)}>{item}</button>)}</div>
        <div className="redesign-field-grid"><div><label className="redesign-label" htmlFor="redesign-palette">Colour palette</label><select id="redesign-palette" className="ds-select" value={palette} onChange={(event) => setPalette(event.target.value)}>{palettes.map((item) => <option key={item}>{item}</option>)}</select></div><div><label className="redesign-label" htmlFor="redesign-budget">Budget guide</label><select id="redesign-budget" className="ds-select" value={budget} onChange={(event) => setBudget(event.target.value)}>{budgets.map((item) => <option key={item}>{item}</option>)}</select></div></div>
        <label className="redesign-label" htmlFor="redesign-instructions">Anything else to keep in mind? <small>Optional</small></label><textarea id="redesign-instructions" className="design-prompt" maxLength={1500} rows={3} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Keep the existing sofa, add more natural light, make room for a puja corner…" />
        {error && <div className="redesign-error" role="alert"><span><X size={15} /></span><div><b>We couldn’t finish that</b><p>{error}</p>{!user && <button type="button" onClick={onAuth}>Sign in or create an account <ArrowRight size={13} /></button>}</div></div>}
        <button type="button" className="ds-button ds-button-dark redesign-generate" onClick={generate} disabled={busy}>{busy ? <><LoaderCircle className="redesign-spin" size={17} /> Creating your redesign…</> : <><Sparkles size={16} /> {design ? 'Regenerate design' : 'Generate redesign'} <ArrowRight size={16} /></>}</button>
        <div className="redesign-privacy"><LockKeyhole size={13} /> To make a redesign, your photo and instructions are sent securely to DreamSpace AI and OpenAI. Saved project images are private to your account.</div>
      </section>
      <section className="redesign-canvas" aria-live="polite"><div className="redesign-canvas-head"><div><span className="redesign-canvas-kicker">YOUR DESIGN CANVAS</span><h3>{design ? design.title : 'Your idea, taking shape'}</h3></div>{design && <span className="redesign-ready"><i /> COMPLETE</span>}</div>
        {busy ? <div className="redesign-loading"><div className="redesign-loader-art"><Sparkles size={28} /></div><b>{stage}</b><p>We’re editing your photo while keeping the original layout in view.</p><div className="redesign-progress"><i /></div><small>This can take a minute or two. Keep this page open.</small></div> : design ? <><div className="redesign-compare" style={{ '--compare': `${compare}%` }}><img className="redesign-after" src={afterUrl} alt="AI redesigned version of your space" crossOrigin="use-credentials" /><div className="redesign-before-layer"><img src={beforeUrl} style={{ width: `${10000 / Math.max(compare, 1)}%` }} alt="Original uploaded photo" crossOrigin="use-credentials" /></div><span className="compare-label before">BEFORE</span><span className="compare-label after">AFTER</span><input aria-label="Compare before and after" type="range" min="0" max="100" value={compare} onChange={(event) => setCompare(Number(event.target.value))} /><span className="compare-handle" style={{ left: `${compare}%` }} /></div><div className="redesign-compare-help">Drag the slider to compare your original photo and redesign.</div><div className="redesign-result-actions"><button type="button" className="redesign-action" onClick={generate} disabled={busy}><RefreshCw size={15} /> Regenerate</button><button type="button" className="redesign-action" onClick={download} disabled={downloading}><ArrowDownToLine size={15} /> {downloading ? 'Preparing…' : 'Download'}</button><button type="button" className="redesign-action" onClick={shareDesign} disabled={sharing}><Share2 size={15} /> {sharing ? 'Preparing…' : 'Share'}</button><button type="button" className="ds-button ds-button-dark redesign-save" onClick={saveDesign} disabled={saved}><Save size={15} /> {saved ? <><Check size={15} /> Saved</> : 'Save to My Projects'}</button></div></> : <div className="redesign-empty"><div className="redesign-empty-icon"><ImagePlus size={24} /></div><h3>A fresh perspective starts here.</h3><p>Upload your own space, make a few choices, and your before-and-after redesign will appear right here.</p><div><span><Check size={13} /> Layout-aware prompt</span><span><Check size={13} /> Inspired by Indian homes</span></div></div>}
      </section>
      <aside className="redesign-side"><div className="redesign-tip"><span><Sparkles size={16} /></span><b>Better results start with light</b><p>A clear, well-lit photo from a corner of the room helps the redesign preserve its shape and details.</p></div><div className="redesign-project-count"><small>YOUR SAVED IDEAS</small><b>{projects.length} {projects.length === 1 ? 'project' : 'projects'}</b><button type="button" onClick={() => onNavigate('My Projects')}>View My Projects <ArrowRight size={13} /></button></div></aside>
    </div>
  </div>;
}
