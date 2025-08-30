import React, { useRef, useState, useCallback } from 'react';
import { Artifact } from '@penny/types';

interface VideoRendererProps {
  artifact: Artifact;
  theme?: 'light' | 'dark' | 'auto';
  interactive?: boolean;
  onError?: (error: Error) => void;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  className?: string;
}

const VideoRenderer: React.FC<VideoRendererProps> = ({
  artifact,
  theme = 'auto',
  interactive = true,
  onError,
  onLoadStart,
  onLoadEnd,\n  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [loading, setLoading] = useState(true);

  const videoUrl = typeof artifact.content === 'string' ? artifact.content : artifact.content?.url || artifact.url;

  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  }, []);

  const handleLoadedData = useCallback(() => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    setLoading(false);
    onLoadEnd?.();
  }, [onLoadEnd]);

  const handleSeek = useCallback((time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const containerClasses = [
    'video-renderer w-full h-full flex flex-col bg-black',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {/* Video */}
      <div className="flex-1 flex items-center justify-center relative">
        {loading && (\n          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="flex items-center space-x-2 text-white">\n              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              <span className="text-sm">Loading video...</span>
            </div>
          </div>
        )}
        
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="max-w-full max-h-full"
            onTimeUpdate={handleTimeUpdate}
            onLoadedData={handleLoadedData}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={() => onError?.(new Error('Failed to load video'))}
            controls={false}
          />
        ) : (\n          <div className="text-center text-white">
            <div className="text-gray-400 mb-2">\n              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>\n            <h3 className="text-lg font-medium mb-2">No Video to Display</h3>
            <p className="text-sm text-gray-400">Video content is not available</p>
          </div>
        )}
      </div>

      {/* Video Controls */}
      {videoUrl && (\n        <div className="bg-gray-900 text-white p-4 space-y-3">
          {/* Progress Bar */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono">{formatTime(currentTime)}</span>\n            <div className="flex-1 bg-gray-700 rounded-full h-2 cursor-pointer" 
                 onClick={(e) => {
                   const rect = e.currentTarget.getBoundingClientRect();
                   const percent = (e.clientX - rect.left) / rect.width;
                   handleSeek(percent * duration);
                 }}>
              <div
               className="bg-blue-600 h-2 rounded-full transition-all"\n                style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
              />
            </div>
            <span className="text-xs font-mono">{formatTime(duration)}</span>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePlayPause}
                className="p-2 rounded-full hover:bg-gray-800 transition-colors"
              >
                {isPlaying ? (\n                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (\n                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M19 10a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </button>

              {/* Volume */}
              <div className="flex items-center space-x-2">
                <button className="p-1 rounded hover:bg-gray-800">\n                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 21H5a2 2 0 01-2-2v-8a2 2 0 012-2h4l7-7v22l-7-7z" />
                  </svg>
                </button>
                <input\n                  type="range"\n                  min="0"\n                  max="1"\n                  step="0.1"
                  value={volume}
                  onChange={(e) => {
                    const newVolume = parseFloat(e.target.value);
                    setVolume(newVolume);
                    if (videoRef.current) {
                      videoRef.current.volume = newVolume;
                    }
                  }}
                  className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
\n            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400">
                {artifact.metadata?.dimensions ?
                 `${artifact.metadata.dimensions.width}x${artifact.metadata.dimensions.height}` : 
                  'Video'
                }
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoRenderer;