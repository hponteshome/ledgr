// scripts/check-docker.js
// Verificacao rapida: containers essenciais precisam estar rodando antes do backend subir.
const { execSync } = require('child_process');

const REQUIRED_CONTAINERS = ['ledgr-postgres', 'ledgr-redis'];

function isRunning(name) {
  try {
    const out = execSync(`docker ps --filter "name=${name}" --filter "status=running" -q`, { encoding: 'utf8' });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

let allOk = true;
for (const name of REQUIRED_CONTAINERS) {
  if (isRunning(name)) {
    console.log(`✅ ${name} esta rodando`);
  } else {
    console.error(`❌ ${name} NAO esta rodando (container parado ou nao existe)`);
    allOk = false;
  }
}

if (!allOk) {
  console.error('\n⚠️  Suba os containers antes de continuar:');
  console.error('    docker start ledgr-postgres ledgr-redis\n');
  process.exit(1);
}
