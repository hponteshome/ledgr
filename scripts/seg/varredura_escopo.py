# scripts/seg/varredura_escopo.py
# Varredura heuristica de escopo de empresa (Fase 0A). Aponta suspeitos para revisao manual.
# Uso: python scripts\seg\varredura_escopo.py apps\api\src\modules\finance
# Falso positivo conhecido: service que confere com findOne/findFirst(id + companyId) e depois
# altera com where: { id } e seguro (ex.: accounts-payable). Conferir a linha anterior ao alerta.
import os, re, sys
BASE = r"D:\Projetos\Ledgr"
alvo = os.path.join(BASE, sys.argv[1] if len(sys.argv) > 1 else r"apps\api\src\modules\finance")
ROTA = re.compile(r"^\s*@(Get|Post|Put|Patch|Delete)\(\s*(?:['\"]([^'\"]*)['\"])?")
PRISMA = re.compile(r"this\.prisma\.(\w+)\.(findUnique|findFirst|findMany|update|updateMany|delete|deleteMany|upsert|count|aggregate|groupBy)\(")
CLIENTE = re.compile(r"@Query\('companyId'\)|@Body\('companyId'\)|query\??\.companyId|body\??\.companyId|dto\.companyId|filters\.companyId|@Query\(\)\s*\w+")
REQ = re.compile(r"req(uest)?\??\.companyId|@CompanyId\(|empresaEfetiva\(")

def ler(p):
    with open(p, encoding="utf-8", errors="ignore") as f:
        return f.read().split("\n")

def chamada(L, i, max_l=16):
    txt, prof, abriu = "", 0, False
    for j in range(i, min(i + max_l, len(L))):
        txt += L[j].strip() + " "
        prof += L[j].count("(") - L[j].count(")")
        if "(" in L[j]: abriu = True
        if abriu and prof <= 0: break
    return txt

ctrl_flags = serv_flags = 0
for raiz, _, arqs in os.walk(alvo):
    for nome in sorted(arqs):
        p = os.path.join(raiz, nome); rel = p.replace(BASE + "\\", "")
        if nome.endswith(".controller.ts"):
            L = ler(p)
            cls = next((i for i, l in enumerate(L) if "export class" in l), len(L))
            cab = [l.strip() for l in L[:cls] if l.strip().startswith(("@UseGuards", "@UseInterceptors", "@SkipCompanyCheck"))]
            saida = []
            for i, l in enumerate(L):
                m = ROTA.match(l)
                if not m: continue
                corpo = []
                for x in L[i + 1:i + 40]:
                    if ROTA.match(x): break
                    corpo.append(x.strip())
                texto = " ".join(corpo)
                caminho = m.group(2) or ""
                cli, req = bool(CLIENTE.search(texto)), bool(REQ.search(texto))
                if cli and not req: sit = "COMPANYID DO CLIENTE"
                elif ":" in caminho and not req: sit = "ROTA :ID SEM EMPRESA DO REQUEST"
                else: continue
                saida.append("   %4d  %-6s %-40s %s" % (i + 1, m.group(1).upper(), "/" + caminho, sit))
            print("\n[CONTROLLER] %s" % rel)
            print("   guards: %s" % (" ".join(cab) if cab else "(nenhum na classe)"))
            if saida:
                ctrl_flags += len(saida); print("\n".join(saida))
            else:
                print("   sem suspeitos")
        elif nome.endswith(".service.ts"):
            L = ler(p); saida = []
            for i, l in enumerate(L):
                m = PRISMA.search(l)
                if not m: continue
                blk = chamada(L, i)
                modelo, op = m.group(1), m.group(2)
                if "companyId" in blk: continue
                var = bool(re.search(r"where\s*[,}]|where:\s*\w+\s*[,}]", blk))
                if op in ("findMany", "updateMany", "deleteMany", "count", "aggregate", "groupBy"):
                    sit = "LISTA SEM companyId" + (" (where em variavel)" if var else "")
                elif re.search(r"\bid\b", blk):
                    sit = "POR ID SEM companyId" + (" (where em variavel)" if var else "")
                else:
                    continue
                saida.append("   %4d  %-22s %-11s %s" % (i + 1, modelo, op, sit))
            if saida:
                serv_flags += len(saida)
                print("\n[SERVICE] %s  (%d suspeitos)" % (rel, len(saida)))
                print("\n".join(saida))
print("\n===== Total: %d rotas suspeitas em controllers | %d consultas suspeitas em services =====" % (ctrl_flags, serv_flags))