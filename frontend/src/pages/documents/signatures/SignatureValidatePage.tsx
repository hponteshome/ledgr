// frontend/src/pages/documents/signatures/SignatureValidatePage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SignatureValidateModal } from './SignatureValidateModal';

export default function SignatureValidatePage() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 60 }}>
      <SignatureValidateModal onClose={() => navigate(-1)} />
    </div>
  );
}
