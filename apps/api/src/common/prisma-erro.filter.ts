// apps/api/src/common/prisma-erro.filter.ts
// Seguranca 0A (04/10/2026): erros conhecidos do Prisma que escapam dos servicos viram respostas HTTP corretas,
// sem detalhes internos. P2025 (registro nao encontrado, ex.: findFirstOrThrow com { id, companyId } de outra empresa)
// = 404; P2002 (duplicidade) = 409; demais = 500 generico, com o detalhe so no log do servidor.
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaErroFilter implements ExceptionFilter {
  private readonly log = new Logger('PrismaErroFilter');

  catch(e: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (e.code === 'P2025') return res.status(HttpStatus.NOT_FOUND).json({ statusCode: 404, message: 'Registro nao encontrado.' });
    if (e.code === 'P2002') return res.status(HttpStatus.CONFLICT).json({ statusCode: 409, message: 'Registro duplicado.' });
    this.log.error(`${e.code}: ${e.message}`);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: 'Internal server error' });
  }
}
