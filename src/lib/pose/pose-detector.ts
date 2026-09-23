// ─────────────────────────────────────────────────────────────
// src/lib/pose/pose-detector.ts
// Client-side MediaPipe BlazePose detector & frame analysis engine
// ─────────────────────────────────────────────────────────────

import { Pose, VERSION, type Results } from '@mediapipe/pose';
import type { PoseLandmark, PosePoint } from '@/types/database';

export const BLAZEPOSE_LANDMARK_NAMES: string[] = [
  'nose',
  'left_eye_inner',
  'left_eye',
  'left_eye_outer',
  'right_eye_inner',
  'right_eye',
  'right_eye_outer',
  'left_ear',
  'right_ear',
  'mouth_left',
  'mouth_right',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_pinky',
  'right_pinky',
  'left_index',
  'right_index',
  'left_thumb',
  'right_thumb',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
  'left_heel',
  'right_heel',
  'left_foot_index',
  'right_foot_index',
];

export interface FrameQualitySignal {
  lightingScore: number; // 0–100 (based on luminance & contrast)
  lightingPassed: boolean;
  lightingLabel: string;
  framingScore: number; // 0–100 (torso & head visibility in view bounds)
  framingPassed: boolean;
  framingLabel: string;
  angleScore: number; // 0–100 (angle of view / keypoint accessibility)
  anglePassed: boolean;
  angleLabel: string;
  landmarks?: PosePoint[];
}

export class PoseDetectorService {
  private pose: Pose | null = null;
  private isReady = false;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private currentResults: Results | null = null;

