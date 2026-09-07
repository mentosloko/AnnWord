import React, { useState } from 'react';

interface ReliablePetImageProps {
  src: string | null;
  fallbackEmoji: string;
  className?: string;
  fallbackClassName?: string;
}

const RETRY_LIMIT = 1;

const retryUrl = (src: string, attempt: number): string => {
  if (attempt === 0) return src;
  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}annword_retry=${attempt}`;
};

export const ReliablePetImage: React.FC<ReliablePetImageProps> = ({ src, fallbackEmoji, className = '', fallbackClassName = 'text-8xl' }) => {
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <span aria-hidden="true" className={fallbackClassName}>{fallbackEmoji}</span>;
  }

  const currentSrc = retryUrl(src, attempt);
  return (
    <>
      {!ready && <div aria-hidden="true" className="absolute inset-6 animate-pulse rounded-[2rem] bg-white/10" />}
      <img
        src={currentSrc}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
        fetchPriority="high"
        onLoad={() => setReady(true)}
        onError={() => {
          setReady(false);
          if (attempt < RETRY_LIMIT) {
            setAttempt(value => value + 1);
            return;
          }
          setFailed(true);
        }}
        className={`${className} transition-opacity ${ready ? 'opacity-100' : 'opacity-0'}`}
        draggable={false}
      />
    </>
  );
};

export default ReliablePetImage;
