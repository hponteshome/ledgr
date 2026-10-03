# scripts/projetos/carga-creditos-historicos.py
# Fase 1.6 - carga idempotente dos 58 creditos historicos da Operacao Ancora (marco 31/12/2025).
# LGPD: o arquivo de dados fica FORA do repositorio (contem CPFs). Este script nao imprime documentos.
# Leitura robusta: qualquer codificacao (UTF-8, UTF-16, Windows-1252) e colunas separadas por tabulacao
# OU espacos - a linha e reconhecida pelo conteudo (numero, data, nome, CPF/CNPJ formatado opcional, R$ valor, referencia).
# Valida tudo antes de gravar: numeracao 1..58, datas, valores positivos, digitos verificadores, total exato.
# Uso: python scripts\projetos\carga-creditos-historicos.py [caminho_do_arquivo]
import sys, re, os, hashlib, subprocess, tempfile
from decimal import Decimal
from datetime import datetime

ARQ = sys.argv[1] if len(sys.argv) > 1 else r"D:\Dados\RecifeOcean\creditos-historicos-58.txt"
TOTAL_ESPERADO = Decimal("3495791.15")
QTD_ESPERADA = 58
SUNSYS = "6a13e876-7056-4076-a403-9610f7dc37b1"
HP = "(SELECT id FROM users WHERE email = 'hpontes@ledgr.com')"
OP = "(SELECT o.id FROM proj_operacoes o JOIN proj_projetos p ON p.id = o.projeto_id WHERE p.codigo = 'RECIFE-OCEAN' AND o.codigo = 'ANCORA')"
LINHA = re.compile(
    r"^\s*(\d{1,3})\s+(\d{2}/\d{2}/\d{4})\s+(.+?)\s+"
    r"(?:(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})\s+)?"
    r"R\$\s*([\d.]+,\d{2})\s+(.+?)\s*$")

def cpf_ok(c):
    if len(set(c)) == 1: return False
    for n in (9, 10):
        s = sum(int(c[i]) * (n + 1 - i) for i in range(n))
        if (s * 10) % 11 % 10 != int(c[n]): return False
    return True

def cnpj_ok(c):
    w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; w2 = [6] + w1
    for w, n in ((w1, 12), (w2, 13)):
        r = sum(int(c[i]) * w[i] for i in range(n)) % 11
        if (0 if r < 2 else 11 - r) != int(c[n]): return False
    return True

def q(s):
    return "NULL" if s is None else "'" + str(s).replace("'", "''") + "'"

def ler_texto(caminho):
    raw = open(caminho, "rb").read()
    if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"): return raw.decode("utf-16")
    try: return raw.decode("utf-8-sig")
    except UnicodeDecodeError: return raw.decode("cp1252")

if not os.path.exists(ARQ):
    print("ERRO - arquivo nao encontrado: " + ARQ); sys.exit(2)
texto = ler_texto(ARQ).replace("\xa0", " ")
linhas = texto.splitlines()
sha_arquivo = hashlib.sha256(texto.encode("utf-8")).hexdigest()
erros, regs, nao_reconhecidas = [], [], 0
for ln in linhas:
    if not re.match(r"^\s*\d+\s", ln): continue
    m = LINHA.match(ln.replace("\t", " "))
    if not m:
        nao_reconhecidas += 1
        erros.append("linha com numero %s nao reconhecida no formato esperado" % ln.strip().split()[0]); continue
    num = int(m.group(1))
    try: data = datetime.strptime(m.group(2), "%d/%m/%Y").date()
    except ValueError: erros.append("data invalida no credito %d" % num); continue
    valor = Decimal(m.group(5).replace(".", "").replace(",", "."))
    if valor <= 0: erros.append("valor nao positivo no credito %d" % num)
    doc = re.sub(r"\D", "", m.group(4) or "")
    pend = not doc
    if doc and not ((len(doc) == 11 and cpf_ok(doc)) or (len(doc) == 14 and cnpj_ok(doc))):
        erros.append("documento invalido no credito %d" % num)
    nome = re.sub(r"\s+", " ", m.group(3)).strip()
    regs.append({"num": num, "data": data, "nome": None if pend else nome, "doc": doc or None, "valor": valor,
                 "ref": re.sub(r"\s+", " ", m.group(6)).strip() or None, "pend": pend})
if sorted(r["num"] for r in regs) != list(range(1, QTD_ESPERADA + 1)):
    erros.append("numeracao diferente de 1..%d (%d linhas reconhecidas)" % (QTD_ESPERADA, len(regs)))
total = sum((r["valor"] for r in regs), Decimal("0"))
if total != TOTAL_ESPERADO:
    erros.append("total %s difere do esperado %s" % (total, TOTAL_ESPERADO))
if erros:
    for e in erros[:15]: print("ERRO - " + e)
    print("ERRO - nada foi gravado (%d linhas no arquivo)" % len(linhas)); sys.exit(1)

contrapartes = {}
for r in regs:
    if r["doc"]:
        atual = contrapartes.get(r["doc"])
        if atual is None or len(r["nome"]) > len(atual): contrapartes[r["doc"]] = r["nome"]
print("OK - arquivo validado: %d creditos | total R$ %s | %d sem remetente identificado | %d remetentes distintos (%d PF, %d PJ)" % (
    len(regs), total, sum(1 for r in regs if r["pend"]), len(contrapartes),
    sum(1 for d in contrapartes if len(d) == 11), sum(1 for d in contrapartes if len(d) == 14)))

