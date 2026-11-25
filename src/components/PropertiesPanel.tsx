import React, { useEffect, useMemo, useState } from 'react';
import {
  Palette,
  Shapes,
  Type,
  Sparkles,
  LayoutGrid,
  Copy,
  Trash2,
  Lock,
  Unlock,
  FlipHorizontal2,
  FlipVertical2,
  RotateCcw,
  RotateCw,
  BringToFront,
  SendToBack,
  ArrowUp,
  ArrowDown,
  PanelRightClose,
  PanelRightOpen,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Spline,
  Search,
  X,
} from 'lucide-react';
import { ALL_SHAPE_TYPES, CanvasElement, GOOGLE_FONT_FAMILIES, StrokeStyle } from '../types';
import { getExtraShape } from '../utils/extraShapes';

type TabId = 'style' | 'shape' | 'text' | 'effects' | 'arrange';

interface PropertiesPanelProps {
  elements: CanvasElement[];
  theme?: string;
  /** Apply the same change to every selected (unlocked) element */
  onChange: (changes: Partial<CanvasElement>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRotateBy: (deg: number) => void;
  onSetRotation: (deg: number) => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onBringStepForward?: () => void;
  onSendStepBackward?: () => void;
  onToggleLock: () => void;
  /** Turn the selected shape into an editable polygon and show its vertex handles */
  onEditPoints?: () => void;
  isEditingPoints?: boolean;
  /** Pixels to keep free on the right edge (side panels such as chat) */
  rightOffset?: number;
  onClose?: () => void;
}

const SWATCHES = [
  '#0f172a', '#475569', '#94a3b8', '#ffffff', '#dc2626', '#ea580c', '#eab308', '#16a34a',
  '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#fecaca', '#fed7aa', '#fef08a', '#bbf7d0',
  '#a5f3fc', '#bfdbfe', '#ddd6fe', '#fbcfe8',
];

// Shared look (module-level components keep their identity between renders, so sliders can be dragged smoothly)
const UiCtx = React.createContext<{ isDark: boolean }>({ isDark: false });

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const { isDark } = React.useContext(UiCtx);
  return (
    <div className="space-y-1.5">
      <div className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {title}
      </div>
      {children}
    </div>
  );
};

const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onSet: (v: number) => void;
}> = ({ label, value, min, max, step = 1, suffix = '', onSet }) => {
  const { isDark } = React.useContext(UiCtx);
  return (
    <label className="block">
      <div className="flex items-center justify-between text-[11px] mb-0.5">
        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{label}</span>
        <span className="font-mono font-semibold">
          {Math.round(value * 100) / 100}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onSet(Number(e.target.value))}
        className="w-full accent-blue-600 h-6 cursor-pointer"
      />
    </label>
  );
};

const ColorRow: React.FC<{
  label: string;
  value: string | undefined;
  allowNone?: boolean;
  onSet: (c: string) => void;
}> = ({ label, value, allowNone, onSet }) => {
  const { isDark } = React.useContext(UiCtx);
  const border = isDark ? 'border-slate-600' : 'border-slate-300';
  return (
    <Section title={label}>
      <div className="flex flex-wrap items-center gap-1.5">
        {allowNone && (
          <button
            type="button"
            onClick={() => onSet('transparent')}
            title="Yok"
            className={`w-7 h-7 rounded-md border flex items-center justify-center ${
              value === 'transparent' || !value ? 'ring-2 ring-blue-500' : ''
            } ${border}`}
          >
            <X className="w-3.5 h-3.5 text-rose-500" />
          </button>
        )}
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onSet(c)}
            style={{ backgroundColor: c }}
            className={`w-7 h-7 rounded-md border ${
              value?.toLowerCase() === c ? 'ring-2 ring-blue-500 ring-offset-1' : ''
            } ${border}`}
            aria-label={c}
          />
        ))}
        <label
          className={`relative w-7 h-7 rounded-md border overflow-hidden cursor-pointer ${border}`}
          title="Özel renk"
          style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}
        >
          <input
            type="color"
            value={normHex(value, '#2563eb')}
            onChange={(e) => onSet(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
        </label>
      </div>
    </Section>
  );
};

