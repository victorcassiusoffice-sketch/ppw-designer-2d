import { useEffect, useRef, useState } from 'react';
import { isHls } from './contract';
export default function SiteVideo({ address, title }: { address: string; title: string }) {
  const video = useRef<HTMLVideoElement>(null),
    [error, setError] = useState('');
  useEffect(() => {
    const v = video.current;
    if (!v || !isHls(address)) return;
    let live = true,
      dispose = () => {};
    setError('');
    if (v.canPlayType('application/vnd.apple.mpegurl')) v.src = address;
    else
      void import('hls.js')
        .then(({ default: Hls }) => {
          if (!live) return;
          if (!Hls.isSupported()) {
            setError('This browser cannot play this stream.');
            return;
          }
          const hls = new Hls({ enableWorker: true });
          dispose = () => hls.destroy();
          hls.on(Hls.Events.ERROR, (_, e) => {
            if (e.fatal && live)
              setError('Stream unavailable. Check its address and cross-origin access.');
          });
          hls.loadSource(address);
          hls.attachMedia(v);
        })
        .catch(() => {
          if (live) setError('Stream player unavailable.');
        });
    return () => {
      live = false;
      dispose();
      v.removeAttribute('src');
      v.load();
    };
  }, [address]);
  return (
    <>
      <video
        ref={video}
        controls
        playsInline
        aria-label={title}
        style={{ width: '100%' }}
        onError={() => setError('Stream unavailable.')}
      />
      {error && <p role="status">{error}</p>}
    </>
  );
}
