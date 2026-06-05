'use client';

import { useState } from 'react';

type SerializedValue = { type: string; value: string };

type JsonTreeViewProps = {
  data: Record<string, SerializedValue>;
};

export function JsonTreeView({ data }: JsonTreeViewProps) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="emptyInspector" style={{ padding: '0.5rem' }}>
        No variables changed in this snapshot.
      </div>
    );
  }

  return (
    <div style={{ 
      fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '0.85rem',
      lineHeight: '1.6',
      marginTop: '0.65rem',
      backgroundColor: 'var(--bg-primary)',
      borderRadius: '8px',
      padding: '0.8rem',
      border: '1px solid var(--border-color)',
      overflowX: 'auto',
      color: 'var(--syntax-default)'
    }}>
      {Object.entries(data).map(([key, serialized]) => {
        let parsedValue: unknown = serialized.value;
        try {
          if (serialized.type === 'object' || serialized.type === 'array') {
            parsedValue = JSON.parse(serialized.value);
          } else if (serialized.type === 'number') {
            parsedValue = Number(serialized.value);
          } else if (serialized.type === 'boolean') {
            parsedValue = serialized.value === 'true';
          } else if (serialized.type === 'null') {
            parsedValue = null;
          } else if (serialized.type === 'undefined') {
            parsedValue = undefined;
          }
        } catch {
          // fallback to string if parsing fails
          parsedValue = serialized.value;
        }

        return <JsonNode key={key} name={key} value={parsedValue} isLast={true} isRoot={true} />;
      })}
    </div>
  );
}

function JsonNode({ 
  name, 
  value, 
  isLast, 
  isRoot = false 
}: { 
  name?: string; 
  value: unknown; 
  isLast?: boolean; 
  isRoot?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(isRoot);
  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);

  const toggle = () => {
    if (isObject) setIsExpanded(!isExpanded);
  };

  const renderValue = () => {
    if (value === null) return <span style={{ color: 'var(--syntax-keyword)' }}>null</span>;
    if (value === undefined) return <span style={{ color: 'var(--syntax-keyword)' }}>undefined</span>;
    if (typeof value === 'boolean') return <span style={{ color: 'var(--syntax-keyword)' }}>{value ? 'true' : 'false'}</span>;
    if (typeof value === 'number') return <span style={{ color: 'var(--syntax-number)' }}>{value}</span>;
    if (typeof value === 'string') return <span style={{ color: 'var(--syntax-string)' }}>&quot;{value}&quot;</span>;

    if (isObject) {
      if (isArray) {
        if (!isExpanded) return <span style={{ color: 'var(--syntax-comment)' }}>Array({value.length}) [...]</span>;
        return null;
      } else {
        const keys = Object.keys(value);
        if (!isExpanded) return <span style={{ color: 'var(--syntax-comment)' }}>Object {'{'} {keys.length} keys {'}'}</span>;
        return null;
      }
    }
    return <span>{String(value)}</span>;
  };

  return (
    <div style={{ paddingLeft: isRoot ? '0' : '1.2rem' }}>
      <div 
        onClick={toggle}
        style={{ 
          display: 'flex', 
          alignItems: 'flex-start',
          cursor: isObject ? 'pointer' : 'default',
          userSelect: isObject ? 'none' : 'auto',
          borderRadius: '4px',
          padding: '2px 4px',
          margin: '1px -4px',
          transition: 'background 0.15s ease'
        }}
        onMouseEnter={(e) => {
          if (isObject) e.currentTarget.style.backgroundColor = 'var(--line-highlight)';
        }}
        onMouseLeave={(e) => {
          if (isObject) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <div style={{ width: '1.2rem', flexShrink: 0, textAlign: 'center', color: 'var(--syntax-comment)', fontSize: '0.75rem', paddingTop: '2px' }}>
          {isObject ? (isExpanded ? '▼' : '▶') : ''}
        </div>
        <div style={{ wordBreak: 'break-all' }}>
          {name !== undefined && (
            <span style={{ 
              color: isRoot ? 'var(--syntax-default)' : 'var(--syntax-default)', 
              fontWeight: isRoot ? '600' : 'normal',
              opacity: isRoot ? 1 : 0.9
            }}>
              {name}:{" "}
            </span>
          )}
          {isExpanded && isArray && <span style={{ color: 'var(--syntax-default)' }}>[</span>}
          {isExpanded && isObject && !isArray && <span style={{ color: 'var(--syntax-default)' }}>{'{'}</span>}
          {(!isExpanded || !isObject) && renderValue()}
          {(!isExpanded || !isObject) && !isRoot && !isLast && <span style={{ color: 'var(--syntax-default)' }}>,</span>}
        </div>
      </div>
      
      {isExpanded && isObject && (
        <div>
          {isArray
            ? (value as unknown[]).map((item: unknown, idx: number) => (
                <JsonNode key={idx} name={String(idx)} value={item} isLast={idx === (value as unknown[]).length - 1} />
              ))
            : Object.entries(value as Record<string, unknown>).map(([k, v], idx, arr) => (
                <JsonNode key={k} name={k} value={v} isLast={idx === arr.length - 1} />
              ))}
          <div style={{ paddingLeft: '1.2rem', paddingBottom: '2px', color: 'var(--syntax-default)' }}>
            {isArray ? ']' : '}'}
            {!isRoot && !isLast && <span>,</span>}
          </div>
        </div>
      )}
    </div>
  );
}