  async init(): Promise<void> {
    if (this.isReady && this.pose) return;

    try {
      this.pose = new Pose({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${VERSION}/${file}`;
        },
      });

      this.pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      this.pose.onResults((results) => {
        this.currentResults = results;
      });

      await this.pose.initialize();
      this.isReady = true;
    } catch (err) {
      console.warn('[PoseDetector] Failed to initialize MediaPipe Pose, falling back to mock processor:', err);
    }
  }

  getReady(): boolean {
    return this.isReady;
  }

  /**
   * Evaluates lighting, body framing, and camera angle directly from an active video element.
   */
  async analyzeVideoFrame(video: HTMLVideoElement): Promise<FrameQualitySignal> {
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return {
        lightingScore: 0,
        lightingPassed: false,
        lightingLabel: 'Checking Lighting…',
        framingScore: 0,
        framingPassed: false,
        framingLabel: 'Detecting Body Framing…',
        angleScore: 0,
        anglePassed: false,
        angleLabel: 'Verifying Camera Angle…',
      };
    }

    // 1. Lighting Analysis via downsampled canvas
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = 160;
      this.offscreenCanvas.height = 120;
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    }

    let avgLuminance = 128;
    if (this.offscreenCtx) {
      this.offscreenCtx.drawImage(video, 0, 0, 160, 120);
      const imgData = this.offscreenCtx.getImageData(0, 0, 160, 120).data;
      let totalLuma = 0;
      const count = imgData.length / 4;
      for (let i = 0; i < imgData.length; i += 4) {
        // Rec. 601 Luma
        const luma = 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
        totalLuma += luma;
      }
      avgLuminance = totalLuma / count;
    }

    // Optimal luminance is around 60–210 out of 255
    let lightingScore = 0;
    if (avgLuminance >= 60 && avgLuminance <= 210) {
      lightingScore = 100;
    } else if (avgLuminance < 60) {
      lightingScore = Math.max(10, Math.round((avgLuminance / 60) * 100));
    } else {
      lightingScore = Math.max(10, Math.round(((255 - avgLuminance) / 45) * 100));
    }
    const lightingPassed = lightingScore >= 65;
    const lightingLabel = lightingPassed
      ? avgLuminance > 160
        ? 'Lighting: Bright & Clear'
        : 'Lighting: Optimal'
      : avgLuminance < 60
        ? 'Lighting: Too Dark'
        : 'Lighting: Too Harsh / Glare';

    // 2. Pose estimation for framing and angle
    let posePoints: PosePoint[] | undefined;
    if (this.pose && this.isReady) {
      try {
        await this.pose.send({ image: video });
        if (this.currentResults?.poseLandmarks) {
          posePoints = this.currentResults.poseLandmarks.map((lm, idx) => ({
            name: BLAZEPOSE_LANDMARK_NAMES[idx] ?? `point_${idx}`,
            x: lm.x,
            y: lm.y,
            z: lm.z ?? 0,
            visibility: lm.visibility ?? 1,
          }));
        }
      } catch (e) {
        console.warn('[PoseDetector] send frame error:', e);
      }
    }

    // 3. Framing Analysis
    let framingScore = 0;
    let framingPassed = false;
    let framingLabel = 'Detecting Body Framing…';

    if (posePoints && posePoints.length >= 25) {
      const leftShoulder = posePoints[11];
      const rightShoulder = posePoints[12];
      const leftHip = posePoints[23];
      const rightHip = posePoints[24];
      const nose = posePoints[0];

      const shouldersVisible = (leftShoulder.visibility ?? 0) > 0.4 && (rightShoulder.visibility ?? 0) > 0.4;
      const hipsVisible = (leftHip.visibility ?? 0) > 0.3 || (rightHip.visibility ?? 0) > 0.3;
      const noseVisible = (nose.visibility ?? 0) > 0.4;

      const inBounds =
        leftShoulder.x >= 0.05 && leftShoulder.x <= 0.95 &&
        rightShoulder.x >= 0.05 && rightShoulder.x <= 0.95 &&
        leftShoulder.y >= 0.05 && leftShoulder.y <= 0.85;

      if (shouldersVisible && inBounds && hipsVisible) {
        framingScore = 100;
        framingPassed = true;
        framingLabel = 'Framing: Full Torso Visible';
      } else if (shouldersVisible && noseVisible) {
        framingScore = 80;
        framingPassed = true;
        framingLabel = 'Framing: Upper Body Centered';
      } else if (shouldersVisible) {
        framingScore = 50;
        framingPassed = false;
        framingLabel = 'Framing: Move Back Slightly';
      } else {
        framingScore = 20;
        framingPassed = false;
        framingLabel = 'Framing: Step Into Frame';
      }
    } else {
      framingScore = 15;
      framingPassed = false;
      framingLabel = 'Framing: Stand in View';
    }

    // 4. Angle / Rescuer View Analysis
    let angleScore = 0;
    let anglePassed = false;
    let angleLabel = 'Verifying Camera Angle…';

    if (posePoints && posePoints.length >= 17) {
      const leftShoulder = posePoints[11];
      const rightShoulder = posePoints[12];
      const leftWrist = posePoints[15];
      const rightWrist = posePoints[16];

      const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
      const handsVisible = (leftWrist.visibility ?? 0) > 0.3 || (rightWrist.visibility ?? 0) > 0.3;

      if (shoulderWidth > 0.12 && handsVisible) {
        angleScore = 100;
        anglePassed = true;
        angleLabel = 'Angle: 45° Rescuer View Validated';
      } else if (shoulderWidth > 0.08) {
        angleScore = 75;
        anglePassed = true;
        angleLabel = 'Angle: Good Perspective';
      } else {
        angleScore = 40;
        anglePassed = false;
        angleLabel = 'Angle: Adjust to 45° View';
      }
    } else {
      angleScore = 20;
      anglePassed = false;
      angleLabel = 'Angle: Position Camera at 45°';
    }

    return {
      lightingScore,
      lightingPassed,
      lightingLabel,
      framingScore,
      framingPassed,
      framingLabel,
      angleScore,
      anglePassed,
      angleLabel,
      landmarks: posePoints,
    };
  }

  /**
   * Processes a video file by seeking through frames, running BlazePose,
   * and extracting the full time-series landmark sequence.
   */
  async processVideoFile(
    file: File,
    onProgress?: (progressPct: number, currentFrame: number) => void
  ): Promise<PoseLandmark[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      const fileUrl = URL.createObjectURL(file);
      video.src = fileUrl;

      video.onloadedmetadata = async () => {
        const duration = video.duration || 5;
        const fps = 15; // Extract at 15-30 fps for efficient analysis
        const totalFrames = Math.max(1, Math.floor(duration * fps));
        const intervalSec = 1 / fps;
        const landmarkSequence: PoseLandmark[] = [];

        let currentFrame = 0;

        const processNextFrame = async () => {
          if (currentFrame >= totalFrames) {
            URL.revokeObjectURL(fileUrl);
            resolve(landmarkSequence);
            return;
          }

          const targetTime = Math.min(duration, currentFrame * intervalSec);
          video.currentTime = targetTime;
        };

        video.onseeked = async () => {
          const timestamp_ms = Math.round(video.currentTime * 1000);
          let points: PosePoint[] = [];

          if (this.pose && this.isReady) {
            try {
              await this.pose.send({ image: video });
              if (this.currentResults?.poseLandmarks) {
                points = this.currentResults.poseLandmarks.map((lm, idx) => ({
                  name: BLAZEPOSE_LANDMARK_NAMES[idx] ?? `point_${idx}`,
                  x: lm.x,
                  y: lm.y,
                  z: lm.z ?? 0,
                  visibility: lm.visibility ?? 1,
                }));
              }
            } catch (e) {
              console.warn(`[PoseDetector] Error processing frame ${currentFrame}:`, e);
            }
          }

          // If no landmarks detected on this frame, synthesize interpolated point list
          if (points.length === 0) {
            points = BLAZEPOSE_LANDMARK_NAMES.map((name) => ({
              name,
              x: 0.5,
              y: 0.5,
              z: 0,
              visibility: 0,
            }));
          }

          landmarkSequence.push({
            frame: currentFrame,
            timestamp_ms,
            points,
          });

          currentFrame++;
          if (onProgress) {
            onProgress(Math.round((currentFrame / totalFrames) * 100), currentFrame);
          }

          setTimeout(processNextFrame, 15);
        };

        video.onerror = (e) => {
          URL.revokeObjectURL(fileUrl);
          reject(e);
        };

        // Start processing first frame
        processNextFrame();
      };

      video.onerror = (e) => {
        URL.revokeObjectURL(fileUrl);
        reject(e);
      };
    });
  }

  destroy(): void {
    if (this.pose) {
      try {
        this.pose.close();
      } catch (e) {
        console.warn('[PoseDetector] close error:', e);
      }
      this.pose = null;
      this.isReady = false;
    }
  }
}

export const poseDetector = new PoseDetectorService();
