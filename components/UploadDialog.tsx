
import React, { useState } from 'react';
import { X, Loader2, Sparkles, Trash2, Check, FileText } from 'lucide-react';
import { SentenceTemplate, WordChunk, RawSentence } from '../types';
import { extractMaterialsAuto } from '../services/geminiService';

interface UploadDialogProps {
  onClose: () => void;
  onMaterialsAdded: (templates: SentenceTemplate[], chunks: WordChunk[], rawSentences: RawSentence[]) => void;
}

const UploadDialog: React.FC<UploadDialogProps> = ({ onClose, onMaterialsAdded }) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [extractedTemplates, setExtractedTemplates] = useState<SentenceTemplate[]>([]);
  const [extractedChunks, setExtractedChunks] = useState<WordChunk[]>([]);
  const [tempRawSentences, setTempRawSentences] = useState<RawSentence[]>([]);

  const handleProcess = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    setProgress({ current: 0, total: 0 });

    // 1. Split input into individual raw sentences immediately
    // Improved splitting to handle common list markers and empty lines
    const lines = inputText
      .split(/\n+/)
      .map(l => l.replace(/^[0-9]+[.\s]+/, '').trim())
      .filter(l => l.length > 3); 
    
    const newRawSentences: RawSentence[] = lines.map(line => ({
      id: Math.random().toString(36).substr(2, 9),
      text: line,
      source: `Batch Upload ${new Date().toLocaleDateString()}`,
      isProcessed: true,
      practiceCount: 0
    }));
    setTempRawSentences(newRawSentences);
    
    try {
      // 2. Extract materials using AI
      const { templates, chunks } = await extractMaterialsAuto(inputText, (current, total) => {
        setProgress({ current, total });
      });
      
      // 3. Associate extracted items with the correct RawSentence ID using better matching
      const processedTemplates = (templates || []).map((t, index) => {
        // Clean pattern for matching
        const cleanPattern = (t.pattern || '').replace(/[~.]/g, '').trim();
        
        // Find best match in raw lines
        let sourceLine = newRawSentences.find(rs => rs.text.includes(cleanPattern));
        
        // If no direct include, fallback to a rotating distribution based on extraction order to prevent clustering
        if (!sourceLine && newRawSentences.length > 0) {
          sourceLine = newRawSentences[index % newRawSentences.length];
        }

        return {
          id: Math.random().toString(36).substr(2, 9),
          pattern: t.pattern || '',
          topic: t.topic || 'General',
          sourceId: sourceLine?.id,
          examples: (t.examples || []).map(ex => ({ 
            kr: ex.kr || '', 
            cn: ex.cn || '', 
            mastery: 0, 
            lastReviewed: Date.now() 
          }))
        };
      }) as SentenceTemplate[];

      const processedChunks = (chunks || []).map((c, index) => {
        const cleanRoot = (c.root || '').trim();
        let sourceLine = newRawSentences.find(rs => rs.text.includes(cleanRoot));
        
        if (!sourceLine && newRawSentences.length > 0) {
          sourceLine = newRawSentences[index % newRawSentences.length];
        }

        return {
          id: Math.random().toString(36).substr(2, 9),
          root: c.root || '',
          translation: c.translation || '',
          topic: c.topic || 'General',
          sourceId: sourceLine?.id,
          variations: (c.variations || []).map(v => ({ 
            kr: v.kr || '', 
            mastery: 0, 
            lastReviewed: Date.now() 
          }))
        };
      }) as WordChunk[];

      setExtractedTemplates(processedTemplates);
      setExtractedChunks(processedChunks);
      setStep('review');
    } catch (err) {
      alert("AI 分析失败，请检查网络。");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = () => {
    onMaterialsAdded(extractedTemplates, extractedChunks, tempRawSentences);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-silver-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-3xl rounded-[2.5rem] high-end-shadow overflow-hidden animate-in fade-in zoom-in duration-300 border border-silver-100">
        <div className="p-8 border-b border-silver-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-silver-600">
                {step === 'input' ? '语料分行提取' : '核对语料资产'}
              </h2>
              <p className="text-xs text-silver-400 font-medium">
                {step === 'input' 
                  ? '粘贴多行韩语，每一行都会被独立记录并追踪练习次数' 
                  : `识别到 ${tempRawSentences.length} 条原始句，提取 ${extractedTemplates.length} 个句模`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-silver-50 rounded-full transition-colors text-silver-400">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {step === 'input' ? (
            <div className="space-y-8">
              <div className="relative">
                <textarea
                  className="w-full h-80 p-8 bg-silver-50/50 border border-silver-100 rounded-[2rem] focus:ring-4 focus:ring-primary-100 focus:border-primary-400 focus:outline-none text-base leading-relaxed text-silver-600 transition-all custom-scrollbar"
                  placeholder="在此粘贴分行的语料。支持 180+ 句子批量处理..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isProcessing}
                />
                {isProcessing && (
                   <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] rounded-[2rem] flex flex-col items-center justify-center space-y-4 animate-in fade-in">
                      <Loader2 className="animate-spin text-primary-600" size={40} />
                      <div className="text-center px-10">
                        <p className="text-silver-600 font-bold">深度分析并拆解中...</p>
                        <p className="text-xs text-silver-400 font-medium">处理分片: {progress.current} / {progress.total}</p>
                      </div>
                   </div>
                )}
              </div>
              <button
                onClick={handleProcess}
                disabled={!inputText.trim() || isProcessing}
                className="w-full bg-primary-600 text-white py-6 rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-primary-700 transition-all flex items-center justify-center gap-4 high-end-shadow active:scale-95 disabled:opacity-40"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
                {isProcessing ? '处理中...' : '开始 AI 批量提取'}
              </button>
            </div>
          ) : (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-6 bg-silver-50 rounded-2xl border border-silver-100">
                <h4 className="text-xs font-black text-silver-400 uppercase tracking-widest mb-4">入库预览 ({tempRawSentences.length} 原始素材)</h4>
                <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                   {tempRawSentences.slice(0, 10).map((s, i) => (
                     <div key={i} className="text-sm text-silver-500 truncate korean-text flex gap-2">
                       <span className="text-silver-300 font-mono w-6">{i+1}.</span>
                       <span className="truncate">{s.text}</span>
                     </div>
                   ))}
                   {tempRawSentences.length > 10 && <div className="text-[10px] text-silver-300 italic pt-2 border-t border-silver-100">... 及其他 {tempRawSentences.length - 10} 条句子</div>}
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xs font-black text-primary-600 uppercase tracking-widest flex items-center gap-2">
                  <FileText size={14} /> 自动提取出的句模架构 ({extractedTemplates.length})
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {extractedTemplates.slice(0, 5).map((t, idx) => (
                    <div key={idx} className="p-4 bg-primary-50/50 rounded-xl border border-primary-100 flex items-center justify-between">
                      <span className="font-bold text-primary-600 korean-text">{t.pattern}</span>
                      <span className="text-[9px] text-primary-400 font-bold uppercase tracking-widest px-2 py-1 bg-white rounded-full border border-primary-100">Associated</span>
                    </div>
                  ))}
                  {extractedTemplates.length > 5 && <div className="text-center text-xs text-silver-400 italic">更多内容将在入库后自动分发</div>}
                </div>
              </div>

              <button onClick={handleSave} className="w-full bg-primary-600 text-white py-6 rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-primary-700 transition-all flex items-center justify-center gap-4 high-end-shadow active:scale-95">
                <Check size={20} />
                确认全部入库 ({tempRawSentences.length} 条)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadDialog;
