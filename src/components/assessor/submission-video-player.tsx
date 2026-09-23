// ─────────────────────────────────────────────────────────────
// src/components/assessor/submission-video-player.tsx
// HTML5 Video Player with BlazePose Skeleton Overlay & Scrubber Annotations
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getSignedVideoUrl } from '@/lib/storage/video-storage';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  PlusCircle,
  Clock,
  Trash2,
  MessageSquare,
  Sparkles,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PoseLandmark, PosePoint } from '@/types/database';

export interface VideoAnnotation {
  id: string;
  timestamp: number; // in seconds
  text: string;
  category: 'technique' | 'safety' | 'commendable' | 'deficiency';
  author: string;
  createdAt: string;
}

interface SubmissionVideoPlayerProps {
  videoUrl: string | null;
  submissionId: string;
  landmarks?: PoseLandmark[];
  annotations: VideoAnnotation[];
  onAddAnnotation: (annotation: VideoAnnotation) => void;
  onDeleteAnnotation?: (id: string) => void;
  assessorName: string;
}

const BLAZEPOSE_CONNECTIONS: Array<[number, number]> = [
  // Face / Head
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
  // Shoulders & Torso
  [11, 12], [11, 23], [12, 24], [23, 24],
  // Arms
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  // Legs
  [23, 25], [24, 26], [25, 27], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32]
];

