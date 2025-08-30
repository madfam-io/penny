import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Artifact } from '@penny/types';

interface AudioRendererProps {
  artifact: Artifact;
  theme?: 'light' | 'dark' | 'auto';
  interactive?: boolean;
  onError?: (error: Error) => void;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  className?: string;
}

const AudioRenderer: React.FC<AudioRendererProps> = ({
  artifact,
  theme = 'auto',
  interactive = true,
  onError,
  onLoadStart,
  onLoadEnd,\n  className = ''
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [loading, setLoading] = useState(true);
  const [waveform, setWaveform] = useState<number[]>([]);

  const isDarkMode = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const audioUrl = typeof artifact.content === 'string' ? artifact.content : artifact.content?.url || artifact.url;

  // Generate mock waveform data
  useEffect(() => {
    const mockWaveform = Array.from({ length: 100 }, () => Math.random() * 0.8 + 0.2);
    setWaveform(mockWaveform);
  }, []);

  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  }, []);

  const handleLoadedData = useCallback(() => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
    setLoading(false);
    onLoadEnd?.();
  }, [onLoadEnd]);

  const handleSeek = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const containerClasses = [
    'audio-renderer w-full h-full flex flex-col',
    isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {/* Audio metadata */}
      <div className="p-6 text-center">
        <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">\n          <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
       
       <h2 className="text-xl font-semibold mb-1">{artifact.title}</h2>
        {artifact.description && (\n          <p className="text-sm text-gray-600 dark:text-gray-400">{artifact.description}</p>
        )}
        
        {loading && (\n          <div className="mt-4 flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>\n            <span className="text-sm">Loading audio...</span>
          </div>
        )}
      </div>

      {/* Waveform visualization */}
      {!loading && waveform.length > 0 && (\n        <div className="px-6 mb-4">
          <div className="flex items-end justify-center h-24 space-x-1">
            {waveform.map((amplitude, index) => {
              const isActive = (index / waveform.length) <= (currentTime / duration);
              return (
                <div
                  key={index}
                  className={`w-1 rounded-full cursor-pointer transition-colors ${
                    isActive 
                      ? 'bg-blue-500' 
                      : isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
                  }`}
                  style={{ height: `${amplitude * 100}%` }}
                  onClick={() => {
                    const seekTime = (index / waveform.length) * duration;
                    handleSeek(seekTime);
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Audio controls */}
      <div className="px-6 pb-6">
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center space-x-2 text-sm">
            <span className="font-mono">{formatTime(currentTime)}</span>
            <div
             className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                handleSeek(percent * duration);
              }}
            >
              <div
               className="bg-blue-600 h-2 rounded-full transition-all"\n                style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
              />
            </div>
            <span className="font-mono">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center space-x-6">
          {/* Previous/Skip Back */}
          <button 
            onClick={() => handleSeek(Math.max(0, currentTime - 10))}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Skip back 10 seconds"
          >\n            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8L12.066 11.2zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8L4.066 11.2z" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            className="p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            disabled={loading}
          >
            {isPlaying ? (\n              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
              </svg>
            ) : (\n              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M19 10a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>

          {/* Next/Skip Forward */}
          <button 
            onClick={() => handleSeek(Math.min(duration, currentTime + 10))}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Skip forward 10 seconds"
          >\n            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
            </svg>
          </button>
        </div>

        {/* Volume and additional controls */}
        <div className="flex items-center justify-between mt-6">
          {/* Volume */}
          <div className="flex items-center space-x-2">
            <button className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">\n              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 21H5a2 2 0 01-2-2v-8a2 2 0 012-2h4l7-7v22l-7-7z" />
              </svg>
            </button>
            <input\n              type="range"\n              min="0"\n              max="1"\n              step="0.1"
              value={volume}
              onChange={(e) => {
                const newVolume = parseFloat(e.target.value);
                setVolume(newVolume);
                if (audioRef.current) {
                  audioRef.current.volume = newVolume;
                }
              }}
              className="w-20 h-1 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Additional info */}
          <div className="text-xs text-gray-500 dark:text-gray-400">\n            {artifact.size && `${Math.round(artifact.size / 1024)} KB`}
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedData={handleLoadedData}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={() => onError?.(new Error('Failed to load audio'))}
        />
      )}

      {/* No audio message */}
      {!audioUrl && (\n        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">\n            <div className="text-gray-400 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 21H5a2 2 0 01-2-2v-8a2 2 0 012-2h4l7-7v22l-7-7z" />
              </svg>
            </div>\n            <h3 className="text-lg font-medium mb-2">No Audio to Play</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Audio content is not available</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioRenderer;