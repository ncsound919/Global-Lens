export interface ArticleProps {
  id?: number;
  url_hash?: string;
  category?: string;
  original_title: string;
  original_url: string;
  image_url?: string;
  source_name: string;
  original_text_dump?: string;
  reframed_headline: string;
  reframed_summary: string;
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
