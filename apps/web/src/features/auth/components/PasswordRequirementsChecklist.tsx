import React from 'react';
import { getNewPasswordRequirements } from '../utils/authValidation';

interface PasswordRequirementsChecklistProps {
  password: string;
}

export const PasswordRequirementsChecklist: React.FC<PasswordRequirementsChecklistProps> = ({ password }) => {
  const reqs = getNewPasswordRequirements(password);

  const items = [
    { key: 'length', label: '10+ characters', satisfied: reqs.hasMinLength },
    { key: 'uppercase', label: 'Uppercase letter', satisfied: reqs.hasUppercase },
    { key: 'lowercase', label: 'Lowercase letter', satisfied: reqs.hasLowercase },
    { key: 'number', label: 'Number', satisfied: reqs.hasDigit },
    { key: 'special', label: 'Special character', satisfied: reqs.hasSpecialChar },
  ];

  return (
    <div
      style={{
        marginTop: '0.4rem',
        padding: '0.45rem 0.65rem',
        borderRadius: '0.375rem',
        backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
        border: '1px solid var(--color-border, #e2e8f0)',
        fontSize: '0.76rem',
        color: 'var(--color-text-muted, #64748b)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--color-text, #334155)' }}>
        Password must include:
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: '1fr', gap: '0.15rem' }}>
        {items.map((item) => (
          <li
            key={item.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: item.satisfied ? 'var(--color-success, #16a34a)' : 'var(--color-text-muted, #64748b)',
              fontWeight: item.satisfied ? 600 : 400,
              transition: 'color 0.15s ease',
            }}
          >
            <span style={{ fontSize: '0.8rem', width: '1rem', textAlign: 'center', flexShrink: 0 }}>
              {item.satisfied ? '✓' : '○'}
            </span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
