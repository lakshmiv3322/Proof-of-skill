import { useState } from 'react';
import {
  CheckCircle2,
  Sliders,
  FileCheck2,
} from 'lucide-react';
import { ScoreReveal3D } from '@/components/3d/score-reveal-3d';

interface CalibrationCriterion {
  id: string;
  code: string;
  label: string;
  measured: string;
  tolerance: string;
  score: number;
  weight: number;
  status: 'PASS' | 'FLAG';
  feedback: string;
  sliderPosPct: number; // 0–100 marker position inside window
}

const LEDGER_ITEMS: CalibrationCriterion[] = [
  {
    id: 'cpr-rate',
    code: 'METRIC_01 · RATE',
    label: 'Compression Frequency',
    measured: '108.4 BPM',
    tolerance: '100.0 – 120.0 BPM',
    score: 100,
    weight: 30,
    status: 'PASS',
    feedback: 'Consistent cadence maintained across all 30 cycles. Matches standard AHA perfusion frequency.',
    sliderPosPct: 42,
  },
  {
    id: 'cpr-depth',
    code: 'METRIC_02 · DISPLACEMENT',
    label: 'Compression Excursion Depth',
    measured: '5.4 cm',
    tolerance: '5.0 – 6.0 cm',
    score: 95,
    weight: 30,
    status: 'PASS',
    feedback: 'Optimal kinetic displacement. Complete sternal excursion with zero shallow compression strokes.',
    sliderPosPct: 40,
  },
  {
    id: 'cpr-recoil',
    code: 'METRIC_03 · DECOMPRESSION',
    label: 'Chest Recoil Completeness',
    measured: '3.2% Leaning',
    tolerance: '< 5.0% Incomplete',
    score: 90,
    weight: 20,
    status: 'PASS',
    feedback: 'Minimal residual leaning detected. Full thoracic decompression confirmed between cycles.',
    sliderPosPct: 64,
  },
  {
    id: 'cpr-posture',
    code: 'METRIC_04 · KINEMATICS',
    label: 'Shoulder Alignment & Arm Lock',
    measured: '8.4° Dev',
    tolerance: '< 15.0° Deviation',
    score: 85,
    weight: 20,
    status: 'PASS',
    feedback: 'Shoulder girdle locked perpendicular over contact axis. Elbow joints rigid and stable.',
    sliderPosPct: 56,
  },
];

interface DemoReportProps {
  onVerifyClick?: (code: string) => void;
}

