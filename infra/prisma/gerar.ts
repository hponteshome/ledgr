import * as bcrypt from 'bcrypt';

async function gerarHashes() {
  console.log('=== GERANDO HASHES VÁLIDOS PARA O SEED ===\n');
  
  // Hash para senha '123456' (usuário teste)
  const hash123456 = await bcrypt.hash('123456', 10);
  console.log('Para senha "123456" (novo2@teste.com):');
  console.log(`'${hash123456}'`);
  console.log();
  
  // Hash para senha 'admin123' (admin)
  const hashAdmin = await bcrypt.hash('admin123', 10);
  console.log('Para senha "admin123" (admin@ledgr.com.br):');
  console.log(`'${hashAdmin}'`);
  console.log();
  
  // Hash para senha 'operador123' (operador)
  const hashOperador = await bcrypt.hash('operador123', 10);
  console.log('Para senha "operador123" (operador@ledgr.com.br):');
  console.log(`'${hashOperador}'`);
  console.log();
  
  // Hash para senha 'cliente123' (cliente)
  const hashCliente = await bcrypt.hash('cliente123', 10);
  console.log('Para senha "cliente123" (cliente@ledgr.com.br):');
  console.log(`'${hashCliente}'`);
}

gerarHashes().catch(console.error);