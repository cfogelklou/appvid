import React, { useEffect, useState, useRef } from 'react';
import { Terminal, ChevronDown, ChevronUp, Cpu } from 'lucide-react';
import type { ProcessLog } from '../utils/ffmpegEngine';
import './components.css';

interface ProcessingOverlayProps {
  isOpen: boolean;
  stage: string;
  progress: number;
  logs: ProcessLog[];
  onCancel: () => void;
}

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({
  isOpen,
  stage,
  progress,
  logs,
  onCancel
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const consoleEndRef = useRef<HTMLDivElement | null>(null);

  // Timer effect
  useEffect(() => {
    if (!isOpen) {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Auto-scroll logs terminal
  useEffect(() => {
    if (logsExpanded && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, logsExpanded]);

  if (!isOpen) return null;

  // Format elapsed time: mm:ss
  const formatTime = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  // Reassuring stall messages based on time
  let stallMessage = 'Processing files locally. Your media never leaves your device.';
  if (elapsedSeconds >= 10 && elapsedSeconds < 30) {
    stallMessage = 'Still rendering. Large videos can pause between stages.';
  } else if (elapsedSeconds >= 30 && elapsedSeconds < 90) {
    stallMessage = 'High-quality encoding can take several minutes. Keep this tab open.';
  } else if (elapsedSeconds >= 90 && elapsedSeconds < 180) {
    stallMessage = 'Still working. If your device is low on memory, this export may fail.';
  } else if (elapsedSeconds >= 180) {
    stallMessage = 'Rendering is taking longer than expected. If memory pressure is high, you can try cancelling and using a smaller recording.';
  }

  // Circular Progress calculations
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div className="processing-backdrop glass-panel">
      <div className="processing-card glass-panel">
        <div className="progress-ring-container">
          <svg className="progress-ring-bg" width="120" height="120">
            {/* Background track circle */}
            <circle
              stroke="rgba(255,255,255,0.06)"
              fill="transparent"
              strokeWidth="8"
              r={radius}
              cx="60"
              cy="60"
            />
            {/* Animated progress circle */}
            <circle
              className="progress-ring-circle"
              stroke="var(--color-primary)"
              fill="transparent"
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              r={radius}
              cx="60"
              cy="60"
            />
          </svg>
          <div className="progress-value-text">{Math.round(progress * 100)}%</div>
        </div>

        <div>
          <h4 className="stage-title">{stage}...</h4>
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center' }}>
            <span className="elapsed-time">Elapsed: {formatTime(elapsedSeconds)}</span>
          </div>
        </div>

        <div className="stall-message">
          {stallMessage}
        </div>

        {/* Console log accordion */}
        <div className="log-accordion">
          <button
            type="button"
            className="log-accordion-trigger"
            onClick={() => setLogsExpanded(!logsExpanded)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={14} />
              <span>FFmpeg Processing Log</span>
            </div>
            {logsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {logsExpanded && (
            <div className="log-console">
              {logs.length === 0 ? (
                <div className="log-line">Initializing console...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="log-line">
                    [{formatTime(Math.round((log.timestamp - (logs[0]?.timestamp || log.timestamp)) / 1000))}] {log.message}
                  </div>
                ))
              )}
              <div ref={consoleEndRef} />
            </div>
          )}
        </div>

        <div className="local-warning">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px' }}>
            <Cpu size={14} style={{ color: 'var(--color-text-muted)' }} />
            <span>Browser-Only Processing</span>
          </div>
          Your files are processed locally in your browser. Do not close this tab.
        </div>

        <button type="button" className="cancel-btn" onClick={onCancel}>
          Cancel Export
        </button>
      </div>
    </div>
  );
};
