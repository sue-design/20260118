
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Mic, Volume2, VolumeX, RotateCcw, ArrowLeft, Loader2 } from 'lucide-react';
import { ShadowingLine } from '../types';
import { generateSpeech, decodeBase64, decodeAudioData } from '../services/geminiService';

interface ShadowingSessionProps {
  lines: ShadowingLine[];
  onBack: () => void;
}

const ShadowingSession: React.FC<ShadowingSessionProps> = ({ lines, onBack }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [loadingAudio, setLoadingAudio] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Auto scroll effect
  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.children[currentIndex] as HTMLElement;
      if (activeEl) {
        scrollRef.current.scrollTo({
          top: activeEl.offsetTop - scrollRef.current.clientHeight / 2 + activeEl.clientHeight / 2,
          behavior: 'smooth'
        });
      }
    }
  }, [currentIndex]);

  // Clean up audio resources on component unmount
  useEffect(() => {
    return () => {
      if (currentSourceRef.current) {
        currentSourceRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handlePlay = async () => {
    if (lines.length === 0) return;
    setIsPlaying(true);
    playLine(0);
  };

  const playLine = async (index: number) => {
    if (index >= lines.length) {
      setIsPlaying(false);
      setCurrentIndex(0);
      return;
    }

    setCurrentIndex(index);

    if (audioEnabled) {
      setLoadingAudio(true);
      const audioData = await generateSpeech(lines[index].korean);
      setLoadingAudio(false);
      
      if (audioData) {
        try {
          // Initialize AudioContext on demand
          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
          }
          const ctx = audioContextRef.current;
          const bytes = decodeBase64(audioData);
          const buffer = await decodeAudioData(bytes, ctx, 24000, 1);
          
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          
          source.onended = () => {
            // Proceed to the next line only if playback is still active
            if (isPlaying) {
              setTimeout(() => {
                playLine(index + 1);
              }, 800);
            }
          };
          
          currentSourceRef.current = source;
          source.start();
        } catch (e) {
          console.error("Playback failed", e);
          setTimeout(() => { if (isPlaying) playLine(index + 1); }, 3000);
        }
      } else {
        // Fallback for failed TTS generation
        setTimeout(() => { if (isPlaying) playLine(index + 1); }, 3000);
      }
    } else {
      // Manual delay for visual-only mode
      setTimeout(() => {
        if (isPlaying) playLine(index + 1);
      }, 3500);
    }
  };

  const togglePlayback = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (currentSourceRef.current) {
        currentSourceRef.current.stop();
        currentSourceRef.current = null;
      }
    } else {
      handlePlay();
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      setAudioEnabled(false);
      handlePlay();
    } else {
      setIsPlaying(false);
      if (currentSourceRef.current) {
        currentSourceRef.current.stop();
        currentSourceRef.current = null;
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-[70] flex flex-col text-white">
      {/* Top Bar */}
      <div className="p-6 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center gap-2">
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">退出</span>
        </button>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`p-2 rounded-full transition-colors ${audioEnabled ? 'bg-indigo-600 text-white' : 'bg-white/10 text-gray-400'}`}
          >
            {audioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        </div>
      </div>

      {/* Lyrics Container */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar px-6 py-[40vh] space-y-24 scroll-smooth"
      >
        {lines.map((line, idx) => (
          <div 
            key={idx}
            className={`transition-all duration-700 text-center flex flex-col items-center gap-4 ${
              currentIndex === idx 
                ? 'opacity-100 scale-110' 
                : 'opacity-20 scale-90 blur-[1px]'
            }`}
          >
            <h2 className="text-3xl md:text-5xl font-bold korean-text max-w-4xl leading-snug">
              {line.korean}
            </h2>
            <p className="text-lg md:text-xl text-gray-400 font-medium max-w-2xl">
              {line.chinese}
            </p>
          </div>
        ))}
      </div>

      {/* Bottom Controls */}
      <div className="p-10 bg-gradient-to-t from-black to-transparent flex flex-col items-center gap-6">
        <div className="flex items-center gap-12">
          <button className="p-3 text-gray-400 hover:text-white transition-colors" onClick={() => setCurrentIndex(0)}>
            <RotateCcw size={28} />
          </button>
          
          <button 
            onClick={togglePlayback}
            className="w-20 h-20 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-xl shadow-white/10"
          >
            {loadingAudio ? <Loader2 className="animate-spin" /> : isPlaying ? <Pause size={36} fill="black" /> : <Play size={36} fill="black" className="ml-2" />}
          </button>

          <button 
            onClick={toggleRecording}
            className={`p-4 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white scale-125 animate-pulse' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            <Mic size={28} />
          </button>
        </div>
        
        <p className="text-xs font-medium text-gray-500 uppercase tracking-[0.2em]">
          {isRecording ? "正在录音跟读中..." : isPlaying ? "影子跟读进行中" : "点击播放开始跟读"}
        </p>
      </div>
    </div>
  );
};

export default ShadowingSession;
