'use client';

import { ReactNode } from 'react';
import { UpgradePromptModal, useUpgradePrompt } from './upgrade-prompt-modal';

interface UsageLimitProviderProps {
  children: ReactNode;
}

export function UsageLimitProvider({ children }: UsageLimitProviderProps) {
  const { upgradePrompt, isOpen, closeModal, handleUpgrade } = useUpgradePrompt();

  return (
    <>
      {children}
      <UpgradePromptModal
        isOpen={isOpen}
        onClose={closeModal}
        upgradePrompt={upgradePrompt}
        onUpgrade={handleUpgrade}
      />
    </>
  );
}
