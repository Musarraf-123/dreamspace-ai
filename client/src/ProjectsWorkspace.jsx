import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Heart, Layers3, Plus, Search } from 'lucide-react';
import { api, assetUrl } from './lib/api.js';
import ProjectDetailModal from './ProjectDetailModal.jsx';

const filters = ['All projects', 'Favourites', 'Interior', 'Exterior', '3D Studio', 'Renovation', 'Archived'];
const typeFor = (project) => ({ interior: 'Interior', exterior: 'Exterior', '3d': '3D Studio', renovation: 'Renovation' }[project.type] || project.kind || 'Interior');
const imageFor = (project) => {
  const latest = project.generations?.at(-1);
  if (latest?.generatedAssetId) return assetUrl(`/api/design-assets/${latest.generatedAssetId}`);
  if (project.image?.startsWith('/api/') || project.image?.startsWith('http') || project.image?.startsWith('data:') || project.image?.startsWith('blob:')) return project.image;
  if (project.referenceAssetId) return assetUrl(`/api/design-assets/${project.referenceAssetId}`);
  const imageId = project.imageKey || project.image || 'photo-1600210492486-724fe5c67fb0';
  return `https://images.unsplash.com/${imageId}?auto=format&fit=crop&w=900&q=85`;
};

export default function ProjectsWorkspace({ projects, navigate, notify, user, onProjectsChange }) {
  const [filter, setFilter] = useState('All projects');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [loadingId, setLoadingId] = useState('');
  const [pageError, setPageError] = useState('');
  const [archivedProjects, setArchivedProjects] = useState([]);

  const visibleProjects = useMemo(() => {
    const base = filter === 'Archived' ? archivedProjects : projects.filter((project) => !project.archived);
    return base.filter((project) => {
      const matchesFilter = filter === 'All projects' || filter === 'Archived'
        || (filter === 'Favourites' ? Boolean(project.favorite) : typeFor(project) === filter);
      const matchesSearch = `${project.title} ${project.room || ''} ${project.style || ''}`.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [projects, archivedProjects, filter, search]);

  const refresh = async () => {
    if (!user) return;
    const result = await api('/projects');
    onProjectsChange(result.data);
  };
  const loadArchived = async () => {
    if (!user) { setArchivedProjects(projects.filter((project) => project.archived)); return; }
    const result = await api('/projects?archived=1');
    setArchivedProjects(result.data);
  };
  useEffect(() => {
    if (filter === 'Archived') loadArchived().catch((error) => setPageError(error.message));
  }, [filter, user]);
  const openProject = async (project) => {
    setPageError('');
    setLoadingId(project.id);
    try {
      const result = user && /^[a-f\d]{24}$/i.test(project.id) ? await api(`/projects/${project.id}`) : { data: project };
      setSelected(result.data);
    } catch (error) { setPageError(error.message); }
    finally { setLoadingId(''); }
  };
  const updateProject = async (project, updates) => {
    if (user && /^[a-f\d]{24}$/i.test(project._id || project.id)) {
      const id = project._id || project.id;
      const result = await api(`/projects/${id}`, { method: 'PATCH', body: updates });
      setSelected(result.data);
      await refresh();
      return result.data;
    }
    const updated = { ...project, ...updates };
    setSelected(updated);
    onProjectsChange(projects.map((item) => item.id === project.id ? updated : item));
    return updated;
  };
  const duplicateProject = async (project) => {
    const id = project._id || project.id;
    try {
      if (user && /^[a-f\d]{24}$/i.test(id)) {
        await api(`/projects/${id}/duplicate`, { method: 'POST' });
        await refresh();
      } else {
        const copy = { ...project, id: crypto.randomUUID(), title: `${project.title} — copy`.slice(0, 100), favorite: false, archived: false, shareToken: undefined, created: 'Just now' };
        onProjectsChange([copy, ...projects]);
      }
      setSelected(null);
      notify('Project duplicated. You can edit the copy independently.');
    } catch (error) { setPageError(error.message); }
  };
  const archiveProject = async (project, archived) => {
    const id = project._id || project.id;
    try {
      if (user && /^[a-f\d]{24}$/i.test(id)) {
        await api(`/projects/${id}`, { method: 'PATCH', body: { archived } });
        await refresh();
        if (filter === 'Archived') await loadArchived();
      } else {
        onProjectsChange(projects.map((item) => (item._id || item.id) === id ? { ...item, archived } : item));
        setArchivedProjects((current) => archived ? [...current, { ...project, archived: true }] : current.filter((item) => (item._id || item.id) !== id));
      }
      setSelected(null);
      notify(archived ? 'Project archived. You can restore it from the Archived tab.' : 'Project restored to your workspace.');
    } catch (error) { setPageError(error.message); }
  };
  const shareProject = async (project) => {
    const id = project._id || project.id;
    if (!user || !/^[a-f\d]{24}$/i.test(id)) throw new Error('Sign in to create a view-only share link.');
    const result = await api(`/projects/${id}/share`, { method: 'POST' });
    setSelected((current) => current ? { ...current, shareToken: result.data.shareToken, sharedAt: result.data.sharedAt } : current);
    return result.data;
  };
  const stopSharing = async (project) => {
    const id = project._id || project.id;
    await api(`/projects/${id}/share`, { method: 'DELETE' });
    setSelected((current) => current ? { ...current, shareToken: undefined, sharedAt: undefined } : current);
    notify('The shared link has been turned off.');
  };
  const deleteProject = async (project) => {
    const confirmed = window.confirm(`Delete “${project.title}” and its saved images? This cannot be undone.`);
    if (!confirmed) return;
    try {
      if (user && /^[a-f\d]{24}$/i.test(project._id || project.id)) await api(`/projects/${project._id || project.id}`, { method: 'DELETE' });
      if (user) await refresh();
      else onProjectsChange(projects.filter((item) => item.id !== project.id));
      setArchivedProjects((current) => current.filter((item) => (item._id || item.id) !== (project._id || project.id)));
      setSelected(null);
      notify('Project and saved images deleted.');
    } catch (error) { throw error; }
  };

  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setSelected(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected]);

  return <section className="projects-workspace">
    <div className="projects-toolbar"><div className="projects-toolbar-left"><div className="filter-tabs">{filters.map((item) => <button key={item} onClick={() => setFilter(item)} className={filter === item ? 'filter-active' : ''}>{item}</button>)}</div><label className="projects-search"><Search size={15} /><input aria-label="Search projects" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your projects" /></label></div><button className="ds-button ds-button-dark" onClick={() => navigate('Interior Design')}><Plus size={15} /> New design</button></div>
    {pageError && <div className="projects-inline-error" role="alert">{pageError}<button onClick={() => setPageError('')}>Dismiss</button></div>}
    {visibleProjects.length ? <div className="projects-rich-grid">{visibleProjects.map((project) => <article className="project-tile" key={project._id || project.id}>
      <button className="project-tile-cover" onClick={() => openProject(project)} aria-label={`Open details for ${project.title}`}><img src={imageFor(project)} alt="" crossOrigin="use-credentials" /><span className="project-tile-kind">{typeFor(project)}</span><span className="project-tile-arrow">{loadingId === project.id ? 'Opening…' : <ArrowUpRight size={16} />}</span></button>
      <div className="project-tile-info"><button className="project-tile-title" onClick={() => openProject(project)}>{project.title}</button><p>{project.roomType || project.room || 'Home redesign'}{project.style ? ` · ${project.style}` : ''}</p><div className="project-tile-footer"><span>{project.estimateReport?.expected || project.estimate ? `Estimate ${new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(project.estimateReport?.expected || project.estimate)}` : project.created || 'Saved project'}</span><button aria-label={`${project.favorite ? 'Remove from' : 'Add to'} favourites`} className={project.favorite ? 'project-favourite active' : 'project-favourite'} onClick={async () => { try { await updateProject(project, { favorite: !project.favorite }); } catch (error) { setPageError(error.message); } }}><Heart size={15} fill={project.favorite ? 'currentColor' : 'none'} /></button></div></div>
    </article>)}</div> : <div className="projects-empty"><span><Layers3 size={24} /></span><h3>{filter === 'Archived' ? 'Nothing archived' : filter === 'Favourites' ? 'No favourites yet' : search ? 'No matching projects' : 'A space for your best ideas'}</h3><p>{filter === 'Archived' ? 'Projects you archive are kept here and can be restored anytime.' : filter === 'Favourites' ? 'Tap the heart on any project to keep it close.' : 'Save a design or renovation estimate and it will be ready to revisit here.'}</p>{!search && filter !== 'Archived' && <button className="ds-button ds-button-dark" onClick={() => navigate('Interior Design')}><Plus size={15} /> Start a design</button>}</div>}
    {selected && <ProjectDetailModal project={selected} onClose={() => setSelected(null)} onUpdate={updateProject} onDelete={deleteProject} onDuplicate={duplicateProject} onArchive={archiveProject} onShare={shareProject} onStopShare={stopSharing} isGuest={!user} navigate={navigate} notify={notify} />}
  </section>;
}
