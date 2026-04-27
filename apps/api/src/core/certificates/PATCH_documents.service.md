// ================================================================
// PATCH: src/core/documents/documents.service.ts
// ================================================================
//
// Integrar o SigningService no método sign() existente.
//
// 1. Importar no topo do arquivo:
//
//    import { SigningService } from '../certificates/signing.service';
//    import { CertificatesService } from '../certificates/certificates.service';
//
// 2. Injetar no constructor:
//
//    constructor(
//      private readonly prisma: PrismaService,
//      private readonly signing: SigningService,       // ← NOVO
//      private readonly certsSvc: CertificatesService, // ← NOVO
//    ) {}
//
// 3. Substituir o método sign() atual pelo abaixo:
// ================================================================

/*

  async sign(documentId: string, dto: SignDocumentDto, user: any) {
    const doc = await this.getDocumentOrFail(documentId);

    if (dto.method === 'GOVBR') {
      throw new BadRequestException(
        'Para assinatura gov.br use GET /documents/:id/sign/govbr/init',
      );
    }

    // ── Certificado ICP-Brasil (A1 ou A3) ──────────────────────
    if (!dto.certId) {
      throw new BadRequestException('certId é obrigatório para assinatura com certificado digital');
    }

    // Buscar dados do certificado para gravar nos metadados
    const companyId = doc.companyId!;
    const certMeta  = await this.certsSvc.findOne(dto.certId, companyId);

    // Hash SHA-256 do conteúdo textual do documento
    const contentHash = this.sha256(doc.content ?? '');

    // Gerar PDF assinado (PAdES) se houver pdfUrl
    let signedPdfUrl: string | undefined;
    if (doc.pdfUrl) {
      // TODO fase 1.2: buscar PDF do MinIO, assinar, regravar
      // Por ora apenas registramos a assinatura no banco
      signedPdfUrl = doc.pdfUrl;
    }

    // Gravar DocumentSignature
    const signature = await this.prisma.documentSignature.create({
      data: {
        documentId,
        method:         dto.method ?? 'CERT_A1',
        status:         'ASSINADO',
        signerName:     user.fullName,
        signerCpf:      user.document,
        signerEmail:    user.email,
        signerRole:     dto.signerRole,
        documentHash:   contentHash,
        signatureHash:  contentHash,  // substituído por assinatura real na fase 1.2
        certificateData: {
          certId:       dto.certId,
          alias:        certMeta.alias,
          subject:      certMeta.subject,
          issuer:       certMeta.issuer,
          serialNumber: certMeta.serialNumber,
          validTo:      certMeta.validTo,
          fingerprint:  certMeta.fingerprint,
        },
        signedAt: new Date(),
      },
    });

    // Atualizar signer correspondente se houver
    if (dto.signerId) {
      await this.prisma.documentSigner.update({
        where: { id: dto.signerId },
        data:  { status: 'ASSINADO' },
      });
    }

    // Atualizar status do documento se todos assinaram
    const allSigners = await this.prisma.documentSigner.findMany({
      where: { documentId },
    });
    const allSigned = allSigners.length > 0 && allSigners.every(s => s.status === 'ASSINADO');
    if (allSigned) {
      await this.prisma.document.update({
        where: { id: documentId },
        data:  { status: 'ASSINADO', contentHash, updatedAt: new Date() },
      });
    }

    this.logger.log(
      `Documento ${documentId} assinado por ${user.email} com cert ${dto.certId}`,
    );

    return signature;
  }

*/

// ================================================================
// DTO — adicionar campo certId ao SignDocumentDto existente
// (arquivo: src/core/documents/dto/create-document.dto.ts)
// ================================================================

/*

export class SignDocumentDto {
  method?: 'CERT_A1' | 'CERT_A3' | 'GOVBR';

  @IsOptional()
  @IsString()
  certId?: string;          // ← NOVO — ID do Certificate no banco

  @IsOptional()
  @IsString()
  signerId?: string;        // ID do DocumentSigner (se existir)

  @IsOptional()
  @IsString()
  signerRole?: string;

  @IsOptional()
  signatureHash?: string;   // mantido para compatibilidade

  @IsOptional()
  certificateData?: any;
}

*/

// ================================================================
// DocumentsModule — adicionar CertificatesModule como import
// (arquivo: src/core/documents/documents.module.ts)
// ================================================================

/*

import { CertificatesModule } from '../certificates/certificates.module';

@Module({
  imports: [
    PrismaModule,
    CertificatesModule,   // ← NOVO — expõe SigningService e CertificatesService
  ],
  ...
})
export class DocumentsModule {}

*/
