-- Item "ECD — Histórico" (/app/sped/ecd/History) fica habilitado no menu mas a rota/pagina
-- nunca foi implementada (import de EcdHistoryPage comentado em frontend/src/routes/index.tsx,
-- sem <Route> registrada) - clicar levava a um estado quebrado. Desabilitado seguindo o mesmo
-- padrao ja usado para EFD-Contribuicoes (feature incompleta = disabled=true, nao removida).
UPDATE sidebar_items SET disabled = true WHERE id = '14b5cbf1-f234-41c9-950c-7f7c6fb8fa3e';
