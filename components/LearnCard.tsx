
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Mic, CheckCircle, XCircle, Play, RotateCcw, Loader2, Keyboard, MessageSquareText, AlertCircle, Sparkles } from 'lucide-react';
import { Material, MaterialType } from '../types';
import { evaluateAudioResponse, checkAnswerFast, generateSpeech, playAudioSafely, stopGlobalAudio } from '../services/geminiService';

interface LearnCardProps {
  material: Material;
  onFinish: (mastered: boolean) => void;
  type: MaterialType;
}

const KOREAN_ONLY_REGEX = /[^\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF0-9\s.,?!~]/g;

const LearnCard: React.FC<LearnCardProps> = ({ material, onFinish, type }) => {
  const [inputMethod, setInputMethod] = useState<'voice' | 'text'>('voice');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [userTranscription, setUserTranscription] = useState<string>("");
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [typedAnswer, setTypedAnswer] = useState<string>("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [noAudioAlert, setNoAudioAlert] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    stopGlobalAudio();
    setIsRecording(false);
    setIsProcessing(false);
    setFeedback(null);
    setUserTranscription("");
    setLiveTranscript("");
    setTypedAnswer("");
    setShowAnswer(false);
    setNoAudioAlert(false);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ko-KR';
      
      recognition.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript;
        }
        const filtered = fullTranscript.replace(KOREAN_ONLY_REGEX, '');
        if (filtered.trim().length > 0) {
           setLiveTranscript(filtered);
           setNoAudioAlert(false);
        }
      };
      recognitionRef.current = recognition;
    }

    return () => {
      stopGlobalAudio();
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [material.id, material.original]);

  const startRecording = async () => {
    stopGlobalAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        // Validation: If no transcript was detected during recording, do not proceed to evaluation
        if (!liveTranscript.trim()) {
          setIsRecording(false);
          setIsProcessing(false);
          setNoAudioAlert(true);
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          processAudioOptimized(base64String);
        };
      };

      recorder.start();
      if (recognitionRef.current) {
        setLiveTranscript("");
        try { recognitionRef.current.start(); } catch (e) {}
      }
      setIsRecording(true);
      setNoAudioAlert(false);
      setFeedback(null);
      setUserTranscription("");
    } catch (err) { 
      console.error("Microphone access failed", err);
      alert("请允许麦克风访问。");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setIsRecording(false);
  };

  const processAudioOptimized = async (base64: string) => {
    setIsProcessing(true);
    try {
      const result = await evaluateAudioResponse(base64, material.translation);
      setUserTranscription(result.transcript || liveTranscript);
      setFeedback(result.feedback);
      setShowAnswer(true);
    } catch (err) {
      setFeedback("分析失败。");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const answer = typedAnswer.trim();
    if (!answer) return;
    setUserTranscription(answer);
    setIsProcessing(true);
    setTypedAnswer("");
    try {
      const aiFeedback = await checkAnswerFast(answer, material.translation);
      setFeedback(aiFeedback);
      setShowAnswer(true);
    } catch (err) {
      setFeedback("分析失败。");
    } finally {
      setIsProcessing(false);
    }
  };

  const playReference = async () => {
    const audioData = await generateSpeech(material.original);
    if (audioData) {
      playAudioSafely(audioData);
    }
  };

  const diffElements = useMemo(() => {
    if (!userTranscription) return null;
    const targetWords = material.original.split(/\s+/);
    const userWords = userTranscription.split(/\s+/);
    const elements: React.ReactNode[] = [];
    
    userWords.forEach((word, idx) => {
      const isCorrect = targetWords.includes(word);
      if (isCorrect) {
        elements.push(<span key={`u-${idx}`} className="text-silver-500">{word} </span>);
      } else {
        elements.push(<span key={`u-${idx}`} className="text-red-500 line-through decoration-2">{word} </span>);
      }
    });

    elements.push(<span key="divider" className="mx-2"> </span>);
    targetWords.forEach((word, idx) => {
       if (!userWords.includes(word)) {
         elements.push(<span key={`t-${idx}`} className="text-blue-500 font-bold">{word} </span>);
       }
    });
    return elements;
  }, [userTranscription, material.original]);

  return (
    <div className="max-w-2xl mx-auto mt-12 px-4 animate-in fade-in duration-500">
      <div className="bg-white rounded-[2.5rem] high-end-shadow overflow-hidden border border-silver-100 flex flex-col min-h-[580px]">
        
        {/* TOP SECTION: Prompt Always Visible (Cream Style) */}
        <div className="bg-[#fdf6e9] pt-12 pb-14 px-10 border-b border-[#f3ead9] flex flex-col items-center text-center space-y-5">
          <p className="text-silver-400 text-[10px] font-black uppercase tracking-[0.3em]">Translate this to Korean</p>
          <h3 className="text-3xl md:text-4xl font-bold text-silver-700 leading-tight korean-text">
            {material.translation}
          </h3>
        </div>

        <div className="flex-1 p-10 flex flex-col items-center justify-center text-center space-y-12">
          
          {/* Waiting/Initial State */}
          {!showAnswer && !isRecording && !isProcessing && (
            <div className="space-y-6 animate-in fade-in duration-500">
               {noAudioAlert ? (
                 <div className="flex flex-col items-center gap-3 text-red-400">
                    <AlertCircle size={48} className="animate-bounce" />
                    <p className="text-sm font-bold">未检测到有效语音，请重试</p>
                 </div>
               ) : (
                 <div className="flex flex-col items-center gap-4 text-silver-300">
                    <Mic size={64} className="opacity-10" />
                    <p className="text-sm font-medium italic opacity-60 tracking-wider">Listening standby...</p>
                 </div>
               )}
            </div>
          )}

          {/* Real-time Recognition View */}
          {(isRecording || (isProcessing && !userTranscription && liveTranscript)) && (
            <div className="w-full flex flex-col items-center gap-6 animate-in zoom-in duration-300">
              <div className="flex items-center gap-2 text-primary-500 font-bold text-[10px] uppercase tracking-widest">
                <Sparkles size={14} className="animate-spin" />
                {isRecording ? "Recording..." : "Analyzing Voice..."}
              </div>
              <div className="px-10 py-10 bg-primary-50/20 rounded-[3rem] border border-dashed border-primary-200/50 min-h-[140px] flex items-center justify-center w-full shadow-inner animate-pulse">
                <p className="text-2xl font-bold text-primary-600 korean-text leading-relaxed">
                  {liveTranscript || "Speak clearly now..."}
                </p>
              </div>
            </div>
          )}

          {/* Result View (Matching Screenshot Palette) */}
          {showAnswer && userTranscription && !isRecording && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 space-y-12 w-full flex flex-col items-center">
              <div className="flex items-center justify-center gap-6 group">
                <h2 className="text-4xl md:text-5xl font-black text-[#2d3494] korean-text leading-tight tracking-tight">
                  {material.original}
                </h2>
                <button 
                  onClick={playReference} 
                  className="w-14 h-14 bg-silver-50 text-silver-400 rounded-full flex items-center justify-center hover:bg-primary-100 hover:text-primary-600 transition-all hover:scale-110 active:scale-95 shadow-sm"
                >
                  <Play size={28} fill="currentColor" className="ml-1" />
                </button>
              </div>

              <div className="w-full max-w-lg p-12 bg-silver-50/40 rounded-[3rem] border border-silver-100/30 relative">
                <div className="absolute top-5 left-8 text-[9px] font-black text-silver-300 uppercase tracking-[0.3em]">Comparison</div>
                <div className="text-xl md:text-2xl leading-relaxed korean-text font-medium text-center">
                  {diffElements}
                </div>
              </div>

              {feedback && (
                <div className="max-w-md text-xs text-silver-400 font-medium italic border-t border-silver-50 pt-8 px-6 leading-relaxed opacity-80">
                  {feedback}
                </div>
              )}
            </div>
          )}

          {!showAnswer && !userTranscription && !isRecording && inputMethod === 'text' && (
            <form onSubmit={handleTextSubmit} className="w-full max-w-md animate-in fade-in zoom-in duration-300">
              <input 
                autoFocus 
                type="text" 
                placeholder="键入韩语翻译..." 
                className="w-full px-8 py-6 bg-silver-50/50 border border-silver-100 rounded-[2rem] focus:ring-4 focus:ring-primary-100 focus:border-primary-400 focus:outline-none text-xl korean-text text-silver-600 shadow-inner" 
                value={typedAnswer} 
                onChange={(e) => setTypedAnswer(e.target.value)} 
              />
              <p className="text-[10px] text-silver-300 mt-6 font-bold uppercase tracking-widest">Press Enter to check</p>
            </form>
          )}
        </div>

        {/* BOTTOM CONTROLS */}
        <div className="p-10 border-t border-silver-50 bg-white">
          <div className="flex items-center justify-between gap-6">
            <button 
              onClick={() => onFinish(false)} 
              className="px-6 py-2 text-silver-300 hover:text-silver-500 font-bold text-[10px] uppercase tracking-widest transition-colors"
            >
              Skip
            </button>
            
            <div className="flex-1 flex items-center justify-center">
              {isProcessing ? (
                <div className="flex items-center gap-3 text-primary-600 font-black text-xs tracking-widest uppercase">
                  <Loader2 className="animate-spin" size={20} /> Analyzing Output
                </div>
              ) : isRecording ? (
                <button 
                  onClick={stopRecording} 
                  className="flex items-center gap-3 bg-red-500 text-white px-12 py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-red-600 transition-all shadow-xl shadow-red-100 animate-pulse active:scale-95"
                >
                  <XCircle size={20} /> Finish
                </button>
              ) : showAnswer ? (
                <div className="flex items-center gap-4">
                  <button onClick={() => onFinish(false)} className="px-8 py-5 bg-silver-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-silver-700 transition-all high-end-shadow flex items-center gap-2 active:scale-95">
                    <AlertCircle size={18} /> <span>Try Again</span>
                  </button>
                  <button onClick={() => onFinish(true)} className="px-12 py-5 bg-primary-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-primary-700 transition-all high-end-shadow flex items-center gap-2 active:scale-95">
                    <CheckCircle size={18} /> <span>Mastered</span>
                  </button>
                  <button 
                    onClick={() => { 
                      stopGlobalAudio(); 
                      setShowAnswer(false); 
                      setUserTranscription(""); 
                      setLiveTranscript(""); 
                      setNoAudioAlert(false); 
                    }} 
                    className="p-4 text-silver-300 hover:text-primary-600 transition-colors"
                  >
                    <RotateCcw size={22} />
                  </button>
                </div>
              ) : inputMethod === 'voice' ? (
                <button 
                  onClick={startRecording} 
                  className="flex items-center gap-4 bg-primary-600 text-white px-16 py-6 rounded-[2.5rem] font-black text-sm uppercase tracking-widest hover:bg-primary-700 transition-all high-end-shadow hover:scale-105 active:scale-95"
                >
                  <Mic size={24} /> Start Speaking
                </button>
              ) : (
                <button 
                  onClick={handleTextSubmit} 
                  disabled={!typedAnswer.trim()} 
                  className="flex items-center gap-4 bg-primary-600 text-white px-16 py-6 rounded-[2.5rem] font-black text-sm uppercase tracking-widest hover:bg-primary-700 transition-all high-end-shadow disabled:opacity-40 active:scale-95"
                >
                  <MessageSquareText size={24} /> Submit
                </button>
              )}
            </div>

            <div className="flex bg-silver-50 p-1.5 rounded-2xl border border-silver-100">
              <button 
                onClick={() => setInputMethod('voice')} 
                className={`p-3 rounded-xl transition-all ${inputMethod === 'voice' ? 'bg-white text-primary-600 shadow-md' : 'text-silver-300'}`}
              >
                <Mic size={20} />
              </button>
              <button 
                onClick={() => setInputMethod('text')} 
                className={`p-3 rounded-xl transition-all ${inputMethod === 'text' ? 'bg-white text-primary-600 shadow-md' : 'text-silver-300'}`}
              >
                <Keyboard size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearnCard;
