import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actor_id: string; // Quem fez a ação (ID do Admin)

  @Column()
  acao: string; // Ex: 'MANUTENCAO_USUARIO', 'USUARIO_EXCLUIDO'

  @Column({ name: 'target_id', nullable: true })
  target_id: string; // ID do recurso afetado (ID do usuário alterado)

  @Column({ type: 'jsonb', nullable: true })
  antes: any; // Estado do objeto antes da alteração

  @Column({ type: 'jsonb', nullable: true })
  depois: any; // Estado do objeto depois da alteração

  @Column({ nullable: true })
  ip: string; // Opcional: IP de onde veio a requisição

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
