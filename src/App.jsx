import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight, Search, Upload, Copy, AlertCircle, Plus, RotateCcw } from 'lucide-react';

export default function App() {
  const [engrams, setEngrams] = useState([]);
  const [resourceDirectory, setResourceDirectory] = useState({});
  const [overrides, setOverrides] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [showModifiedOnly, setShowModifiedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Configuration - using the user's master sheet IDs
  const ITEMS_SHEET_ID = '1Gt9_KXXupzUEcuB-aS6oIUut6wEDB-Kol_4z_7ghO_U';
  const ITEMS_GID = '894821371';
  const RES_GID = '1400851834';

  const extractClassString = (blueprintPath) => {
    if (!blueprintPath) return '';
    const cleanPath = blueprintPath.replace(/^Blueprint'/i, '').replace(/'$/g, '').trim();
    const parts = cleanPath.split(/[./]/);
    let lastPart = parts[parts.length - 1];
    return lastPart.endsWith('_C') ? lastPart : `${lastPart}_C`;
  };

  const parseCraftingCost = (costString, resMap) => {
    if (!costString) return [];
    return costString.split(',').map(part => {
      const match = part.trim().match(/(\d+)\s*(.*)/);
      if (!match) return null;
      const amount = parseFloat(match[1]);
      const name = match[2].trim();
      const id = resMap[name.toLowerCase()] || name; 
      return { id, name, amount };
    }).filter(x => x !== null);
  };

  const fetchSheet = async (gid) => {
    const url = `https://docs.google.com/spreadsheets/d/${ITEMS_SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    return JSON.parse(text.substring(start, end + 1));
  };

  const processData = (itemsRows, resourceRows) => {
    const resMap = {};
    const masterResourceDir = {};
    const blacklist = new Set();

    resourceRows.forEach(row => {
      if (!row.c) return;
      const cells = row.c;
      const name = cells[0]?.v?.toString();
      const path = cells[1]?.v;
      if (name && path) {
        const id = extractClassString(String(path));
        resMap[name.toLowerCase()] = id;
        masterResourceDir[id] = name;
        blacklist.add(name.toLowerCase());
      }
    });
    setResourceDirectory(masterResourceDir);

    const masterItems = [];
    if (itemsRows.length > 0) {
        const header = itemsRows[0].c;
        const craftingCostColIdx = header.findIndex(c => c?.v?.toString().toLowerCase().includes('crafting cost'));
        const nameColIdx = header.findIndex(c => c?.v?.toString().toLowerCase().includes('name'));
        
        if (craftingCostColIdx !== -1) {
            itemsRows.slice(1).forEach(row => {
                if (!row.c) return;
                const cells = row.c;
                const name = cells[nameColIdx]?.v?.toString();
                const path = cells.find(c => c?.v && typeof c.v === 'string' && (c.v.includes('Blueprint') || c.v.includes('/Game/')))?.v;
                
                if (name && blacklist.has(name.toLowerCase())) return;

                const costString = cells[craftingCostColIdx]?.v;

                if (path) {
                    const id = extractClassString(String(path));
                    const resources = parseCraftingCost(costString, resMap);
                    masterItems.push({ id, name: name || id, resources });
                }
            });
        }
    }
    setEngrams(masterItems.sort((a,b) => a.name.localeCompare(b.name)));
    setLoading(false);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [items, resources] = await Promise.all([fetchSheet(ITEMS_GID), fetchSheet(RES_GID)]);
      processData(items.table.rows, resources.table.rows);
    } catch (err) {
      console.error(err);
      setError("Failed to load sheet data. Ensure sheet is public.");
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleImportIni = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split('\n');
      let newOverrides = { ...overrides };
      lines.forEach(line => {
        if (line.includes('ConfigOverrideItemCraftingCosts=')) {
          const itemMatch = line.match(/ItemClassString="([^"]+)"/);
          if (itemMatch) {
            const engramId = itemMatch[1];
            const reqRegex = /\(ResourceItemTypeString="([^"]+)",BaseResourceRequirement=([0-9.]+)/g;
            let reqMatch;
            if (!newOverrides[engramId]) newOverrides[engramId] = {};
            while ((reqMatch = reqRegex.exec(line)) !== null) {
              newOverrides[engramId][reqMatch[1]] = parseFloat(reqMatch[2]);
            }
          }
        }
      });
      setOverrides(newOverrides);
    };
    reader.readAsText(file);
  };

  const deltaOutput = useMemo(() => {
    let output = '[/Script/ShooterGame.ShooterGameMode]\n';
    Object.entries(overrides).forEach(([engramId, customResources]) => {
      const baseEngram = engrams.find(e => e.id === engramId);
      if (!baseEngram) return;
      
      const combinedRecipe = [];
      const processedIds = new Set();

      Object.entries(customResources).forEach(([resId, val]) => {
        if (val !== '' && !isNaN(val)) {
            combinedRecipe.push({ resId, amount: val });
            processedIds.add(resId);
        }
      });

      baseEngram.resources.forEach(baseRes => {
        if (!processedIds.has(baseRes.id)) {
            combinedRecipe.push({ resId: baseRes.id, amount: baseRes.amount });
            processedIds.add(baseRes.id);
        }
      });

      const reqs = combinedRecipe.map(r => 
        `(ResourceItemTypeString="${r.resId}",BaseResourceRequirement=${r.amount},bCraftingRequireExactResourceType=false)`
      );
      
      if (reqs.length > 0) output += `ConfigOverrideItemCraftingCosts=(ItemClassString="${engramId}",BaseCraftingResourceRequirements=(${reqs.join(',')}))\n`;
    });
    return output;
  }, [overrides, engrams]);

  const filteredEngrams = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return engrams.filter(e => {
        const matchesQuery = e.name.toLowerCase().includes(query) || e.id.toLowerCase().includes(query);
        const isModified = !!overrides[e.id];
        if (showModifiedOnly && !isModified) return false;
        return matchesQuery;
    });
  }, [engrams, searchQuery, showModifiedOnly, overrides]);

  return (
    <div className="min-h-screen bg-[#050b0d] text-[#00e5ff] font-mono selection:bg-[#00e5ff]/20">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        
        {/* Header - Terminal Style */}
        <header className="mb-6 border border-[#00e5ff]/30 p-6 bg-[#0a1114]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-xl font-bold tracking-[0.2em] uppercase text-[#00e5ff]">Ark Engram Cost Editor</h1>
              <p className="text-[10px] uppercase tracking-widest mt-1 opacity-70">Advanced Terminal Interface</p>
            </div>
            <div className="flex items-center gap-4">
              <input 
                type="text" 
                placeholder="SEARCH SYSTEM..." 
                className="bg-[#050b0d] border border-[#00e5ff]/30 p-2 text-sm focus:outline-none focus:border-[#00e5ff] w-64 uppercase"
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              />
              <label className="border border-[#00e5ff]/50 px-6 py-2 cursor-pointer hover:bg-[#00e5ff]/10 transition-colors uppercase text-sm font-bold">
                Import
                <input type="file" onChange={handleImportIni} className="hidden" />
              </label>
              <button onClick={() => setOverrides({})} className="border border-red-500/50 text-red-400 px-6 py-2 hover:bg-red-500/10 transition-colors uppercase text-sm font-bold">
                Reset
              </button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Main List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#00e5ff]/30 pb-4">
                <h2 className="text-sm uppercase tracking-widest font-bold">Protocols</h2>
                <div className="flex gap-2">
                    <button onClick={() => setExpandedItems(new Set(engrams.map(e => e.id)))} className="border border-[#00e5ff]/30 px-3 py-1 text-[10px] uppercase hover:bg-[#00e5ff]/10">Expand All</button>
                    <button onClick={() => setExpandedItems(new Set())} className="border border-[#00e5ff]/30 px-3 py-1 text-[10px] uppercase hover:bg-[#00e5ff]/10">Collapse All</button>
                    <button onClick={() => setShowModifiedOnly(!showModifiedOnly)} className={`border px-3 py-1 text-[10px] uppercase transition-colors ${showModifiedOnly ? 'bg-[#00e5ff]/20 border-[#00e5ff]' : 'border-[#00e5ff]/30 hover:bg-[#00e5ff]/10'}`}>
                        {showModifiedOnly ? 'Show All' : 'Show Modified'}
                    </button>
                </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-20 opacity-50 uppercase tracking-widest text-sm">Initializing...</div>
            ) : (
              <div className="space-y-1">
                {filteredEngrams.map(engram => (
                  <div key={engram.id} className="border border-[#00e5ff]/20 bg-[#0a1114]">
                    <div className="p-3 cursor-pointer hover:bg-[#00e5ff]/5 flex justify-between items-center" onClick={() => {
                      const next = new Set(expandedItems);
                      if (next.has(engram.id)) next.delete(engram.id); else next.add(engram.id);
                      setExpandedItems(next);
                    }}>
                      <span className={`text-xs uppercase tracking-wider ${overrides[engram.id] ? 'text-white font-bold' : ''}`}>{engram.name}</span>
                      {expandedItems.has(engram.id) ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                    </div>
                    {expandedItems.has(engram.id) && (
                      <div className="px-4 pb-4 pt-1 bg-[#050b0d] border-t border-[#00e5ff]/10">
                        {engram.resources.length > 0 ? (
                            engram.resources.map(r => (
                              <div key={r.id} className="flex justify-between items-center gap-4 py-2 border-b border-[#00e5ff]/5">
                                <span className="text-[10px] uppercase opacity-70">{resourceDirectory[r.id] || r.id}</span>
                                <input type="number" className="bg-[#050b0d] border border-[#00e5ff]/30 w-20 p-1 text-center text-[#00e5ff] text-xs font-mono focus:border-[#00e5ff] outline-none" 
                                  value={overrides[engram.id]?.[r.id] ?? r.amount} 
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    const next = {...overrides, [engram.id]: {...overrides[engram.id], [r.id]: isNaN(val) ? '' : val}};
                                    setOverrides(next);
                                }}/>
                              </div>
                            ))
                        ) : (
                            <div className="text-[10px] opacity-50 italic py-2 uppercase">No resources listed.</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delta Output */}
          <div className="lg:sticky lg:top-6 self-start">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm uppercase tracking-widest font-bold">Ini Output</h3>
              <button onClick={() => navigator.clipboard.writeText(deltaOutput)} className="border border-[#00e5ff]/30 px-4 py-1 text-[10px] uppercase hover:bg-[#00e5ff]/10">Copy</button>
            </div>
            <textarea readOnly className="w-full h-[60vh] bg-[#050b0d] border border-[#00e5ff]/30 p-4 font-mono text-xs text-[#00e5ff]/80 resize-none focus:outline-none" value={deltaOutput} />
            <div className="mt-4 text-[9px] opacity-50 uppercase tracking-widest leading-relaxed">
                System status: Active. Awaiting configuration overrides.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}