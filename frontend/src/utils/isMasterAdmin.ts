// frontend/src/utils/isMasterAdmin.ts
// Seguranca 0A (03/10/2026): criterio unico de Master Admin no frontend,
// espelhando o backend (apps/api/src/multi-company/company.interceptor.ts -> isMasterAdmin).
// O user do AuthContext vem da resposta do login: permissoes ficam em user.profile.permissions.
// A raiz (user.permissions) e mantida como alternativa, igual ao SidebarPermissionsContext.
export function isMasterAdmin(user: any): boolean {
  return user?.profile?.permissions?.all === true || user?.permissions?.all === true;
}
