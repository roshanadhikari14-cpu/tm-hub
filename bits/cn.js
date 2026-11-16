// Small stand-in for Magic UI's `cn` helper (joins class names).
export function cn(...a) {
  const out = [];
  const add = (v) => {
    if (!v) return;
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(add);
    else if (typeof v === 'object') for (const k in v) if (v[k]) out.push(k);
  };
  a.forEach(add);
  return out.join(' ');
}
