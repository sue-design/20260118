
import React, { useState } from 'react';
import { SentenceTemplate, WordChunk, RawSentence } from '../types';
import { Edit3, Trash2, ChevronRight, ChevronDown, Check, X, Search, AlertCircle, Tag, FileText, PlusSquare, Loader2, BarChart3, Filter } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

interface LibraryViewProps {
  templates: SentenceTemplate[];
  chunks: WordChunk[];
  rawSentences: RawSentence[];
  onUpdateTemplates: (ts: SentenceTemplate[]) => void;
  onUpdateChunks: (cs: WordChunk[]) => void;
  onUpdateRaw: (rs: RawSentence[]) => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({ templates, chunks, rawSentences, onUpdateTemplates, onUpdateChunks, onUpdateRaw }) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'chunks' | 'raw'>('templates');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showOnlyUnmastered, setShowOnlyUnmastered] = useState(false);
  const [showZeroPracticeOnly, setShowZeroPracticeOnly] = useState(false);
  const [manualExtractingSentence, setManualExtractingSentence] = useState<RawSentence | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const deleteTemplate = (id: string) => onUpdateTemplates(templates.filter(t => t.id !== id));
  const deleteChunk = (id: string) => onUpdateChunks(chunks.filter(c => c.id !== id));
  const deleteRaw = (id: string) => onUpdateRaw(rawSentences.filter(r => r.id !== id));

  const filteredTemplates = templates.filter(t => (t.pattern.toLowerCase().includes(search.toLowerCase()) || t.topic.toLowerCase().includes(search.toLowerCase())) && (!showOnlyUnmastered || t.examples.some(ex => ex.mastery < 100)));
  const filteredChunks = chunks.filter(c => (c.root.toLowerCase().includes(search.toLowerCase()) || c.translation.toLowerCase().includes(search.toLowerCase())) && (!showOnlyUnmastered || c.variations.some(v => v.mastery < 100)));
  const filteredRaw = rawSentences.filter(r => 
    r.text.toLowerCase().includes(search.toLowerCase()) && 
    (!showZeroPracticeOnly || r.practiceCount === 0)
  );

  const handleManualExtract = async (type: 'pattern' | 'chunk', userFragment: string) => {
    if (!manualExtractingSentence || !userFragment.trim()) return;
    setIsAiProcessing(true);
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      if (type === 'pattern') {
        const resp = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `As a Korean expert, create a "Sentence Template" for: "${userFragment}".
          Context from source text: "${manualExtractingSentence.text}".
          You MUST return a JSON object with: 
          { 
            "pattern": "${userFragment}", 
            "topic": "string", 
            "examples": [
              { "kr": "Korean example sentence using this pattern", "cn": "Accurate Chinese translation" },
              { "kr": "Another Korean example", "cn": "Chinese translation" }
            ] 
          }
          Ensure 'cn' is NOT empty.`,
          config: { responseMimeType: "application/json" }
        });
        const data = JSON.parse(resp.text || '{}');
        onUpdateTemplates([{
          id: Math.random().toString(36).substr(2, 9),
          pattern: data.pattern || userFragment,
          topic: data.topic || "General",
          sourceId: manualExtractingSentence.id,
          examples: (data.examples || []).map((ex: any) => ({ kr: ex.kr, cn: ex.cn, mastery: 0, lastReviewed: Date.now() }))
        }, ...templates]);
      } else {
        const resp = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `As a Korean expert, create a "Word Chunk" for: "${userFragment}".
          Context from source text: "${manualExtractingSentence.text}".
          You MUST return a JSON object with: 
          { 
            "root": "${userFragment}", 
            "translation": "Accurate Chinese meaning", 
            "topic": "string", 
            "variations": [{ "kr": "The fragment itself or a variation" }] 
          }
          Ensure 'translation' is NOT empty.`,
          config: { responseMimeType: "application/json" }
        });
        const data = JSON.parse(resp.text || '{}');
        onUpdateChunks([{
          id: Math.random().toString(36).substr(2, 9),
          root: data.root || userFragment,
          translation: data.translation || "未知含义",
          topic: data.topic || "General",
          sourceId: manualExtractingSentence.id,
          variations: (data.variations || []).map((v: any) => ({ ...v, mastery: 0, lastReviewed: Date.now() }))
        }, ...chunks]);
      }
      setManualExtractingSentence(null);
    } catch (e) {
      alert("手动提取失败，AI 未能按要求生成完整数据。");
    } finally {
      setIsAiProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto mt-12 px-6 pb-24 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div>
          <h2 className="text-4xl font-bold text-silver-600 tracking-tight">语料资产管理</h2>
          <p className="text-silver-400 mt-2 font-medium">查看与维护您的个性化韩语表达库</p>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
          {activeTab === 'raw' ? (
            <button onClick={() => setShowZeroPracticeOnly(!showZeroPracticeOnly)} className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all border ${showZeroPracticeOnly ? 'bg-primary-50 border-primary-200 text-primary-600' : 'bg-white border-silver-100 text-silver-400 hover:border-silver-300'}`}>
              <Filter size={18} />
              零练习优先
            </button>
          ) : (
            <button onClick={() => setShowOnlyUnmastered(!showOnlyUnmastered)} className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all border ${showOnlyUnmastered ? 'bg-primary-50 border-primary-200 text-primary-600' : 'bg-white border-silver-100 text-silver-400 hover:border-silver-300'}`}>
              <AlertCircle size={18} />
              待掌握过滤
            </button>
          )}
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-silver-300 transition-colors" size={18} />
            <input type="text" placeholder="搜索..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-12 pr-6 py-3.5 bg-white border border-silver-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-primary-400 focus:outline-none w-full md:w-72 transition-all" />
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-10 bg-silver-100/50 p-2 rounded-[1.25rem] w-fit">
        <button onClick={() => setActiveTab('templates')} className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'templates' ? 'bg-white text-primary-600 shadow-md' : 'text-silver-400 hover:text-silver-600'}`}>句模 ({templates.length})</button>
        <button onClick={() => setActiveTab('chunks')} className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'chunks' ? 'bg-white text-primary-600 shadow-md' : 'text-silver-400 hover:text-silver-600'}`}>单词块 ({chunks.length})</button>
        <button onClick={() => setActiveTab('raw')} className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'raw' ? 'bg-white text-primary-600 shadow-md' : 'text-silver-400 hover:text-silver-600'}`}>原始素材 ({rawSentences.length})</button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {activeTab === 'raw' ? (
          filteredRaw.length === 0 ? <EmptyState message="暂无原始素材" /> : (
            filteredRaw.map(r => (
              <div key={r.id} className="bg-white border border-silver-100 rounded-[2rem] p-8 high-end-shadow hover:border-primary-200 transition-all group">
                <div className="flex items-start justify-between">
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-silver-50 text-silver-500 rounded-lg border border-silver-100">
                        <FileText size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{r.source}</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary-50 text-primary-600 rounded-lg border border-primary-100">
                        <BarChart3 size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">练习: {r.practiceCount}次</span>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-silver-600 leading-snug korean-text">{r.text}</p>
                    <div className="flex gap-3">
                      <button onClick={() => setManualExtractingSentence(r)} className="flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-600 rounded-xl text-xs font-bold border border-primary-100 hover:bg-primary-100 transition-all">
                        <PlusSquare size={14} />
                        手动拆解
                      </button>
                    </div>
                  </div>
                  <ActionButtons onEdit={() => {}} onDelete={() => deleteRaw(r.id)} />
                </div>
              </div>
            ))
          )
        ) : activeTab === 'templates' ? (
          filteredTemplates.length === 0 ? <EmptyState message="暂无匹配的句模" /> : filteredTemplates.map(t => (
            <div key={t.id} className="bg-white border border-silver-100 rounded-[2rem] p-8 high-end-shadow hover:border-primary-200 transition-all group">
               <div className="flex items-start justify-between">
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-silver-50 text-silver-500 rounded-lg border border-silver-100">
                        <Tag size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{t.topic}</span>
                      </div>
                      <h4 className="text-2xl font-bold text-silver-600">{t.pattern}</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {t.examples.map((ex, idx) => (
                        <div key={idx} className="flex items-start gap-4 p-4 bg-silver-50/50 rounded-2xl border border-silver-100 group-hover:bg-white transition-colors">
                          <div className="flex-1 space-y-1">
                            <p className="text-silver-600 font-bold korean-text">{ex.kr}</p>
                            <p className="text-xs text-silver-400 font-medium">{ex.cn}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                             <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-tighter ${ex.mastery >= 100 ? 'bg-green-100 text-green-600' : 'bg-primary-100 text-primary-600'}`}>
                               Mastery: {ex.mastery}%
                             </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <ActionButtons onEdit={() => setEditingId(t.id)} onDelete={() => deleteTemplate(t.id)} />
                </div>
            </div>
          ))
        ) : (
          filteredChunks.length === 0 ? <EmptyState message="暂无匹配的单词块" /> : filteredChunks.map(c => (
             <div key={c.id} className="bg-white border border-silver-100 rounded-[2rem] p-8 high-end-shadow hover:border-primary-200 transition-all group">
                <div className="flex items-start justify-between">
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary-50 text-primary-600 rounded-lg border border-primary-100">
                        <Tag size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{c.topic}</span>
                      </div>
                      <h4 className="text-2xl font-bold text-silver-600">{c.root}</h4>
                    </div>
                    <div className="flex flex-col gap-4">
                      <p className="text-sm text-silver-400 font-bold uppercase tracking-widest">{c.translation}</p>
                      <div className="flex flex-wrap gap-3">
                        {c.variations.map((v, idx) => (
                          <div key={idx} className="relative group/var">
                            <span className="px-5 py-2.5 bg-silver-100/30 text-silver-600 text-sm font-semibold rounded-2xl border border-silver-100 korean-text block group-hover:bg-white transition-colors">
                              {v.kr} ({v.mastery}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <ActionButtons onEdit={() => setEditingId(c.id)} onDelete={() => deleteChunk(c.id)} />
                </div>
              </div>
          ))
        )}
      </div>

      {manualExtractingSentence && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
            <h3 className="text-xl font-bold text-silver-600 mb-6">手动提取语料</h3>
            <div className="p-6 bg-silver-50 rounded-2xl border border-silver-100 mb-8">
              <p className="text-lg font-bold text-silver-600 korean-text leading-relaxed">
                {manualExtractingSentence.text}
              </p>
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-silver-400 uppercase tracking-widest block mb-2">输入你要提取的部分</label>
                <input 
                  id="fragment-input"
                  className="w-full px-5 py-4 bg-silver-50 border border-silver-100 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none korean-text"
                  placeholder="例如: ~기 때문에 或 영향을 미치다"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => handleManualExtract('pattern', (document.getElementById('fragment-input') as HTMLInputElement).value)}
                  disabled={isAiProcessing}
                  className="py-4 bg-primary-50 text-primary-600 rounded-2xl font-black text-xs uppercase tracking-widest border border-primary-200 hover:bg-primary-600 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  {isAiProcessing ? <Loader2 size={16} className="animate-spin" /> : <Tag size={16} />}
                  存为句模
                </button>
                <button 
                  onClick={() => handleManualExtract('chunk', (document.getElementById('fragment-input') as HTMLInputElement).value)}
                  disabled={isAiProcessing}
                  className="py-4 bg-primary-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest border border-primary-600 hover:bg-primary-700 transition-all flex items-center justify-center gap-2"
                >
                  {isAiProcessing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  存为单词块
                </button>
              </div>
              <button onClick={() => setManualExtractingSentence(null)} className="w-full text-silver-400 font-bold text-xs uppercase tracking-widest hover:text-silver-600 py-2">取消操作</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ActionButtons = ({ onEdit, onDelete }: { onEdit: () => void, onDelete: () => void }) => (
  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
    <button onClick={onEdit} className="p-3 text-silver-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-all"><Edit3 size={18} /></button>
    <button onClick={onDelete} className="p-3 text-silver-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"><Trash2 size={18} /></button>
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="text-center py-32 bg-white rounded-[2rem] border border-dashed border-silver-200">
    <div className="w-16 h-16 bg-silver-50 rounded-full flex items-center justify-center mx-auto mb-6"><Search className="text-silver-300" size={32} /></div>
    <p className="text-silver-400 font-bold uppercase tracking-widest text-xs">{message}</p>
  </div>
);

export default LibraryView;
