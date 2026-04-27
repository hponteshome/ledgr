// apps/frontend/src/utils/chartMapper.ts

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
    const codeParts = acc.code.split('.');

    if (codeParts.length > 1) {
      const parentCode = codeParts.slice(0, -1).join('.');

      if (mappedArr[parentCode]) {
        mappedArr[parentCode].children.push(mappedArr[acc.code]);
      } else {
        tree.push(mappedArr[acc.code]);
      }
    } else {
      tree.push(mappedArr[acc.code]);
    }
  });

  return tree;
}