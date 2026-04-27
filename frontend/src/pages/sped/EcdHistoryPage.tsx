export const EcdViewerPage = () => {
    const { data, loading } = useEcdViewer();

    if (loading) return <div>Carregando dados da ECD...</div>;
    if (!data) return <div>Erro: Dados não encontrados.</div>;

    return (
        <div className="p-4">
            <h1>{data.summary?.companyName || 'Visualizador ECD'}</h1>

            {/* Exemplo de visualização simples das contas */}
            <div className="mt-4">
                <h2 className="font-bold">Plano de Contas</h2>
                {data.accounts?.map((acc: any) => (
                    <div key={acc.id} className="border-b py-1">
                        {acc.code} - {acc.description} | Saldo: {acc.finalBalance}
                    </div>
                ))}
            </div>

            {/* Exemplo de visualização dos lançamentos */}
            <div className="mt-4">
                <h2 className="font-bold">Lançamentos</h2>
                {data.entries?.map((entry: any) => (
                    <div key={entry.id} className="text-sm">
                        Data: {entry.date} | Valor: {entry.value} | Histórico: {entry.description}
                    </div>
                ))}
            </div>
        </div>
    );
};