import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
  private readonly logger = new Logger('BackupService');

  private getPgEnv() {
    const url = new URL(process.env.DATABASE_URL || '');
    return {
      host: url.hostname,
      port: url.port || '5432',
      user: url.username,
      password: url.password,
      database: url.pathname.replace('/', ''),
    };
  }

  async exportFullBackup() {
    const { host, port, user, password, database } = this.getPgEnv();
    const tmpFile = path.join(os.tmpdir(), `ledgr_backup_${Date.now()}.dump`);

    const cmd = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -F c -f "${tmpFile}"`;

    try {
      await execAsync(cmd, { env: { ...process.env, PGPASSWORD: password } });
      const buffer = await fs.readFile(tmpFile);
      await fs.unlink(tmpFile);

      return {
        version: '2.0',
        format: 'pg_dump_custom',
        createdAt: new Date().toISOString(),
        data: buffer.toString('base64'),
      };
    } catch (err: any) {
      this.logger.error('Falha ao gerar backup via pg_dump', err.stack);
      throw new Error(`Falha ao gerar backup: ${err.message}. Verifique se pg_dump esta instalado e no PATH.`);
    }
  }

  async restoreFullBackup(backupData: any) {
    if (backupData?.format !== 'pg_dump_custom' || !backupData?.data) {
      throw new Error('Formato de backup invalido - esperado pg_dump_custom com campo data (base64).');
    }

    const { host, port, user, password, database } = this.getPgEnv();
    const tmpFile = path.join(os.tmpdir(), `ledgr_restore_${Date.now()}.dump`);

    try {
      const buffer = Buffer.from(backupData.data, 'base64');
      await fs.writeFile(tmpFile, buffer);

      const cmd = `pg_restore -h ${host} -p ${port} -U ${user} -d ${database} --clean --if-exists -F c "${tmpFile}"`;
      const { stderr } = await execAsync(cmd, { env: { ...process.env, PGPASSWORD: password } });

      await fs.unlink(tmpFile);

      // pg_restore normalmente reporta avisos em stderr mesmo em sucesso (ex: objetos ja inexistentes no --clean)
      if (stderr) this.logger.warn(`pg_restore stderr (pode ser normal): ${stderr.substring(0, 2000)}`);

      return { success: true, message: 'Restauracao concluida via pg_restore.' };
    } catch (err: any) {
      this.logger.error('Falha ao restaurar backup via pg_restore', err.stack);
      throw new Error(`Falha na restauracao: ${err.message}`);
    }
  }
}
