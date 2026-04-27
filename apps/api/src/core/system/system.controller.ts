// apps/api/src/system/system.controller.ts
import { 
  Controller, Get, Post, Body, Param, Res, 
  BadRequestException, UploadedFile, UseInterceptors 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ExportDataService } from './export-data.service';

@Controller('system')
export class SystemController {
  constructor(private readonly exportService: ExportDataService) {}

  @Get('export/:table')
  async exportTable(@Param('table') table: string, @Res() res: Response) {
    try {
      const data = await this.exportService.exportTableToTxt(table);
      
      const fileName = `export_${table}_${new Date().getTime()}.txt`;
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      return res.send(data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('import/:table')
  @UseInterceptors(FileInterceptor('file'))
  async importTable(
    @Param('table') table: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Conteúdo do arquivo não fornecido.');
    }

    console.log('📥 Arquivo recebido:', {
      nome: file.originalname,
      tamanho: file.size,
      campo: file.fieldname,
      mimetype: file.mimetype
    });

    // Converter o arquivo para texto
    const fileContent = file.buffer.toString('utf-8');
    
    console.log('📄 Primeiras 200 chars:', fileContent.substring(0, 200));
    
    return this.exportService.importTableFromTxt(table, fileContent);
  }
}