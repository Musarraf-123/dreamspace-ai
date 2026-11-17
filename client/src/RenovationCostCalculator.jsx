import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, Check, CircleHelp, FileImage, ImagePlus, IndianRupee, Layers3, Plus, Printer, Ruler, ShieldCheck, ShoppingBag, Tag, Trash2, X } from 'lucide-react';
import { api, apiForm } from './lib/api.js';
import { calculateRenovationEstimate, CITIES, RENOVATION_TYPES } from './lib/renovationCalculator.js';

const initialForm = { length: '14', width: '12', height: '10', openingsArea: '0', city: 'Pune', renovationType: 'Full room renovation', quality: 'Standard' };
const currency = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const quantityText = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);

export default function RenovationCostCalculator({ notify, addProject, projects = [], user, attachEstimate, refreshProjects }) {
  const [form, setForm] = useState(initialForm);
  const [quantityOverrides, setQuantityOverrides] = useState({});
  const [rateOverrides, setRateOverrides] = useState({});
  const [attachTo, setAttachTo] = useState(() => sessionStorage.getItem('dreamspace-attach-estimate-to') || '');
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState('');
  const [referenceFile, setReferenceFile] = useState(null);
  const [referencePreview, setReferencePreview] = useState('');
  const [rooms, setRooms] = useState(() => (Array.isArray(projects.find((project) => project.id === sessionStorage.getItem('dreamspace-attach-estimate-to'))?.rooms) ? projects.find((project) => project.id === sessionStorage.getItem('dreamspace-attach-estimate-to')).rooms : []));
  const [roomDraft, setRoomDraft] = useState({ name: '', length: '', width: '', height: '' });
  const referenceRef = useRef(null);
  const estimate = useMemo(() => calculateRenovationEstimate(form, { quantityOverrides, rateOverrides, rateCard: catalog }), [form, quantityOverrides, rateOverrides, catalog]);
  const input = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const setQuantity = (key, value) => setQuantityOverrides((current) => ({ ...current, [key]: value }));
  const setRate = (key, value) => setRateOverrides((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    let active = true;
    setCatalogError('');
    api(`/catalog?city=${encodeURIComponent(form.city)}&quality=${encodeURIComponent(form.quality)}`)
      .then(({ data }) => { if (active) setCatalog(data); })
      .catch(() => { if (active) { setCatalog(null); setCatalogError('Live rate card unavailable; built-in planning allowances are being used.'); } });
    return () => { active = false; };
  }, [form.city, form.quality]);

  useEffect(() => { setRateOverrides({}); }, [form.city, form.quality]);
  useEffect(() => () => { if (referencePreview.startsWith('blob:')) URL.revokeObjectURL(referencePreview); }, [referencePreview]);

  const onReferencePhoto = (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return notify('Choose a JPG, PNG or WebP reference photo.');
    if (file.size > 8 * 1024 * 1024) return notify('Choose a reference photo under 8 MB.');
    if (referencePreview.startsWith('blob:')) URL.revokeObjectURL(referencePreview);
    setReferenceFile(file);
    setReferencePreview(URL.createObjectURL(file));
  };
  const clearReference = () => {
    if (referencePreview.startsWith('blob:')) URL.revokeObjectURL(referencePreview);
    setReferenceFile(null); setReferencePreview('');
    if (referenceRef.current) referenceRef.current.value = '';
  };
  const uploadReference = async (projectId) => {
    if (!referenceFile || !user) return;
    const formData = new FormData(); formData.append('image', referenceFile);
    await apiForm(`/projects/${projectId}/reference`, formData);
  };

  const reportPayload = () => ({
    measurements: {
      length: Number(form.length), width: Number(form.width), height: Number(form.height),
      openingsArea: Number(form.openingsArea) || 0, unit: 'ft', city: form.city,
    },
    estimateReport: {
      renovationType: form.renovationType, quality: form.quality,
      low: estimate.totals.low, expected: estimate.totals.expected, high: estimate.totals.high, currency: 'INR',
      items: estimate.rows.map(({ key, name, quantity, unit, rate, low, expected, high }) => ({ key, name, quantity, unit, unitRate: rate, low, expected, high })),
      shoppingList: estimate.shoppingList.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
      assumptions: estimate.assumptions,
    },
    estimate: estimate.totals.expected,
    rooms: rooms.length ? rooms.map((room) => ({
      name: room.name,
      length: Number(room.length) || undefined,
      width: Number(room.width) || undefined,
      height: Number(room.height) || undefined,
      notes: room.notes,
    })) : undefined,
  });
  const addRoom = () => {
    const name = roomDraft.name.trim();
    if (!name) return notify('Give the additional room a name first.');
    if (rooms.length >= 12) return notify('You can add up to 12 rooms to one project.');
    setRooms((current) => [...current, { ...roomDraft, name }]);
    setRoomDraft({ name: '', length: '', width: '', height: '' });
  };
  const removeRoom = (index) => setRooms((current) => current.filter((_, roomIndex) => roomIndex !== index));
  const save = async () => {
    if (!estimate.valid || !estimate.totals) return;
    let photoWarning = '';
    try {
      if (attachTo && user && attachEstimate) {
        await attachEstimate(attachTo, reportPayload());
        if (referenceFile && user) {
          try { await uploadReference(attachTo); } catch { photoWarning = ' The reference photo could not be uploaded.'; }
        }
        await refreshProjects?.();
        sessionStorage.removeItem('dreamspace-attach-estimate-to'); setAttachTo('');
        notify(`Estimate attached to the design report in My Projects.${photoWarning}`);
        return;
      }
      const saved = await addProject({
        title: `${form.renovationType} estimate`, kind: 'Renovation',
        room: `${form.length} × ${form.width} × ${form.height} ft · ${form.city}`,
        style: `${form.quality} quality`, image: user ? undefined : referencePreview || 'photo-1600566753086-00f18fb6b3ea',
        estimate: estimate.totals.expected,
        prompt: `Indicative ${form.renovationType} estimate in ${form.city}. Expected: ${currency(estimate.totals.expected)}; range ${currency(estimate.totals.low)} to ${currency(estimate.totals.high)}.`,
        ...reportPayload(),
      });
      if (referenceFile && user && saved?.id) {
        try { await uploadReference(saved.id); await refreshProjects?.(); } catch { photoWarning = ' The reference photo could not be uploaded.'; }
      }
      notify(`Estimate saved to My Projects.${photoWarning}`);
    } catch (error) { notify(error.message); }
  };

  return <div className="cost-calculator">
    <section className="cost-intro"><div><span className="cost-eyebrow"><Ruler size={14} /> ROOM-BY-ROOM PLANNING</span><h2>A clearer picture of <em>the costs.</em></h2><p>Enter your room dimensions and renovation scope for an itemized estimate in Indian rupees.</p></div><span className="cost-intro-icon"><IndianRupee size={24} /></span></section>
    <div className="cost-main-grid">
      <section className="cost-input-card">
        <div className="cost-card-heading"><span><Ruler size={17} /></span><div><b>Room & project details</b><small>Measurements are in feet.</small></div></div>
        <div className="cost-dimensions">
          {[['length', 'Length', '3', '60'], ['width', 'Width', '3', '60'], ['height', 'Height', '7', '20'], ['openingsArea', 'Openings', '0', '500']].map(([key, label, min, max]) => <label className="cost-field" key={key}><span>{label} <small>({key === 'openingsArea' ? 'sq. ft.' : 'ft'})</small></span><input type="number" min={min} max={max} step="0.5" value={form[key]} onChange={(event) => input(key, event.target.value)} aria-invalid={Boolean(estimate.errors[key])} aria-describedby={estimate.errors[key] ? `${key}-error` : undefined} /><small className="cost-field-error" id={`${key}-error`}>{estimate.errors[key] || (key === 'openingsArea' ? 'Doors + windows, 0–500' : `Between ${min}–${max} ft`)}</small></label>)}
        </div>
        <div className="cost-validation-note"><CircleHelp size={14} /> Door and window opening area is subtracted from the wall area. Floor area is limited to 2,000 sq. ft.</div>
        <div className="cost-rooms">
          <div className="cost-rooms-head"><span><Layers3 size={15} /></span><div><b>Other rooms in this project</b><small>The estimate above covers the primary room. Extra rooms are saved to the project brief.</small></div></div>
          {rooms.length > 0 && <ul className="cost-room-list">{rooms.map((room, index) => <li key={`${room.name}-${index}`}><span><b>{room.name}</b><small>{[room.length && room.width ? `${room.length} × ${room.width} ft` : '', room.height ? `${room.height} ft high` : ''].filter(Boolean).join(' · ') || 'Dimensions not added'}</small></span><button type="button" aria-label={`Remove ${room.name}`} onClick={() => removeRoom(index)}><Trash2 size={13} /></button></li>)}</ul>}
          <div className="cost-room-form">
            <input aria-label="Additional room name" placeholder="Room name, e.g. Kitchen" maxLength={60} value={roomDraft.name} onChange={(event) => setRoomDraft({ ...roomDraft, name: event.target.value })} />
            <input aria-label="Additional room length" type="number" min="0" max="60" step="0.5" placeholder="Length" value={roomDraft.length} onChange={(event) => setRoomDraft({ ...roomDraft, length: event.target.value })} />
            <input aria-label="Additional room width" type="number" min="0" max="60" step="0.5" placeholder="Width" value={roomDraft.width} onChange={(event) => setRoomDraft({ ...roomDraft, width: event.target.value })} />
            <input aria-label="Additional room height" type="number" min="0" max="20" step="0.5" placeholder="Height" value={roomDraft.height} onChange={(event) => setRoomDraft({ ...roomDraft, height: event.target.value })} />
            <button type="button" onClick={addRoom}><Plus size={14} /> Add room</button>
          </div>
        </div>
        <label className="cost-form-label" htmlFor="cost-city">City</label>
        <select id="cost-city" className="ds-select" value={form.city} onChange={(event) => input('city', event.target.value)}>{Object.keys(CITIES).map((city) => <option key={city}>{city}</option>)}</select>
        <label className="cost-form-label" htmlFor="cost-type">Renovation type</label>
        <select id="cost-type" className="ds-select" value={form.renovationType} onChange={(event) => input('renovationType', event.target.value)}>{Object.keys(RENOVATION_TYPES).map((type) => <option key={type}>{type}</option>)}</select>
        <p className="cost-scope-note">{RENOVATION_TYPES[form.renovationType]}</p>
        <label className="cost-form-label">Quality level</label>
        <div className="cost-quality-options">{[['Basic', 'Practical essentials'], ['Standard', 'Balanced everyday finish'], ['Premium', 'Higher-end materials']].map(([level, description]) => <button type="button" key={level} className={form.quality === level ? 'selected' : ''} onClick={() => input('quality', level)}><span><b>{level}</b><small>{description}</small></span>{form.quality === level && <Check size={16} />}</button>)}</div>
        <label className="cost-form-label" htmlFor="cost-reference">Reference photo <small>Optional</small></label>
        <input ref={referenceRef} id="cost-reference" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => onReferencePhoto(event.target.files?.[0])} />
        <button type="button" className={`cost-reference ${referencePreview ? 'has-photo' : ''}`} onClick={() => referenceRef.current?.click()}>
          {referencePreview ? <><img src={referencePreview} alt="Reference space" /><span><b>{referenceFile?.name}</b><small>Click to replace this reference photo</small></span><Check size={17} /></> : <><span className="cost-reference-icon"><ImagePlus size={19} /></span><span><b>Add a room or house photo</b><small>JPG, PNG or WebP · up to 8 MB{user ? ' · stored privately with the estimate' : ' · sign in to store it'}</small></span></>}
        </button>
        {referencePreview && <button type="button" className="cost-reference-remove" onClick={clearReference}><X size={13} /> Remove reference photo</button>}
        {user && projects.length > 0 && <><label className="cost-form-label" htmlFor="cost-attach-project">Attach this estimate to a saved project</label><select id="cost-attach-project" className="ds-select" value={attachTo} onChange={(event) => setAttachTo(event.target.value)}><option value="">Save as a new estimate project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></>}
        <div className="cost-edit-note"><Check size={14} /> You can edit each quantity and assumed unit rate below.</div>
        <button className="ds-button ds-button-dark cost-print" type="button" onClick={() => window.print()}><Printer size={15} /> Print or save as PDF</button>
      </section>

      <section className="cost-results">
        <div className="cost-total-card"><div className="cost-total-header"><span><IndianRupee size={15} /> ROOM ESTIMATE</span><span>{form.city} · {form.quality}</span></div>
          {estimate.totals ? <><div className="cost-range-cards"><div><small>LOW</small><b>{currency(estimate.totals.low)}</b></div><div className="expected"><small>EXPECTED</small><b>{currency(estimate.totals.expected)}</b></div><div><small>HIGH</small><b>{currency(estimate.totals.high)}</b></div></div><p className="cost-area-summary">{quantityText(estimate.dimensions.floorArea)} sq. ft. floor · {quantityText(estimate.dimensions.wallArea)} sq. ft. wall area{estimate.dimensions.openingsArea ? ` after ${quantityText(estimate.dimensions.openingsArea)} sq. ft. openings` : ''}</p><p className="cost-area-summary">{catalog ? `Rate card dated ${catalog.effectiveDate}` : catalogError || 'Using built-in planning allowances'}</p></> : <div className="cost-invalid-summary" role="status">Correct the room measurements to see your estimate.</div>}
        </div>
        <div className="cost-items-card"><div className="cost-section-heading"><div><h3>Itemized estimate</h3><p>Materials, labour lines, transport, contingency and tax. Edit any quantity or rate.</p></div><span>INR</span></div>
          <div className="cost-table-scroll"><table className="cost-table"><thead><tr><th>Item</th><th>Quantity</th><th>Unit rate</th><th>Low</th><th>Expected</th><th>High</th></tr></thead><tbody>{estimate.rows.map((row) => <tr key={row.key} className={row.quantity === 0 ? 'cost-out-of-scope' : ''}><td><b>{row.name}</b><small>{row.unit}{row.quantity === 0 ? ' · out of scope' : ''}</small></td><td><label className="cost-edit"><input aria-label={`${row.name} quantity`} type="number" min="0" step="0.01" value={quantityOverrides[row.key] ?? row.quantity} onChange={(event) => setQuantity(row.key, event.target.value)} /><span>{row.unit === '% of subtotal' ? '%' : ''}</span></label></td><td><label className="cost-edit"><span>₹</span><input aria-label={`${row.name} assumed unit rate`} type="number" min="0" step="0.01" value={rateOverrides[row.key] ?? row.rate} onChange={(event) => setRate(row.key, event.target.value)} /></label><small className="cost-rate-unit">{row.unit === '% of subtotal' ? 'per 1%' : `per ${row.unit}`}</small></td><td>{currency(row.low)}</td><td className="cost-expected-cell">{currency(row.expected)}</td><td>{currency(row.high)}</td></tr>)}</tbody>{estimate.totals && <tfoot><tr><td colSpan="4">Expected project total</td><td>{currency(estimate.totals.expected)}</td><td /></tr></tfoot>}</table></div>
          {!estimate.valid && Object.entries(estimate.errors).some(([key]) => key.startsWith('override-')) && <p className="cost-override-error" role="alert">Enter non-negative quantities and rates using valid numbers.</p>}
          <div className="cost-save-row"><p><ShieldCheck size={14} /> Indicative planning estimate only. Not a guaranteed contractor quote.</p><button type="button" onClick={save} disabled={!estimate.valid || !estimate.totals}><FileImage size={14} /> {attachTo ? 'Attach estimate' : 'Save estimate'}</button></div>
        </div>
        <details className="cost-catalogue">
          <summary><span><Tag size={15} /> Material catalogue</span><small>{catalog ? `Rates dated ${catalog.effectiveDate}` : 'Built-in allowances'}</small></summary>
          <p className="cost-catalogue-source">{catalog?.source || catalogError || 'Live rate card unavailable; showing built-in planning allowances.'}</p>
          {catalog?.materials?.length ? <div className="cost-catalogue-list">{catalog.materials.map((material) => <div key={material.sku} className={Number(rateOverrides[material.category]) === material.rate ? 'selected' : ''}><span><b>{material.brand} · {material.name}</b><small>{material.categoryName} · {material.tier} · per {material.unit}</small></span><b>{currency(material.rate)}</b><button type="button" onClick={() => setRate(material.category, material.rate)}>Use rate</button></div>)}</div> : <p className="cost-catalogue-source">Catalogue options will appear when the rate card loads.</p>}
          <p className="cost-catalogue-note">Choosing a product sets that category's rate; you can still edit it in the table. Prices are editable planning allowances, not live quotes.</p>
        </details>
        <div className="cost-shopping-card"><div className="cost-section-heading"><div><h3><ShoppingBag size={17} /> Material shopping list</h3><p>Starting quantities include the assumptions shown below.</p></div><ArrowDownToLine size={16} /></div>{estimate.shoppingList.length ? <div className="cost-shopping-list">{estimate.shoppingList.map((item) => <div key={item.key}><span><Check size={13} /> {item.name}</span><b>{quantityText(item.quantity)} <small>{item.unit}</small></b></div>)}</div> : <div className="cost-shopping-empty">No material quantities in this scope. Pick a renovation type or add quantities above.</div>}
          <details className="cost-assumptions"><summary>See calculation assumptions</summary><ul>{estimate.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></details>
          <p className="cost-tax-note">Tax is an editable planning allowance, not a GST determination. GST treatment and rates can differ by materials, labour/service and contract structure; confirm with your contractor or tax adviser.</p>
        </div>
      </section>
    </div>
    <aside className="cost-disclaimer"><ShieldCheck size={16} /><p><b>Indicative, not guaranteed.</b> Actual prices vary with site condition, brand, finish selection, access, local availability, labour and contractor scope. Use this for early planning and compare written local quotes before committing.</p></aside>
  </div>;
}
