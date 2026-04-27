import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom'; // Importação necessária
import  api  from '@/services/api';

export function useEcdViewer() {
    const { id } = useParams<{ id: string }>(); // Captura o ID da URL automaticamente
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            setLoading(true);
            api.get(`/sped/ecd/viewer/${id}`) // Faz a chamada com o ID correto
                .then(res => setData(res.data))
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        }
    }, [id]);

    return { data, loading };
}