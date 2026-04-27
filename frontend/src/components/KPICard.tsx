// src/components/accounting/AccountTree.tsx
// 
import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText } from 'lucide-react';
import { AccountNode } from '@/utils/chartMapper';

interface AccountTreeProps {
  nodes: AccountNode[];
}

const TreeNode = ({ node }: { node: AccountNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="ml-4">
      <div
        className={`flex items-center py-1 px-2 hover:bg-slate-100 rounded-md cursor-pointer transition-colors ${node.isAnalytic ? 'text-blue-600' : 'font-semibold text-slate-800'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* Ícone de Expansão */}
        <span className="mr-1">
          {hasChildren ? (
            isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
          ) : (
            <span className="w-4" />
          )}
        </span>

        {/* Ícone de Pasta ou Arquivo */}
        <span className="mr-2">
          {node.isAnalytic ? (
            <FileText size={14} className="text-blue-400" />
          ) : (
            <Folder size={14} className="text-amber-400" />
          )}
        </span>

        {/* Conteúdo da Conta */}
        <span className="text-sm font-mono mr-3 text-slate-500">{node.code}</span>
        <span className="text-sm uppercase tracking-tight">{node.name}</span>
      </div>

      {/* Renderização Recursiva dos Filhos */}
      {hasChildren && isOpen && (
        <div className="border-l border-slate-200 ml-2">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
};

export const AccountTree = ({ nodes }: AccountTreeProps) => {
  return (
    <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm overflow-auto max-h-[600px]">
      <div className="mb-4 border-b pb-2">
        <h3 className="text-lg font-bold text-slate-700">Plano de Contas</h3>
      </div>
      {nodes.map((node) => (
        <TreeNode key={node.id} node={node} />
      ))}
    </div>
  );
};