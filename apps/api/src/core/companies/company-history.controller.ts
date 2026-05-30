// apps/api/src/core/companies/company-history.controller.ts
import { Controller, Get, Post, Body, Param, Request, UseGuards } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { JwtAuthGuard } from "@/auth/guards/jwt.guard";
import { CompanyHistoryService } from "./company-history.service";
import { firstValueFrom } from "rxjs";

@Controller("companies")
@UseGuards(JwtAuthGuard)
export class CompanyHistoryController {
  constructor(
    private readonly historySvc: CompanyHistoryService,
    private readonly http: HttpService,
  ) {}

  // GET /companies/:id/history
  @Get(":id/history")
  findHistory(@Param("id") id: string) {
    return this.historySvc.findByCompany(id);
  }

  // POST /companies/:id/rfb-compare
  // Consulta RFB pelo CNPJ da empresa e retorna divergencias
  @Post(":id/rfb-compare")
  async compareWithRfb(
    @Param("id") id: string,
    @Body() body: { cnpj: string },
  ) {
    const cnpj = body.cnpj.replace(/\D/g, "");
    const { data } = await firstValueFrom(
      this.http.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
    );
    const rfbData = {
      razaoSocial:       data.razao_social,
      nomeFantasia:      data.nome_fantasia,
      situacaoCadastral: data.descricao_situacao_cadastral,
      dataSituacao:      data.data_situacao_cadastral,
      cnaePrincipal:     { descricao: data.cnae_fiscal_descricao },
      endereco: {
        logradouro: data.logradouro,
        numero:     data.numero,
        bairro:     data.bairro,
        municipio:  data.municipio,
        uf:         data.uf,
        cep:        (data.cep || "").replace(/\D/g, ""),
      },
      contato: {
        email:    data.email,
        telefone1: data.ddd_telefone_1 || "",
      },
      naturezaJuridica: data.natureza_juridica,
      porte:            data.porte,
    };
    const divergences = await this.historySvc.compareWithRfb(id, rfbData);
    return { divergences, rfbData };
  }

  // POST /companies/:id/rfb-apply
  @Post(":id/rfb-apply")
  async applyRfb(
    @Param("id") id: string,
    @Request() req: any,
    @Body() body: { changes: any[] },
  ) {
    return this.historySvc.applyRfbChanges(id, req.user.id, body.changes);
  }
}
