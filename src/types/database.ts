export interface LspRow {
  id: number;
  nama: string;
  jml_skema: number | null;
  status: string | null;
  no_sk: string | null;
  no_lisensi: string | null;
  last_checked: string | null;
}

export interface SkemaRow {
  id: number;
  nama: string;
  id_skema: string | null;
  lsp_id: number;
  jml_unit: number | null;
}

export interface UnitRow {
  kode: string;
  nama: string;
}

export interface LspItem {
  id: number;
  nama: string;
  jml_skema: number;
  status: string;
  no_sk: string;
  no_lisensi: string;
  last_checked: string;
}

export interface SkemaLspOption {
  lsp: string;
  lsp_id: number;
  id_skema: string | null;
  jml_unit: number;
  skema_id: number;
}

export interface SkemaItem {
  nama: string;
  jml_lsp: number;
  total_unit: number;
  lsps: SkemaLspOption[];
}
