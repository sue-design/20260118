
import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import UploadDialog from './components/UploadDialog';
import LearnCard from './components/LearnCard';
import ShadowingSession from './components/ShadowingSession';
import LibraryView from './components/LibraryView';
import { SentenceTemplate, WordChunk, RawSentence, AppMode, ReviewConfig, ShadowingLine, MaterialType, Material } from './types';
import { INITIAL_TOPICS } from './constants';
import { generateShadowingContent, stopGlobalAudio } from './services/geminiService';
import { Zap, BookOpen, Layers, Repeat, Loader2, Database, AlertCircle, ArrowRight, TrendingUp, Settings, Plus, X, RefreshCw, FileText } from 'lucide-react';

const App: React.FC = () => {
  const [templateLibrary, setTemplateLibrary] = useState<SentenceTemplate[]>([]);
  const [chunkLibrary, setChunkLibrary] = useState<WordChunk[]>([]);
  const [rawSentences, setRawSentences] = useState<RawSentence[]>([]);
  const [topics, setTopics] = useState<string[]>(INITIAL_TOPICS);
  const [mode, setMode] = useState<AppMode>(AppMode.HOME);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  
  const [lastPracticedKey, setLastPracticedKey] = useState<string | null>(null);
  const [currentLearnMaterial, setCurrentLearnMaterial] = useState<Material | null>(null);

  const [reviewConfig, setReviewConfig] = useState<ReviewConfig>({
    topic: INITIAL_TOPICS[0],
    sentenceCount: 3,
    chunkCount: 3
  });

  // Persist state
  useEffect(() => {
    const savedTemplates = localStorage.getItem('arirang_templates');
    const savedChunks = localStorage.getItem('arirang_chunks');
    const savedRaw = localStorage.getItem('arirang_raw');
    if (savedTemplates) setTemplateLibrary(JSON.parse(savedTemplates));
    if (savedChunks) setChunkLibrary(JSON.parse(savedChunks));
    if (savedRaw) setRawSentences(JSON.parse(savedRaw));
  }, []);

  useEffect(() => {
    localStorage.setItem('arirang_templates', JSON.stringify(templateLibrary));
    localStorage.setItem('arirang_chunks', JSON.stringify(chunkLibrary));
    localStorage.setItem('arirang_raw', JSON.stringify(rawSentences));
  }, [templateLibrary, chunkLibrary, rawSentences]);

  const startLearnSession = (type: MaterialType) => {
    stopGlobalAudio();
    let candidates: Material[] = [];
    
    if (type === MaterialType.SENTENCE_TEMPLATE) {
      // Create a flat list of all examples for learning
      templateLibrary.forEach(t => {
        t.examples.forEach((ex, idx) => {
          candidates.push({
            id: t.id,
            original: ex.kr,
            translation: ex.cn || t.pattern, // Use specific Chinese if available
            topic: t.topic,
            type: MaterialType.SENTENCE_TEMPLATE,
            mastery: ex.mastery,
            lastReviewed: ex.lastReviewed,
            sourceId: t.sourceId
          });
        });
      });
    } else {
      chunkLibrary.forEach(c => {
        c.variations.forEach((v, idx) => {
          candidates.push({
            id: c.id,
            original: v.kr,
            translation: v.cn || c.translation, // Use specific Chinese if available
            topic: c.topic,
            type: MaterialType.WORD_CHUNK,
            mastery: v.mastery,
            lastReviewed: v.lastReviewed,
            sourceId: c.sourceId
          });
        });
      });
    }

    // Filter out mastered ones if possible, then shuffle
    const unmastered = candidates.filter(c => c.mastery < 100);
    const pool = unmastered.length > 0 ? unmastered : candidates;
    
    if (pool.length === 0) {
      alert("请先上传一些语料资产。");
      return;
    }

    const random = pool[Math.floor(Math.random() * pool.length)];
    setCurrentLearnMaterial(random);
    setMode(type === MaterialType.SENTENCE_TEMPLATE ? AppMode.LEARN_SENTENCE : AppMode.LEARN_CHUNK);
  };

  const finishLearnMaterial = (mastered: boolean) => {
    if (!currentLearnMaterial) return;

    if (currentLearnMaterial.type === MaterialType.SENTENCE_TEMPLATE) {
      setTemplateLibrary(prev => prev.map(t => {
        if (t.id === currentLearnMaterial.id) {
          return {
            ...t,
            examples: t.examples.map(ex => 
              ex.kr === currentLearnMaterial.original 
                ? { ...ex, mastery: mastered ? Math.min(ex.mastery + 20, 100) : Math.max(ex.mastery - 10, 0), lastReviewed: Date.now() }
                : ex
            )
          };
        }
        return t;
      }));
    } else {
      setChunkLibrary(prev => prev.map(c => {
        if (c.id === currentLearnMaterial.id) {
          return {
            ...c,
            variations: c.variations.map(v => 
              v.kr === currentLearnMaterial.original 
                ? { ...v, mastery: mastered ? Math.min(v.mastery + 25, 100) : Math.max(v.mastery - 10, 0), lastReviewed: Date.now() }
                : v
            )
          };
        }
        return c;
      }));
    }

    // Update practice count on raw source
    if (currentLearnMaterial.sourceId) {
      setRawSentences(prev => prev.map(rs => 
        rs.id === currentLearnMaterial.sourceId ? { ...rs, practiceCount: rs.practiceCount + 1 } : rs
      ));
    }

    // Auto-advance
    startLearnSession(currentLearnMaterial.type);
  };

  return (
    <div className="min-h-screen bg-silver-50 selection:bg-primary-100 selection:text-primary-700">
      <Header 
        currentMode={mode} 
        setMode={(m) => { stopGlobalAudio(); setMode(m); }} 
        onOpenUpload={() => setIsUploadOpen(true)} 
      />
      
      <main className="container mx-auto px-4 py-8">
        {mode === AppMode.HOME && (
          <div className="max-w-4xl mx-auto space-y-12">
            <section className="text-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">
               <h2 className="text-5xl font-black text-silver-600 tracking-tight leading-tight">
                 让每一份收藏的语料<br/>都能成为<span className="text-primary-600">脱口而出</span>的力量
               </h2>
               <p className="text-silver-400 text-lg font-medium max-w-2xl mx-auto">
                 Arirang Fluent 深度集成 Gemini AI，通过分级拆解与沉浸式跟读，<br/>助你跨越“看得懂”到“说得出”的鸿沟。
               </p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <button 
                onClick={() => startLearnSession(MaterialType.SENTENCE_TEMPLATE)}
                className="group relative bg-white p-10 rounded-[3rem] high-end-shadow border border-silver-100 hover:border-primary-300 transition-all text-left overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all">
                  <BookOpen size={120} />
                </div>
                <div className="w-16 h-16 bg-primary-50 text-primary-600 rounded-3xl flex items-center justify-center mb-8 group-hover:rotate-6 transition-all">
                  <BookOpen size={32} />
                </div>
                <h3 className="text-3xl font-bold text-silver-600 mb-4">句模训练</h3>
                <p className="text-silver-400 font-medium leading-relaxed">
                  精选 Grammar Pattern，配合场景例句，通过 AI 实时语音评测，内化核心表达。
                </p>
                <div className="mt-8 flex items-center gap-2 text-primary-600 font-bold text-sm uppercase tracking-widest">
                  Start Learning <ArrowRight size={18} />
                </div>
              </button>

              <button 
                onClick={() => startLearnSession(MaterialType.WORD_CHUNK)}
                className="group relative bg-white p-10 rounded-[3rem] high-end-shadow border border-silver-100 hover:border-primary-300 transition-all text-left overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all">
                  <Layers size={120} />
                </div>
                <div className="w-16 h-16 bg-primary-50 text-primary-600 rounded-3xl flex items-center justify-center mb-8 group-hover:rotate-6 transition-all">
                  <Layers size={32} />
                </div>
                <h3 className="text-3xl font-bold text-silver-600 mb-4">单词块训练</h3>
                <p className="text-silver-400 font-medium leading-relaxed">
                  告别孤立单词，掌握高频 Collocations，提升语言的流利度与自然感。
                </p>
                <div className="mt-8 flex items-center gap-2 text-primary-600 font-bold text-sm uppercase tracking-widest">
                  Start Practice <ArrowRight size={18} />
                </div>
              </button>
            </div>
            
            <section className="bg-silver-600 text-white rounded-[4rem] p-12 md:p-16 high-end-shadow flex flex-col md:flex-row items-center gap-12 overflow-hidden relative">
               <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
               <div className="flex-1 space-y-6">
                  <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/10 text-xs font-bold uppercase tracking-widest">
                    <TrendingUp size={14} /> AI Shadowing Engine
                  </div>
                  <h3 className="text-4xl font-black">沉浸式影子跟读</h3>
                  <p className="text-silver-300 font-medium text-lg leading-relaxed">
                    基于您已掌握的句模与词块，实时生成拟真对话。在律动中磨炼语感，实现从“刻意练习”到“自然反应”的蜕变。
                  </p>
                  <button 
                    onClick={() => setMode(AppMode.REVIEW_SHADOWING)}
                    className="bg-white text-silver-600 px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-primary-100 hover:text-primary-700 transition-all"
                  >
                    开始跟读 Session
                  </button>
               </div>
               <div className="w-full md:w-1/3 flex justify-center">
                  <div className="w-48 h-48 rounded-full border-[10px] border-white/10 flex items-center justify-center animate-pulse">
                     <Repeat size={64} className="text-white/20" />
                  </div>
               </div>
            </section>
          </div>
        )}

        {mode === AppMode.LEARN_SENTENCE && currentLearnMaterial && (
          <LearnCard material={currentLearnMaterial} onFinish={finishLearnMaterial} type={MaterialType.SENTENCE_TEMPLATE} />
        )}

        {mode === AppMode.LEARN_CHUNK && currentLearnMaterial && (
          <LearnCard material={currentLearnMaterial} onFinish={finishLearnMaterial} type={MaterialType.WORD_CHUNK} />
        )}

        {mode === AppMode.LIBRARY && (
          <LibraryView 
            templates={templateLibrary} 
            chunks={chunkLibrary} 
            rawSentences={rawSentences}
            onUpdateTemplates={setTemplateLibrary}
            onUpdateChunks={setChunkLibrary}
            onUpdateRaw={setRawSentences}
          />
        )}
      </main>

      {isUploadOpen && (
        <UploadDialog 
          onClose={() => setIsUploadOpen(false)} 
          onMaterialsAdded={(ts, cs, rs) => {
            setTemplateLibrary(prev => [...ts, ...prev]);
            setChunkLibrary(prev => [...cs, ...prev]);
            setRawSentences(prev => [...rs, ...prev]);
          }} 
        />
      )}
    </div>
  );
};

export default App;
