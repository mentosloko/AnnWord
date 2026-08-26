import React, { useEffect, useRef } from 'react';

interface ScreenContainerProps {
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
  id?: string;
}

const containsMainLandmark = (node: React.ReactNode): boolean => React.Children.toArray(node).some(child => {
  if (!React.isValidElement(child)) return false;
  if (child.type === 'main') return true;
  const props = child.props as { children?: React.ReactNode };
  return containsMainLandmark(props.children);
});

export const ScreenContainer: React.FC<ScreenContainerProps> = ({ children, className = '', compact = false, id = 'main-content' }) => {
  const spacingClassName = compact ? '' : 'px-4 py-6';
  const classNames = `w-full max-w-6xl mx-auto ${spacingClassName} ${className}`;
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const selects = root.querySelectorAll<HTMLSelectElement>('select:not([aria-label]):not([aria-labelledby])');
    selects.forEach((select: HTMLSelectElement) => {
      if (select.options[0]?.textContent?.trim() === 'Выберите подборку') {
        select.setAttribute('aria-label', 'Словарь для назначения ученику');
      }
    });
  }, [children]);

  if (containsMainLandmark(children)) {
    return <div ref={containerRef as React.Ref<HTMLDivElement>} id={id} tabIndex={-1} className={classNames}>{children}</div>;
  }

  return <main ref={containerRef as React.Ref<HTMLElement>} id={id} tabIndex={-1} className={classNames}>{children}</main>;
};
