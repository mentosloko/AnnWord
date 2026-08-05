import React from 'react';
import { AccessibleDialog } from '../a11y/AccessibleDialog';
import { experienceUi } from '../ui/ExperiencePrimitives';

interface InfoModalProps {
  open: boolean;
  eyebrow?: string;
  title: string;
  description: React.ReactNode;
  actionLabel?: string;
  onClose: () => void;
  children?: React.ReactNode;
}

export const InfoModal: React.FC<InfoModalProps> = ({ open, eyebrow = 'AnnWord', title, description, actionLabel = 'Понятно', onClose, children }) => <AccessibleDialog open={open} titleId="annword-info-modal-title" descriptionId="annword-info-modal-description" onEscape={onClose} className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl">
  <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">{eyebrow}</div>
  <h2 id="annword-info-modal-title" className="mt-2 text-3xl font-black leading-tight text-indigo-950">{title}</h2>
  <div id="annword-info-modal-description" className="mt-3 text-sm font-bold leading-6 text-slate-600">{description}</div>
  {children}
  <button type="button" onClick={onClose} className={`mt-6 w-full ${experienceUi.primaryButton}`}>{actionLabel}</button>
</AccessibleDialog>;