const isShapeType = (t: string) =>
  (ALL_SHAPE_TYPES as readonly string[]).includes(t) || t === 'polygon' || Boolean(getExtraShape(t));
const isLineType = (t: string) => t === 'line' || t === 'arrow' || t === 'double-arrow' || t === 'curved-arrow';
const isFreehand = (t: string) => t === 'pencil' || t === 'fountain-pen' || t === 'highlighter';
const isMedia = (t: string) => t === 'image' || t === 'pdf' || t === 'video' || t === 'folder';

function uniform<T>(vals: T[]): T | undefined {
  return vals.every((v) => v === vals[0]) ? vals[0] : undefined;
}

const normHex = (c: string | undefined, fallback: string) =>
  c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback;

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  elements,
  theme = 'light',
  onChange,
  onDuplicate,
  onDelete,
  onRotateBy,
  onSetRotation,
  onFlipHorizontal,
  onFlipVertical,
  onBringForward,
  onSendBackward,
  onBringStepForward,
  onSendStepBackward,
  onToggleLock,
  onEditPoints,
  isEditingPoints,
  rightOffset = 0,
  onClose,
}) => {
  const isDark = theme === 'dark' || theme === 'midnight';
  const [tab, setTab] = useState<TabId>('style');
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('collab_props_open') !== 'false';
    } catch {
      return true;
    }
  });
  const [fontQuery, setFontQuery] = useState('');

  const types = useMemo(() => elements.map((e) => e.type as string), [elements]);
  const anyShape = types.some(isShapeType);
  const anyText = types.some((t) => t === 'text' || t === 'sticky') || anyShape;
  const allFreehand = types.every(isFreehand);
  const allMedia = types.every(isMedia);
  const allLines = types.every(isLineType);
  const onlyOne = elements.length === 1 ? elements[0] : null;
  const canFill = types.some((t) => isShapeType(t) || t === 'sticky' || isFreehand(t) === false && !isLineType(t) && !isMedia(t) && t !== 'text');
  const allLocked = elements.every((e) => e.isLocked);

  const tabs = useMemo(() => {
    const list: { id: TabId; label: string; icon: React.ReactNode }[] = [];
    if (!allMedia) list.push({ id: 'style', label: 'Stil', icon: <Palette className="w-4 h-4" /> });
    if (anyShape || types.some(isLineType)) list.push({ id: 'shape', label: anyShape ? 'Şekil' : 'Çizgi', icon: <Shapes className="w-4 h-4" /> });
    if (anyText) list.push({ id: 'text', label: 'Yazı', icon: <Type className="w-4 h-4" /> });
    if (!allMedia && !allLines) list.push({ id: 'effects', label: 'Efekt', icon: <Sparkles className="w-4 h-4" /> });
    list.push({ id: 'arrange', label: 'Düzen', icon: <LayoutGrid className="w-4 h-4" /> });
    return list;
  }, [allMedia, anyShape, anyText, allLines, types]);

  useEffect(() => {
    if (!tabs.some((t) => t.id === tab)) setTab(tabs[0].id);
  }, [tabs, tab]);

  const setOpenPersist = (v: boolean) => {
    setOpen(v);
    try {
      localStorage.setItem('collab_props_open', String(v));
    } catch {}
  };

  const card = isDark
    ? 'bg-slate-900/95 border-slate-700 text-slate-100'
    : 'bg-white/95 border-slate-200 text-slate-800';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const field = isDark
    ? 'bg-slate-800 border-slate-700 text-slate-100'
    : 'bg-slate-50 border-slate-200 text-slate-800';
  const btn = isDark
    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200';
  const btnOn = 'bg-blue-600 text-white border-blue-600';

  const fontList = useMemo(() => {
    const q = fontQuery.trim().toLowerCase();
    return GOOGLE_FONT_FAMILIES.filter((f) => !q || f.label.toLowerCase().includes(q) || f.category.toLowerCase().includes(q));
  }, [fontQuery]);

  const first = elements[0];
  const fill = uniform(elements.map((e) => e.fillColor));
  const stroke = uniform(elements.map((e) => e.color));
  const strokeW = uniform(elements.map((e) => e.strokeWidth ?? 3)) ?? first.strokeWidth ?? 3;
  const opacity = uniform(elements.map((e) => e.opacity ?? 1)) ?? 1;
  const strokeStyle = uniform(elements.map((e) => e.strokeStyle ?? 'solid'));
  const fontSize = uniform(elements.map((e) => e.fontSize ?? 16)) ?? 16;
  const fontFamily = uniform(elements.map((e) => e.fontFamily ?? 'Plus Jakarta Sans'));
  const hasGradient = Boolean(uniform(elements.map((e) => Boolean(e.gradientTo))));
  const rotation = Math.round(uniform(elements.map((e) => e.rotation ?? 0)) ?? 0);

  const renderBody = () => {
    switch (tab) {
      case 'style':
        return (
          <div className="space-y-4">
            <ColorRow label={allFreehand || allLines ? 'Çizgi Rengi' : 'Kenar Rengi'} value={stroke} onSet={(c) => onChange({ color: c })} />
            {!allFreehand && !allLines && canFill && (
              <ColorRow label="Dolgu Rengi" value={fill} allowNone onSet={(c) => onChange({ fillColor: c })} />
            )}
            <Slider label="Çizgi Kalınlığı" value={strokeW} min={1} max={24} onSet={(v) => onChange({ strokeWidth: v })} suffix="px" />
            <Section title="Çizgi Stili">
              <div className="grid grid-cols-3 gap-1.5">
                {(['solid', 'dashed', 'dotted'] as StrokeStyle[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => onChange({ strokeStyle: st })}
                    className={`py-1.5 rounded-lg border text-[11px] font-semibold ${strokeStyle === st ? btnOn : btn}`}
                  >
                    {st === 'solid' ? 'Düz' : st === 'dashed' ? 'Kesikli' : 'Noktalı'}
                  </button>
                ))}
              </div>
            </Section>
            <Slider label="Saydamlık" value={Math.round(opacity * 100)} min={5} max={100} suffix="%" onSet={(v) => onChange({ opacity: v / 100 })} />
          </div>
        );
      case 'shape':
        return (
          <div className="space-y-4">
            {types.some((t) => t === 'rectangle' || t === 'rounded-rect') && (
              <Slider
                label="Köşe Yuvarlaklığı"
                value={uniform(elements.map((e) => e.cornerRadius ?? (e.type === 'rounded-rect' ? 16 : 0))) ?? 0}
                min={0}
                max={80}
                suffix="px"
                onSet={(v) => onChange({ cornerRadius: v })}
              />
            )}
            {types.includes('star') && (
              <>
                <Slider label="Köşe (Uç) Sayısı" value={first.starPoints ?? 5} min={3} max={14} onSet={(v) => onChange({ starPoints: v })} />
                <Slider label="İç Yarıçap" value={first.starInner ?? 0.45} min={0.1} max={0.9} step={0.05} onSet={(v) => onChange({ starInner: v })} />
              </>
            )}
            {types.includes('polygon') && (
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(first.smooth)}
                  onChange={(e) => onChange({ smooth: e.target.checked })}
                  className="accent-blue-600"
                />
                <span>Köşeleri yumuşat (eğri)</span>
              </label>
            )}
            {onEditPoints && onlyOne && !isMediaOrText(onlyOne.type) && (
              <button
                type="button"
                onClick={onEditPoints}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-semibold ${isEditingPoints ? btnOn : btn}`}
              >
                <Spline className="w-4 h-4" />
                <span>{isEditingPoints ? 'Nokta Düzenleme Açık' : 'Noktaları Düzenle'}</span>
              </button>
            )}
            <p className={`text-[11px] leading-snug ${muted}`}>
              {onlyOne && isLineType(onlyOne.type)
                ? 'Çizgi/ok uçlarını sürükleyerek eğimi ve yönü değiştirin.'
                : 'Noktaları düzenle: şekil serbest çokgene çevrilir. Köşeleri sürükleyin, kenardaki + ile nokta ekleyin, noktaya çift tıklayıp silin.'}
            </p>
            {onlyOne && onlyOne.width !== undefined && !isLineType(onlyOne.type) && (
              <Section title="Boyut">
                <div className="grid grid-cols-2 gap-1.5">
                  {(['width', 'height'] as const).map((k) => (
                    <label key={k} className="text-[11px]">
                      <span className={muted}>{k === 'width' ? 'Genişlik' : 'Yükseklik'}</span>
                      <input
                        type="number"
                        value={Math.round(Math.abs(onlyOne[k] ?? 0))}
                        onChange={(e) => {
                          const v = Math.max(4, Number(e.target.value) || 4);
                          onChange({ [k]: (onlyOne[k] ?? 0) < 0 ? -v : v } as Partial<CanvasElement>);
                        }}
                        className={`w-full mt-0.5 px-2 py-1 rounded-md border text-xs ${field}`}
                      />
                    </label>
                  ))}
                </div>
              </Section>
            )}
          </div>
        );
      case 'text':
        return (
          <div className="space-y-4">
            {anyShape && (
              <Section title="Şeklin İçindeki Yazı">
                <textarea
                  value={onlyOne?.text ?? ''}
                  disabled={!onlyOne}
                  onChange={(e) => onChange({ text: e.target.value })}
                  rows={2}
                  placeholder={onlyOne ? 'Şekle yazı ekle...' : 'Tek bir şekil seçin'}
                  className={`w-full px-2 py-1.5 rounded-lg border text-xs resize-none ${field}`}
                />
              </Section>
            )}
            <Section title="Yazı Tipi">
              <div className="relative">
                <Search className={`w-3.5 h-3.5 absolute left-2 top-2 ${muted}`} />
                <input
                  value={fontQuery}
                  onChange={(e) => setFontQuery(e.target.value)}
                  placeholder={`${GOOGLE_FONT_FAMILIES.length} font içinde ara...`}
                  className={`w-full pl-7 pr-2 py-1.5 rounded-lg border text-xs ${field}`}
                />
              </div>
              <div className={`max-h-44 overflow-y-auto rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                {fontList.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onChange({ fontFamily: f.id })}
                    style={{ fontFamily: f.cssFamily }}
                    className={`w-full text-left px-2.5 py-1.5 text-sm flex items-center justify-between gap-2 ${
                      fontFamily === f.id ? 'bg-blue-600 text-white' : isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{f.label}</span>
                    <span className={`text-[9px] font-sans shrink-0 ${fontFamily === f.id ? 'text-blue-100' : muted}`}>{f.category}</span>
                  </button>
                ))}
              </div>
            </Section>
            <Slider label="Yazı Boyutu" value={fontSize} min={8} max={120} suffix="px" onSet={(v) => onChange({ fontSize: v })} />
            <Section title="Biçim">
              <div className="grid grid-cols-5 gap-1.5">
                <button type="button" onClick={() => onChange({ fontWeight: first.fontWeight === 'bold' ? 'normal' : 'bold' })} className={`py-1.5 rounded-lg border flex justify-center ${first.fontWeight === 'bold' ? btnOn : btn}`}>
                  <Bold className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => onChange({ fontStyle: first.fontStyle === 'italic' ? 'normal' : 'italic' })} className={`py-1.5 rounded-lg border flex justify-center ${first.fontStyle === 'italic' ? btnOn : btn}`}>
                  <Italic className="w-4 h-4" />
                </button>
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button key={a} type="button" onClick={() => onChange({ textAlign: a })} className={`py-1.5 rounded-lg border flex justify-center ${(first.textAlign ?? (anyShape && !types.includes('text') ? 'center' : 'left')) === a ? btnOn : btn}`}>
                    {a === 'left' ? <AlignLeft className="w-4 h-4" /> : a === 'center' ? <AlignCenter className="w-4 h-4" /> : <AlignRight className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </Section>
            {anyShape && <ColorRow label="Yazı Rengi" value={first.textColor ?? first.color} onSet={(c) => onChange({ textColor: c })} />}
          </div>
        );
      case 'effects':
        return (
          <div className="space-y-4">
            <Slider label="Gölge" value={first.shadowBlur ?? 0} min={0} max={40} suffix="px" onSet={(v) => onChange({ shadowBlur: v })} />
            {(first.shadowBlur ?? 0) > 0 && (
              <>
                <Slider label="Gölge Uzaklığı" value={first.shadowOffset ?? (first.shadowBlur ?? 0) / 3} min={0} max={30} onSet={(v) => onChange({ shadowOffset: v })} />
                <ColorRow label="Gölge Rengi" value={first.shadowColor} onSet={(c) => onChange({ shadowColor: c })} />
              </>
            )}
            {!allFreehand && canFill && (
              <Section title="Renk Geçişi (Gradyan)">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasGradient}
                    onChange={(e) =>
                      onChange(
                        e.target.checked
                          ? { gradientTo: first.gradientTo || '#a855f7', gradientAngle: first.gradientAngle ?? 90, fillColor: fill && fill !== 'transparent' ? fill : '#38bdf8' }
                          : { gradientTo: '' }
                      )
                    }
                    className="accent-blue-600"
                  />
                  <span>Gradyan dolgu kullan</span>
                </label>
                {hasGradient && (
                  <>
                    <ColorRow label="Bitiş Rengi" value={first.gradientTo} onSet={(c) => onChange({ gradientTo: c })} />
                    <Slider label="Açı" value={first.gradientAngle ?? 90} min={0} max={360} suffix="°" onSet={(v) => onChange({ gradientAngle: v })} />
                  </>
                )}
              </Section>
            )}
          </div>
        );
      case 'arrange':
        return (
          <div className="space-y-4">
            <Section title="Döndür">
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => onRotateBy(-15)} className={`p-2 rounded-lg border ${btn}`} title="-15°">
                  <RotateCcw className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  value={rotation}
                  onChange={(e) => onSetRotation(Number(e.target.value) || 0)}
                  className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg border text-xs text-center ${field}`}
                />
                <span className={`text-xs ${muted}`}>°</span>
                <button type="button" onClick={() => onRotateBy(15)} className={`p-2 rounded-lg border ${btn}`} title="+15°">
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            </Section>
            <Section title="Çevir">
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={onFlipHorizontal} className={`py-2 rounded-lg border flex items-center justify-center gap-1.5 text-xs ${btn}`}>
                  <FlipHorizontal2 className="w-4 h-4" /> Yatay
                </button>
                <button type="button" onClick={onFlipVertical} className={`py-2 rounded-lg border flex items-center justify-center gap-1.5 text-xs ${btn}`}>
                  <FlipVertical2 className="w-4 h-4" /> Dikey
                </button>
              </div>
            </Section>
            <Section title="Katman Sırası">
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={onBringStepForward || onBringForward} className={`py-2 rounded-lg border flex items-center justify-center gap-1.5 text-xs ${btn}`}>
                  <ArrowUp className="w-4 h-4" /> Bir Öne
                </button>
                <button type="button" onClick={onSendStepBackward || onSendBackward} className={`py-2 rounded-lg border flex items-center justify-center gap-1.5 text-xs ${btn}`}>
                  <ArrowDown className="w-4 h-4" /> Bir Arkaya
                </button>
                <button type="button" onClick={onBringForward} className={`py-2 rounded-lg border flex items-center justify-center gap-1.5 text-xs ${btn}`}>
                  <BringToFront className="w-4 h-4" /> En Öne
                </button>
                <button type="button" onClick={onSendBackward} className={`py-2 rounded-lg border flex items-center justify-center gap-1.5 text-xs ${btn}`}>
                  <SendToBack className="w-4 h-4" /> En Arkaya
                </button>
              </div>
            </Section>
            <Section title="İşlemler">
              <div className="grid grid-cols-3 gap-1.5">
                <button type="button" onClick={onDuplicate} className={`py-2 rounded-lg border flex flex-col items-center gap-0.5 text-[10px] ${btn}`}>
                  <Copy className="w-4 h-4" /> Çoğalt
                </button>
                <button type="button" onClick={onToggleLock} className={`py-2 rounded-lg border flex flex-col items-center gap-0.5 text-[10px] ${allLocked ? btnOn : btn}`}>
                  {allLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />} {allLocked ? 'Kilitli' : 'Kilitle'}
                </button>
                <button type="button" onClick={onDelete} className="py-2 rounded-lg border flex flex-col items-center gap-0.5 text-[10px] bg-rose-600 hover:bg-rose-700 text-white border-rose-600">
                  <Trash2 className="w-4 h-4" /> Sil
                </button>
              </div>
            </Section>
          </div>
        );
    }
  };

  function isMediaOrText(t: string) {
    return isMedia(t) || t === 'text' || t === 'sticky';
  }

  const stopCanvas = (e: React.SyntheticEvent) => e.stopPropagation();

  const title =
    elements.length > 1
      ? `${elements.length} nesne seçili`
      : onlyOne
      ? getExtraShape(onlyOne.type)?.label || shapeTitle(onlyOne.type)
      : '';

  // Collapsed: only the vertical tab rail stays on the edge of the canvas
  const rail = (
    <div className={`flex flex-col items-center gap-1 p-1 border rounded-xl shadow-lg backdrop-blur-md ${card}`}>
      <button
        type="button"
        onClick={() => setOpenPersist(!open)}
        className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
        title={open ? 'Paneli daralt' : 'Özellikler panelini aç'}
      >
        {open ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
      </button>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => {
            setTab(t.id);
            setOpenPersist(true);
          }}
          title={t.label}
          className={`p-2 rounded-lg flex flex-col items-center gap-0.5 ${
            open && tab === t.id ? 'bg-blue-600 text-white' : isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          {t.icon}
          <span className="text-[9px] font-semibold leading-none">{t.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <UiCtx.Provider value={{ isDark }}>
      {/* Desktop / tablet: vertical tab rail + panel on the free right edge of the canvas */}
      <div
        data-floating-bar="true"
        onPointerDown={stopCanvas}
        onWheel={stopCanvas}
        style={{ right: 12 + rightOffset }}
        className="hidden md:flex fixed top-24 bottom-24 z-[60] items-start gap-2 pointer-events-none transition-[right] duration-200"
      >
        {open && (
          <div className={`pointer-events-auto w-[272px] max-h-full flex flex-col border rounded-2xl shadow-xl backdrop-blur-md cb-anim-scale-in ${card}`}>
            <div className={`px-3 py-2.5 flex items-center justify-between border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">{title}</div>
                <div className={`text-[10px] ${muted}`}>{tabs.find((t) => t.id === tab)?.label} özellikleri</div>
              </div>
              {onClose && (
                <button type="button" onClick={onClose} className={`p-1 rounded ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`} title="Seçimi kaldır">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="p-3 overflow-y-auto">{renderBody()}</div>
          </div>
        )}
        <div className="pointer-events-auto">{rail}</div>
      </div>

      {/* Phones: bottom sheet with a horizontal tab strip (big touch targets) */}
      <div
        data-floating-bar="true"
        onPointerDown={stopCanvas}
        onTouchStart={stopCanvas}
        className={`md:hidden fixed inset-x-0 bottom-0 z-[60] border-t rounded-t-2xl shadow-2xl backdrop-blur-md ${card}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center gap-1 px-2 pt-2 overflow-x-auto">
          <div className="text-[11px] font-bold px-2 shrink-0 max-w-[110px] truncate">{title}</div>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                if (open && tab === t.id) setOpenPersist(false);
                else {
                  setTab(t.id);
                  setOpenPersist(true);
                }
              }}
              className={`shrink-0 min-h-[44px] px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold ${
                open && tab === t.id ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
          {onClose && (
            <button type="button" onClick={onClose} className="shrink-0 min-h-[44px] min-w-[44px] ml-auto flex items-center justify-center rounded-xl" aria-label="Kapat">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {open && <div className="p-3 max-h-[42vh] overflow-y-auto">{renderBody()}</div>}
      </div>
    </UiCtx.Provider>
  );
};

function shapeTitle(t: string): string {
  const map: Record<string, string> = {
    rectangle: 'Dikdörtgen', 'rounded-rect': 'Yuvarlak Dikdörtgen', circle: 'Daire / Elips', diamond: 'Eşkenar Dörtgen',
    triangle: 'Üçgen', star: 'Yıldız', heart: 'Kalp', polygon: 'Serbest Çokgen', text: 'Metin', sticky: 'Yapışkan Not',
    line: 'Çizgi', arrow: 'Ok', image: 'Görsel', pdf: 'PDF', video: 'Video', folder: 'Klasör',
    pencil: 'Kalem Çizimi', 'fountain-pen': 'Dolma Kalem', highlighter: 'Fosforlu Kalem',
  };
  return map[t] || 'Nesne';
}
