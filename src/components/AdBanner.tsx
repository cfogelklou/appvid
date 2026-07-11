import React, { useEffect, useRef } from 'react';

const AD_CLIENT = 'ca-pub-9954896376614754';
const AD_SLOT = '3474703979';

export interface AdBannerProps {
  orientation: 'portrait' | 'landscape';
  height: number;
  width: number;
}

let lastPushAt = 0;
const MIN_AD_PUSH_INTERVAL_MS = 60_000;

function pushAd(node: HTMLModElement): void {
  const w = window as unknown as { adsbygoogle?: unknown[] };
  w.adsbygoogle = w.adsbygoogle || [];
  w.adsbygoogle.push({});
  node.dataset.adProcessed = '1';
  lastPushAt = Date.now();
}

const rootStyle: React.CSSProperties = {
  position: 'relative',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  backgroundColor: 'rgba(0, 0, 0, 0.25)',
  margin: '0 auto',
};

const labelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 2,
  left: 4,
  fontSize: '9px',
  opacity: 0.4,
  color: '#fff',
  pointerEvents: 'none',
};

export function AdBanner(p: AdBannerProps): React.ReactElement {
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    let localTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      const node = insRef.current;
      if (!node || node.dataset.adProcessed) {
        return;
      }
      const sinceLast = Date.now() - lastPushAt;
      if (lastPushAt === 0 || sinceLast >= MIN_AD_PUSH_INTERVAL_MS) {
        pushAd(node);
      } else {
        localTimer = setTimeout(() => {
          localTimer = null;
          const n = insRef.current;
          if (n && !n.dataset.adProcessed) {
            pushAd(n);
          }
        }, MIN_AD_PUSH_INTERVAL_MS - sinceLast);
      }
    } catch {
      // AdSense loader not present / blocked
    }

    return () => {
      if (localTimer) {
        clearTimeout(localTimer);
      }
    };
  }, []);

  const sizeStyle: React.CSSProperties =
    p.orientation === 'portrait'
      ? { width: '100%', height: p.height, maxHeight: p.height, maxWidth: p.width }
      : { width: p.width, height: '100%', maxHeight: '100%' };

  return (
    <div style={{ ...rootStyle, ...sizeStyle }} aria-label="Advertisement">
      <span style={labelStyle}>Ad</span>
      <div style={{ width: '100%', height: '100%' }}>
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
          data-ad-client={AD_CLIENT}
          data-ad-slot={AD_SLOT}
          data-ad-format={p.orientation === 'portrait' ? 'horizontal' : 'vertical'}
        />
      </div>
    </div>
  );
}
