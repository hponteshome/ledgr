import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const execAsync = promisify(exec);

const CONTAINER_NAME = process.env.POSTGRES_CONTAINER_NAME || 'ledgr-postgres';

@Injectable()
export class BackupService {
  private readonly logger = new Logger('BackupService');

  private getPgEnv() {
    const url = new URL(process.env.DATABASE_URL || '');
    return {
      user: url.username,
      password: url.password,
      database: url.pathname.replace('/', ''),
    };
  }

  // Roda pg_dump DENTRO do container Docker, garantindo mesma versao
  // do pg_restore que sera usado na restauracao (evita incompatibilidade
  // de formato entre pg_dump do host e pg_restore do container).
  async exportFullBackup() {
    const { user, database } = this.getPgEnv();
    const remoteFile = `/tmp/ledgr_backup_${Date.now()}.dump`;
    const localFile = path.join(os.tmpdir(), `ledgr_backup_${Date.now()}.dump`);

    try {
      await execAsync(
        `docker exec ${CONTAINER_NAME} pg_dump -U ${user} -d ${database} -F c -f "${remoteFile}"`
      );
      await execAsync(`docker cp ${CONTAINER_NAME}:${remoteFile} "${localFile}"`);
      await execAsync(`docker exec ${CONTAINER_NAME} rm -f "${remoteFile}"`);

      const buffer = await fs.readFile(localFile);
      await fs.unlink(localFile);

      return {
        version: '2.1',
        format: 'pg_dump_custom',
        createdAt: new Date().toISOString(),
        data: buffer.toString('base64'),
      };
    } catch (err: any) {
      this.logger.error('Falha ao gerar backup via pg_dump (docker exec)', err.stack);
      throw new Error(`Falha ao gerar backup: ${err.message}. Verifique se o container ${CONTAINER_NAME} esta rodando.`);
    }
  }

  async restoreFullBackup(backupData: any) {
    if ((backupData?.format !== 'pg_dump_custom') || !backupData?.data) {
      throw new Error('Formato de backup invalido - esperado pg_dump_custom com campo data (base64).');
    }

    const { user, database } = this.getPgEnv();
    const localFile = path.join(os.tmpdir(), `ledgr_restore_${Date.now()}.dump`);
    const remoteFile = `/tmp/ledgr_restore_${Date.now()}.dump`;

    try {
      const buffer = Buffer.from(backupData.data, 'base64');
      await fs.writeFile(localFile, buffer);

      await execAsync(`docker cp "${localFile}" ${CONTAINER_NAME}:${remoteFile}`);
      const { stderr } = await execAsync(
        `docker exec ${CONTAINER_NAME} pg_restore -U ${user} -d ${database} --clean --if-exists --no-owner --no-privileges -F c "${remoteFile}"`
      );
      await execAsync(`docker exec ${CONTAINER_NAME} rm -f "${remoteFile}"`);
      await fs.unlink(localFile);

      if (stderr) this.logger.warn(`pg_restore stderr (avisos podem ser normais): ${stderr.substring(0, 2000)}`);

      return { success: true, message: 'Restauracao concluida via pg_restore (docker exec).' };
    } catch (err: any) {
      this.logger.error('Falha ao restaurar backup via pg_restore (docker exec)', err.stack);
      throw new Error(`Falha na restauracao: ${err.message}`);
    }
  }
}
