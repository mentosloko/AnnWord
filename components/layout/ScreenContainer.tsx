import React from 'react';

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

  if (containsMainLandmark(children)) {
    return <div id={id} tabIndex={-1} className={classNames}>{children}</div>;
  }

  return <main id={id} tabIndex={-1} className={classNames}>{children}</main>;
};
