export interface ArticleProps {
  id?: number;
  url_hash?: string;
  category?: string;
  original_title: string;
  original_url: string;
  image_url?: string;
  source_name: string;
  bias?: string;
  pub_date?: string;
  lens_intensity?: string;
  original_text_dump?: string;
  reframed_headline: string;
  reframed_summary: string;
  article_body?: string;
  cultural_lens_analysis: string;
  historical_context?: string;
  key_takeaways: string[];
  what_this_means_for_us?: string[];
  statistical_data?: {
    title: string;
    type: 'bar' | 'pie';
    data: { name: string; value: number }[];
    reference: string;
  };
  created_at?: string;
}

export interface PaperProps {
  id: string;
  source: string;
  title: string;
  url: string;
  year?: number | null;
  authors: string;
  abstract?: string;
  summary: string;
  category: string;
  pillar: string;
  evidence_tier?: string | null;
  payload?: { doi?: string } | null;
  pub_date?: string;
}

export interface TrendProps {
  id: string;
  title: string;
  summary?: string;
  direction?: string;
  slope?: number | null;
  confidence?: number | null;
  evidence_tier?: string;
  recommended_action?: string;
  source?: string;
  category?: string;
  pub_date?: string;
}

export interface DiscoveryProps {
  id: string;
  title: string;
  insight?: string;
  evidence_tier?: string;
  source?: string;
  category?: string;
  pub_date?: string;
}

export interface MetaphorMappingElement {
  real_world?: string;
  comic_analog?: string;
  explanation?: string;
  confidence?: number;
}

export interface MetaphorPackage {
  topic?: string;
  protocol_id?: string | null;
  core_tension?: string | null;
  mappings: MetaphorMappingElement[];
  beat_structure?: any[];
  codex_scores?: {
    trueness?: number | null;
    flow?: number | null;
    pcs?: number | null;
    overall_fit?: number | null;
    tap?: number | null;
    tap_weights?: any;
  } | null;
  narrative?: string | null;
  lesson?: string | null;
  _unavailable?: boolean;
}

export interface ContentFeedItem {
  type: 'paper' | 'trend' | 'discovery';
  id: string;
  title: string;
  summary?: string;
  item_group?: string;
  link?: string;
  evidence_tier?: string;
  pub_date?: string;
}

export interface FindingProps {
  id: string;
  paper_id?: string | null;
  headline: string;
  kind: string;
  metric?: string;
  value?: string;
  unit?: string;
  reference_claim?: string;
  evidence_tier?: string;
  manifest_hash?: string;
  audit_signature?: string;
  dataset?: string;
  sample_size?: number | null;
  pub_date?: string;
  payload?: Record<string, unknown> | null;
}

export interface DonationStats {
  totalDonations: number;
  settledUsd: number;
}

export interface OncologyOverview {
  finding_of_day: { day: string; finding: FindingProps | null };
  findings: FindingProps[];
  papers: PaperProps[];
  donations: DonationStats;
}
