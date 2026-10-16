import { useEffect, useRef, useState } from 'react';
import { useDisciplineVisibilityStore } from '../store/disciplineVisibilityStore';
import { DISCIPLINES, VISIBILITY_PARTS, VIEW_PRESETS, visibilityPreset, type ViewPreset } from '../designer/disciplineVisibility';
import { useAppPreferences } from '../i18n/AppPreferences';
import { StudioIcon } from './StudioIcon';
import './disciplineVisibility.css';

const WORDS = {
  en: { title: 'Layers', all: 'Show all', only: 'Only', close: 'Close', note: 'Hide or isolate a discipline in both views. Quantities and saved objects stay unchanged.', hidden: 'hidden', labels: ['Structure', 'Furniture', 'Foundations & holes', 'Plumbing', 'Electrical & lighting', 'Ventilation & AC', 'Fire protection', 'Cameras & data', 'Garden & trees', 'Solar'] },
  fr: { title: 'Calques', all: 'Tout afficher', only: 'Seul', close: 'Fermer', note: 'Masquez ou isolez une discipline dans les deux vues. Les quantités et objets enregistrés restent inchangés.', hidden: 'masqués', labels: ['Structure', 'Mobilier', 'Fondations et fouilles', 'Plomberie', 'Électricité et éclairage', 'Ventilation et climatisation', 'Protection incendie', 'Caméras et données', 'Jardin et arbres', 'Solaire'] },
  'zh-CN': { title: '图层', all: '显示全部', only: '仅此', close: '关闭', note: '在二维和三维视图中隐藏或单独显示专业图层。工程量和保存的对象不变。', hidden: '已隐藏', labels: ['结构', '家具', '基础与开挖', '给排水', '电气与照明', '通风与空调', '消防', '摄像机与网络', '园林与树木', '太阳能'] },
  es: { title: 'Capas', all: 'Mostrar todo', only: 'Solo', close: 'Cerrar', note: 'Oculta o aísla una disciplina en ambas vistas. Las cantidades y los objetos guardados no cambian.', hidden: 'ocultas', labels: ['Estructura', 'Mobiliario', 'Cimientos y excavación', 'Fontanería', 'Electricidad e iluminación', 'Ventilación y climatización', 'Protección contra incendios', 'Cámaras y datos', 'Jardín y árboles', 'Solar'] },
};

const DETAIL_WORDS = {
  en: { preset: 'Working view', custom: 'Custom selection', none: 'Hide all', parts: 'What to show', disciplines: 'Disciplines', partLabels: ['Walls & openings', 'Floors', 'Roofs', 'Stairs', 'Routes & pipes', 'Service equipment'], presets: ['All disciplines', 'Pipes only', 'Plumbing + electrical + walls', 'Architect', 'Engineer', 'Plumber', 'Electrician', 'Client'] },
  fr: { preset: 'Vue de travail', custom: 'Sélection personnalisée', none: 'Tout masquer', parts: 'Éléments visibles', disciplines: 'Disciplines', partLabels: ['Murs et ouvertures', 'Sols', 'Toitures', 'Escaliers', 'Réseaux et tuyaux', 'Équipements techniques'], presets: ['Toutes les disciplines', 'Tuyaux uniquement', 'Plomberie + électricité + murs', 'Architecte', 'Ingénieur', 'Plombier', 'Électricien', 'Client'] },
  'zh-CN': { preset: '工作视图', custom: '自定义', none: '隐藏全部', parts: '显示内容', disciplines: '专业', partLabels: ['墙体与洞口', '楼板', '屋顶', '楼梯', '管线', '设备'], presets: ['全部专业', '仅管道', '给排水＋电气＋墙体', '建筑师', '工程师', '水管工', '电工', '客户'] },
  es: { preset: 'Vista de trabajo', custom: 'Selección personalizada', none: 'Ocultar todo', parts: 'Elementos visibles', disciplines: 'Disciplinas', partLabels: ['Muros y aberturas', 'Suelos', 'Cubiertas', 'Escaleras', 'Redes y tuberías', 'Equipos técnicos'], presets: ['Todas las disciplinas', 'Solo tuberías', 'Fontanería + electricidad + muros', 'Arquitecto', 'Ingeniero', 'Fontanero', 'Electricista', 'Cliente'] },
};

export function DisciplineVisibilityPanel() {
  const { locale } = useAppPreferences(), c = WORDS[locale];
  const { visible, parts, setVisible, setPartVisible, only, applyPreset, showAll, showNone } = useDisciplineVisibilityStore();
  const d = DETAIL_WORDS[locale];
  const preset = VIEW_PRESETS.find(id => { const p = visibilityPreset(id); return DISCIPLINES.every(key => visible[key] === p.visible[key]) && VISIBILITY_PARTS.every(key => parts[key] === p.parts[key]); }) ?? '';
  return <div className="discipline-options" data-testid="discipline-options">
    <p>{c.note}</p>
    <label className="discipline-preset">{d.preset}<select aria-label={d.preset} value={preset} onChange={event => applyPreset(event.target.value as ViewPreset)}>
      <option value="" disabled>{d.custom}</option>{VIEW_PRESETS.map((id, index) => <option key={id} value={id}>{d.presets[index]}</option>)}
    </select></label>
    <div className="discipline-reset"><button type="button" className="discipline-show-all" onClick={showAll}>{c.all}</button><button type="button" onClick={showNone}>{d.none}</button></div>
    <fieldset className="discipline-parts"><legend>{d.parts}</legend>{VISIBILITY_PARTS.map((key, index) => <label key={key}><input type="checkbox" checked={parts[key] && (!['walls', 'floors', 'roofs', 'stairs'].includes(key) || visible.structure)} onChange={event => setPartVisible(key, event.target.checked)} data-visibility-part={key} /><span>{d.partLabels[index]}</span></label>)}</fieldset>
    <h4>{d.disciplines}</h4>
    <div className="discipline-list">{DISCIPLINES.map((key, index) => <div key={key} className="discipline-row">
      <label><input type="checkbox" checked={visible[key]} onChange={event => setVisible(key, event.target.checked)} data-discipline={key} /><span>{c.labels[index]}</span></label>
      <button type="button" onClick={() => only(key)} aria-label={`${c.only}: ${c.labels[index]}`} data-only-discipline={key}>{c.only}</button>
    </div>)}</div>
  </div>;
}

/** Anchored to chrome, with a visible close and outside/Escape dismissal. */
export function DisciplineVisibilityControls({ direction = 'down' }: { direction?: 'up' | 'down' }) {
  const { locale } = useAppPreferences(), c = WORDS[locale];
  const visible = useDisciplineVisibilityStore(s => s.visible);
  const parts = useDisciplineVisibilityStore(s => s.parts);
  const hidden = DISCIPLINES.filter(key => !visible[key]).length + VISIBILITY_PARTS.filter(key => !parts[key]).length;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', away, true); document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', key, true); };
  }, [open]);
  return <div ref={root} className={`discipline-controls discipline-${direction}`}>
    <button ref={trigger} type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} title={hidden ? `${c.title} · ${hidden} ${c.hidden}` : c.title} aria-label={c.title} data-testid="discipline-toggle"><StudioIcon name="storeys" size={18} /><span>{c.title}</span>{hidden > 0 && <b>{hidden}</b>}</button>
    {open && <section className="discipline-popover" aria-label={c.title}>
      <header><strong>{c.title}</strong><button type="button" onClick={() => { setOpen(false); trigger.current?.focus(); }}>{c.close} ×</button></header>
      <DisciplineVisibilityPanel />
    </section>}
  </div>;
}
