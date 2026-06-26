import React, { useState, useEffect } from 'react';
import { Bookmark } from 'lucide-react';
import { ArticleProps } from '../types';

interface BookmarkButtonProps {
  article: ArticleProps;
}

export default function BookmarkButton({ article }: BookmarkButtonProps) {
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    try {
      const savedData = localStorage.getItem('globalLens_saved');
      if (savedData) {
        const savedArticles = JSON.parse(savedData) as ArticleProps[];
        setIsSaved(savedArticles.some(a => a.url_hash === article.url_hash || a.id === article.id));
      }
    } catch (e) {}
  }, [article.url_hash, article.id]);

  const toggleSave = () => {
    try {
      const savedData = localStorage.getItem('globalLens_saved');
      let savedArticles = savedData ? JSON.parse(savedData) as ArticleProps[] : [];
      
      if (isSaved) {
        savedArticles = savedArticles.filter(a => a.url_hash !== article.url_hash && a.id !== article.id);
        setIsSaved(false);
      } else {
        savedArticles = [article, ...savedArticles];
        setIsSaved(true);
      }
      
      localStorage.setItem('globalLens_saved', JSON.stringify(savedArticles));
    } catch (e) {
      console.error('Error saving article', e);
    }
  };

  return (
    <button
      onClick={toggleSave}
      className={`cursor-pointer rounded-full p-2.5 transition-all
        ${isSaved 
          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
          : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-white hover:text-black hover:border-white'}`}
      aria-label={isSaved ? "Remove from saved" : "Save article"}
      title={isSaved ? "Remove from saved" : "Save article"}
    >
      <Bookmark className="w-4 h-4" fill={isSaved ? "currentColor" : "none"} />
    </button>
  );
}
