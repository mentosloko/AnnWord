import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ReliablePetImage } from '../components/ReliablePetImage';

afterEach(cleanup);

describe('ReliablePetImage', () => {
  it('loads the hero image eagerly with high fetch priority', () => {
    const { container } = render(<ReliablePetImage src="/assets/pets/puppy/base/idle.webp" fallbackEmoji="🐶" />);
    const image = container.querySelector('img');

    expect(image).not.toBeNull();
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('fetchpriority', 'high');
  });

  it('retries once with a fresh URL and then falls back instead of leaving a permanent skeleton', () => {
    const { container } = render(<ReliablePetImage src="/assets/pets/puppy/base/idle.webp" fallbackEmoji="🐶" />);
    const firstImage = container.querySelector('img');
    expect(firstImage).not.toBeNull();

    fireEvent.error(firstImage!);
    const retryImage = container.querySelector('img');
    expect(retryImage).not.toBeNull();
    expect(retryImage?.getAttribute('src')).toContain('annword_retry=1');

    fireEvent.error(retryImage!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('🐶');
  });

  it('shows the fallback immediately when no rendered asset exists', () => {
    const { container } = render(<ReliablePetImage src={null} fallbackEmoji="🐲" />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('🐲');
  });
});
