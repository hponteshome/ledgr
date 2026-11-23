// apps/frontend/src/utils/chartMapper.ts
// CODPURO-02 (23/11/2026): codigo de conta e puro (sem pontos) - o pai de cada conta e o
// maior codigo existente que e prefixo do seu codigo (antes dependia dos pontos).

export interface AccountNode {
  id: string;
  code: string;
  name: string;
  description?: string;
  isAnalytic: boolean;
  isAnalytical: boolean; // alias usado pelo AccountTree
  balance: number;
  children: AccountNode[];
}

export function buildAccountTree(accounts: any[]): AccountNode[] {
  const tree: AccountNode[] = [];
  const mappedArr: { [code: string]: AccountNode } = {};

  const sortedAccounts = [...accounts].sort((a, b) => a.code.localeCompare(b.code));
  const codes = sortedAccounts.map(a => String(a.code));

  sortedAccounts.forEach(acc => {
    mappedArr[acc.code] = {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      description: acc.description ?? acc.name,
      isAnalytic: acc.is_analytic ?? acc.isAnalytic ?? false,
      isAnalytical: acc.is_analytic ?? acc.isAnalytic ?? false, // alias para AccountTree
      balance: Number(acc.balance ?? 0),
      children: [],
    };
  });

  sortedAccounts.forEach(acc => {
    let parent: string | undefined;
    for (const c of codes) {
      if (c !== acc.code && acc.code.startsWith(c) && (!parent || c.length > parent.length)) parent = c;
    }
    if (parent) mappedArr[parent].children.push(mappedArr[acc.code]);
    else tree.push(mappedArr[acc.code]);
  });

  return tree;
}