export function SubmissionVideoPlayer({
  videoUrl,
  submissionId,
  landmarks = [],
  annotations,
  onAddAnnotation,
  onDeleteAnnotation,
  assessorName,
}: SubmissionVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>();

  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showSkeleton, setShowSkeleton] = useState<boolean>(true);

  // Annotation input state
  const [isAddingAnnotation, setIsAddingAnnotation] = useState<boolean>(false);
  const [annotationText, setAnnotationText] = useState<string>('');
  const [annotationCategory, setAnnotationCategory] = useState<VideoAnnotation['category']>('technique');

  // 1. Fetch short-lived signed URL or local offline blob
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingUrl(true);

    getSignedVideoUrl(videoUrl, submissionId, 900)
      .then((url) => {
        if (!isCancelled) {
          setPlaybackUrl(url);
          setIsLoadingUrl(false);
        }
      })
      .catch((e) => {
        console.warn('[SubmissionVideoPlayer] Signed URL resolution error:', e);
        if (!isCancelled) {
          setPlaybackUrl(null);
          setIsLoadingUrl(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [videoUrl, submissionId]);

  // 2. Format time helper (m:ss.s)
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // 3. Play / Pause toggle
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch((e) => console.warn('Play error:', e));
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // 4. Seek handler
  const handleSeek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  };

  // 5. Playback rate changer
  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  // 6. Skeleton landmark overlay rendering loop
  const renderSkeletonOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match canvas dimensions to video element
    const rect = video.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width;
    const height = rect.height;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    ctx.clearRect(0, 0, width, height);

    if (showSkeleton && landmarks.length > 0) {
      const currentMs = video.currentTime * 1000;

      // Find landmark frame closest to current playback time
      let closestFrame: PoseLandmark | null = null;
      let minDelta = Infinity;

      for (const f of landmarks) {
        const delta = Math.abs(f.timestamp_ms - currentMs);
        if (delta < minDelta) {
          minDelta = delta;
          closestFrame = f;
        }
      }

      // Render landmarks if within 600ms of current frame
      if (closestFrame && minDelta < 600 && closestFrame.points) {
        const pts = closestFrame.points;
        const ptMap = new Map<number, PosePoint>();
        pts.forEach((p, idx) => ptMap.set(idx, p));

        // Draw connections
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8;

        for (const [i1, i2] of BLAZEPOSE_CONNECTIONS) {
          const p1 = ptMap.get(i1);
          const p2 = ptMap.get(i2);
          if (p1 && p2 && (p1.visibility ?? 1) > 0.4 && (p2.visibility ?? 1) > 0.4) {
            ctx.beginPath();
            ctx.moveTo(p1.x * width, p1.y * height);
            ctx.lineTo(p2.x * width, p2.y * height);
            ctx.stroke();
          }
        }

        // Draw joint nodes
        for (const p of pts) {
          if ((p.visibility ?? 1) > 0.4) {
            const x = p.x * width;
            const y = p.y * height;

            ctx.shadowBlur = 10;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, 3.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(renderSkeletonOverlay);
  }, [showSkeleton, landmarks]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(renderSkeletonOverlay);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [renderSkeletonOverlay]);

  // 7. Add annotation at current scrubber position
  const handleSaveAnnotation = () => {
    if (!annotationText.trim()) return;

    const newAnnotation: VideoAnnotation = {
      id: `ann-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Math.round(currentTime * 10) / 10,
      text: annotationText.trim(),
      category: annotationCategory,
      author: assessorName || 'Assessor',
      createdAt: new Date().toISOString(),
    };

    onAddAnnotation(newAnnotation);
    setAnnotationText('');
    setIsAddingAnnotation(false);
  };

  const getCategoryBadge = (category: VideoAnnotation['category']) => {
    switch (category) {
      case 'safety':
        return <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-2.5 w-2.5" /> Safety</Badge>;
      case 'commendable':
        return <Badge className="bg-emerald-600/90 text-white text-[10px] gap-1"><CheckCircle className="h-2.5 w-2.5" /> Good</Badge>;
      case 'deficiency':
        return <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-[10px] gap-1">Deficiency</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] gap-1"><Sparkles className="h-2.5 w-2.5" /> Technique</Badge>;
    }
  };

  return (
    <Card className="overflow-hidden border border-border/80 shadow-sm">
      {/* ── Player Viewport ── */}
      <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
        {isLoadingUrl ? (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs font-mono">Generating secure 15-min signed playback token…</p>
          </div>
        ) : playbackUrl ? (
          <>
            <video
              ref={videoRef}
              src={playbackUrl}
              className="w-full h-full object-contain"
              playsInline
              muted={isMuted}
              onTimeUpdate={() => {
                if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
              }}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  setDuration(videoRef.current.duration);
                  videoRef.current.playbackRate = playbackRate;
                }
              }}
              onEnded={() => setIsPlaying(false)}
              onClick={togglePlay}
            />
            {/* BlazePose Skeleton Overlay Canvas */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 pointer-events-none w-full h-full"
            />
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-slate-400">
            <p className="text-sm font-semibold text-slate-200">Video Evidence Encrypted or Offline</p>
            <p className="text-xs max-w-xs text-slate-400">
              No direct video link found for submission. Pose landmark telemetry remains preserved in audit storage.
            </p>
          </div>
        )}

        {/* Overlay Badges */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] backdrop-blur-md cursor-pointer transition-all border font-mono',
              showSkeleton
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-black/60 text-slate-400 border-slate-700'
            )}
            onClick={() => setShowSkeleton(!showSkeleton)}
          >
            {showSkeleton ? (
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> BlazePose Overlay ON</span>
            ) : (
              <span className="flex items-center gap-1"><EyeOff className="h-3 w-3" /> BlazePose Overlay OFF</span>
            )}
          </Badge>
          <Badge className="bg-black/75 text-slate-200 text-[10px] font-mono border border-slate-800">
            {formatTime(currentTime)} / {formatTime(duration)}
          </Badge>
        </div>
      </div>

      {/* ── Scrubber & Interactive Timeline with Annotation Markers ── */}
      <div className="px-4 pt-3 pb-2 bg-card border-b border-border/40">
        <div className="relative flex items-center h-4 group cursor-pointer">
          <input
            type="range"
            min="0"
            max={duration > 0 ? duration : 100}
            step="0.05"
            value={currentTime}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
          />

          {/* Annotation markers on timeline */}
          {duration > 0 &&
            annotations.map((ann) => {
              const leftPct = Math.min(100, Math.max(0, (ann.timestamp / duration) * 100));
              return (
                <div
                  key={ann.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSeek(ann.timestamp);
                  }}
                  title={`[${formatTime(ann.timestamp)}] ${ann.text}`}
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-400 border border-black shadow hover:scale-150 transition-transform z-10"
                  style={{ left: `${leftPct}%` }}
                />
              );
            })}
        </div>

        {/* Controls row */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-foreground"
              onClick={togglePlay}
              disabled={!playbackUrl}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleSeek(0)}
              disabled={!playbackUrl}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </Button>
            <span className="font-mono text-[11px]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Slow-mo technique playback rates */}
            <div className="flex items-center rounded border p-0.5 bg-muted/30">
              {[0.5, 1, 1.5].map((rate) => (
                <button
                  key={rate}
                  onClick={() => handleRateChange(rate)}
                  className={cn(
                    'px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors',
                    playbackRate === rate ? 'bg-primary text-primary-foreground font-bold' : 'hover:text-foreground'
                  )}
                >
                  {rate}x
                </button>
              ))}
            </div>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/5"
              onClick={() => setIsAddingAnnotation(true)}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Remark at {formatTime(currentTime)}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Timestamped Remarks / Annotations Section ── */}
      <CardContent className="p-3 bg-muted/10 space-y-3">
        {isAddingAnnotation && (
          <div className="p-3 rounded-lg border border-primary/30 bg-background space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Add Remark at timestamp <span className="font-mono text-primary font-bold">{formatTime(currentTime)}</span>
              </span>
              <div className="flex gap-1">
                {(['technique', 'safety', 'commendable', 'deficiency'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setAnnotationCategory(cat)}
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded capitalize transition-colors',
                      annotationCategory === cat ? 'bg-primary text-primary-foreground font-semibold' : 'bg-muted hover:text-foreground'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <Input
              placeholder="e.g. Compression rate dropped slightly between compressions 12-16..."
              value={annotationText}
              onChange={(e) => setAnnotationText(e.target.value)}
              className="text-xs h-8"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveAnnotation();
              }}
            />

            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setIsAddingAnnotation(false)}>
                Cancel
              </Button>
              <Button size="sm" className="h-7 text-xs bg-primary text-primary-foreground font-semibold" onClick={handleSaveAnnotation}>
                Save Remark
              </Button>
            </div>
          </div>
        )}

        {/* Existing Annotations List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              Assessor Timestamped Evidence Trail ({annotations.length})
            </p>
          </div>

          {annotations.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-1">
              No remarks added yet. Scrub to any timestamp and click &quot;Remark at [time]&quot; to document technique observations.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {annotations
                .slice()
                .sort((a, b) => a.timestamp - b.timestamp)
                .map((ann) => (
                  <div
                    key={ann.id}
                    className="flex items-start justify-between gap-2 p-2 rounded-md border border-border/50 bg-background text-xs hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => handleSeek(ann.timestamp)}
                        className="font-mono text-[11px] font-bold text-primary hover:underline shrink-0 bg-primary/10 px-1.5 py-0.5 rounded"
                      >
                        {formatTime(ann.timestamp)}
                      </button>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          {getCategoryBadge(ann.category)}
                          <span className="text-[10px] text-muted-foreground">by {ann.author}</span>
                        </div>
                        <p className="text-xs text-foreground/90">{ann.text}</p>
                      </div>
                    </div>

                    {onDeleteAnnotation && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => onDeleteAnnotation(ann.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