export function DemoReport({ onVerifyClick }: DemoReportProps) {
  const [selectedRow, setSelectedRow] = useState<string | null>(null);

  return (
    <section id="demo-report" className="relative py-28 sm:py-36 bg-[#070a12] overflow-hidden">
      {/* Radiant ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] ambient-glow-amber blur-[180px] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-2xl mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-mono text-slate-300 mb-4 backdrop-blur-md">
            <Sliders className="h-3.5 w-3.5 text-cyan-400" />
            <span>Inspection Artifact · Live Telemetry Ledger</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-headline font-bold text-white tracking-tight">
            The Precision <span className="text-gradient-amber-ember">Calibration Ledger</span>
          </h2>
          <p className="mt-4 text-base text-slate-300 leading-relaxed">
            Every movement metric is bounded within exact tolerance windows. Scores calculate deterministically into an accredited, immutable record.
          </p>
        </div>

        {/* ── SIGNATURE STRUCTURAL DEVICE: The Calibration Ledger Table ── */}
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-2xl overflow-hidden shadow-glass">
          
          {/* Header Bar */}
          <div className="px-6 py-4 bg-slate-950/90 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
            <div className="flex items-center gap-3">
              <span className="text-white font-bold">ARTIFACT: CPR-2026-042</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-300">Candidate: Alex Mercer</span>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-slate-400">Standard: <strong className="text-white">AHA-CPR-2026</strong></span>
              <span className="text-slate-600">|</span>
              <span className="text-cyan-400 font-bold">BlazePose Confidence: 98.4%</span>
            </div>
          </div>

          {/* Ledger Grid Headers (Desktop) */}
          <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 bg-white/[0.02] border-b border-white/10 font-mono text-[11px] text-slate-400 uppercase tracking-wider">
            <div className="col-span-4">Criterion & Code</div>
            <div className="col-span-4">Tolerance Window vs Measurement</div>
            <div className="col-span-2 text-right">Measured Value</div>
            <div className="col-span-2 text-right">Rubric Verdict</div>
          </div>

          {/* Ledger Rows */}
          <div className="divide-y divide-white/5">
            {LEDGER_ITEMS.map((item) => {
              const isSelected = selectedRow === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedRow(isSelected ? null : item.id)}
                  className="p-6 hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center font-mono">
                    
                    {/* Column 1: Label & Code */}
                    <div className="lg:col-span-4">
                      <span className="text-[10px] text-cyan-400/80 block mb-1 tracking-wider">{item.code}</span>
                      <span className="text-base font-headline font-bold text-white block">{item.label}</span>
                      <span className="text-[11px] text-slate-400 font-mono">Weight: {item.weight}%</span>
                    </div>

                    {/* Column 2: Tolerance Band Gauge */}
                    <div className="lg:col-span-4 space-y-2">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Window: {item.tolerance}</span>
                        <span className="text-cyan-300 font-semibold">{item.measured}</span>
                      </div>
                      
                      {/* Tolerance gauge bar */}
                      <div className="h-2 w-full bg-slate-900 rounded-full border border-white/10 relative overflow-hidden">
                        {/* Acceptable target band */}
                        <div className="absolute inset-y-0 left-1/4 right-1/4 bg-amber-500/20 border-x border-amber-500/40" />
                        {/* Candidate marker */}
                        <div
                          className="absolute top-0 bottom-0 w-2 rounded-full bg-cyan-400 shadow-glow-cyan"
                          style={{ left: `${item.sliderPosPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Column 3: Measured */}
                    <div className="lg:col-span-2 text-left lg:text-right">
                      <span className="text-sm text-cyan-400 font-bold block">{item.measured}</span>
                      <span className="text-[10px] text-slate-500 block">DTW Synchronized</span>
                    </div>

                    {/* Column 4: Verdict & Score */}
                    <div className="lg:col-span-2 flex items-center justify-between lg:justify-end gap-3">
                      <span className="text-sm text-white font-bold">{item.score}/100</span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold">
                        <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
                        {item.status}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Telemetry Drawer */}
                  {isSelected && (
                    <div className="mt-5 pt-4 border-t border-white/10 grid sm:grid-cols-2 gap-4 text-xs font-mono text-slate-300">
                      <div>
                        <span className="text-amber-400 font-semibold block mb-1">Assessor Telemetry Note:</span>
                        <p className="text-slate-300 leading-relaxed font-sans">{item.feedback}</p>
                      </div>
                      <div className="bg-white/[0.02] p-3 rounded-xl border border-white/10 text-[11px] space-y-1.5">
                        <div className="text-slate-400">Raw DTW Distance Vector: <span className="text-cyan-300 font-bold">0.142</span></div>
                        <div className="text-slate-400">Peak Detection Rate: <span className="text-white">30 / 30 verified cycles</span></div>
                        <div className="text-slate-400">Confidence Interval: <span className="text-cyan-400 font-semibold">99.1% statistical lock</span></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Signature Rollup Seal: Official Credential Verdict ── */}
          <div className="p-7 bg-slate-950/90 border-t border-white/10 grid sm:grid-cols-12 gap-6 items-center">
            
            {/* Seal Badge Left */}
            <div className="sm:col-span-4 flex items-center gap-4">
              <ScoreReveal3D score={94.5} size="md" />
              <div>
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider block">Official Verdict Seal</span>
                <span className="text-2xl font-headline font-bold text-white">Certified Competent</span>
                <span className="text-xs font-mono text-slate-400 block mt-0.5">Threshold: 70.0% · Achieved: 94.5%</span>
              </div>
            </div>

            {/* Middle Verification Hash Details */}
            <div className="sm:col-span-5 text-xs font-mono space-y-1.5 text-slate-400 border-l border-white/10 pl-5">
              <div>Verification Code: <strong className="text-amber-300 font-semibold">POS-CPR-2026-042AH</strong></div>
              <div>SHA-256 Hash: <span className="text-slate-500">8f4e3c13a0219bd948f2c9e782d1a3</span></div>
              <div>Issued By: <span className="text-slate-300">Lead Assessor ID: 01 (Apex Institute)</span></div>
            </div>

            {/* Right Action Button */}
            <div className="sm:col-span-3 text-right">
              <button
                onClick={() => {
                  if (onVerifyClick) {
                    onVerifyClick('POS-CPR-2026-042AH');
                  } else {
                    window.open('/verify/POS-CPR-2026-042AH', '_blank');
                  }
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-mono text-xs font-bold hover:from-amber-300 hover:to-orange-400 transition-all shadow-glow-amber"
              >
                <FileCheck2 className="h-4 w-4" />
                <span>Verify Credential</span>
              </button>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
