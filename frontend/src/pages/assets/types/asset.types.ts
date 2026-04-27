// ============================================================
// LEDGR — frontend/src/pages/Assets/types/asset.types.ts
// ============================================================

// ── Enums ─────────────────────────────────────────────────────

export type AssetGroup =
  | 'REAL_ESTATE'
  | 'MACHINERY_EQUIPMENT'
  | 'VEHICLE'
  | 'FURNITURE_FIXTURE'
  | 'IT_EQUIPMENT'
  | 'INTANGIBLE'
  | 'OTHER';

export type AssetStatus =
  | 'PENDING_ACTIVATION'
  | 'ACTIVE'
  | 'UNDER_MAINTENANCE'
  | 'INACTIVE'
  | 'DISPOSED'
  | 'WRITTEN_OFF';

export type DepreciationMethod =
  | 'STRAIGHT_LINE'
  | 'SUM_OF_DIGITS'
  | 'UNITS_OF_PRODUCTION'
  | 'ACCELERATED_2X';

export type MaintenanceType   = 'PREVENTIVE' | 'CORRECTIVE' | 'PREDICTIVE' | 'OVERHAUL' | 'EMERGENCY';
export type MaintenanceStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ImprovementType   = 'ACCESSORY' | 'CAPITALIZABLE_RENOVATION' | 'EXPANSION' | 'RETROFIT' | 'RESTORATION';
export type AppraisalType     = 'ASSET_VALUATION' | 'TECHNICAL_INSPECTION' | 'PHYSICAL_DEPRECIATION' | 'TAX_CLASSIFICATION' | 'ENGINEERING_REPORT';
export type RetrofitStatus    = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'SUSPENDED' | 'CANCELLED';
export type WriteOffReason    = 'DISPOSAL' | 'SCRAPPING' | 'DONATION' | 'CASUALTY' | 'OTHER';
export type AssetEventType    =
  | 'ACQUISITION' | 'ACTIVATION'
  | 'MAINTENANCE_OPENED' | 'MAINTENANCE_COMPLETED'
  | 'IMPROVEMENT_REGISTERED' | 'IMPROVEMENT_CAPITALIZED'
  | 'RETROFIT_STARTED' | 'RETROFIT_COMPLETED'
  | 'APPRAISAL_REGISTERED' | 'REVALUATION'
  | 'TRANSFER' | 'WRITE_OFF' | 'DISPOSAL';

// ── UI Labels ─────────────────────────────────────────────────

export const ASSET_GROUP_LABELS: Record<AssetGroup, string> = {
  REAL_ESTATE:          'Imóvel',
  MACHINERY_EQUIPMENT:  'Máquina / Equipamento',
  VEHICLE:              'Veículo',
  FURNITURE_FIXTURE:    'Móvel / Utensílio',
  IT_EQUIPMENT:         'TI / Informática',
  INTANGIBLE:           'Intangível',
  OTHER:                'Outros',
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  PENDING_ACTIVATION: 'Aguardando Ativação',
  ACTIVE:             'Ativo',
  UNDER_MAINTENANCE:  'Em Manutenção',
  INACTIVE:           'Inativo',
  DISPOSED:           'Alienado',
  WRITTEN_OFF:        'Baixado',
};

export const ASSET_STATUS_COLORS: Record<AssetStatus, string> = {
  PENDING_ACTIVATION: 'bg-yellow-100 text-yellow-800',
  ACTIVE:             'bg-green-100 text-green-800',
  UNDER_MAINTENANCE:  'bg-orange-100 text-orange-800',
  INACTIVE:           'bg-gray-100 text-gray-600',
  DISPOSED:           'bg-purple-100 text-purple-800',
  WRITTEN_OFF:        'bg-red-100 text-red-800',
};

