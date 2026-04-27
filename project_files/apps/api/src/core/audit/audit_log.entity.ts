import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string; // Who performed the action (Admin ID)

  @Column({ name: 'acao' })
  action: string; // e.g., 'USER_MAINTENANCE', 'USER_DELETED'

  @Column({ name: 'target_id', nullable: true })
  targetId: string; // ID of the affected resource (ID of the changed user)

  @Column({ name: 'antes', type: 'jsonb', nullable: true })
  before: any; // Object state before the change

  @Column({ name: 'depois', type: 'jsonb', nullable: true })
  after: any; // Object state after the change

  @Column({ nullable: true })
  ip: string; // Optional: Request source IP

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}