sql = ["BEGIN;"]
for doc, nome in sorted(contrapartes.items()):
    sql.append("INSERT INTO proj_contrapartes (tipo_pessoa, documento, nome, observacoes, criado_por_id) SELECT %s, %s, %s, 'Remetente de creditos da Operacao Ancora (carga historica)', %s WHERE NOT EXISTS (SELECT 1 FROM proj_contrapartes WHERE documento = %s AND cancelado_em IS NULL);"
               % (q("PF" if len(doc) == 11 else "PJ"), q(doc), q(nome), HP, q(doc)))
docs_sql = ", ".join(q(d) for d in sorted(contrapartes))
sql.append(("INSERT INTO proj_participacoes (operacao_id, papel_id, contraparte_id, observacao, criado_por_id) "
            "SELECT %s, pa.id, ct.id, 'Remetente de creditos (carga historica)', %s FROM proj_papeis pa JOIN proj_contrapartes ct ON ct.documento IN (%s) AND ct.cancelado_em IS NULL "
            "WHERE pa.codigo = 'REMETENTE' AND NOT EXISTS (SELECT 1 FROM proj_participacoes pp WHERE pp.operacao_id = %s AND pp.papel_id = pa.id AND pp.contraparte_id = ct.id AND pp.cancelado_em IS NULL);")
           % (OP, HP, docs_sql, OP))
for r in sorted(regs, key=lambda x: x["num"]):
    chave = hashlib.sha256(("HISTORICO|%d|%s|%s|%s" % (r["num"], r["data"].isoformat(), r["valor"], r["ref"] or "")).encode("utf-8")).hexdigest()
    rem = "(SELECT id FROM proj_contrapartes WHERE documento = %s AND cancelado_em IS NULL)" % q(r["doc"]) if r["doc"] else "NULL"
    obs = q("Remetente nao identificado no registro fornecido") if r["pend"] else "NULL"
    sql.append(("INSERT INTO proj_creditos (operacao_id, numero_ordem, data_credito, valor, remetente_id, remetente_nome_extrato, referencia_bancaria, recebedora_company_id, origem, identificacao_pendente, chave_idempotencia, observacao, criado_por_id) "
                "VALUES (%s, %d, DATE %s, %s, %s, %s, %s, %s, 'HISTORICO', %s, %s, %s, %s) ON CONFLICT (operacao_id, chave_idempotencia) DO NOTHING;")
               % (OP, r["num"], q(r["data"].isoformat()), r["valor"], rem, q(r["nome"]), q(r["ref"]), q(SUNSYS), "true" if r["pend"] else "false", q(chave), obs, HP))
sql.append(("INSERT INTO proj_credito_vinculos (credito_id, situacao, adquirente_id, motivo, criado_por_id) "
            "SELECT c.id, 'VINCULADO', (SELECT pp.contraparte_id FROM proj_participacoes pp JOIN proj_papeis pa ON pa.id = pp.papel_id "
            "WHERE pp.operacao_id = %s AND pa.codigo = 'ADQUIRENTE' AND pp.cancelado_em IS NULL), "
            "'Vinculo inicial na carga: credito de terceiro em favor do Adquirente da operacao', %s "
            "FROM proj_creditos c WHERE c.operacao_id = %s AND c.cancelado_em IS NULL "
            "AND NOT EXISTS (SELECT 1 FROM proj_credito_vinculos v WHERE v.credito_id = c.id);") % (OP, HP, OP))
sql.append(("INSERT INTO audit_logs (actor_id, acao, target_id, depois) SELECT %s, 'PROJ_CARGA_CREDITOS_HISTORICOS', %s::text, "
            "jsonb_build_object('inseridos', (SELECT count(*) FROM proj_creditos WHERE origem = 'HISTORICO' AND criado_em = now()), 'total_arquivo', '%s', 'quantidade_arquivo', %d, 'arquivo_sha256', '%s');")
           % (HP, OP, total, len(regs), sha_arquivo))
sql.append("COMMIT;")
sql.append(("SELECT count(*) AS creditos, sum(valor) AS total, count(*) FILTER (WHERE identificacao_pendente) AS pendentes_identificacao, count(DISTINCT remetente_id) AS remetentes, "
            "(SELECT (depois->>'inseridos') FROM audit_logs WHERE acao = 'PROJ_CARGA_CREDITOS_HISTORICOS' ORDER BY created_at DESC LIMIT 1) AS inseridos_nesta_carga "
            "FROM proj_creditos WHERE operacao_id = %s AND origem = 'HISTORICO' AND cancelado_em IS NULL;") % OP)

fd, tmp = tempfile.mkstemp(suffix=".sql"); os.close(fd)
with open(tmp, "w", encoding="utf-8") as f: f.write("\n".join(sql) + "\n")
try:
    subprocess.run(["docker", "cp", tmp, "ledgr-postgres:/tmp/carga_creditos.sql"], check=True, capture_output=True)
    r = subprocess.run(["docker", "exec", "ledgr-postgres", "psql", "-U", "ledgr", "-d", "ledgr_app", "-v", "ON_ERROR_STOP=1", "-q", "-f", "/tmp/carga_creditos.sql"], capture_output=True, text=True, encoding="utf-8")
    print(r.stdout.strip())
    if r.returncode != 0:
        print("ERRO - falha na gravacao (transacao desfeita): " + r.stderr.strip()[:300]); sys.exit(1)
finally:
    subprocess.run(["docker", "exec", "ledgr-postgres", "rm", "-f", "/tmp/carga_creditos.sql"], capture_output=True)
    os.remove(tmp)