export const DEPRECIATION_METHOD_LABELS: Record<DepreciationMethod, string> = {
  STRAIGHT_LINE:       'Linear (SLM)',
  SUM_OF_DIGITS:       'Soma dos Dígitos (SYD)',
  UNITS_OF_PRODUCTION: 'Unidades Produzidas',
  ACCELERATED_2X:      'Acelerada 2x',
};

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  PREVENTIVE:  'Preventiva',
  CORRECTIVE:  'Corretiva',
  PREDICTIVE:  'Preditiva',
  OVERHAUL:    'Reforma',
  EMERGENCY:   'Emergencial',
};

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  SCHEDULED:   'Agendada',
  IN_PROGRESS: 'Em Andamento',
  COMPLETED:   'Concluída',
  CANCELLED:   'Cancelada',
};

export const IMPROVEMENT_TYPE_LABELS: Record<ImprovementType, string> = {
  ACCESSORY:                'Acessório',
  CAPITALIZABLE_RENOVATION: 'Reforma Capitalizável',
  EXPANSION:                'Ampliação',
  RETROFIT:                 'Retrofit',
  RESTORATION:              'Restauração',
};

export const APPRAISAL_TYPE_LABELS: Record<AppraisalType, string> = {
  ASSET_VALUATION:      'Avaliação Patrimonial',
  TECHNICAL_INSPECTION: 'Vistoria Técnica',
  PHYSICAL_DEPRECIATION:'Depreciação Física/Funcional',
  TAX_CLASSIFICATION:   'Enquadramento Fiscal',
  ENGINEERING_REPORT:   'ART / Laudo de Engenharia',
};

export const WRITE_OFF_REASON_LABELS: Record<WriteOffReason, string> = {
  DISPOSAL:  'Alienação',
  SCRAPPING: 'Sucateamento',
  DONATION:  'Doação',
  CASUALTY:  'Sinistro',
  OTHER:     'Outros',
};

// ── Interfaces ────────────────────────────────────────────────

export interface FixedAsset {
  id:        string;
  companyId: string;

  // Identification
  internalCode:  string;
  description:   string;
  group:         AssetGroup;
  subgroup?:     string;
  brand?:        string;
  model?:        string;
  serialNumber?: string;
  location?:     string;
  status:        AssetStatus;
  notes?:        string;

  // Valuation
  acquisitionCost:   number;
  acquisitionDate:   string;
  residualValue:     number;
  bookValue:         number;
  marketValue?:      number;
  lastAppraisalDate?:string;

  // Depreciation
  depreciationMethod:  DepreciationMethod;
  usefulLifeMonths:    number;
  remainingLifeMonths: number;
  annualRatePercent:   number;
  accumulatedDeprec:   number;
  depreciationStart:   string;
  nonDepreciable:      boolean;

  // Real Estate
  iptuRegistration?: string;
  registryNumber?:   string;
  totalArea?:        number;
  builtArea?:        number;
  assessedValue?:    number;
  landValuePercent?: number;
  landValueAmount?:  number;
  street?:           string;
  zipCode?:          string;
  state?:            string;
  city?:             string;

  // Accounting
  assetAccountId?:    string;
  depreciationAccId?: string;
  accumDeprecAccId?:  string;

  // Relations (included on detail)
  maintenances?:     AssetMaintenance[];
  improvements?:     AssetImprovement[];
  retrofitProjects?: AssetRetrofitProject[];
  depreciationLogs?: AssetDepreciationLog[];
  appraisals?:       AssetAppraisal[];
  history?:          AssetHistory[];
  _count?:           { improvements: number; retrofitProjects: number };

