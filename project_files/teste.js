const bcrypt = require('bcrypt');

async function testar() {
    // A senha que você quer testar
    const senhaDigitada = 'admin123'; 
    
    // O hash que você pegou no banco (coloque entre as aspas)
    const hashDoBanco = '$2b$10$seu_hash_real_aqui'; 

    console.log('--- Iniciando Teste ---');
    
    try {
        const match = await bcrypt.compare(senhaDigitada, hashDoBanco);
        
        if (match) {
            console.log('✅ SUCESSO: A senha "admin123" está correta para este hash!');
        } else {
            console.log('❌ ERRO: A senha não bate com o hash fornecido.');
        }
    } catch (error) {
        console.error('❌ ERRO AO PROCESSAR:', error.message);
    }
}

testar();