export interface TemplateSystemChannelSpec {
  readonly name: string;
  readonly reducer?: "append" | "replace" | "merge" | "custom";
  readonly typeHint?: string;
  readonly reducerRef?: string;
}

export type TemplateSlotValue = string | number | boolean | readonly string[] | null;

export interface TemplateSystemNodeSpec {
  readonly id: string;
  readonly label?: string;
  readonly template: string;
  readonly nodeType?: "text" | "folder";
  readonly flowCol?: number;
  readonly flowRow?: number;
  readonly slots?: Record<string, TemplateSlotValue>;
  readonly subsystem?: TemplateSystemScopeSpec;
}

export interface TemplateSystemEdgeSpec {
  readonly id?: string;
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly branch?: string;
}

export interface TemplateSystemScopeSpec {
  readonly id?: string;
  readonly label?: string;
  readonly entry?: string;
  readonly channels?: readonly TemplateSystemChannelSpec[];
  readonly nodes?: readonly TemplateSystemNodeSpec[];
  readonly edges?: readonly TemplateSystemEdgeSpec[];
  readonly note?: string;
}

export interface TemplateSystemSpec extends TemplateSystemScopeSpec {
  readonly id: string;
  readonly label: string;
  readonly template?: string;
  readonly graphSpecVersion?: string;
  readonly strategy?: string;
}