  isActive:  boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssetMaintenance {
  id:            string;
  assetId:       string;
  type:          MaintenanceType;
  status:        MaintenanceStatus;
  title:         string;
  description:   string;
  serviceOrderNo?: string;
  providerName?: string;
  providerCnpj?: string;
  contactInfo?:  string;
  scheduledDate: string;
  startedAt?:    string;
  completedAt?:  string;
  estimatedCost?: number;
  actualCost?:   number;
  capitalizable: boolean;
  notes?:        string;
  createdAt:     string;
}

export interface AssetImprovement {
  id:                  string;
  assetId:             string;
  type:                ImprovementType;
  description:         string;
  justification?:      string;
  technicalReport?:    string;
  startDate:           string;
  completionDate?:     string;
  capitalizationDate?: string;
  totalCost:           number;
  usefulLifeExtension: number;
  newUsefulLifeMonths?: number;
  capitalized:         boolean;
  createdAt:           string;
}

export interface AssetRetrofitPhase {
  id:            string;
  projectId:     string;
  name:          string;
  sequence:      number;
  description?:  string;
  phaseBudget:   number;
  executedAmount:number;
  plannedDate:   string;
  completionDate?:string;
  completed:     boolean;
}

export interface AssetRetrofitProject {
  id:               string;
  assetId:          string;
  name:             string;
  objective:        string;
  responsible?:     string;
  status:           RetrofitStatus;
  startDate:        string;
  plannedEndDate?:  string;
  actualEndDate?:   string;
  totalBudget:      number;
  executedAmount:   number;
  physicalProgress: number;
  usefulLifeImpact: number;
  phases:           AssetRetrofitPhase[];
  createdAt:        string;
}

export interface AssetAppraisal {
  id:               string;
  assetId:          string;
  type:             AppraisalType;
  appraisalDate:    string;
  appraisalFirm:    string;
  responsibleName:  string;
  creaRegistration?: string;
  appraisedValue:   number;
  previousValue:    number;
  methodology?:     string;
  conclusions?:     string;
  estimatedRemainingMonths?: number;
  createdAt:        string;
}

export interface AssetDepreciationLog {
  id:               string;
  assetId:          string;
  period:           string;
  method:           DepreciationMethod;
  monthlyCharge:    number;
  accumDeprecBefore:number;
  accumDeprecAfter: number;
  bookValueAfter:   number;
  createdAt:        string;
}

export interface AssetHistory {
  id:            string;
  assetId:       string;
  eventType:     AssetEventType;
  description:   string;
  previousValue?: number;
  newValue?:     number;
  performedById?: string;
  createdAt:     string;
}

// ── Response types ────────────────────────────────────────────

export interface AssetsKpis {
  totalAssets:          number;
  totalAcquisitionCost: number;
  totalBookValue:       number;
  totalAccumDeprec:     number;
}

export interface AssetsListResponse {
  data: FixedAsset[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  kpis: AssetsKpis;
}

// ── Form types ────────────────────────────────────────────────

export interface CreateAssetForm {
  internalCode:       string;
  description:        string;
  group:              AssetGroup;
  subgroup?:          string;
  brand?:             string;
  model?:             string;
  serialNumber?:      string;
  location?:          string;
  notes?:             string;
  acquisitionCost:    number | string;
  acquisitionDate:    string;
  residualValue?:     number | string;
  depreciationMethod?: DepreciationMethod;
  usefulLifeMonths:   number | string;
  annualRatePercent?: number | string;
  depreciationStart:  string;
  nonDepreciable?:    boolean;
  // Real estate
  iptuRegistration?:  string;
  registryNumber?:    string;
  totalArea?:         number | string;
  builtArea?:         number | string;
  assessedValue?:     number | string;
  landValuePercent?:  number | string;
  street?:            string;
  zipCode?:           string;
  state?:             string;
  city?:              string;
}

// Suggested useful life by group (months) — matches RFB rates
export const SUGGESTED_USEFUL_LIFE: Partial<Record<AssetGroup, number>> = {
  REAL_ESTATE:         300,  // 25 years (building)
  MACHINERY_EQUIPMENT: 120,  // 10 years
  VEHICLE:              60,  //  5 years
  FURNITURE_FIXTURE:   120,  // 10 years
  IT_EQUIPMENT:         60,  //  5 years
  INTANGIBLE:           60,  //  5 years
};